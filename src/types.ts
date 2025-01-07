export interface Detection {
  location: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  keyword: string;
  score: number;
  cefrLevel?: string;
}

export interface VisionAnalysisResult {
  description: string;
  keywords: string[];
  scene: string;
  detection?: Detection[];
  openaiFiltered?: {
    description: string;
    keywords: string[];
    scene: string;
  };
  allLevels?: {
    descriptions: {
      basic: string;
      intermediate: string;
      advanced: string;
    };
    keywords: {
      basic: string[];
      intermediate: string[];
      advanced: string[];
    };
  };
} 