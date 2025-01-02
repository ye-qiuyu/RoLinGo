import { VisionAnalysisResult } from '../types';

// 定义相似关键词组
const SIMILAR_KEYWORDS_GROUPS = [
  ['Adult', 'Person', 'Human', 'Female', 'Woman', 'Girl', 'Lady', 'Male', 'Man', 'Boy', 'Gentleman'],
  ['Weapon', 'Gun', 'Rifle', 'Firearm'],
  ['Building', 'House', 'Room', 'Indoor'],
];

// 过滤相似关键词，只保留每组中置信度最高的一个
const filterSimilarKeywords = (items: any[]) => {
  console.log('开始过滤相似关键词，原始关键词：', items);
  let result = [...items];
  
  SIMILAR_KEYWORDS_GROUPS.forEach(group => {
    // 找出当前组中所有匹配的关键词
    const matchingItems = result.filter(item => 
      group.includes(item.keyword)
    );
    
    console.log(`检查关键词组 ${group.join(', ')} 的匹配项:`, matchingItems);
    
    if (matchingItems.length > 1) {
      // 找出组内置信度最高的项
      const highestConfidenceItem = matchingItems.reduce((prev, current) => 
        prev.score > current.score ? prev : current
      );
      
      console.log(`组内最高置信度项:`, highestConfidenceItem);
      
      // 创建新的结果数组，只包含非匹配项和最高置信度项
      result = result.filter(item => 
        !matchingItems.includes(item) || item === highestConfidenceItem
      );
    }
  });
  
  console.log('过滤后的关键词：', result);
  return result;
};

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
    
    // 过滤相似关键词
    console.log('原始 AWS 结果：', result.aws.result);
    result.aws.result = filterSimilarKeywords(result.aws.result);
    console.log('过滤后的 AWS 结果：', result.aws.result);
    
    // 确保 detection 结果也使用过滤后的关键词
    if (result.detection) {
      result.detection = filterSimilarKeywords(result.detection);
    }
    
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