import { VocabularyDisplayConfig, DifficultyConfig, CEFRLevel } from '../types/vocabulary';

// 系统词汇展示配置
export const VOCABULARY_DISPLAY_CONFIG: VocabularyDisplayConfig = {
  idealTotalKeywords: 5,
  idealAWSKeywords: 2,
  idealOpenAIKeywords: 3,
  maxTotalKeywords: 6,
  awsConfidenceThreshold: 0.5,
  maxA1Keywords: 3,
  maxA2Keywords: 3
};

// 预定义难度等级
export const DIFFICULTY_LEVELS: DifficultyConfig[] = [
  {
    id: 'beginner',
    name: '初学者',
    level: 'basic',
    description: '适合英语初学者，使用基础词汇',
    allowedLevels: ['A1', 'A2'],
    minConfidence: 0.5
  },
  {
    id: 'intermediate',
    name: '中级',
    level: 'intermediate',
    description: '适合中级英语学习者，使用中等难度词汇',
    allowedLevels: ['B1', 'B2'],
    minConfidence: 0.5
  },
  {
    id: 'advanced',
    name: '高级',
    level: 'advanced',
    description: '适合高级英语学习者，使用高级词汇',
    allowedLevels: ['B2', 'C1', 'C2'],
    minConfidence: 0.5
  }
]; 