import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  baseURL: 'https://api.guidaodeng.com/v1',
  dangerouslyAllowBrowser: true
});

export interface VisionAnalysisResult {
  description: string;
  keywords: string[];
  scene: string;
}

export const analyzeImage = async (base64Image: string): Promise<VisionAnalysisResult> => {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请分析这张图片，并以JSON格式返回以下信息：\n1. description: 详细的场景描述\n2. keywords: 关键词列表（3-5个）\n3. scene: 场景类型',
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    // 解析返回的JSON字符串
    const result = JSON.parse(content);
    return {
      description: result.description || '',
      keywords: result.keywords || [],
      scene: result.scene || '',
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
}; 