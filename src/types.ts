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
}

export interface AnalysisResult extends VisionAnalysisResult {}

export type Role = 'Robot' | 'RealPerson' | 'ProProfessor' | 'SmallTalker' | 'FunnyBone';

export interface RoleConfig {
  style: string;
  requirements: string[];
  example: string;
}

export interface VisionResponse {
  role?: Role;
} 