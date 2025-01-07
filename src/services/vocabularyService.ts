import { WordInfo, DifficultyConfig } from '../types/vocabulary';
import { Detection } from '../types';
import { VOCABULARY_DISPLAY_CONFIG } from '../config/vocabularyConfig';

interface WordEntry {
  word: string;
  type: string;
  level: string;
}

export class VocabularyService {
  private wordList: Map<string, WordEntry[]> = new Map();

  // 加载词汇表
  async loadWordList() {
    try {
      console.log('开始加载词汇表...');
      const response = await fetch('/vocabulary/full-word.json');
      
      if (!response.ok) {
        console.error('加载词汇表失败，HTTP状态:', response.status);
        console.error('响应URL:', response.url);
        throw new Error(`HTTP error! status: ${response.status}, url: ${response.url}`);
      }
      
      const text = await response.text();
      
      try {
        const data = JSON.parse(text) as Array<{
          id: number;
          value: {
            word: string;
            type: string;
            level: string;
          };
        }>;
        
        // 将数组转换为 Map，同一个单词可能有多个词性和等级
        const normalizedData = new Map<string, WordEntry[]>();
        
        data.forEach(item => {
          const word = item.value.word.toLowerCase();
          const entry: WordEntry = {
            word: word,
            type: item.value.type,
            level: item.value.level.toUpperCase()
          };
          
          if (normalizedData.has(word)) {
            normalizedData.get(word)!.push(entry);
          } else {
            normalizedData.set(word, [entry]);
          }
        });
        
        this.wordList = normalizedData;
        console.log('词汇表加载成功，总词数：', this.wordList.size);
        
      } catch (parseError: unknown) {
        console.error('词汇表解析失败:', parseError);
        throw parseError;
      }
    } catch (error: unknown) {
      console.error('加载词汇表失败：', error);
      throw error;
    }
  }

  // 获取单词的 CEFR 等级
  private getWordLevel(word: string): string {
    if (!this.wordList || this.wordList.size === 0) {
      console.error('词汇表未加载或为空');
      return 'Unknown';
    }

    console.log(`获取单词 "${word}" 的 CEFR 等级`);
    const normalizedWord = word.toLowerCase();
    
    // 1. 直接匹配
    let entries = this.wordList.get(normalizedWord);
    if (entries) {
      // 如果有多个词性，选择最低难度等级
      const levels = entries.map(entry => entry.level);
      const difficultyOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      levels.sort((a, b) => difficultyOrder.indexOf(a) - difficultyOrder.indexOf(b));
      console.log(`找到多个等级: ${levels.join(', ')}, 选择最低等级: ${levels[0]}`);
      return levels[0];
    }
    
    // 2. 处理单复数和时态变化
    const wordVariations = this.getWordVariations(normalizedWord);
    for (const variation of wordVariations) {
      entries = this.wordList.get(variation);
      if (entries) {
        const levels = entries.map(entry => entry.level);
        const difficultyOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        levels.sort((a, b) => difficultyOrder.indexOf(a) - difficultyOrder.indexOf(b));
        console.log(`变形 "${variation}" 匹配到等级: ${levels[0]}`);
        return levels[0];
      }
    }
    
    // 3. 处理复合词
    const words = normalizedWord
      .replace(/-/g, ' ')
      .split(' ')
      .filter(w => w.length > 0);
    
    if (words.length > 1) {
      console.log(`处理复合词: ${words.join(', ')}`);
      const wordLevels = words.map(w => {
        const variations = this.getWordVariations(w);
        for (const variation of variations) {
          const entries = this.wordList.get(variation);
          if (entries) {
            const levels = entries.map(entry => entry.level);
            const difficultyOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
            levels.sort((a, b) => difficultyOrder.indexOf(a) - difficultyOrder.indexOf(b));
            return levels[0];
          }
        }
        return 'Unknown';
      });
      
      const validLevels = wordLevels.filter(level => level !== 'Unknown');
      if (validLevels.length > 0) {
        const difficultyOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        validLevels.sort((a, b) => difficultyOrder.indexOf(b) - difficultyOrder.indexOf(a));
        console.log(`复合词最终等级: ${validLevels[0]}`);
        return validLevels[0];
      }
    }
    
    console.log(`未找到匹配的等级，返回 Unknown`);
    return 'Unknown';
  }

  // 获取单词的所有可能变形
  private getWordVariations(word: string): string[] {
    const variations = new Set<string>();
    variations.add(word);
    
    // 1. 处理以 s 结尾的情况
    if (word.endsWith('s')) {
      // 处理 -ies 结尾
      if (word.endsWith('ies')) {
        variations.add(word.slice(0, -3) + 'y');
      }
      // 处理 -es 结尾
      else if (word.endsWith('es')) {
        variations.add(word.slice(0, -2));
        variations.add(word.slice(0, -1));
        // 特殊情况：glasses -> glass
        if (word === 'glasses') {
          variations.add('glass');
        }
      }
      // 普通的 -s 结尾
      else {
        variations.add(word.slice(0, -1));
      }
    }
    
    // 2. 处理 -ing 结尾
    if (word.endsWith('ing')) {
      const base = word.slice(0, -3);
      variations.add(base);
      variations.add(base + 'e');  // write -> writing
      if (base.length > 0 && base[base.length - 1] === base[base.length - 2]) {
        variations.add(base.slice(0, -1));  // running -> run
      }
    }
    
    // 3. 处理 -ed 结尾
    if (word.endsWith('ed')) {
      const base = word.slice(0, -2);
      variations.add(base);
      variations.add(base + 'e');  // used -> use
      if (base.length > 0 && base[base.length - 1] === base[base.length - 2]) {
        variations.add(base.slice(0, -1));  // planned -> plan
      }
    }
    
    // 4. 处理连字符变体
    if (word.includes('-')) {
      variations.add(word.replace(/-/g, ''));  // black-board -> blackboard
      variations.add(word.replace(/-/g, ' '));  // black-board -> black board
    }
    
    // 5. 处理空格变体
    if (word.includes(' ')) {
      variations.add(word.replace(/ /g, ''));  // black board -> blackboard
      variations.add(word.replace(/ /g, '-'));  // black board -> black-board
    }
    
    console.log(`单词 "${word}" 的所有变形:`, Array.from(variations));
    return Array.from(variations);
  }

  // 处理 AWS 关键词
  private processAWSKeywords(keywords: Detection[], config: DifficultyConfig): Detection[] {
    console.log('处理 AWS 关键词，原始关键词：', keywords);
    
    // 过滤置信度
    let filtered = keywords.filter(k => k.score >= config.minConfidence);
    
    // 为每个关键词添加难度等级
    const keywordsWithLevel = filtered.map(k => ({
      ...k,
      cefrLevel: this.getWordLevel(k.keyword)
    }));

    // 按难度和置信度排序
    // 难度顺序：C2 > C1 > B2 > B1 > A2 > A1 > Unknown
    const difficultyOrder = ['C2', 'C1', 'B2', 'B1', 'A2', 'A1', 'Unknown'];
    
    keywordsWithLevel.sort((a, b) => {
      const levelA = a.cefrLevel;
      const levelB = b.cefrLevel;
      // 首先按难度排序
      const diffOrderDiff = difficultyOrder.indexOf(levelA) - difficultyOrder.indexOf(levelB);
      // 如果难度相同，则按置信度排序
      if (diffOrderDiff === 0) {
        return b.score - a.score;
      }
      return diffOrderDiff;
    });

    console.log('AWS关键词处理结果（按难度排序）：', keywordsWithLevel);
    
    // 返回前3个关键词
    const result = keywordsWithLevel.slice(0, 3);
    console.log('最终选择的AWS关键词：', result);
    return result;
  }

  // 处理 OpenAI 关键词
  private processOpenAIKeywords(keywords: string[], config: DifficultyConfig): string[] {
    console.log('处理 OpenAI 关键词，输入关键词：', keywords);

    if (!Array.isArray(keywords)) {
      console.error('关键词不是数组：', keywords);
      return [];
    }

    // 为每个关键词添加难度等级
    const keywordsWithLevel = keywords.map(keyword => ({
      keyword,
      cefrLevel: this.getWordLevel(keyword)
    }));

    console.log('关键词难度分析：', keywordsWithLevel);

    // 根据当前难度级别选择关键词
    let selectedKeywords: string[] = [];
    
    switch (config.level) {
      case 'basic':
        // 对于基础级别，优先选择 A1-A2 的词
        selectedKeywords = keywordsWithLevel
          .filter(k => ['A1', 'A2'].includes(k.cefrLevel))
          .map(k => k.keyword);
        break;
      
      case 'intermediate':
        // 对于中级，优先选择 A2-B2 的词
        selectedKeywords = keywordsWithLevel
          .filter(k => ['A2', 'B1', 'B2'].includes(k.cefrLevel))
          .map(k => k.keyword);
        break;
      
      case 'advanced':
        // 对于高级，优先选择 B2-C2 的词
        selectedKeywords = keywordsWithLevel
          .filter(k => ['B2', 'C1', 'C2'].includes(k.cefrLevel))
          .map(k => k.keyword);
        break;
    }

    // 如果筛选后的关键词不足，从原始列表中补充
    if (selectedKeywords.length < VOCABULARY_DISPLAY_CONFIG.idealOpenAIKeywords) {
      const remainingKeywords = keywords.filter(k => !selectedKeywords.includes(k));
      selectedKeywords = [
        ...selectedKeywords,
        ...remainingKeywords
      ];
    }

    // 返回指定数量的关键词
    const result = selectedKeywords.slice(0, VOCABULARY_DISPLAY_CONFIG.idealOpenAIKeywords);
    console.log('最终选择的 OpenAI 关键词：', result);
    return result;
  }

  // 处理所有关键词
  processKeywords(awsKeywords: Detection[], openaiKeywords: string[], config: DifficultyConfig) {
    console.log('开始处理关键词...');
    console.log('AWS 关键词：', awsKeywords);
    console.log('OpenAI 关键词：', openaiKeywords);
    console.log('难度配置：', config);

    const processedAWS = this.processAWSKeywords(awsKeywords, config);
    const processedOpenAI = this.processOpenAIKeywords(openaiKeywords, config);

    return {
      awsKeywords: processedAWS,
      openaiKeywords: processedOpenAI
    };
  }
} 