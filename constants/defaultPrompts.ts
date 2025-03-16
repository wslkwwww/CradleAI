// Define default negative prompts for image generation
export const DEFAULT_NEGATIVE_PROMPTS = [
  "blurry", 
  "lowres", 
  "error", 
  "film grain", 
  "scan artifacts", 
  "worst quality", 
  "bad quality", 
  "jpeg artifacts", 
  "very displeasing", 
  "chromatic aberration", 
  "logo", 
  "dated", 
  "signature", 
  "multiple views", 
  "gigantic breasts", 
  "white blank page", 
  "blank page", 
  "nsfw", 
  "Bad hands", 
  "bad eyes", 
  "extra fingers", 
  "fewer fingers", 
  "ugly", 
  "deformed", 
  "disproportionate", 
  "displeasing"
];

// Function to get default negative prompts as a string
export const getDefaultNegativePromptsString = (): string => {
  return DEFAULT_NEGATIVE_PROMPTS.join(', ');
};
