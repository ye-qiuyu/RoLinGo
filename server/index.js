require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');

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

const BAIDU_API = {
  apiKey: process.env.BAIDU_API_KEY,
  secretKey: process.env.BAIDU_SECRET_KEY,
  accessToken: '',
};

// OpenAI 客户端配置
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.guidaodeng.com/v1',
  dangerouslyAllowBrowser: true,
});

// 获取百度 access token
async function getBaiduAccessToken() {
  try {
    const response = await axios.post(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API.apiKey}&client_secret=${BAIDU_API.secretKey}`
    );
    BAIDU_API.accessToken = response.data.access_token;
    return BAIDU_API.accessToken;
  } catch (error) {
    console.error('获取百度 access token 失败:', error);
    throw error;
  }
}

// 使用 OpenAI 优化结果
async function optimizeWithOpenAI(keywords, scores) {
  try {
    const prompt = `
作为一个专业的图像描述专家，请基于以下图像识别结果，生成一个详细、生动且自然的场景描述：

识别到的关键词及其置信度：
${keywords.map((kw, i) => `${kw} (${scores[i]})`).join('\n')}

请以 JSON 格式返回以下信息：
1. description: 请提供一段流畅的场景描述，需要：
   - 从最显著的视觉元素开始描述
   - 包含环境、氛围、动作或状态
   - 使用具体而生动的形容词
   - 避免重复用语和不确定的表述
2. keywords: 3-5个最重要的关键词，按重要性排序，可以包括：
   - 主要物体/人物
   - 场景特征
   - 显著的视觉元素
   - 氛围或情感特征
3. scene: 一个简洁而准确的场景类型分类

请确保描述自然流畅，避免机械化的罗列，让描述更有画面感和生命力。`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7, // 添加一些创造性，但保持合理范围
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    // 清理 Markdown 格式，只保留 JSON 内容
    const jsonContent = content.replace(/```json\n|\n```/g, '');
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('OpenAI 处理失败:', error);
    throw error;
  }
}

// 调用百度物体检测 API
async function detectObjects(image) {
  try {
    // 确保有 access token
    if (!BAIDU_API.accessToken) {
      await getBaiduAccessToken();
    }

    console.log('开始调用百度多主体检测 API...');

    // 调用多主体检测 API
    const multiObjectResponse = await axios.post(
      `https://aip.baidubce.com/rest/2.0/image-classify/v1/multi_object_detect?access_token=${BAIDU_API.accessToken}`,
      `image=${encodeURIComponent(image)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('多主体检测原始结果:', JSON.stringify(multiObjectResponse.data, null, 2));

    // 调用通用物体识别 API 获取详细的物体类别信息
    const classifyResponse = await axios.post(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${BAIDU_API.accessToken}`,
      `image=${encodeURIComponent(image)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('物体识别原始结果:', JSON.stringify(classifyResponse.data, null, 2));

    // 获取图片尺寸（从第一个检测结果中）
    const detectedObjects = multiObjectResponse.data.result || [];
    const firstObject = detectedObjects[0] || {};
    const imageWidth = firstObject.location?.width + firstObject.location?.left || 1000;
    const imageHeight = firstObject.location?.height + firstObject.location?.top || 1000;

    // 转换结果为标准格式
    const result = {
      result: detectedObjects.map(obj => {
        const location = obj.location || {};
        return {
          keyword: obj.name,
          score: obj.score,
          location: {
            left: (location.left / imageWidth) * 100,
            top: (location.top / imageHeight) * 100,
            width: (location.width / imageWidth) * 100,
            height: (location.height / imageHeight) * 100
          }
        };
      })
    };

    console.log('处理后的检测结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('物体检测失败:', error);
    console.error('错误详情:', error.response?.data || error.message);
    throw error;
  }
}

// 代理图像识别请求
app.post('/api/vision', async (req, res) => {
  try {
    const { image } = req.body;

    console.log('开始处理图像识别请求...');

    // 调用百度 API 进行识别
    const detectionResult = await detectObjects(image);
    
    // 提取关键词和置信度
    const keywords = detectionResult.result?.map(item => item.keyword) || [];
    const scores = detectionResult.result?.map(item => item.score) || [];

    console.log('识别到的关键词:', keywords);
    console.log('对应的置信度:', scores);

    // 使用 OpenAI 优化结果
    const optimizedResult = await optimizeWithOpenAI(keywords, scores);

    // 返回完整结果
    const result = {
      baidu: detectionResult,
      detection: detectionResult.result || [],
      optimized: optimizedResult
    };

    console.log('最终返回结果:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('图像处理失败:', error);
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