import { TranslatedWord } from '../types';

export async function translateWords(words: string[]): Promise<TranslatedWord[]> {
  try {
    const response = await fetch('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ words }),
    });

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Translation error:', error);
    // 如果翻译失败，返回原始英文作为临时解决方案
    return words.map(word => ({ en: word, zh: '翻译中...' }));
  }
} 