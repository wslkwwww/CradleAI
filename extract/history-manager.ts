import { SimpleContext } from './simple-context';
import { resolve } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

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
  private historyPath: string;
  private history: Record<string, GenerationHistoryItem[]> = {};
  private maxItems: number;
  
  constructor(private ctx: SimpleContext, options: { maxItems?: number, historyPath?: string } = {}) {
    this.historyPath = options.historyPath || resolve(ctx.baseDir, 'data/novelai-history');
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
      if (!existsSync(this.historyPath)) {
        await mkdir(this.historyPath, { recursive: true });
        return;
      }
      
      const files = await this.ctx.http(`file://${this.historyPath}`);
      for (const file of files.data) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const userId = file.replace('.json', '');
          const content = await readFile(resolve(this.historyPath, file), 'utf8');
          this.history[userId] = JSON.parse(content);
        } catch (err) {
          this.ctx.logger.error(`Failed to load history for ${file}:`, err);
        }
      }
    } catch (err) {
      this.ctx.logger.error('Failed to read history directory:', err);
    }
  }
  
  private async saveHistory(userId: string): Promise<void> {
    try {
      if (!existsSync(this.historyPath)) {
        await mkdir(this.historyPath, { recursive: true });
      }
      
      const filePath = resolve(this.historyPath, `${userId}.json`);
      await writeFile(filePath, JSON.stringify(this.history[userId] || []), 'utf8');
    } catch (err) {
      this.ctx.logger.error(`Failed to save history for ${userId}:`, err);
    }
  }
}
