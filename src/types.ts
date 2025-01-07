export interface Detection {
  location: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  keyword: string;
  score: number;
}

export interface TranslatedWord {
  en: string;
  zh: string;
}

export interface VisionAnalysisResult {
  description: string;
  keywords: string[];
  scene: string;
  detection?: Detection[];
  translations?: TranslatedWord[];
} 