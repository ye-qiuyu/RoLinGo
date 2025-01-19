require('dotenv').config();

// 检查环境变量
console.log('AWS 配置检查：', {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ? '已设置' : '未设置',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? '已设置' : '未设置',
  region: 'us-east-2'
});

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { RekognitionClient, DetectLabelsCommand } = require('@aws-sdk/client-rekognition');

const app = express();

// 确保上传目录存在并设置正确的权限
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
}

// 配置 multer
const upload = multer({ 
  dest: uploadsDir,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

// 配置 CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// OpenAI 客户端配置
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.guidaodeng.com/v1',
  dangerouslyAllowBrowser: true,
});

// AWS Rekognition 客户端配置
const rekognitionClient = new RekognitionClient({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  maxAttempts: 3, // 添加重试
  retryMode: 'adaptive'
});

// 添加验证函数
async function validateAWSCredentials() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS 凭证未设置');
  }
  
  console.log('开始验证 AWS 凭证...');
  console.log('Access Key ID 长度:', process.env.AWS_ACCESS_KEY_ID.length);
  console.log('Secret Access Key 长度:', process.env.AWS_SECRET_ACCESS_KEY.length);
  
  try {
    // 尝试一个简单的 AWS 操作来验证凭证
    const params = {
      Image: {
        Bytes: Buffer.from('test')
      },
      MaxLabels: 1,
      MinConfidence: 70
    };
    
    console.log('发送测试请求到 AWS Rekognition...');
    const command = new DetectLabelsCommand(params);
    await rekognitionClient.send(command);
  } catch (error) {
    console.error('AWS 错误详情:', {
      name: error.name,
      message: error.message,
      code: error.code,
      requestId: error.$metadata?.requestId
    });
    
    if (error.name === 'UnrecognizedClientException') {
      throw new Error('AWS 凭证无效，请检查 Access Key 和 Secret Key');
    }
    // 如果是其他错误（比如图片格式错误），说明凭证是有效的
    console.log('AWS 凭证验证成功');
  }
}

// 在服务器启动时验证凭证
validateAWSCredentials().catch(error => {
  console.error('AWS 凭证验证失败:', error.message);
});

// 添加 tryParseResponse 函数
async function tryParseResponse(content) {
  try {
    // 尝试直接解析
    return JSON.parse(content);
  } catch (e) {
    // 尝试提取 JSON 部分
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

// 使用 OpenAI 优化结果
async function optimizeWithOpenAI(keywords, scores, base64Image, role = 'RealPerson') {
  try {
    const roleStyles = {
      Robot: {
        style: "You are an AI assistant. Share a quick technical observation about something that catches your sensors' attention in this scene.",
        example: "Ambient lighting analysis: 750 lumens detected from decorative illumination, creating optimal 92% visibility comfort ratio for human occupants."
      },
      RealPerson: {
        style: "You're chatting with a friend. Share a quick, natural reaction as if you just walked into this scene.",
        example: "Oh my gosh, I'm loving the cozy vibes in here! Makes me want to grab a hot chocolate and never leave."
      },
      ProProfessor: {
        style: "You're a cultural anthropology professor who just noticed something interesting. Share a quick academic observation about this scene.",
        example: "Fascinating how this space exemplifies modern urban cafe culture's reinterpretation of traditional holiday aesthetics."
      },
      SmallTalker: {
        style: "You're a friendly person who loves starting conversations. Share your excitement about something you notice in this scene!",
        example: "Isn't it amazing how they've decorated this place for the holidays? Totally puts you in the festive mood!"
      },
      FunnyBone: {
        style: "You're a witty person who loves making clever observations. Share a humorous comment about something in this scene.",
        example: "With all these sparkly decorations, my coffee's feeling a bit underdressed - might need to add some glitter to my latte!"
      }
    };

    const selectedRole = roleStyles[role] || roleStyles.RealPerson;

    // 构建提示词
    const prompt = base64Image ? `${selectedRole.style}

I'll show you an image. Imagine you're actually there in this scene.

Important:
1. Share a quick, natural reaction (1-2 sentences max)
2. React as if you're really there, speaking in the moment
3. Focus on whatever interests your character most
4. Keep it casual and conversational, like real speech
5. Stay true to your character's personality

Please provide your response in this JSON format:
{
  "description": "Your quick, natural reaction",
  "keywords": ["3-5 key elements from the scene"],
  "scene": "A simple label for the setting"
}` :
      // 如果没有图片（角色切换时），使用更简单的提示词
      `${selectedRole.style}

Share a quick, natural reaction to this scene.
Return in this JSON format:
{
  "description": "Your quick, natural reaction"
}`;

    // 构建消息
    const messages = base64Image ? [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: base64Image
            }
          }
        ],
      }
    ] : [
      {
        role: 'user',
        content: prompt
      }
    ];

    // 调用 OpenAI API
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: base64Image ? 1000 : 500,
      temperature: 0.7,
    });

    let content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI 返回内容为空');
    }

    // 尝试解析返回内容
    let result = await tryParseResponse(content);
    
    // 如果解析失败，尝试修复格式
    if (!result) {
      console.log('首次返回格式不正确，尝试修复...');
      const formatPrompt = `
请将以下内容转换为合法的 JSON 格式，保持原有的创造性描述不变：

${content}

请严格按照以下格式返回：
{
  "description": "场景描述",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "scene": "场景类型"
}`;

      const formatResponse = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: formatPrompt }],
        max_tokens: 500,
        temperature: 0.5,
      });

      content = formatResponse.choices[0]?.message?.content;
      result = await tryParseResponse(content);
      
      if (!result) {
        throw new Error('无法解析 OpenAI 返回的格式');
      }
    }

    return result;
  } catch (error) {
    console.error('OpenAI 处理失败:', error);
    throw new Error(`OpenAI 处理失败: ${error.message}`);
  }
}

// 调用 AWS Rekognition API 进行物体检测
async function detectObjects(image) {
  try {
    // 处理 base64 图片数据
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    console.log('图片处理信息：', {
      原始长度: image.length,
      处理后长度: imageBuffer.length,
      是否为Buffer: Buffer.isBuffer(imageBuffer)
    });

    // 如果图片大于 5MB，需要压缩
    let finalImageBuffer = imageBuffer;
    if (imageBuffer.length > 5 * 1024 * 1024) {
      console.log('图片超过 5MB，开始压缩...');
      
      // 使用 Python 进行压缩
      const compressProcess = spawn('python3', [
        '-c',
        `
import sys
from PIL import Image
import io

try:
    # 从标准输入读取图片数据
    image_data = sys.stdin.buffer.read()
    
    # 打开图片
    image = Image.open(io.BytesIO(image_data))
    
    # 计算新的尺寸，保持宽高比
    max_size = 2048
    ratio = min(max_size / image.width, max_size / image.height)
    new_size = (int(image.width * ratio), int(image.height * ratio))
    
    # 调整图片大小
    image = image.resize(new_size, Image.Resampling.LANCZOS)
    
    # 保存到内存中
    output = io.BytesIO()
    image.save(output, format='JPEG', quality=85)
    
    # 写入标准输出
    sys.stdout.buffer.write(output.getvalue())
    sys.exit(0)
except Exception as e:
    print('压缩错误:', str(e), file=sys.stderr)
    sys.exit(1)
        `
      ]);

      // 写入图片数据
      compressProcess.stdin.write(imageBuffer);
      compressProcess.stdin.end();

      // 收集压缩后的数据
      const chunks = [];
      compressProcess.stdout.on('data', (chunk) => chunks.push(chunk));

      // 等待压缩完成
      await new Promise((resolve, reject) => {
        compressProcess.on('close', (code) => {
          if (code === 0) {
            finalImageBuffer = Buffer.concat(chunks);
            console.log('压缩后的图片大小:', finalImageBuffer.length);
            resolve();
          } else {
            reject(new Error('图片压缩失败'));
          }
        });
      });
    }

    // 准备 AWS Rekognition 请求参数
    const params = {
      Image: {
        Bytes: finalImageBuffer
      },
      MaxLabels: 50,
      MinConfidence: 70
    };

    // 调用 AWS Rekognition
    const command = new DetectLabelsCommand(params);
    const response = await rekognitionClient.send(command);

    console.log('AWS Rekognition 原始结果:', JSON.stringify(response, null, 2));

    // 转换结果为标准格式
    const result = {
      result: response.Labels.map(label => {
        // 如果有边界框，使用第一个边界框的位置
        const instance = label.Instances && label.Instances[0];
        const location = instance ? instance.BoundingBox : null;
        
        return {
          keyword: label.Name,
          score: label.Confidence / 100, // 转换为 0-1 范围
          location: location ? {
            left: location.Left * 100,   // 转换为百分比
            top: location.Top * 100,
            width: location.Width * 100,
            height: location.Height * 100
          } : null
        };
      }).filter(item => item.location !== null) // 只保留有位置信息的结果
    };

    console.log('处理后的检测结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('AWS Rekognition 检测失败:', error);
    if (error.name === 'InvalidImageFormatException') {
      console.error('图片格式无效，请确保是有效的图片文件');
    }
    throw error;
  }
}

// 代理图像识别请求
app.post('/api/vision', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: '请求中没有图片数据' });
    }

    let awsResult = null;
    let openaiResult = null;

    // 先尝试 AWS 识别
    try {
      awsResult = await detectObjects(image);
      console.log('AWS 识别成功:', awsResult);
    } catch (awsError) {
      console.error('AWS 识别失败:', awsError);
      // AWS 失败不影响整体流程
    }

    // 提取关键词和置信度
    const keywords = awsResult?.result?.map(item => item.keyword) || [];
    const scores = awsResult?.result?.map(item => item.score) || [];

    // 然后尝试 OpenAI 处理
    try {
      openaiResult = await optimizeWithOpenAI(keywords, scores, image);
      console.log('OpenAI 处理成功:', openaiResult);
    } catch (openaiError) {
      console.error('OpenAI 处理失败:', openaiError);
      return res.status(500).json({
        error: 'OpenAI 处理失败',
        details: openaiError.message,
        aws: awsResult
      });
    }

    // 返回完整结果
    res.json({
      aws: awsResult,
      detection: awsResult?.result || [],
      optimized: openaiResult
    });
  } catch (error) {
    console.error('请求处理失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 添加翻译 API 端点
app.post('/api/translate', async (req, res) => {
  try {
    const { keywords } = req.body;
    
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: '关键词列表不能为空' });
    }

    // 构建 OpenAI 的提示
    const prompt = `请将以下英文关键词翻译成中文，保持专业准确性。
关键词列表：${keywords.join(', ')}

请以 JSON 数组格式返回结果，每个元素包含 en 和 zh 字段，例如：
[
  { "en": "example", "zh": "示例" }
]`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    console.log('OpenAI 原始响应:', content);

    // 尝试解析 JSON 响应
    let translations;
    try {
      translations = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON 解析错误:', parseError);
      console.error('原始内容:', content);
      // 如果解析失败，尝试提取 JSON 部分
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          translations = JSON.parse(jsonMatch[0]);
        } catch (secondError) {
          throw new Error('无法解析翻译结果');
        }
      } else {
        throw new Error('响应格式不正确');
      }
    }
    
    console.log('翻译结果：', translations);
    res.json(translations);
  } catch (error) {
    console.error('翻译失败：', error);
    console.error('错误详情：', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json({ 
      error: error.message,
      details: {
        name: error.name,
        message: error.message,
        response: error.response?.data
      }
    });
  }
});

// HEIC 转换路由
app.post('/api/convert-heic', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有收到文件' });
  }

  try {
    console.log('收到文件:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    const inputPath = req.file.path;
    const outputPath = path.join(uploadsDir, `${Date.now()}.jpg`);

    // 使用 Python 脚本进行转换
    const pythonProcess = spawn('python3', [
      '-c',
      `
import os
import sys
from PIL import Image
from pillow_heif import register_heif_opener
import imghdr

try:
    print('Python: 开始处理文件')
    print('Python: 输入文件路径:', '${inputPath}')
    print('Python: 输出文件路径:', '${outputPath}')
    
    # 检查文件是否存在
    if not os.path.exists('${inputPath}'):
        raise Exception(f"输入文件不存在: {inputPath}")
    
    # 检查文件大小
    file_size = os.path.getsize('${inputPath}')
    print('Python: 输入文件大小:', file_size, '字节')
    
    # 注册 HEIF 打开器
    register_heif_opener()
    print('Python: HEIF opener 注册成功')
    
    # 检测实际的文件类型
    file_type = imghdr.what('${inputPath}')
    print('Python: 检测到的文件类型:', file_type)
    
    # 尝试打开文件
    image = Image.open('${inputPath}')
    print('Python: 文件打开成功，格式:', image.format)
    print('Python: 图片尺寸:', image.size)
    
    # 保存为 JPEG
    image.save('${outputPath}', format="JPEG", quality=95)
    print('Python: 文件保存成功')
    print('Python: 输出文件大小:', os.path.getsize('${outputPath}'), '字节')
    
    sys.exit(0)
except Exception as e:
    print('Python错误:', str(e), file=sys.stderr)
    sys.exit(1)
      `
    ]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data;
      console.log(`Python输出: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data;
      console.error(`Python错误: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Python转换成功，准备读取文件');
        try {
          // 检查输出文件是否存在
          if (!fs.existsSync(outputPath)) {
            throw new Error('输出文件不存在');
          }

          // 读取转换后的文件并发送
          const jpegBuffer = fs.readFileSync(outputPath);
          console.log('文件读取成功，大小:', jpegBuffer.length);
          res.set('Content-Type', 'image/jpeg');
          res.send(jpegBuffer);
          
          // 清理临时文件
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);
          console.log('临时文件清理完成');
        } catch (error) {
          console.error('文件处理错误:', error);
          res.status(500).json({ 
            error: '文件处理失败',
            details: error.message
          });
        }
      } else {
        console.error('Python进程退出码:', code);
        console.error('Python错误输出:', stderrData);
        res.status(500).json({ 
          error: 'HEIC转换失败',
          details: stderrData
        });
        // 清理临时文件
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      }
    });
  } catch (error) {
    console.error('转换过程出错:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      error: '图片转换失败',
      details: error.message
    });
    
    // 确保清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// 添加角色切换路由
app.post('/api/switch-role', async (req, res) => {
  try {
    const { keywords, scores, role, imageData } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: '未指定角色' });
    }

    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: '关键词数据无效' });
    }

    // 使用 OpenAI 根据新角色重新生成描述
    const result = await optimizeWithOpenAI(keywords, scores || [], null, role);
    
    res.json({
      description: result.description || '',
      role: role
    });
  } catch (error) {
    console.error('角色切换失败:', error);
    res.status(500).json({ 
      error: '角色切换失败',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
}); 