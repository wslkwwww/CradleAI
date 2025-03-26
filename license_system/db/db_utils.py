import os
import sqlite3
import time
import logging
import sys
from contextlib import contextmanager
from pathlib import Path

# 添加项目根目录到Python路径以支持绝对导入
current_dir = Path(__file__).parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 设置日志
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("db_utils")

# 获取数据库路径
DB_PATH = os.environ.get('LICENSE_DB_PATH', str(Path(__file__).parent / 'license.db'))
DB_SCHEMA_PATH = Path(__file__).parent / 'schema.sql'

def init_db():
    """初始化数据库，创建所需表"""
    try:
        logger.info(f"正在初始化数据库: {DB_PATH}")
        # 确保父目录存在
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        
        # 读取模式文件
        with open(DB_SCHEMA_PATH, 'r', encoding='utf-8') as f:
            schema = f.read()
        
        # 创建数据库并执行建表语句
        with get_db_connection() as conn:
            conn.executescript(schema)
            conn.commit()
        
        logger.info("数据库初始化成功")
        return True
    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        return False

@contextmanager
def get_db_connection():
    """创建数据库连接的上下文管理器"""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        yield conn
    except sqlite3.Error as e:
        logger.error(f"数据库连接错误: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def log_action(code_id, action, client_ip, device_id, status, details=None):
    """记录操作到审计日志"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                """
                INSERT INTO license_audit_log 
                (code_id, action, timestamp, client_ip, device_id, status, details) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (code_id, action, int(time.time()), client_ip, device_id, status, details)
            )
            conn.commit()
            
            logger.info(f"记录审计日志: {action} - {status}")
            return True
    except Exception as e:
        logger.error(f"记录审计日志失败: {str(e)}")
        return False

def get_license_by_code(code):
    """根据许可证编码获取许可证信息"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                """
                SELECT id, code, salt, hash, devices, plan_id, created_at, expires_at, is_active, failed_attempts, last_verified_at
                FROM activation_codes
                WHERE code = ?
                """,
                (code,)
            )
            
            result = cursor.fetchone()
            if result:
                return dict(result)
            return None
    except Exception as e:
        logger.error(f"获取许可证信息失败: {str(e)}")
        return None

def update_license_devices(code, devices):
    """更新许可证的设备绑定信息"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # 将设备列表转换为逗号分隔的字符串
            devices_str = ','.join(devices)
            
            cursor.execute(
                "UPDATE activation_codes SET devices = ? WHERE code = ?",
                (devices_str, code)
            )
            conn.commit()
            
            logger.info(f"更新许可证设备绑定: {code}")
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"更新许可证设备绑定失败: {str(e)}")
        return False

def update_license_last_verified(code):
    """更新许可证最后验证时间"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE activation_codes SET last_verified_at = ?, failed_attempts = 0 WHERE code = ?",
                (int(time.time()), code)
            )
            conn.commit()
            
            logger.info(f"更新许可证最后验证时间: {code}")
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"更新许可证最后验证时间失败: {str(e)}")
        return False

def increment_failed_attempts(code):
    """增加许可证验证失败次数"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE activation_codes SET failed_attempts = failed_attempts + 1 WHERE code = ?",
                (code,)
            )
            conn.commit()
            
            logger.info(f"增加许可证验证失败次数: {code}")
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"增加许可证验证失败次数失败: {str(e)}")
        return False

def create_license(code, salt, hash_value, plan_id, validity_days=365):
    """创建新的许可证"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # 计算过期时间
            created_at = int(time.time())
            expires_at = created_at + (validity_days * 86400) if validity_days else None
            
            cursor.execute(
                """
                INSERT INTO activation_codes 
                (code, salt, hash, plan_id, created_at, expires_at, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                (code, salt, hash_value, plan_id, created_at, expires_at)
            )
            conn.commit()
            
            logger.info(f"创建许可证成功: {code}")
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"创建许可证失败: {str(e)}")
        return None

def revoke_license(code):
    """撤销许可证"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE activation_codes SET is_active = 0 WHERE code = ?",
                (code,)
            )
            conn.commit()
            
            logger.info(f"撤销许可证: {code}")
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"撤销许可证失败: {str(e)}")
        return False

def record_payment(transaction_id, amount, currency, status, customer_email, code_id=None, details=None):
    """记录支付交易"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                """
                INSERT INTO payment_transactions
                (transaction_id, amount, currency, status, customer_email, code_id, timestamp, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (transaction_id, amount, currency, status, customer_email, code_id, int(time.time()), details)
            )
            conn.commit()
            
            logger.info(f"记录支付交易: {transaction_id}")
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"记录支付交易失败: {str(e)}")
        return None

def get_payment_by_transaction_id(transaction_id):
    """根据交易ID获取支付信息"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                """
                SELECT * FROM payment_transactions
                WHERE transaction_id = ?
                """,
                (transaction_id,)
            )
            
            result = cursor.fetchone()
            if result:
                return dict(result)
            return None
    except Exception as e:
        logger.error(f"获取支付信息失败: {str(e)}")
        return None

if __name__ == "__main__":
    # 当作为脚本运行时，初始化数据库
    init_db()
