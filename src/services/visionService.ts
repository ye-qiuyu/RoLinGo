import { VisionAnalysisResult } from '../types';

export const analyzeImage = async (base64Image: string): Promise<VisionAnalysisResult> => {
  try {
    console.log('开始图片分析流程...');
    
    // 调用后端 API 进行图像分析
    const response = await fetch('http://localhost:3000/api/vision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // 格式化 AWS Rekognition 结果
    console.log('\n=== AWS Rekognition 识别结果 ===');
    console.log('识别的关键词及置信度：');
    result.aws.result.forEach((item: any) => {
      console.log(`- ${item.keyword} (置信度: ${item.score})`);
    });
    
    // 格式化 OpenAI 优化结果
    console.log('\n=== OpenAI 优化结果 ===');
    console.log('场景描述：', result.optimized.description);
    console.log('关键词：', result.optimized.keywords.join(', '));
    console.log('场景类型：', result.optimized.scene);
    console.log('================\n');
    
    // 返回完整结果
    return {
      ...result.optimized,
      detection: result.detection
    };
  } catch (error) {
    console.error('图片分析过程出错：', error);
    throw error;
  }
}; 