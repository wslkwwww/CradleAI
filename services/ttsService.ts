import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Configuration
const TTS_API_URL = 'https://tts.cradleintro.top/api/tts';
const TTS_CACHE_PREFIX = 'tts_cache_';
const TTS_CACHE_DIR = FileSystem.cacheDirectory + 'tts/';
const TTS_AUDIO_STATE_KEY = 'tts_audio_states';

// Interface for TTS request
interface TTSRequest {
  templateId: string;
  tts_text: string;
}

// Interface for TTS response
interface TTSResponse {
  success: boolean;
  data?: {
    audio_url: string;
  };
  error?: string;
}

// Define PlaybackStatus type based on Audio.ts
type PlaybackStatus = {
  isLoaded: boolean;
  isPlaying?: boolean;
  durationMillis?: number;
  positionMillis?: number;
  didJustFinish?: boolean;
  error?: string;
  // Add other properties as needed
};

// Audio state for tracking playback
export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  hasAudio: boolean;
  error: string | null;
  sound?: Audio.Sound;
  status?: PlaybackStatus;
  audioUrl?: string;
  localUri?: string;
  isComplete?: boolean; // Add flag to track if audio has completed playback
  templateId?: string;  // Store template ID for potential regeneration
}

// Define a simplified version of AudioState for persistence
interface PersistentAudioState {
  hasAudio: boolean;
  localUri?: string;
  audioUrl?: string;
  isComplete?: boolean;
  templateId?: string;
}

class TTSService {
  // Map to keep track of audio states for different messages
  private audioStates: Map<string, AudioState> = new Map();
  
  constructor() {
    this.ensureCacheDirectoryExists();
    this.loadPersistedAudioStates();
  }
  
  // Initialize the cache directory
  private async ensureCacheDirectoryExists() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(TTS_CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(TTS_CACHE_DIR, { intermediates: true });
        console.log('Created TTS cache directory');
      }
    } catch (error) {
      console.error('Failed to create TTS cache directory:', error);
    }
  }
  
  // New method to persist audio states to AsyncStorage
  private async persistAudioStates() {
    try {
      const states: Record<string, PersistentAudioState> = {};
      
      // Only persist essential information - not sound objects or full status
      for (const [messageId, state] of this.audioStates.entries()) {
        if (state.hasAudio && state.localUri) {
          states[messageId] = {
            hasAudio: state.hasAudio,
            localUri: state.localUri,
            audioUrl: state.audioUrl,
            isComplete: state.isComplete,
            templateId: state.templateId
          };
        }
      }
      
      await AsyncStorage.setItem(TTS_AUDIO_STATE_KEY, JSON.stringify(states));
      console.log(`[TTSService] Persisted ${Object.keys(states).length} audio states`);
    } catch (error) {
      console.error('[TTSService] Failed to persist audio states:', error);
    }
  }
  
  // Load persisted audio states from AsyncStorage
  private async loadPersistedAudioStates() {
    try {
      const statesJson = await AsyncStorage.getItem(TTS_AUDIO_STATE_KEY);
      if (!statesJson) return;
      
      const states: Record<string, PersistentAudioState> = JSON.parse(statesJson);
      console.log(`[TTSService] Loading ${Object.keys(states).length} persisted audio states`);
      
      // Verify each audio file exists before restoring state
      for (const messageId in states) {
        const state = states[messageId];
        
        if (state.localUri) {
          const fileInfo = await FileSystem.getInfoAsync(state.localUri);
          
          if (fileInfo.exists) {
            // File exists, restore the audio state
            this.audioStates.set(messageId, {
              hasAudio: true,
              isPlaying: false,
              isLoading: false,
              error: null,
              localUri: state.localUri,
              audioUrl: state.audioUrl,
              isComplete: state.isComplete || false,
              templateId: state.templateId
            });
            console.log(`[TTSService] Restored audio state for message: ${messageId}`);
          } else {
            console.log(`[TTSService] Audio file not found: ${state.localUri}`);
          }
        }
      }
    } catch (error) {
      console.error('[TTSService] Failed to load persisted audio states:', error);
    }
  }
  
  // Generate TTS for a message
  async generateTTS(messageId: string, text: string, templateId: string): Promise<AudioState> {
    // Check if we already have this audio
    const existingState = this.getAudioState(messageId);
    if (existingState.hasAudio && existingState.localUri) {
      return existingState;
    }
    
    // Update state to loading
    this.updateAudioState(messageId, {
      isLoading: true,
      hasAudio: false,
      error: null,
      isPlaying: false,
      templateId: templateId // Store template ID for potential regeneration
    });
    
    try {
      // Prepare the request using the provided template ID
      const requestData: TTSRequest = {
        templateId,  // Use the character-specific template ID
        tts_text: text
      };
      
      console.log(`[TTSService] Generating TTS for message ${messageId} with template ${templateId}`);
      
      // Make the API request
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const responseData: TTSResponse = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to generate audio');
      }
      
      if (!responseData.data?.audio_url) {
        // If no audio URL is returned but the request was successful,
        // the server might still be processing - set up polling
        return this.pollForAudioCompletion(messageId, templateId, text);
      }
      
      const audioUrl = responseData.data.audio_url;
      console.log(`[TTSService] Audio generated: ${audioUrl}`);
      
      // Download and cache the audio file
      const localUri = await this.downloadAndCacheAudio(messageId, audioUrl);
      
      // Update audio state with success
      this.updateAudioState(messageId, {
        isLoading: false,
        hasAudio: true,
        audioUrl,
        localUri,
        error: null,
        isPlaying: false,
        isComplete: false,
        templateId: templateId
      });
      
      // Persist audio states after successful generation
      await this.persistAudioStates();
      
      return this.getAudioState(messageId);
    } catch (error) {
      console.error(`[TTSService] Error generating TTS:`, error);
      
      // Update audio state with error
      this.updateAudioState(messageId, {
        isLoading: false,
        hasAudio: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isPlaying: false
      });
      
      return this.getAudioState(messageId);
    }
  }
  
  // Poll for audio completion when the server is still processing
  private async pollForAudioCompletion(messageId: string, templateId: string, text: string, attempts: number = 0): Promise<AudioState> {
    // Maximum number of retry attempts (10 attempts × 3 seconds = 30 seconds max wait time)
    const MAX_ATTEMPTS = 10;
    const RETRY_DELAY = 3000; // 3 seconds between attempts
    
    if (attempts >= MAX_ATTEMPTS) {
      console.log(`[TTSService] Max polling attempts reached for message ${messageId}`);
      this.updateAudioState(messageId, {
        isLoading: false,
        hasAudio: false,
        error: 'Audio generation timed out after 30 seconds',
        isPlaying: false
      });
      return this.getAudioState(messageId);
    }
    
    // Wait before trying again
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    
    try {
      console.log(`[TTSService] Polling for audio completion (attempt ${attempts + 1}/${MAX_ATTEMPTS})`);
      
      // Make a new request to check if audio is ready
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId,
          tts_text: text
        })
      });
      
      const responseData: TTSResponse = await response.json();
      
      if (responseData.success && responseData.data?.audio_url) {
        // Audio is ready!
        const audioUrl = responseData.data.audio_url;
        console.log(`[TTSService] Audio ready after polling: ${audioUrl}`);
        
        // Download and cache the audio file
        const localUri = await this.downloadAndCacheAudio(messageId, audioUrl);
        
        // Update audio state with success
        this.updateAudioState(messageId, {
          isLoading: false,
          hasAudio: true,
          audioUrl,
          localUri,
          error: null,
          isPlaying: false,
          isComplete: false,
          templateId: templateId
        });
        
        // Persist audio states after successful generation
        await this.persistAudioStates();
        
        return this.getAudioState(messageId);
      } else {
        // Audio still not ready, continue polling
        console.log(`[TTSService] Audio not ready yet, continuing to poll...`);
        return this.pollForAudioCompletion(messageId, templateId, text, attempts + 1);
      }
    } catch (error) {
      console.error(`[TTSService] Error while polling for audio:`, error);
      
      // Try again instead of failing immediately
      return this.pollForAudioCompletion(messageId, templateId, text, attempts + 1);
    }
  }
  
  // Download and cache the audio file
  private async downloadAndCacheAudio(messageId: string, audioUrl: string): Promise<string> {
    // Generate a cache key based on the message ID
    const cacheKey = `${TTS_CACHE_PREFIX}${messageId}`;
    
    // Check if we have the URL cached
    const cachedUri = await AsyncStorage.getItem(cacheKey);
    if (cachedUri) {
      // Verify the file still exists
      const fileInfo = await FileSystem.getInfoAsync(cachedUri);
      if (fileInfo.exists) {
        console.log(`[TTSService] Using cached audio file: ${cachedUri}`);
        return cachedUri;
      }
    }
    
    // Download the file
    const fileName = `${messageId}.wav`;
    const fileUri = `${TTS_CACHE_DIR}${fileName}`;
    
    console.log(`[TTSService] Downloading audio from ${audioUrl} to ${fileUri}`);
    
    const downloadResult = await FileSystem.downloadAsync(audioUrl, fileUri);
    
    if (downloadResult.status !== 200) {
      throw new Error(`Failed to download audio file (status ${downloadResult.status})`);
    }
    
    // Save the cache entry
    await AsyncStorage.setItem(cacheKey, fileUri);
    
    return fileUri;
  }
  
  // Play audio for a message
  async playAudio(messageId: string): Promise<void> {
    const state = this.getAudioState(messageId);
    
    // Check if we have audio to play
    if (!state.hasAudio || !state.localUri) {
      throw new Error('No audio available to play');
    }
    
    try {
      // If sound already exists, check if it's already playing
      if (state.sound) {
        const status = await state.sound.getStatusAsync();
        
        if (status.isLoaded) {
          // If it's already playing, pause it
          if (status.isPlaying) {
            await state.sound.pauseAsync();
            this.updateAudioState(messageId, { isPlaying: false });
            return;
          }
          
          // If it's paused, check if it's at the end
          if (status.didJustFinish || 
              (status.positionMillis !== undefined && 
               status.durationMillis !== undefined && 
               status.positionMillis >= status.durationMillis - 100)) {
            // Reset to beginning before playing
            await state.sound.setPositionAsync(0);
            // Also reset the isComplete flag when replaying
            this.updateAudioState(messageId, { isComplete: false });
          }
          
          // Resume or play from reset position
          await state.sound.playAsync();
          this.updateAudioState(messageId, { isPlaying: true });
          return;
        } else {
          // Unload the sound if it's not properly loaded
          await state.sound.unloadAsync();
        }
      }
      
      // Create and load a new sound object
      const { sound } = await Audio.Sound.createAsync(
        { uri: state.localUri },
        { shouldPlay: true },
        this.createPlaybackStatusCallback(messageId)
      );
      
      // Update state with the sound object
      this.updateAudioState(messageId, { sound, isPlaying: true, isComplete: false });
      
      // Set up audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error(`[TTSService] Error playing audio:`, error);
      this.updateAudioState(messageId, {
        isPlaying: false,
        error: error instanceof Error ? error.message : 'Failed to play audio'
      });
      throw error;
    }
  }
  
  // Stop audio playback
  async stopAudio(messageId: string): Promise<void> {
    const state = this.getAudioState(messageId);
    
    if (state.sound) {
      try {
        const status = await state.sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await state.sound.pauseAsync();
          this.updateAudioState(messageId, { isPlaying: false });
        }
      } catch (error) {
        console.error(`[TTSService] Error stopping audio:`, error);
      }
    }
  }
  
  // Create a callback for audio playback status updates
  private createPlaybackStatusCallback(messageId: string) {
    return (status: PlaybackStatus) => {
      if (status.isLoaded) {
        // Update playing state
        this.updateAudioState(messageId, {
          isPlaying: status.isPlaying,
          status
        });
        
        // When playback finishes
        if (status.didJustFinish) {
          // Mark as not playing AND completed playback
          this.updateAudioState(messageId, { 
            isPlaying: false,
            isComplete: true 
          });
          // Persist updated state after completion
          this.persistAudioStates();
        }
      } else if (status.error) {
        console.error(`[TTSService] Playback error:`, status.error);
        this.updateAudioState(messageId, {
          isPlaying: false,
          error: `Playback error: ${status.error}`
        });
      }
    };
  }
  
  // Get the current audio state for a message
  getAudioState(messageId: string): AudioState {
    return this.audioStates.get(messageId) || {
      isPlaying: false,
      isLoading: false,
      hasAudio: false,
      error: null,
      isComplete: false
    };
  }
  
  // Update the audio state for a message
  private updateAudioState(messageId: string, updates: Partial<AudioState>) {
    const currentState = this.getAudioState(messageId);
    const newState = { ...currentState, ...updates };
    this.audioStates.set(messageId, newState);
    return newState;
  }
  
  // Clean up resources when component unmounts
  async cleanup(messageId?: string) {
    if (messageId) {
      // Clean up specific message
      const state = this.getAudioState(messageId);
      if (state.sound) {
        await state.sound.unloadAsync();
        // Don't delete from audioStates to preserve the audio file reference
        // Just update its state
        this.updateAudioState(messageId, {
          isPlaying: false,
          sound: undefined,
          status: undefined
        });
      }
    } else {
      // Clean up all sounds but preserve the state references
      for (const [id, state] of this.audioStates.entries()) {
        if (state.sound) {
          await state.sound.unloadAsync();
          this.updateAudioState(id, {
            isPlaying: false,
            sound: undefined,
            status: undefined
          });
        }
      }
    }
    
    // Persist states before cleanup completes
    await this.persistAudioStates();
  }
}

// Export a singleton instance
export const ttsService = new TTSService();
