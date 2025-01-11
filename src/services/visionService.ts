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
  
  // 首先处理相似关键词组
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
  
  // 然后过滤掉 'person' 关键词
  result = result.filter(item => item.keyword.toLowerCase() !== 'person');
  
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

    const result = await response.json();

    if (!response.ok) {
      // 如果服务器返回了错误信息
      const errorMessage = result.error || `服务器错误 (${response.status})`;
      console.error('服务器返回错误:', result);
      
      // 如果是 OpenAI 错误但有 AWS 结果，仍然返回部分结果
      if (result.aws && result.error === 'OpenAI 处理失败') {
        return {
          description: '抱歉，描述生成失败，但已识别出以下内容',
          keywords: result.aws.result?.map((item: any) => item.keyword) || [],
          scene: '场景分析失败',
          detection: result.aws.result || []
        };
      }
      
      throw new Error(errorMessage);
    }

    if (!result.optimized && !result.aws) {
      console.error('服务器返回的数据格式不正确:', result);
      throw new Error('服务器返回的数据格式不正确');
    }
    
    // 过滤相似关键词
    if (result.aws?.result) {
      result.aws.result = filterSimilarKeywords(result.aws.result);
      console.log('过滤后的 AWS 结果：', result.aws.result);
    }
    
    // 确保 detection 结果也使用过滤后的关键词
    if (result.detection) {
      result.detection = filterSimilarKeywords(result.detection);
    }

    // 获取 AWS 关键词列表
    const awsKeywords = result.aws?.result?.map((item: any) => item.keyword.toLowerCase()) || [];
    
    // 过滤 OpenAI 关键词
    const openaiFiltered = result.optimized ? {
      ...result.optimized,
      keywords: (result.optimized.keywords || []).filter(
        (keyword: string) => !awsKeywords.includes(keyword.toLowerCase())
      )
    } : null;
    
    // 返回完整结果
    return {
      description: openaiFiltered?.description || '描述生成失败',
      keywords: openaiFiltered?.keywords || awsKeywords,
      scene: openaiFiltered?.scene || '场景分析中...',
      detection: result.detection || [],
      openaiFiltered,
      roleDescriptions: result.roleDescriptions || {
        Robot: '描述生成失败',
        RealPerson: '描述生成失败',
        ProProfessor: '描述生成失败',
        SmallTalker: '描述生成失败',
        FunnyBone: '描述生成失败'
      }
    };
  } catch (error) {
    console.error('图片分析过程出错：', error);
    throw error;
  }
}; 