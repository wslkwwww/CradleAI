import os
import sqlite3
import logging
import sys
from pathlib import Path

# 添加项目根目录到Python路径以支持绝对导入
current_dir = Path(__file__).parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def upgrade_database(db_path=None):
    """升级数据库结构，添加缺失的列"""
    if db_path is None:
        db_path = os.path.join(os.path.dirname(__file__), 'license_system.db')
    
    logger.info(f"开始升级数据库: {db_path}")
    
    if not os.path.exists(db_path):
        logger.error(f"数据库文件不存在: {db_path}")
        return False
    
    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        # 检查licenses表是否存在
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='licenses'")
        if not cursor.fetchone():
            logger.error("licenses表不存在，无法升级")
            return False
        
        # 获取licenses表的列信息
        cursor = conn.execute('PRAGMA table_info(licenses)')
        columns = {row['name'] for row in cursor.fetchall()}
        
        # 添加缺失的列
        try:
            if 'salt' not in columns:
                logger.info("添加salt列到licenses表")
                conn.execute('ALTER TABLE licenses ADD COLUMN salt TEXT DEFAULT ""')
            else:
                logger.info("salt列已存在")
                
            if 'hash' not in columns:
                logger.info("添加hash列到licenses表")
                conn.execute('ALTER TABLE licenses ADD COLUMN hash TEXT DEFAULT ""')
            else:
                logger.info("hash列已存在")
            
            conn.commit()
            logger.info("数据库升级成功")
            return True
            
        except sqlite3.OperationalError as e:
            logger.error(f"升级数据库时出错: {str(e)}")
            conn.rollback()
            return False
            
    except Exception as e:
        logger.error(f"连接数据库时出错: {str(e)}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    # 允许从命令行指定数据库文件路径
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    if upgrade_database(db_path):
        logger.info("数据库升级脚本执行完成")
        sys.exit(0)
    else:
        logger.error("数据库升级失败")
        sys.exit(1)
