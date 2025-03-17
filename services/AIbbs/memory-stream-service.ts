export interface MemoryRecord {
  id: string;
  content: string;             // 记忆内容的自然语言描述
  creationTimestamp: number;   // 创建时间
  lastAccessTimestamp: number; // 最后访问时间
  type: 'observation' | 'reflection' | 'plan'; // 记忆类型
  importance: number;          // 重要性评分(1-10)
  embedding?: number[];        // 内容的向量表示
  relatedMemoryIds?: string[]; // 相关记忆的引用
  metadata?: {                 // 额外元数据
    location?: string;         // 记忆发生的"位置"(例如:"论坛前厅","财经板块")
    involvedAgentIds?: string[]; // 涉及的其他代理ID
    topics?: string[];         // 相关话题标签
  };
}

export class MemoryStreamService {
  private memoryStore: Record<string, Map<string, MemoryRecord>> = {};
  
  // 添加新记忆
  async addMemory(agentId: string, content: string, type: 'observation' | 'reflection' | 'plan', metadata?: any): Promise<MemoryRecord> {
    if (!this.memoryStore[agentId]) {
      this.memoryStore[agentId] = new Map();
    }
    
    const now = Date.now();
    const importance = await this.calculateImportance(content);
    const embedding = await this.generateEmbedding(content);
    
    const memoryRecord: MemoryRecord = {
      id: `memory-${agentId}-${now}-${Math.random().toString(36).substring(2, 9)}`,
      content,
      creationTimestamp: now,
      lastAccessTimestamp: now,
      type,
      importance,
      embedding,
      metadata
    };
    
    this.memoryStore[agentId].set(memoryRecord.id, memoryRecord);
    return memoryRecord;
  }
  
  // 基于当前情境检索相关记忆
  async retrieveMemories(
    agentId: string,
    query: string,
    options: {
      limit?: number;
      recencyWeight?: number;
      relevanceWeight?: number;
      importanceWeight?: number;
      filterTypes?: ('observation' | 'reflection' | 'plan')[];
    } = {}
  ): Promise<MemoryRecord[]> {
    const {
      limit = 20,
      recencyWeight = 1.0,
      relevanceWeight = 1.0,
      importanceWeight = 1.0,
      filterTypes
    } = options;
    
    if (!this.memoryStore[agentId]) {
      return [];
    }
    
    const queryEmbedding = await this.generateEmbedding(query);
    const memories = Array.from(this.memoryStore[agentId].values());
    
    // 如果指定了类型过滤
    const filteredMemories = filterTypes 
      ? memories.filter(m => filterTypes.includes(m.type)) 
      : memories;
    
    // 计算分数
    const scoredMemories = filteredMemories.map(memory => {
      // 计算相关性分数(余弦相似度)
      const relevance = this.calculateCosineSimilarity(memory.embedding || [], queryEmbedding);
      
      // 计算时间衰减因子(使用指数衰减)
      const hoursElapsed = (Date.now() - memory.lastAccessTimestamp) / (1000 * 60 * 60);
      const recency = Math.pow(0.995, hoursElapsed); // 每小时衰减0.5%
      
      // 归一化重要性(1-10转换为0-1)
      const normalizedImportance = memory.importance / 10;
      
      // 计算最终得分
      const score = 
        recencyWeight * recency + 
        relevanceWeight * relevance + 
        importanceWeight * normalizedImportance;
        
      return { memory, score };
    });
    
    // 排序并限制返回数量
    const topMemories = scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
    
    // 更新访问时间
    topMemories.forEach(memory => {
      memory.lastAccessTimestamp = Date.now();
      this.memoryStore[agentId].set(memory.id, memory);
    });
    
    return topMemories;
  }
  
  // 计算记忆重要性(1-10)
  private async calculateImportance(content: string): Promise<number> {
    // 使用LLM评估记忆的重要性
    const prompt = `
    On the scale of 1 to 10, where 1 is purely mundane (e.g., reading a routine post) 
    and 10 is extremely poignant (e.g., discovering a major community controversy),
    rate the likely poignancy of the following piece of memory.
    Memory: ${content}
    Rating: `;
    
    const response = await callLanguageModel(prompt);
    const rating = parseInt(response.trim());
    
    // 确保返回有效的评分
    return isNaN(rating) ? 5 : Math.max(1, Math.min(10, rating));
  }
  
  // 生成文本嵌入向量
  private async generateEmbedding(text: string): Promise<number[]> {
    // 调用嵌入模型API获取文本的向量表示
    return await getEmbedding(text);
  }
  
  // 计算余弦相似度
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length === 0 || vec2.length === 0) return 0;
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < Math.min(vec1.length, vec2.length); i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    return dotProduct / (mag1 * mag2) || 0;
  }
}
