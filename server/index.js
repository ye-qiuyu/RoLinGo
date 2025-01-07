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
const { RekognitionClient, DetectLabelsCommand } = require('@aws-sdk/client-rekognition');

const app = express();

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
  }
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

// 使用 OpenAI 优化结果
async function optimizeWithOpenAI(keywords, scores, base64Image) {
  try {
    const prompt = `As a professional image description expert, please analyze this image.

${keywords.length > 0 ? `
Keywords and confidence scores detected by AWS:
${keywords.map((kw, i) => `${kw} (${scores[i]})`).join('\n')}
` : ''}

Please carefully observe the image content and combine your observations${keywords.length > 0 ? ' with the keywords above' : ''} to return the following information in JSON format:
1. description: Provide a fluent scene description that:
   - Starts with the most prominent visual elements
   - Includes environment, atmosphere, actions, or states
   - Uses specific and vivid adjectives
   - Avoids repetitive language and uncertain expressions
2. keywords: 3-5 most important keywords, ordered by importance, including:
   - Main objects/subjects
   - Scene characteristics
   - Prominent visual elements
   - Atmosphere or emotional features
3. scene: A concise and accurate scene type classification

Please ensure the description flows naturally, avoiding mechanical listing, and make it more vivid and lively.
Note: The response must be in valid JSON format, starting with { and ending with }.`;

    async function tryParseResponse(content) {
      try {
        // 尝试提取 JSON 部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    async function retryWithFormat(originalContent) {
      const formatPrompt = `
请将以下内容转换为合法的 JSON 格式，保持原有的创造性描述不变：

${originalContent}

请严格按照以下格式返回：
{
  "description": "场景描述",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "scene": "场景类型"
}`;

      const formatResponse = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: formatPrompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.5,
      });

      return formatResponse.choices[0]?.message?.content;
    }

    // 第一次尝试，直接使用图片
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
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
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    let content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    // 尝试解析返回内容
    let result = await tryParseResponse(content);
    
    // 如果解析失败，尝试修复格式
    if (!result) {
      console.log('首次返回格式不正确，尝试修复...');
      const formattedContent = await retryWithFormat(content);
      result = await tryParseResponse(formattedContent);
      
      if (!result) {
        throw new Error('Failed to parse response after retry');
      }
    }

    return result;
  } catch (error) {
    console.error('OpenAI 处理失败:', error);
    throw error;
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

    // 准备 AWS Rekognition 请求参数
    const params = {
      Image: {
        Bytes: imageBuffer
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
      console.error('请求中没有图片数据');
      return res.status(400).json({ error: '请求中没有图片数据' });
    }

    console.log('开始处理图像识别请求...');
    console.log('图片数据长度:', image.length);

    // 调用 AWS Rekognition 进行识别
    const detectionResult = await detectObjects(image);
    
    // 提取关键词和置信度
    const keywords = detectionResult.result?.map(item => item.keyword) || [];
    const scores = detectionResult.result?.map(item => item.score) || [];

    console.log('识别到的关键词:', keywords);
    console.log('对应的置信度:', scores);

    // 使用 OpenAI 优化结果，传入原始图片数据
    const optimizedResult = await optimizeWithOpenAI(keywords, scores, image);

    // 返回完整结果
    const result = {
      aws: detectionResult,
      detection: detectionResult.result || [],
      optimized: optimizedResult
    };

    console.log('最终返回结果:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('图像处理失败:', error);
    console.error('错误堆栈:', error.stack);
    if (error.response) {
      console.error('错误响应:', error.response.data);
    }
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
}); 