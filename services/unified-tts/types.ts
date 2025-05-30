export type TTSProvider = 'cosyvoice' | 'doubao' | 'minimax';

export interface UnifiedTTSRequest {
  text: string;
  provider: TTSProvider;
  // Common parameters
  voiceId?: string;
  emotion?: string;
  speed?: number;
  // Provider-specific parameters
  providerSpecific?: {
    // CosyVoice specific
    templateId?: string;
    instruction?: string;
    task?: string;
    email?: string;
    
    // Doubao specific
    enableEmotion?: boolean;
    emotionScale?: number;
    loudnessRatio?: number;
    encoding?: 'wav' | 'pcm' | 'ogg_opus' | 'mp3';
    
    // Minimax specific
    languageBoost?: string;
    englishNormalization?: boolean;
  };
}

export interface UnifiedTTSResponse {
  success: boolean;
  provider: TTSProvider;
  data?: {
    audioUrl?: string;
    audioPath?: string;
    audioBuffer?: Buffer;
    taskId?: string;
    duration?: number;
  };
  error?: string;
  metadata?: {
    processingTime?: number;
    predictionId?: string;
    reqId?: string;
  };
}

export interface UnifiedTTSStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  audioUrl?: string;
  error?: string;
  provider: TTSProvider;
}

export type TTSStatusCallback = (status: UnifiedTTSStatus) => void;

export interface TTSProviderConfig {
  cosyvoice?: {
    serverUrl?: string;
    useRealtimeUpdates?: boolean;
  };
  doubao?: {
    appid: string;
    token: string;
    voiceType?: string;
    encoding?: 'wav' | 'pcm' | 'ogg_opus' | 'mp3';
    speedRatio?: number;
  };
  minimax?: {
    apiToken: string;
    model?: string;
    voiceId?: string;
  };
}
