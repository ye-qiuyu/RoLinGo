// CEFR 等级枚举
export enum CEFRLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2'
}

// 系统词汇展示配置
export interface VocabularyDisplayConfig {
  idealTotalKeywords: number;      // 理想总关键词数
  idealAWSKeywords: number;        // 理想AWS关键词数
  idealOpenAIKeywords: number;     // 理想OpenAI关键词数
  maxTotalKeywords: number;        // 最大总关键词数
  awsConfidenceThreshold: number;  // AWS置信度阈值
  maxA1Keywords: number;           // 最大A1词汇数
  maxA2Keywords: number;           // 最大A2词汇数
}

// 难度等级配置
export interface DifficultyConfig {
  id: string;
  name: string;
  level: 'basic' | 'intermediate' | 'advanced';  // 对应 OpenAI 返回的难度级别
  description: string;
  allowedLevels: string[];  // CEFR levels (A1, A2, etc.)
  minConfidence: number;
}

// 词汇信息接口
export interface WordInfo {
  word: string;
  level: CEFRLevel;
  frequency?: number;
} 