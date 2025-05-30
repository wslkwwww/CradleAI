export { unifiedTTSService, UnifiedTTSService } from './unified-tts-service';
export * from './types';
export * from './adapters';

import { unifiedTTSService } from './unified-tts-service';
import { UnifiedTTSRequest, UnifiedTTSResponse, TTSProvider } from './types';

/**
 * Convenience function to synthesize text with the best available provider
 */
export async function synthesizeText(
  text: string,
  options?: {
    preferredProvider?: TTSProvider;
    voiceId?: string;
    emotion?: string;
    speed?: number;
    providerSpecific?: UnifiedTTSRequest['providerSpecific'];
  }
): Promise<UnifiedTTSResponse> {
  const availableProviders = unifiedTTSService.getAvailableProviders();
  
  if (availableProviders.length === 0) {
    return {
      success: false,
      provider: 'cosyvoice',
      error: 'No TTS providers are available'
    };
  }

  // Use preferred provider if available, otherwise use the first available
  const provider = options?.preferredProvider && 
    unifiedTTSService.isProviderAvailable(options.preferredProvider)
    ? options.preferredProvider
    : availableProviders[0];

  const request: UnifiedTTSRequest = {
    text,
    provider,
    voiceId: options?.voiceId,
    emotion: options?.emotion,
    speed: options?.speed,
    providerSpecific: options?.providerSpecific
  };

  return await unifiedTTSService.synthesize(request);
}

/**
 * Convenience function to synthesize with CosyVoice
 */
export async function synthesizeWithCosyVoice(
  text: string,
  templateId?: string,
  instruction?: string
): Promise<UnifiedTTSResponse> {
  return await synthesizeText(text, {
    preferredProvider: 'cosyvoice',
    providerSpecific: {
      templateId,
      instruction
    }
  });
}

/**
 * Convenience function to synthesize with Doubao
 */
export async function synthesizeWithDoubao(
  text: string,
  voiceType?: string,
  emotion?: string
): Promise<UnifiedTTSResponse> {
  return await synthesizeText(text, {
    preferredProvider: 'doubao',
    voiceId: voiceType,
    emotion
  });
}

/**
 * Convenience function to synthesize with Minimax
 */
export async function synthesizeWithMinimax(
  text: string,
  voiceId?: string,
  emotion?: string
): Promise<UnifiedTTSResponse> {
  return await synthesizeText(text, {
    preferredProvider: 'minimax',
    voiceId,
    emotion
  });
}

/**
 * Get available providers
 */
export function getAvailableProviders(): TTSProvider[] {
  return unifiedTTSService.getAvailableProviders();
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(provider: TTSProvider): boolean {
  return unifiedTTSService.isProviderAvailable(provider);
}
