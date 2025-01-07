import { VisionAnalysisResult } from '../types';

interface TranslatedKeyword {
  en: string;
  zh: string;
}

export class TranslationService {
  private translations: Map<string, string> = new Map();

  async translateKeywords(result: VisionAnalysisResult): Promise<Map<string, string>> {
    // 收集所有需要翻译的关键词
    const keywords = new Set<string>();
    
    // 添加 AWS 检测关键词
    result.detection?.forEach(item => {
      keywords.add(item.keyword);
    });

    // 添加 OpenAI 关键词
    result.keywords.forEach(keyword => {
      keywords.add(keyword);
    });

    // 将关键词列表转换为数组
    const keywordsList = Array.from(keywords);

    try {
      // 调用后端 API 进行翻译
      const response = await fetch('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords: keywordsList }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('翻译服务错误详情:', errorData);
        throw new Error(`翻译服务错误: ${errorData.error}\n详情: ${JSON.stringify(errorData.details)}`);
      }

      const translatedResults = await response.json();
      
      // 更新翻译映射
      translatedResults.forEach((item: TranslatedKeyword) => {
        this.translations.set(item.en, item.zh);
      });

      return this.translations;
    } catch (error) {
      console.error('翻译过程出错：', error);
      throw error;
    }
  }

  // 获取某个英文关键词的中文翻译
  getTranslation(keyword: string): string {
    return this.translations.get(keyword) || keyword;
  }
}

// 创建单例实例
export const translationService = new TranslationService(); 