import { SimpleContext } from './simple-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GenerationHistoryItem {
  id: string;
  timestamp: number;
  type: 'text2img' | 'img2img' | 'enhance';
  prompt: string;
  negativePrompt: string;
  imageUrl: string;
  parameters: Record<string, any>;
  userId?: string;
}

export class HistoryManager {
  private historyPrefix: string;
  private history: Record<string, GenerationHistoryItem[]> = {};
  private maxItems: number;
  
  constructor(private ctx: SimpleContext, options: { maxItems?: number, historyPath?: string } = {}) {
    this.historyPrefix = 'novelai_history_';
    this.maxItems = options.maxItems || 50;
    this.loadHistory().catch(err => {
      ctx.logger.error('Failed to load history:', err);
    });
  }
  
  async addItem(item: Omit<GenerationHistoryItem, 'id' | 'timestamp'>): Promise<string> {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const historyItem: GenerationHistoryItem = {
      ...item,
      id,
      timestamp: Date.now(),
    };
    
    const userId = item.userId || 'anonymous';
    this.history[userId] = this.history[userId] || [];
    this.history[userId].unshift(historyItem);
    
    // Limit history size
    if (this.history[userId].length > this.maxItems) {
      this.history[userId] = this.history[userId].slice(0, this.maxItems);
    }
    
    await this.saveHistory(userId);
    return id;
  }
  
  getHistory(userId: string = 'anonymous', limit?: number): GenerationHistoryItem[] {
    const userHistory = this.history[userId] || [];
    return limit ? userHistory.slice(0, limit) : userHistory;
  }
  
  async getItem(id: string, userId?: string): Promise<GenerationHistoryItem | null> {
    if (userId) {
      return this.history[userId]?.find(item => item.id === id) || null;
    }
    
    // Search in all histories if userId not provided
    for (const userHistory of Object.values(this.history)) {
      const item = userHistory.find(item => item.id === id);
      if (item) return item;
    }
    
    return null;
  }
  
  async deleteItem(id: string, userId?: string): Promise<boolean> {
    if (userId) {
      const userHistory = this.history[userId];
      if (!userHistory) return false;
      
      const index = userHistory.findIndex(item => item.id === id);
      if (index === -1) return false;
      
      userHistory.splice(index, 1);
      await this.saveHistory(userId);
      return true;
    }
    
    // Delete from all histories if userId not provided
    let found = false;
    for (const [uid, userHistory] of Object.entries(this.history)) {
      const index = userHistory.findIndex(item => item.id === id);
      if (index !== -1) {
        userHistory.splice(index, 1);
        await this.saveHistory(uid);
        found = true;
      }
    }
    
    return found;
  }
  
  async clearHistory(userId: string): Promise<void> {
    if (this.history[userId]) {
      this.history[userId] = [];
      await this.saveHistory(userId);
    }
  }
  
  private async loadHistory(): Promise<void> {
    try {
      // 获取所有键
      const keys = await AsyncStorage.getAllKeys();
      const historyKeys = keys.filter(key => key.startsWith(this.historyPrefix));
      
      for (const key of historyKeys) {
        try {
          const userId = key.slice(this.historyPrefix.length);
          const content = await AsyncStorage.getItem(key);
          if (content) {
            this.history[userId] = JSON.parse(content);
          }
        } catch (err) {
          this.ctx.logger.error(`Failed to load history for ${key}:`, err);
        }
      }
    } catch (err) {
      this.ctx.logger.error('Failed to read history keys:', err);
    }
  }
  
  private async saveHistory(userId: string): Promise<void> {
    try {
      const key = `${this.historyPrefix}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(this.history[userId] || []));
    } catch (err) {
      this.ctx.logger.error(`Failed to save history for ${userId}:`, err);
    }
  }
}
