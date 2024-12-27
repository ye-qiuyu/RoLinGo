const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const BAIDU_API = {
  apiKey: '083tUzHli1NEImaQ56LzwEb4',
  secretKey: 'oEkpSK25CUplU7JCx3Ahvzw0BEzpl5eH',
  accessToken: '',
};

// OpenAI 客户端配置
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.guidaodeng.com/v1',
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
基于以下图像识别结果，请生成一个更自然的描述和场景分类：

识别到的关键词及其置信度：
${keywords.map((kw, i) => `${kw} (${scores[i]})`).join('\n')}

请以 JSON 格式返回以下信息：
1. description: 基于以上关键词的详细场景描述
2. keywords: 3-5个最重要的关键词
3. scene: 场景类型分类
    `;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
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

// 代理图像识别请求
app.post('/api/vision', async (req, res) => {
  try {
    const { image } = req.body;

    // 确保有 access token
    if (!BAIDU_API.accessToken) {
      await getBaiduAccessToken();
    }

    // 调用百度图像识别 API
    const baiduResponse = await axios.post(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${BAIDU_API.accessToken}`,
      `image=${encodeURIComponent(image)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // 提取百度识别的关键词和置信度
    const keywords = baiduResponse.data.result?.map(item => item.keyword) || [];
    const scores = baiduResponse.data.result?.map(item => item.score) || [];

    // 使用 OpenAI 优化结果
    const optimizedResult = await optimizeWithOpenAI(keywords, scores);

    // 返回完整结果
    res.json({
      baidu: baiduResponse.data,
      optimized: optimizedResult
    });
  } catch (error) {
    console.error('图像识别失败:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
}); 