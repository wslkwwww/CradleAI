import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatSave, Message } from '@/shared/types';

/**
 * Service for managing chat saves (save points)
 */
class ChatSaveService {
  private STORAGE_KEY = 'chat_saves';
  
  /**
   * Get all saved chat states
   */
  async getAllSaves(): Promise<ChatSave[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as ChatSave[];
    } catch (error) {
      console.error('Error loading chat saves:', error);
      return [];
    }
  }
  
  /**
   * Get saves for a specific conversation
   */
  async getSavesForConversation(conversationId: string): Promise<ChatSave[]> {
    const saves = await this.getAllSaves();
    return saves.filter(save => save.conversationId === conversationId);
  }
  
  /**
   * Save the current chat state
   */
  async saveChat(
    conversationId: string, 
    characterId: string,
    characterName: string,
    messages: Message[],
    description: string, 
    thumbnail?: string
  ): Promise<ChatSave> {
    try {
      // Get existing saves
      const saves = await this.getAllSaves();
      
      // Create new save point
      const newSave: ChatSave = {
        id: `save_${Date.now()}`,
        conversationId,
        characterId,
        characterName,
        timestamp: Date.now(),
        description,
        messageIds: messages.map(m => m.id),
        messages: [...messages], // Create a deep copy of messages
        previewText: this.generatePreviewText(messages),
        thumbnail: thumbnail
      };
      
      // Add to saves and store
      const updatedSaves = [newSave, ...saves];
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSaves));
      
      return newSave;
    } catch (error) {
      console.error('Error saving chat:', error);
      throw error;
    }
  }
  
  /**
   * Delete a save point
   */
  async deleteSave(saveId: string): Promise<boolean> {
    try {
      const saves = await this.getAllSaves();
      const updatedSaves = saves.filter(save => save.id !== saveId);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSaves));
      return true;
    } catch (error) {
      console.error('Error deleting save:', error);
      return false;
    }
  }
  
  /**
   * Generate a short preview text from messages
   */
  private generatePreviewText(messages: Message[]): string {
    // Get last 2 messages
    const lastMessages = messages.slice(-2);
    
    // Create preview from last messages
    const preview = lastMessages
      .map(m => {
        const sender = m.sender === 'user' ? 'You' : 'Character';
        const text = m.text.length > 40 ? m.text.substring(0, 40) + '...' : m.text;
        return `${sender}: ${text}`;
      })
      .join(' | ');
      
    return preview || 'Empty conversation';
  }
}

export const chatSaveService = new ChatSaveService();
