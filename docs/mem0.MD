# Mem0 Memory System Integration Guide for React Native/Expo

## 1. Overview of Mem0 Memory Architecture

Mem0's memory system consists of three main components:

1. **Embeddings Service**: Converts text into vector representations
2. **Vector Storage**: Stores and retrieves vector embeddings 
3. **LLM Integration**: Used for fact extraction and memory management


现在我们将把mem0移植到基于React Native/Expo开发的app中，实现下列功能：

### 1.1 记忆存储流程

1. **输入处理**：
   - 接收用户输入(文本或消息数组)
   - 将多模态消息(如图像)转换为文本描述
   - 准备处理上下文和过滤器

2. **事实提取**：
   - 使用 LLM 和系统提示从输入中提取关键事实
   - 生成结构化的事实列表

3. **向量化**：
   - 对每个提取的事实生成向量嵌入
   - 使用 OpenAI 嵌入模型将文本转换为高维向量

4. **记忆比对**：
   - 搜索现有类似记忆
   - 使用 LLM 判断是添加新记忆、更新现有记忆还是删除冲突记忆

5. **存储操作**：
   - 执行添加/更新/删除操作
   - 在向量存储中保存记忆及其向量表示
   - 在历史数据库中记录操作

```
用户输入 → 事实提取 → 向量化 → 记忆比对 → 存储操作
```

### 1.2 记忆检索流程

1. **查询处理**：
   - 接收用户查询和过滤条件
   - 验证必要的过滤参数(userId/agentId/runId)

2. **查询向量化**：
   - 将查询文本转换为向量表示
   - 使用与存储相同的嵌入模型

3. **相似度搜索**：
   - 在向量存储中搜索与查询向量相似的记忆
   - 应用过滤条件筛选结果
   - 计算余弦相似度得分

4. **结果处理**：
   - 根据相似度分数排序结果
   - 格式化返回数据，包括记忆内容、元数据和相似度分数

```
查询文本 → 向量化 → 相似度搜索 → 结果排序 → 返回记忆
```

### 1.3 记忆管理流程

1. **记忆获取**：
   - 通过 ID 直接从向量存储中检索特定记忆
   - 加载完整的记忆数据和元数据

2. **记忆更新**：
   - 使用新文本生成新向量
   - 更新向量存储中的记忆内容和向量
   - 记录历史变更

3. **记忆删除**：
   - 从向量存储中删除指定记忆
   - 保留删除记录在历史数据库中

4. **历史跟踪**：
   - 每次操作都记录在 SQLite 历史数据库中
   - 包含操作类型、旧值、新值和时间戳

Let's go through how to adapt each component for a React Native/Expo environment.

## 2. Mobile Vector Database Selection and Integration

### 2.1 Options for Mobile Vector Databases

For React Native/Expo, you need a lightweight vector database that works with mobile constraints:

1. **SQLite with Vector Extensions**: 
   - Best option for mobile with vector search capabilities
   - Supports basic vector operations with custom functions

2. **React Native SQLite Storage**: 
   - Standard storage solution that can be adapted for vector storage
   - Will require custom vector similarity functions

3. **Expo SQLite**:
   - Built into Expo SDK
   - More limited but easier to set up in Expo projects

### 2.2 Implementing SQLite Vector Storage for Mobile

I recommend using SQLite with custom vector functions. Here's how to implement it:

```typescript
import * as SQLite from 'expo-sqlite';
import { VectorStore } from './base';
import { SearchFilters, VectorStoreConfig, VectorStoreResult } from '../types';

interface MobileSQLiteConfig extends VectorStoreConfig {
  dbName: string;
  dimension: number;
}

export class MobileSQLiteVectorStore implements VectorStore {
  private db: SQLite.SQLiteDatabase;
  private dimension: number;
  private collectionName: string;

  constructor(config: MobileSQLiteConfig) {
    this.dimension = config.dimension || 1536; // Default OpenAI dimension
    this.collectionName = config.collectionName;
    this.db = SQLite.openDatabase(config.dbName);
    this.init().catch(console.error);
  }

  private async init() {
    return new Promise<void>((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS ${this.collectionName} (
            id TEXT PRIMARY KEY,
            vector BLOB NOT NULL,
            payload TEXT NOT NULL
          )`,
          [],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          sql,
          params,
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  private all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          sql,
          params,
          (_, { rows }) => resolve(rows._array),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  private getOne(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          sql,
          params,
          (_, { rows }) => {
            if (rows.length > 0) {
              resolve(rows.item(0));
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private filterVector(vector: { id: string, payload: Record<string, any> }, filters?: SearchFilters): boolean {
    if (!filters) return true;
    
    const payload = typeof vector.payload === 'string' 
      ? JSON.parse(vector.payload) 
      : vector.payload;
      
    return Object.entries(filters).every(
      ([key, value]) => payload[key] === value
    );
  }

  async insert(
    vectors: number[][],
    ids: string[],
    payloads: Record<string, any>[],
  ): Promise<void> {
    for (let i = 0; i < vectors.length; i++) {
      if (vectors[i].length !== this.dimension) {
        throw new Error(
          `Vector dimension mismatch. Expected ${this.dimension}, got ${vectors[i].length}`
        );
      }
      
      // Convert float32array to buffer
      const buffer = this.vectorToBase64(vectors[i]);
      
      await this.run(
        `INSERT OR REPLACE INTO ${this.collectionName} (id, vector, payload) VALUES (?, ?, ?)`,
        [ids[i], buffer, JSON.stringify(payloads[i])]
      );
    }
  }

  async search(
    query: number[],
    limit: number = 10,
    filters?: SearchFilters,
  ): Promise<VectorStoreResult[]> {
    if (query.length !== this.dimension) {
      throw new Error(
        `Query dimension mismatch. Expected ${this.dimension}, got ${query.length}`
      );
    }

    const rows = await this.all(`SELECT id, vector, payload FROM ${this.collectionName}`);
    const results: VectorStoreResult[] = [];

    for (const row of rows) {
      const vector = this.base64ToVector(row.vector);
      const payload = JSON.parse(row.payload);
      
      const item = {
        id: row.id,
        payload
      };

      if (this.filterVector(item, filters)) {
        const score = this.cosineSimilarity(query, vector);
        results.push({
          id: row.id,
          payload,
          score,
        });
      }
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return results.slice(0, limit);
  }

  async get(vectorId: string): Promise<VectorStoreResult | null> {
    const row = await this.getOne(
      `SELECT id, payload FROM ${this.collectionName} WHERE id = ?`,
      [vectorId]
    );
    
    if (!row) return null;

    return {
      id: row.id,
      payload: JSON.parse(row.payload),
    };
  }

  async update(
    vectorId: string,
    vector: number[],
    payload: Record<string, any>,
  ): Promise<void> {
    if (vector.length !== this.dimension) {
      throw new Error(
        `Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`
      );
    }
    
    const buffer = this.vectorToBase64(vector);
    
    await this.run(
      `UPDATE ${this.collectionName} SET vector = ?, payload = ? WHERE id = ?`,
      [buffer, JSON.stringify(payload), vectorId]
    );
  }

  async delete(vectorId: string): Promise<void> {
    await this.run(
      `DELETE FROM ${this.collectionName} WHERE id = ?`,
      [vectorId]
    );
  }

  async deleteCol(): Promise<void> {
    await this.run(`DROP TABLE IF EXISTS ${this.collectionName}`);
    await this.init();
  }

  async list(
    filters?: SearchFilters,
    limit: number = 100,
  ): Promise<[VectorStoreResult[], number]> {
    const rows = await this.all(
      `SELECT id, payload FROM ${this.collectionName}`
    );
    
    const results: VectorStoreResult[] = [];

    for (const row of rows) {
      const payload = JSON.parse(row.payload);
      const item = {
        id: row.id,
        payload
      };

      if (this.filterVector(item, filters)) {
        results.push({
          id: row.id,
          payload,
        });
      }
    }

    return [results.slice(0, limit), results.length];
  }
  
  // Utilities for converting between vector formats in React Native
  private vectorToBase64(vector: number[]): string {
    // Convert vector to base64 string (optimized for React Native)
    return JSON.stringify(vector);
  }
  
  private base64ToVector(base64: string): number[] {
    // Convert base64 string back to vector
    return JSON.parse(base64);
  }
}
```

### 2.3 Factory Integration

Update the VectorStoreFactory to include the mobile SQLite option:

```typescript


Made changes.

import { EmbedderFactory, LLMFactory } from './existing_factories';
import { MobileSQLiteVectorStore } from '../vector_stores/mobile_sqlite';
import { VectorStore } from '../vector_stores/base';
import { VectorStoreConfig } from '../types';

export class VectorStoreFactory {
  static create(provider: string, config: VectorStoreConfig): VectorStore {
    switch (provider.toLowerCase()) {
      case "mobile_sqlite":
        return new MobileSQLiteVectorStore(config as any);
      case "memory":
        // ...existing code...
      case "qdrant":
        // ...existing code...
      case "redis":
        // ...existing code...
      default:
        throw new Error(`Unsupported vector store provider: ${provider}`);
    }
  }
}
```

## 3. OpenAI Embedding Model Integration

### 3.1 Embedding Service for React Native

Create an embedding service that works with your existing API configuration:

```typescript


Made changes.

import { Embedder } from './base';
import { EmbeddingConfig } from '../types';

export class MobileOpenAIEmbedder implements Embedder {
  private apiKey: string;
  private model: string;
  private apiEndpoint: string;

  constructor(config: EmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'text-embedding-3-small';
    this.apiEndpoint = config.url || 'https://api.openai.com/v1/embeddings';
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: text
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: texts
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      return data.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
  }
}
```

### 3.2 Update the Factory

Update the EmbedderFactory to include the mobile embedder:

```typescript


Made changes.

import { MobileOpenAIEmbedder } from '../embeddings/mobile_openai';

export class EmbedderFactory {
  static create(provider: string, config: EmbeddingConfig): Embedder {
    switch (provider.toLowerCase()) {
      case "mobile_openai":
        return new MobileOpenAIEmbedder(config);
      case "openai":
        // ...existing code...
      case "ollama":
        // ...existing code...
      default:
        throw new Error(`Unsupported embedder provider: ${provider}`);
    }
  }
}
```

## 4. LLM Integration for Mobile

### 4.1 Mobile LLM Service

Create a mobile-friendly LLM adapter that works with your existing API configuration:

```typescript
import { LLM, LLMResponse } from './base';
import { LLMConfig, Message } from '../types';

export class MobileLLM implements LLM {
  private apiKey: string;
  private model: string;
  private apiEndpoint: string;
  
  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4-turbo';
    this.apiEndpoint = config.config?.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
  }

  async generateResponse(
    messages: Message[],
    responseFormat?: { type: string },
    tools?: any[]
  ): Promise<string | LLMResponse> {
    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content)
      }));
      
      const payload: any = {
        messages: formattedMessages,
        model: this.model
      };
      
      if (responseFormat) {
        payload.response_format = responseFormat;
      }
      
      if (tools) {
        payload.tools = tools;
        payload.tool_choice = "auto";
      }
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`LLM API error: ${JSON.stringify(error)}`);
      }
      
      const data = await response.json();
      const result = data.choices[0].message;
      
      if (result.tool_calls) {
        return {
          content: result.content || '',
          role: result.role,
          toolCalls: result.tool_calls.map((call: any) => ({
            name: call.function.name,
            arguments: call.function.arguments
          }))
        };
      }
      
      return result.content || '';
    } catch (error) {
      console.error('Error generating LLM response:', error);
      throw error;
    }
  }

  async generateChat(messages: Message[]): Promise<LLMResponse> {
    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content)
      }));
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          messages: formattedMessages,
          model: this.model
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`LLM API error: ${JSON.stringify(error)}`);
      }
      
      const data = await response.json();
      const result = data.choices[0].message;
      
      return {
        content: result.content || '',
        role: result.role
      };
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }
}
```

### 4.2 Update LLM Factory

```typescript


Made changes.

Made changes.

import { MobileLLM } from '../llms/mobile_llm';

export class LLMFactory {
  static create(provider: string, config: LLMConfig): LLM {
    switch (provider) {
      case "mobile_llm":
        return new MobileLLM(config);
      case "openai":
        // ...existing code...
      // ...existing code...
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}
```

## 5. SQLite History Manager for Mobile

Create a mobile-compatible history manager:

```typescript


Made changes.

import * as SQLite from 'expo-sqlite';

export class MobileSQLiteManager {
  
  private db: SQLite.SQLiteDatabase;

  constructor(dbName: string) {
    this.db = SQLite.openDatabase(dbName);
    this.init().catch(console.error);
  }

  private async init() {
    return new Promise<void>((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS memory_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_id TEXT NOT NULL,
            previous_value TEXT,
            new_value TEXT,
            action TEXT NOT NULL,
            created_at TEXT,
            updated_at TEXT,
            is_deleted INTEGER DEFAULT 0
          )`,
          [],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async addHistory(
    memoryId: string,
    previousValue: string | null,
    newValue: string | null,
    action: string,
    createdAt?: string,
    updatedAt?: string,
    isDeleted: number = 0,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO memory_history 
          (memory_id, previous_value, new_value, action, created_at, updated_at, is_deleted)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [memoryId, previousValue, newValue, action, createdAt, updatedAt, isDeleted],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async getHistory(memoryId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          "SELECT * FROM memory_history WHERE memory_id = ? ORDER BY id DESC",
          [memoryId],
          (_, { rows }) => resolve(rows._array),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async reset(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          "DROP TABLE IF EXISTS memory_history",
          [],
          () => {
            this.init().then(resolve).catch(reject);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
}
```

## 6. Adapting the Memory Module for Mobile

Create a mobile-specific Memory class that uses the mobile adaptations:

```typescript


Made changes.

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto-browserify'; // Use a polyfill for React Native
import {
  MemoryConfig,
  MemoryItem,
  Message,
  SearchFilters,
  SearchResult,
} from '../types';
import {
  EmbedderFactory,
  LLMFactory,
  VectorStoreFactory,
} from '../utils/factory';
import {
  getFactRetrievalMessages,
  getUpdateMemoryMessages,
  removeCodeBlocks,
} from '../prompts';
import { MobileSQLiteManager } from '../storage/MobileSQLiteManager';
import { ConfigManager } from '../config/manager';
import {
  AddMemoryOptions,
  SearchMemoryOptions,
  DeleteAllMemoryOptions,
  GetAllMemoryOptions,
} from './memory.types';

export class MobileMemory {
  private config: MemoryConfig;
  private customPrompt: string | undefined;
  private embedder: any;
  private vectorStore: any;
  private llm: any;
  private db: MobileSQLiteManager;
  private collectionName: string;
  private apiVersion: string;

  constructor(config: Partial<MemoryConfig> = {}) {
    // Merge and validate config
    this.config = ConfigManager.mergeConfig(config);

    this.customPrompt = this.config.customPrompt;
    this.embedder = EmbedderFactory.create(
      this.config.embedder.provider,
      this.config.embedder.config,
    );
    this.vectorStore = VectorStoreFactory.create(
      this.config.vectorStore.provider,
      this.config.vectorStore.config,
    );
    this.llm = LLMFactory.create(
      this.config.llm.provider,
      this.config.llm.config,
    );
    // Use the mobile SQLite manager
    this.db = new MobileSQLiteManager(this.config.historyDbPath || "memory.db");
    this.collectionName = this.config.vectorStore.config.collectionName;
    this.apiVersion = this.config.version || "v1.0";
  }

  async add(
    messages: string | Message[],
    config: AddMemoryOptions,
  ): Promise<SearchResult> {
    const {
      userId,
      agentId,
      runId,
      metadata = {},
      filters = {},
    } = config;

    if (userId) filters.userId = metadata.userId = userId;
    if (agentId) filters.agentId = metadata.agentId = agentId;
    if (runId) filters.runId = metadata.runId = runId;

    if (!filters.userId && !filters.agentId && !filters.runId) {
      throw new Error(
        "One of the filters: userId, agentId or runId is required!"
      );
    }

    const parsedMessages = Array.isArray(messages)
      ? (messages as Message[])
      : [{ role: "user", content: messages }];

    // For simplicity in this mobile adaptation, skip vision message processing
    // If you need vision support, adapt the parse_vision_messages function

    // Add to vector store
    const vectorStoreResult = await this.addToVectorStore(
      parsedMessages,
      metadata,
      filters,
    );

    return {
      results: vectorStoreResult,
    };
  }

  private async addToVectorStore(
    messages: Message[],
    metadata: Record<string, any>,
    filters: SearchFilters,
  ): Promise<MemoryItem[]> {
    const parsedMessages = messages.map((m) => 
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('\n');

    // Get prompts
    const [systemPrompt, userPrompt] = this.customPrompt
      ? [this.customPrompt, `Input:\n${parsedMessages}`]
      : getFactRetrievalMessages(parsedMessages);

    // Extract facts using LLM
    const response = await this.llm.generateResponse(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { type: "json_object" },
    );

    const cleanResponse = removeCodeBlocks(response);
    let facts = [];
    try {
      const parsed = JSON.parse(cleanResponse);
      facts = parsed.facts || [];
    } catch (e) {
      console.error("Failed to parse LLM response:", e);
      return [];
    }

    // Get embeddings for new facts
    const newMessageEmbeddings: Record<string, number[]> = {};
    const retrievedOldMemory: Array<{ id: string; text: string }> = [];

    // Create embeddings and search for similar memories
    for (const fact of facts) {
      const embedding = await this.embedder.embed(fact);
      newMessageEmbeddings[fact] = embedding;

      const existingMemories = await this.vectorStore.search(
        embedding,
        5,
        filters,
      );
      for (const mem of existingMemories) {
        retrievedOldMemory.push({ id: mem.id, text: mem.payload.data });
      }
    }

    // Remove duplicates from old memories
    const uniqueOldMemories = retrievedOldMemory.filter(
      (mem, index) =>
        retrievedOldMemory.findIndex((m) => m.id === mem.id) === index,
    );

    // Create UUID mapping for handling UUID hallucinations
    const tempUuidMapping: Record<string, string> = {};
    uniqueOldMemories.forEach((item, idx) => {
      tempUuidMapping[String(idx)] = item.id;
      uniqueOldMemories[idx].id = String(idx);
    });

    // Get memory update decisions
    const updatePrompt = getUpdateMemoryMessages(uniqueOldMemories, facts);
    const updateResponse = await this.llm.generateResponse(
      [{ role: "user", content: updatePrompt }],
      { type: "json_object" },
    );

    const cleanUpdateResponse = removeCodeBlocks(updateResponse);
    let memoryActions = [];
    try {
      const parsed = JSON.parse(cleanUpdateResponse);
      memoryActions = parsed.memory || [];
    } catch (e) {
      console.error("Failed to parse LLM update response:", e);
      return [];
    }

    // Process memory actions
    const results: MemoryItem[] = [];
    for (const action of memoryActions) {
      try {
        switch (action.event) {
          case "ADD": {
            const memoryId = await this.createMemory(
              action.text,
              newMessageEmbeddings,
              metadata,
            );
            results.push({
              id: memoryId,
              memory: action.text,
              metadata: { event: action.event },
            });
            break;
          }
          case "UPDATE": {
            const realMemoryId = tempUuidMapping[action.id];
            await this.updateMemory(
              realMemoryId,
              action.text,
              newMessageEmbeddings,
              metadata,
            );
            results.push({
              id: realMemoryId,
              memory: action.text,
              metadata: {
                event: action.event,
                previousMemory: action.old_memory,
              },
            });
            break;
          }
          case "DELETE": {
            const realMemoryId = tempUuidMapping[action.id];
            await this.deleteMemory(realMemoryId);
            results.push({
              id: realMemoryId,
              memory: action.text,
              metadata: { event: action.event },
            });
            break;
          }
        }
      } catch (error) {
        console.error(`Error processing memory action: ${error}`);
      }
    }

    return results;
  }

  async get(memoryId: string): Promise<MemoryItem | null> {
    const memory = await this.vectorStore.get(memoryId);
    if (!memory) return null;

    const filters = {
      ...(memory.payload.userId && { userId: memory.payload.userId }),
      ...(memory.payload.agentId && { agentId: memory.payload.agentId }),
      ...(memory.payload.runId && { runId: memory.payload.runId }),
    };

    const memoryItem: MemoryItem = {
      id: memory.id,
      memory: memory.payload.data,
      hash: memory.payload.hash,
      createdAt: memory.payload.createdAt,
      updatedAt: memory.payload.updatedAt,
      metadata: {},
    };

    // Add additional metadata
    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    for (const [key, value] of Object.entries(memory.payload)) {
      if (!excludedKeys.has(key)) {
        memoryItem.metadata![key] = value;
      }
    }

    return { ...memoryItem, ...filters };
  }

  async search(
    query: string,
    config: SearchMemoryOptions,
  ): Promise<SearchResult> {
    const { userId, agentId, runId, limit = 100, filters = {} } = config;

    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    if (!filters.userId && !filters.agentId && !filters.runId) {
      throw new Error(
        "One of the filters: userId, agentId or runId is required!"
      );
    }

    // Search vector store
    const queryEmbedding = await this.embedder.embed(query);
    const memories = await this.vectorStore.search(
      queryEmbedding,
      limit,
      filters,
    );

    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    const results = memories.map((mem) => ({
      id: mem.id,
      memory: mem.payload.data,
      hash: mem.payload.hash,
      createdAt: mem.payload.createdAt,
      updatedAt: mem.payload.updatedAt,
      score: mem.score,
      metadata: Object.entries(mem.payload)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      ...(mem.payload.userId && { userId: mem.payload.userId }),
      ...(mem.payload.agentId && { agentId: mem.payload.agentId }),
      ...(mem.payload.runId && { runId: mem.payload.runId }),
    }));

    return { results };
  }

  async update(memoryId: string, data: string): Promise<{ message: string }> {
    const embedding = await this.embedder.embed(data);
    await this.updateMemory(memoryId, data, { [data]: embedding });
    return { message: "Memory updated successfully!" };
  }

  async delete(memoryId: string): Promise<{ message: string }> {
    await this.deleteMemory(memoryId);
    return { message: "Memory deleted successfully!" };
  }

  async deleteAll(
    config: DeleteAllMemoryOptions,
  ): Promise<{ message: string }> {
    const { userId, agentId, runId } = config;

    const filters: SearchFilters = {};
    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    if (!Object.keys(filters).length) {
      throw new Error(
        "At least one filter is required to delete all memories. If you want to delete all memories, use the `reset()` method."
      );
    }

    const [memories] = await this.vectorStore.list(filters);
    for (const memory of memories) {
      await this.deleteMemory(memory.id);
    }

    return { message: "Memories deleted successfully!" };
  }

  async history(memoryId: string): Promise<any[]> {
    return this.db.getHistory(memoryId);
  }

  async reset(): Promise<void> {
    await this.db.reset();
    await this.vectorStore.deleteCol();
    this.vectorStore = VectorStoreFactory.create(
      this.config.vectorStore.provider,
      this.config.vectorStore.config,
    );
  }

  async getAll(config: GetAllMemoryOptions): Promise<SearchResult> {
    const { userId, agentId, runId, limit = 100 } = config;

    const filters: SearchFilters = {};
    if (userId) filters.userId = userId;
    if (agentId) filters.agentId = agentId;
    if (runId) filters.runId = runId;

    const [memories] = await this.vectorStore.list(filters, limit);

    const excludedKeys = new Set([
      "userId",
      "agentId",
      "runId",
      "hash",
      "data",
      "createdAt",
      "updatedAt",
    ]);
    const results = memories.map((mem) => ({
      id: mem.id,
      memory: mem.payload.data,
      hash: mem.payload.hash,
      createdAt: mem.payload.createdAt,
      updatedAt: mem.payload.updatedAt,
      metadata: Object.entries(mem.payload)
        .filter(([key]) => !excludedKeys.has(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      ...(mem.payload.userId && { userId: mem.payload.userId }),
      ...(mem.payload.agentId && { agentId: mem.payload.agentId }),
      ...(mem.payload.runId && { runId: mem.payload.runId }),
    }));

    return { results };
  }

  private async createMemory(
    data: string,
    existingEmbeddings: Record<string, number[]>,
    metadata: Record<string, any>,
  ): Promise<string> {
    const memoryId = uuidv4();
    const embedding =
      existingEmbeddings[data] || (await this.embedder.embed(data));

    const memoryMetadata = {
      ...metadata,
      data,
      hash: createHash('md5').update(data).digest('hex'),
      createdAt: new Date().toISOString(),
    };

    await this.vectorStore.insert([embedding], [memoryId], [memoryMetadata]);
    await this.db.addHistory(
      memoryId,
      null,
      data,
      "ADD",
      memoryMetadata.createdAt,
    );

    return memoryId;
  }

  private async updateMemory(
    memoryId: string,
    data: string,
    existingEmbeddings: Record<string, number[]>,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const existingMemory = await this.vectorStore.get(memoryId);
    if (!existingMemory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    const prevValue = existingMemory.payload.data;
    const embedding =
      existingEmbeddings[data] || (await this.embedder.embed(data));

    const newMetadata = {
      ...metadata,
      data,
      hash: createHash('md5').update(data).digest('hex'),
      createdAt: existingMemory.payload.createdAt,
      updatedAt: new Date().toISOString(),
      ...(existingMemory.payload.userId && {
        userId: existingMemory.payload.userId,
      }),
      ...(existingMemory.payload.agentId && {
        agentId: existingMemory.payload.agentId,
      }),
      ...(existingMemory.payload.runId && {
        runId: existingMemory.payload.runId,
      }),
    };

    await this.vectorStore.update(memoryId, embedding, newMetadata);
    await this.db.addHistory(
      memoryId,
      prevValue,
      data,
      "UPDATE",
      newMetadata.createdAt,
      newMetadata.updatedAt,
    );

    return memoryId;
  }

  private async deleteMemory(memoryId: string): Promise<string> {
    const existingMemory = await this.vectorStore.get(memoryId);
    if (!existingMemory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    const prevValue = existingMemory.payload.data;
    await this.vectorStore.delete(memoryId);
    await this.db.addHistory(
      memoryId,
      prevValue,
      null,
      "DELETE",
      undefined,
      undefined,
      1,
    );

    return memoryId;
  }
}
```

## 7. React Native/Expo Adaptation and Integration

### 7.1 Polyfills and Compatibility Issues

React Native doesn't include all Node.js built-ins that mem0 requires. You'll need to add polyfills:

```javascript


Made changes.

// Install these packages:
// npm install react-native-get-random-values react-native-url-polyfill crypto-browserify

// Add these imports at the entry point of your app
import 'react-native-get-random-values'; // Required for uuid to work
import 'react-native-url-polyfill/auto'; // URL polyfill for fetch

// Set up global.crypto if using crypto libraries
global.crypto = global.crypto || require('crypto-browserify');
```

### 7.2 Handling Database Permissions

For Expo, you'll need to request storage permissions:

```javascript


Made changes.

import * as FileSystem from 'expo-file-system';
import * as Permissions from 'expo-permissions';

export async function ensureStoragePermission() {
  // Only needed for older Expo versions or specific platforms
  const { status } = await Permissions.askAsync(Permissions.MEDIA_LIBRARY);
  
  if (status !== 'granted') {
    throw new Error('Storage permission is required');
  }
  
  return true;
}

export async function getDatabasePath(filename) {
  return `${FileSystem.documentDirectory}${filename}`;
}
```

### 7.3 Creating a Memory Hook for React Native

Here's a custom React hook to use the memory system in your components:

```typescript


Made changes.

import { useState, useEffect, useCallback } from 'react';
import { MobileMemory } from '../memory/mobile_memory';
import { getDatabasePath } from '../utils/permissions';
import { MemoryConfig, SearchResult, Message } from '../types';
import { AddMemoryOptions, SearchMemoryOptions } from '../memory/memory.types';

export function useMemory(config: Partial<MemoryConfig> = {}) {
  const [memory, setMemory] = useState<MobileMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initMemory() {
      try {
        // Get proper database path for mobile
        const dbPath = await getDatabasePath('memory.db');
        
        // Create memory instance with mobile-specific paths
        const memoryInstance = new MobileMemory({
          ...config,
          historyDbPath: dbPath,
          vectorStore: {
            ...config.vectorStore,
            provider: 'mobile_sqlite',
            config: {
              ...config.vectorStore?.config,
              dbName: 'vector_store.db',
            },
          },
        });
        
        setMemory(memoryInstance);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
    
    initMemory();
  }, []);

  const addMemory = useCallback(
    async (messages: string | Message[], options: AddMemoryOptions): Promise<SearchResult> => {
      if (!memory) throw new Error('Memory system not initialized');
      return memory.add(messages, options);
    },
    [memory]
  );

  const searchMemory = useCallback(
    async (query: string, options: SearchMemoryOptions): Promise<SearchResult> => {
      if (!memory) throw new Error('Memory system not initialized');
      return memory.search(query, options);
    },
    [memory]
  );

  const getMemory = useCallback(
    async (memoryId: string) => {
      if (!memory) throw new Error('Memory system not initialized');
      return memory.get(memoryId);
    },
    [memory]
  );

  const updateMemory = useCallback(
    async (memoryId: string, data: string) => {
      if (!memory) throw new Error('Memory system not initialized');
      return memory.update(memoryId, data);
    },
    [memory]
  );

  const deleteMemory = useCallback(
    async (memoryId: string) => {
      if (!memory) throw new Error('Memory system not initialized');
      return memory.delete(memoryId);
    },
    [memory]
  );

  const resetMemory = useCallback(async () => {
    if (!memory) throw new Error('Memory system not initialized');
    return memory.reset();
  }, [memory]);

  return {
    memory,
    loading,
    error,
    addMemory,
    searchMemory,
    getMemory,
    updateMemory,
    deleteMemory,
    resetMemory
  };
}
```

### 7.4 Memory Provider Component

Create a Memory context provider for your app:

```typescript


Made changes.

```typescript
```typescript
import React, { createContext, useContext, ReactNode } from 'react';
import { useMemory } from '../hooks/useMemory';
import { MemoryConfig } from '../types';

type MemoryContextType = ReturnType<typeof useMemory>;

const MemoryContext = createContext<MemoryContextType | null>(null);

interface MemoryProviderProps {
  children: ReactNode;
  config?: Partial<MemoryConfig>;
}

export function MemoryProvider({ children, config = {} }: MemoryProviderProps) {
  const memoryUtils = useMemory(config);
  
  return (
    <MemoryContext.Provider value={memoryUtils}>
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemoryContext() {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemoryContext must be used within a MemoryProvider');
  }
  return context;
}
```

## 8. Integration with Existing Chat Functionality

### 8.1 Chat Integration Example

Here's how to integrate memory with your existing chat functionality:

```tsx


Made changes.

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet } from 'react-native';
import { useMemoryContext } from '../providers/MemoryProvider';

// Assuming you have an existing chat interface
interface ChatMessage {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

const ChatWithMemory = ({ userId, conversationId }) => {
  // Your existing chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  
  // Get memory functionality
  const { addMemory, searchMemory, loading, error } = useMemoryContext();
  
  // Send message and store in memory
  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Create new message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: input,
      role: 'user',
      timestamp: new Date()
    };
    
    // Update chat UI
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    try {
      // Save to memory system
      await addMemory(
        { role: 'user', content: input },
        { 
          userId, 
          runId: conversationId,
          metadata: { timestamp: new Date().toISOString() }
        }
      );
      
      // You would then add the assistant's response to memory as well
      // after receiving it from your existing chat system
    } catch (err) {
      console.error("Failed to add to memory:", err);
    }
  };
  
  // Search memory for relevant context before responding
  const searchRelevantMemories = async (query: string) => {
    try {
      const memories = await searchMemory(query, { 
        userId, 
        runId: conversationId 
      });
      return memories.results;
    } catch (err) {
      console.error("Failed to search memories:", err);
      return [];
    }
  };
  
  // Render chat interface
  return (
    <View style={styles.container}>
      {loading && <Text>Loading memory system...</Text>}
      {error && <Text style={styles.error}>Error: {error.message}</Text>}
      
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.role === 'user' ? styles.userBubble : styles.assistantBubble
          ]}>
            <Text>{item.text}</Text>
          </View>
        )}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
        />
        <Button title="Send" onPress={handleSend} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: '#ECECEC',
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  error: {
    color: 'red',
    padding: 10
  }
});

export default ChatWithMemory;
```

### 8.2 Setup in App Root

```tsx


Made changes.

import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { MemoryProvider } from './src/providers/MemoryProvider';
import ChatWithMemory from './src/components/ChatWithMemory';

// Import polyfills
import './src/polyfills';

// Assuming you have API config management
import { useApiConfig } from './src/hooks/useApiConfig';

export default function App() {
  // Get API keys from your existing config
  const { openaiApiKey } = useApiConfig();
  
  const memoryConfig = {
    embedder: {
      provider: 'mobile_openai',
      config: {
        apiKey: openaiApiKey,
        model: 'text-embedding-3-small',
      },
    },
    vectorStore: {
      provider: 'mobile_sqlite',
      config: {
        collectionName: 'memories',
        dimension: 1536,
      },
    },
    llm: {
      provider: 'mobile_llm',
      config: {
        apiKey: openaiApiKey,
        model: 'gpt-4-turbo',
      },
    },
  };
  
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar />
      <MemoryProvider config={memoryConfig}>
        <ChatWithMemory userId="user123" conversationId="conv456" />
      </MemoryProvider>
    </SafeAreaView>
  );
}
```

## 9. Compatibility and Performance Considerations

### 9.1 React Native/Expo Compatibility Issues

1. **File System Access**: 
   - Expo provides limited file system access
   - Use Expo's FileSystem API for all file operations
   - Consider using a development build with Expo to access native modules

2. **Polyfills**:
   - Node.js built-ins need polyfills (crypto, path, etc.)
   - Use the polyfills mentioned in section 7.1

3. **Performance**:
   - Mobile devices have limited resources
   - Implement pagination for large memory retrievals
   - Batch vector operations to avoid UI freezes

### 9.2 Performance Optimizations

1. **Memory Usage**:
   - Limit vector dimension size (consider using 384 instead of 1536)
   - Implement memory cleanup when app goes to background

2. **Network Optimizations**:
   - Cache embeddings for frequently used texts
   - Implement offline capabilities by storing pending operations

3. **UI Responsiveness**:
   - Use background threads for heavy operations
   - Show loading indicators for memory operations

```typescript


Made changes.

import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

// Define background task for memory operations
const MEMORY_TASK = 'MEMORY_OPERATIONS';

// Register background task
TaskManager.defineTask(MEMORY_TASK, async () => {
  try {
    // Perform pending memory operations
    const success = await processPendingMemoryOperations();
    return success ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("Background task error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Process operations that couldn't complete while online
async function processPendingMemoryOperations() {
  // Implementation depends on your specific needs
  return true;
}

// Register background fetch
export async function registerBackgroundTask() {
  if (Platform.OS === 'ios') {
    await BackgroundFetch.registerTaskAsync(MEMORY_TASK, {
      minimumInterval: 60 * 15, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}
```

## 10. Implementation Roadmap

Here's a recommended step-by-step implementation plan:

1. **Set up project dependencies**:
   - Install necessary dependencies: `expo-sqlite`, `crypto-browserify`, polyfills
   - Configure project for mobile vector operations

2. **Implement core components**:
   - Mobile SQLite vector store
   - Mobile-friendly embedding service
   - Mobile-friendly LLM service

3. **Implement memory management**:
   - Port core memory functionality
   - Adapt for mobile environment constraints

4. **Create React Native hooks and components**:
   - Memory provider and context
   - Integration with chat interface

5. **Optimize and test**:
   - Performance testing on target devices
   - Memory usage optimization
   - Battery impact analysis

## 11. Required Dependencies

```json
{
  "dependencies": {
    "crypto-browserify": "^3.12.0",
    "expo": "^49.0.0",
    "expo-background-fetch": "~11.3.0",
    "expo-file-system": "~15.4.4",
    "expo-sqlite": "~11.3.3",
    "expo-task-manager": "~11.3.0",
    "react": "18.2.0",
    "react-native": "0.72.6",
    "react-native-get-random-values": "~1.9.0",
    "react-native-url-polyfill": "^2.0.0",
    "uuid": "^9.0.1",
    "zod": "^3.22.4"
  }
}
```

## Conclusion

This guide provides a comprehensive approach to integrating mem0's memory management functionality into your React Native/Expo application. The key adaptations focus on:

1. A lightweight mobile-compatible vector database using SQLite
2. Mobile-friendly API clients for embeddings and LLM services
3. React hooks and providers for easy integration
4. Performance optimizations for mobile constraints

By following this implementation guide, you'll be able to build a React Native/Expo application with sophisticated memory management capabilities, allowing your conversational AI to maintain context and provide more personalized interactions to your users.

The modular architecture makes it easy to swap components as needed, such as using different embedding models or LLM providers, while maintaining the core functionality of the memory system.

Made changes.

Similar code found with 1 license type