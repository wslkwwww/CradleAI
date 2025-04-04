import * as SQLite from 'expo-sqlite';
import { VectorStore } from './base';
import { SearchFilters, VectorStoreConfig, VectorStoreResult } from './base';
import * as FileSystem from 'expo-file-system';

interface MobileSQLiteConfig extends VectorStoreConfig {
  dbName: string;
  dimension: number;
}

// Add interfaces for SQLite query results
interface CountResult {
  count: number;
}

interface VectorRow {
  id: string;
  vector: string;
  payload: string;
}

interface PayloadRow {
  id: string;
  payload: string;
}

/**
 * 基于 SQLite 的移动端向量存储实现
 */
export class MobileSQLiteVectorStore implements VectorStore {
  private db: SQLite.SQLiteDatabase;
  private dimension: number;
  private collectionName: string;
  // Store database name separately since it's needed for file path access
  private dbName: string;

  constructor(config: MobileSQLiteConfig) {
    this.dimension = config.dimension || 1536; // 默认 OpenAI 维度
    this.collectionName = config.collectionName;
    this.dbName = config.dbName; // Store the db name separately
    
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
      
      // 增加一个索引以提高按角色ID查询的性能
      await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_${this.collectionName}_agentId 
        ON ${this.collectionName}(json_extract(payload, '$.agentId'))`);
      console.log(`[MobileSQLiteVectorStore] 为表 ${this.collectionName} 创建角色ID索引成功`);
      
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

  private async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      // 修复: 使用 getAllAsync 方法并添加类型
      return await this.db.getAllAsync<T>(sql, params);
    } catch (error) {
      console.error('[MobileSQLiteVectorStore] 查询多条记录失败:', error);
      return [];
    }
  }

  private async getOne<T>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      // 修复: 使用 getFirstAsync 方法并添加类型
      return await this.db.getFirstAsync<T>(sql, params);
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

    const rows = await this.all<VectorRow>(`SELECT id, vector, payload FROM ${this.collectionName}`);
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
    const row = await this.getOne<PayloadRow>(
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
    const rows = await this.all<PayloadRow>(
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

  /**
   * 获取数据库文件大小
   * @returns 数据库大小（字节）
   */
  public async getDatabaseSize(): Promise<number> {
    try {
      // 获取数据库文件路径 - 修复: 使用 dbName 而不是 db.name
      const dbPath = FileSystem.documentDirectory + 'SQLite/' + this.dbName;
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      
      if (fileInfo.exists && fileInfo.size) {
        console.log(`[MobileSQLiteVectorStore] 数据库大小: ${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB`);
        return fileInfo.size;
      }
      return 0;
    } catch (error) {
      console.error('[MobileSQLiteVectorStore] 获取数据库大小失败:', error);
      return 0;
    }
  }
  
  /**
   * 按角色ID获取向量数据
   * @param characterId 角色ID
   * @param limit 结果限制
   * @returns 向量结果数组
   */
  public async getByCharacterId(characterId: string, limit: number = 100): Promise<VectorStoreResult[]> {
    try {
      // 使用 JSON_EXTRACT 函数提取 payload 中的 agentId
      const query = `
        SELECT id, payload 
        FROM ${this.collectionName} 
        WHERE json_extract(payload, '$.agentId') = ?
        ORDER BY json_extract(payload, '$.updatedAt') DESC, json_extract(payload, '$.createdAt') DESC
        LIMIT ?`;
      
      const rows = await this.db.getAllAsync<PayloadRow>(query, [characterId, limit]);
      
      const results: VectorStoreResult[] = rows.map(row => ({
        id: row.id,
        payload: JSON.parse(row.payload)
      }));
      
      console.log(`[MobileSQLiteVectorStore] 按角色ID ${characterId} 查询到 ${results.length} 条记录`);
      return results;
    } catch (error) {
      console.error(`[MobileSQLiteVectorStore] 按角色ID查询失败:`, error);
      return [];
    }
  }
  
  /**
   * 按角色ID获取记录数
   * @param characterId 角色ID
   * @returns 记录数
   */
  public async getCountByCharacterId(characterId: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM ${this.collectionName} 
        WHERE json_extract(payload, '$.agentId') = ?`;
      
      const result = await this.db.getFirstAsync<CountResult>(query, [characterId]);
      // Fix: Add null check and use proper typed access to count
      return result?.count || 0;
    } catch (error) {
      console.error(`[MobileSQLiteVectorStore] 获取角色ID记录数失败:`, error);
      return 0;
    }
  }

  /**
   * 获取向量存储统计信息
   * @returns 统计信息
   */
  public async getStats(): Promise<{ totalCount: number, dbSize: number }> {
    try {
      const countQuery = `SELECT COUNT(*) as count FROM ${this.collectionName}`;
      const result = await this.db.getFirstAsync<CountResult>(countQuery);
      // Fix: Add null check and use proper typed access to count
      const totalCount = result?.count || 0;
      const dbSize = await this.getDatabaseSize();
      
      return { totalCount, dbSize };
    } catch (error) {
      console.error('[MobileSQLiteVectorStore] 获取统计信息失败:', error);
      return { totalCount: 0, dbSize: 0 };
    }
  }
}
