import * as SQLite from 'expo-sqlite';

/**
 * 移动端 SQLite 历史管理器
 * 用于跟踪记忆的变更历史
 */
export class MobileSQLiteManager {
  private db: SQLite.SQLiteDatabase;
  
  constructor(dbName: string) {
    // 修复: 使用 openDatabaseSync 替代 openDatabase
    this.db = SQLite.openDatabaseSync(dbName);
    this.init().catch(console.error);
  }

  private async init() {
    try {
      // 使用 execAsync 方法替代 exec
      await this.db.execAsync(`CREATE TABLE IF NOT EXISTS memory_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id TEXT NOT NULL,
        previous_value TEXT,
        new_value TEXT,
        action TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        is_deleted INTEGER DEFAULT 0
      )`);
      console.log('[MobileSQLiteManager] 历史表初始化成功');
    } catch (error) {
      console.error('[MobileSQLiteManager] 初始化历史表失败:', error);
      throw error;
    }
  }

  /**
   * 添加历史记录
   */
  async addHistory(
    memoryId: string,
    previousValue: string | null,
    newValue: string | null,
    action: string,
    createdAt?: string,
    updatedAt?: string,
    isDeleted: number = 0,
  ): Promise<void> {
    try {
      // 使用 runAsync 方法执行有参数的 SQL 语句
      await this.db.runAsync(
        `INSERT INTO memory_history 
        (memory_id, previous_value, new_value, action, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [memoryId, previousValue, newValue, action, createdAt ?? null, updatedAt ?? null, isDeleted]
      );
    } catch (error) {
      console.error('[MobileSQLiteManager] 添加历史记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定记忆的历史记录
   */
  async getHistory(memoryId: string): Promise<any[]> {
    try {
      // 使用 getAllAsync 方法获取所有结果
      return await this.db.getAllAsync(
        "SELECT * FROM memory_history WHERE memory_id = ? ORDER BY id DESC",
        [memoryId]
      );
    } catch (error) {
      console.error('[MobileSQLiteManager] 获取历史记录失败:', error);
      return [];
    }
  }

  /**
   * 重置历史数据库
   */
  async reset(): Promise<void> {
    try {
      // 使用 execAsync 方法执行 SQL 语句
      await this.db.execAsync("DROP TABLE IF EXISTS memory_history");
      await this.init();
    } catch (error) {
      console.error('[MobileSQLiteManager] 重置历史数据库失败:', error);
      throw error;
    }
  }
}
