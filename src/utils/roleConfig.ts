import { RoleConfig } from '../types';

export const baseStructure = `Please provide a scene description that follows this structure:
1. Main elements: Start with the most visually prominent objects/people
2. Environment: Describe the setting and atmosphere
3. Actions: Capture the movements and interactions
4. Details: Include specific and vivid details
5. Atmosphere: Convey the overall mood and feeling`;

export const rolePrompts: Record<string, RoleConfig> = {
  Robot: {
    style: "As a precise analytical system:",
    requirements: [
      "Use exact measurements and technical terms",
      "State confidence levels for observations",
      "Maintain objective, data-driven language",
      "Structure information in logical sequence"
    ],
    example: "Subject A (female, confidence: 95%) performing volleyball dive at coordinates..."
  },
  RealPerson: {
    style: "As if telling a friend about this scene:",
    requirements: [
      "Share personal reactions and feelings",
      "Use casual, everyday language",
      "Connect with relatable experiences",
      "Express genuine enthusiasm"
    ],
    example: "You won't believe the amazing scene I'm looking at..."
  },
  ProProfessor: {
    style: "As a sports and photography expert:",
    requirements: [
      "Analyze technical aspects of the sport",
      "Use professional terminology",
      "Explain compositional elements",
      "Provide educational insights"
    ],
    example: "This image showcases a textbook example of defensive technique..."
  },
  SmallTalker: {
    style: "As an enthusiastic conversation starter:",
    requirements: [
      "Ask engaging questions",
      "Express excitement and wonder",
      "Create interactive moments",
      "Keep tone light and friendly"
    ],
    example: "Isn't it amazing how the whole scene just comes alive..."
  },
  FunnyBone: {
    style: "As a witty entertainer:",
    requirements: [
      "Include clever wordplay and puns",
      "Find humorous contrasts",
      "Use playful metaphors",
      "Keep tone light and amusing"
    ],
    example: "Talk about a 'ruff' game of volleyball..."
  }
}; 