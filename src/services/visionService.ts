import { VisionAnalysisResult, Detection } from '../types';
import { VocabularyService } from './vocabularyService';
import { DIFFICULTY_LEVELS, VOCABULARY_DISPLAY_CONFIG } from '../config/vocabularyConfig';

// 创建单例实例
const vocabularyService = new VocabularyService();
let currentDifficulty = DIFFICULTY_LEVELS.find(level => level.id === 'intermediate')!;

// 定义相似关键词组
const SIMILAR_KEYWORDS_GROUPS = [
  ['Adult', 'Person', 'Human', 'Female', 'Woman', 'Girl', 'Lady', 'Male', 'Man', 'Boy', 'Gentleman'],
  ['Weapon', 'Gun', 'Rifle', 'Firearm'],
  ['Building', 'House', 'Room', 'Indoor'],
];

// 过滤相似关键词，只保留每组中置信度最高的一个
const filterSimilarKeywords = (items: Detection[]) => {
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

// 初始化词汇服务
export const initializeVocabularyService = async () => {
  await vocabularyService.loadWordList();
};

// 设置难度等级
export const setDifficultyLevel = (levelId: string) => {
  const newLevel = DIFFICULTY_LEVELS.find(level => level.id === levelId);
  if (newLevel) {
    currentDifficulty = newLevel;
  } else {
    console.warn(`未找到难度等级: ${levelId}, 使用当前难度等级`);
  }
};

// 保持原有的 analyzeImage 函数
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
      // 尝试获取详细的错误信息
      const errorData = await response.json().catch(() => null);
      console.error('服务器错误详情:', errorData);
      throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    
    // 验证返回的数据结构
    if (!result.aws?.result || !result.optimized?.keywords) {
      console.error('返回数据结构不完整:', result);
      throw new Error('服务器返回的数据结构不完整');
    }
    
    // 首先过滤相似关键词
    console.log('原始 AWS 结果：', result.aws.result);
    const filteredAWSResult = filterSimilarKeywords(result.aws.result);
    console.log('过滤相似关键词后的 AWS 结果：', filteredAWSResult);

    // 使用词汇服务处理关键词
    console.log('原始 OpenAI 关键词：', result.optimized.keywords);
    console.log('原始 OpenAI 描述：', result.optimized.descriptions);

    const processedKeywords = vocabularyService.processKeywords(
      filteredAWSResult,
      result.optimized.keywords || [],  // 确保传入数组
      currentDifficulty
    );

    console.log('处理后的 AWS 关键词：', processedKeywords.awsKeywords);
    console.log('处理后的 OpenAI 关键词：', processedKeywords.openaiKeywords);
    
    // 返回处理后的结果
    return {
      description: result.optimized.descriptions[currentDifficulty.level],
      keywords: processedKeywords.openaiKeywords,
      scene: result.optimized.scene,
      detection: processedKeywords.awsKeywords,
      openaiFiltered: {
        description: result.optimized.descriptions[currentDifficulty.level],
        keywords: processedKeywords.openaiKeywords,
        scene: result.optimized.scene
      },
      allLevels: {
        descriptions: result.optimized.descriptions,
        keywords: result.optimized.keywords
      }
    };
  } catch (error) {
    console.error('图片分析过程出错：', error);
    if (error instanceof Error) {
      console.error('错误堆栈：', error.stack);
      console.error('错误消息：', error.message);
    }
    throw error;
  }
}; 