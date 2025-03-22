import * as SQLite from 'expo-sqlite';
import { VectorStore } from './base';
import { SearchFilters, VectorStoreConfig, VectorStoreResult } from './base';

interface MobileSQLiteConfig extends VectorStoreConfig {
  dbName: string;
  dimension: number;
}

/**
 * 基于 SQLite 的移动端向量存储实现
 */
export class MobileSQLiteVectorStore implements VectorStore {
  private db: SQLite.SQLiteDatabase;
  private dimension: number;
  private collectionName: string;

  constructor(config: MobileSQLiteConfig) {
    this.dimension = config.dimension || 1536; // 默认 OpenAI 维度
    this.collectionName = config.collectionName;
    // 修复: 使用 openDatabaseSync 替代 openDatabase
    this.db = SQLite.openDatabaseSync(config.dbName);
    this.init().catch(console.error);
  }

  private async init() {
    try {
      // 修复: 使用正确的 SQLite API
      await this.db.execAsync(`CREATE TABLE IF NOT EXISTS ${this.collectionName} (
        id TEXT PRIMARY KEY,
        vector TEXT NOT NULL,
        payload TEXT NOT NULL
      )`);
      console.log(`[MobileSQLiteVectorStore] 表 ${this.collectionName} 初始化成功`);
    } catch (error) {
      console.error(`[MobileSQLiteVectorStore] 初始化表 ${this.collectionName} 失败:`, error);
      throw error;
    }
  }

  private async run(sql: string, params: any[] = []): Promise<void> {
    try {
      // 修复: 使用 runAsync 代替不存在的方法
      await this.db.runAsync(sql, params);
    } catch (error) {
      console.error('[MobileSQLiteVectorStore] 执行 SQL 失败:', error);
      throw error;
    }
  }

  private async all(sql: string, params: any[] = []): Promise<any[]> {
    try {
      // 修复: 使用 getAllAsync 方法
      return await this.db.getAllAsync(sql, params);
    } catch (error) {
      console.error('[MobileSQLiteVectorStore] 查询多条记录失败:', error);
      return [];
    }
  }

  private async getOne(sql: string, params: any[] = []): Promise<any> {
    try {
      // 修复: 使用 getFirstAsync 方法
      return await this.db.getFirstAsync(sql, params);
    } catch (error) {
      console.error('[MobileSQLiteVectorStore] 查询单条记录失败:', error);
      return null;
    }
  }

  /**
   * 计算余弦相似度
   */
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

  /**
   * 根据过滤条件过滤向量
   */
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
          `向量维度不匹配。期望 ${this.dimension}, 实际 ${vectors[i].length}`
        );
      }
      
      // 转换为JSON字符串
      const vectorString = JSON.stringify(vectors[i]);
      
      await this.run(
        `INSERT OR REPLACE INTO ${this.collectionName} (id, vector, payload) VALUES (?, ?, ?)`,
        [ids[i], vectorString, JSON.stringify(payloads[i])]
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
        `查询向量维度不匹配。期望 ${this.dimension}, 实际 ${query.length}`
      );
    }

    const rows = await this.all(`SELECT id, vector, payload FROM ${this.collectionName}`);
    const results: VectorStoreResult[] = [];

    for (const row of rows) {
      const vector = JSON.parse(row.vector);
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

    // 根据相似度分数排序结果
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
        `向量维度不匹配。期望 ${this.dimension}, 实际 ${vector.length}`
      );
    }
    
    const vectorString = JSON.stringify(vector);
    
    await this.run(
      `UPDATE ${this.collectionName} SET vector = ?, payload = ? WHERE id = ?`,
      [vectorString, JSON.stringify(payload), vectorId]
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
}
