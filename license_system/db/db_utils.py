import os
import time
import sqlite3
import logging
import threading
from datetime import datetime

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 数据库文件路径
DB_FILE = os.path.join(os.path.dirname(__file__), 'license_system.db')

# 事务锁字典
transaction_locks = {}
transaction_lock = threading.Lock()

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化数据库"""
    conn = get_db_connection()
    
    try:
        # 创建许可证表
        conn.execute('''
        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            plan_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER,
            is_active INTEGER DEFAULT 1,
            devices TEXT,
            max_devices INTEGER DEFAULT 3,
            failed_attempts INTEGER DEFAULT 0,
            last_verified_at INTEGER,
            salt TEXT,
            hash TEXT
        )
        ''')
        
        # 检查并添加缺失的列
        # 获取licenses表的列信息
        cursor = conn.execute('PRAGMA table_info(licenses)')
        columns = {row['name'] for row in cursor.fetchall()}
        
        # 如果缺少salt列或hash列，添加它们
        if 'salt' not in columns:
            logger.info("添加缺失的salt列到licenses表")
            conn.execute('ALTER TABLE licenses ADD COLUMN salt TEXT')
        
        if 'hash' not in columns:
            logger.info("添加缺失的hash列到licenses表")
            conn.execute('ALTER TABLE licenses ADD COLUMN hash TEXT')
        
        # 如果缺少devices列, 添加它
        if 'devices' not in columns:
            logger.info("添加缺失的devices列到licenses表")
            conn.execute('ALTER TABLE licenses ADD COLUMN devices TEXT')
        
        # 创建审计日志表
        conn.execute('''
        CREATE TABLE IF NOT EXISTS license_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_id INTEGER,
            action_type TEXT NOT NULL,
            client_ip TEXT,
            device_id TEXT,
            status TEXT NOT NULL,
            details TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (license_id) REFERENCES licenses (id)
        )
        ''')
        
        # 创建支付记录表
        conn.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id TEXT UNIQUE NOT NULL,
            zpay_trade_no TEXT,
            amount REAL NOT NULL,
            payment_type TEXT,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            email TEXT,
            license_id INTEGER,
            details TEXT,
            FOREIGN KEY (license_id) REFERENCES licenses(id)
        )
        ''')
        
        conn.commit()
        logger.info("数据库初始化成功")
    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        raise
    finally:
        conn.close()

def save_license(code, salt, hash_value, plan_id, expires_at=None, max_devices=3):
    """保存许可证到数据库"""
    conn = get_db_connection()
    
    try:
        now = int(time.time())
        
        cur = conn.execute(
            'INSERT INTO licenses (code, salt, hash, plan_id, created_at, expires_at, max_devices) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (code, salt, hash_value, plan_id, now, expires_at, max_devices)
        )
        
        license_id = cur.lastrowid
        conn.commit()
        
        return license_id
    except Exception as e:
        conn.rollback()
        logger.error(f"保存许可证失败: {str(e)}")
        raise
    finally:
        conn.close()

def create_license(license_key, salt, hash_value, plan_id, validity_days=None):
    """创建新的许可证
    
    Args:
        license_key: 许可证密钥
        salt: 盐值
        hash_value: 哈希值
        plan_id: 计划ID
        validity_days: 有效期（天）
        
    Returns:
        许可证ID
    """
    conn = get_db_connection()
    
    try:
        now = int(time.time())
        expires_at = None
        if validity_days:
            expires_at = now + (int(validity_days) * 86400)
        
        # 确保使用与init_db()函数中一致的列名
        cur = conn.execute(
            '''INSERT INTO licenses 
               (code, salt, hash, plan_id, created_at, expires_at, devices) 
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (license_key, salt, hash_value, plan_id, now, expires_at, "")
        )
        
        license_id = cur.lastrowid
        
        # 确认插入成功
        if license_id:
            # 验证数据是否正确存储
            verify_cur = conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,))
            inserted_data = verify_cur.fetchone()
            if not inserted_data:
                logger.error(f"创建许可证失败: 无法验证插入的数据 (ID: {license_id})")
                raise Exception("许可证数据验证失败")
                
            # 检查哈希值是否正确存储
            if not inserted_data['hash']:
                logger.error(f"创建许可证失败: 哈希值未正确存储 (ID: {license_id})")
                # 更新记录以添加哈希值
                conn.execute('UPDATE licenses SET hash = ? WHERE id = ?', (hash_value, license_id))
        
        conn.commit()
        logger.info(f"许可证创建成功: {license_key} (ID: {license_id})")
        
        return license_id
    except Exception as e:
        conn.rollback()
        logger.error(f"创建许可证失败: {str(e)}")
        # 添加更详细的错误记录
        import traceback
        logger.error(traceback.format_exc())
        raise
    finally:
        conn.close()

def revoke_license(license_key):
    """撤销许可证
    
    Args:
        license_key: 许可证密钥
    
    Returns:
        布尔值，表示操作是否成功
    """
    conn = get_db_connection()
    
    try:
        conn.execute(
            'UPDATE licenses SET is_active = 0 WHERE code = ?',
            (license_key,)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"撤销许可证失败: {str(e)}")
        return False
    finally:
        conn.close()

def get_license(code):
    """根据许可证码获取许可证信息"""
    conn = get_db_connection()
    
    try:
        cur = conn.execute('SELECT * FROM licenses WHERE code = ?', (code,))
        license_data = cur.fetchone()
        
        if license_data:
            return dict(license_data)
        return None
    except Exception as e:
        logger.error(f"获取许可证失败: {str(e)}")
        return None
    finally:
        conn.close()

def get_license_by_code(code):
    """根据许可证码获取许可证信息"""
    conn = get_db_connection()
    
    try:
        cur = conn.execute('SELECT * FROM licenses WHERE code = ?', (code,))
        license_data = cur.fetchone()
        
        if license_data:
            # 转换为字典并确保所有需要的字段都存在
            result = dict(license_data)
            
            # 确保devices字段存在
            if 'devices' not in result or result['devices'] is None:
                result['devices'] = ""
                
            # 确保salt和hash字段存在
            if 'salt' not in result or result['salt'] is None:
                result['salt'] = ""
                
            if 'hash' not in result or result['hash'] is None:
                result['hash'] = ""
                
            # 检查哈希值是否为空，如果是则记录警告
            if not result['hash']:
                logger.warning(f"许可证 {code} 缺少哈希值，验证可能会失败")
                
            return result
        return None
    except Exception as e:
        logger.error(f"获取许可证失败: {str(e)}")
        return None
    finally:
        conn.close()

def get_license_by_id(license_id):
    """根据ID获取许可证信息"""
    conn = get_db_connection()
    
    try:
        cur = conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,))
        license_data = cur.fetchone()
        
        if license_data:
            return dict(license_data)
        return None
    except Exception as e:
        logger.error(f"根据ID获取许可证失败: {str(e)}")
        return None
    finally:
        conn.close()

def update_license(license_id, **kwargs):
    """更新许可证信息"""
    if not kwargs:
        return False
        
    conn = get_db_connection()
    
    try:
        set_clause = ', '.join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values())
        values.append(license_id)
        
        conn.execute(f'UPDATE licenses SET {set_clause} WHERE id = ?', values)
        conn.commit()
        
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"更新许可证失败: {str(e)}")
        return False
    finally:
        conn.close()

def update_license_last_verified(license_key):
    """更新许可证验证时间并重置失败次数"""
    conn = get_db_connection()
    
    try:
        now = int(time.time())
        conn.execute(
            'UPDATE licenses SET last_verified_at = ?, failed_attempts = 0 WHERE code = ?',
            (now, license_key)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"更新许可证验证时间失败: {str(e)}")
        return False
    finally:
        conn.close()

def increment_failed_attempts(license_key):
    """增加许可证验证失败次数"""
    conn = get_db_connection()
    
    try:
        now = int(time.time())
        conn.execute(
            'UPDATE licenses SET failed_attempts = failed_attempts + 1, last_verified_at = ? WHERE code = ?',
            (now, license_key)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"增加许可证验证失败次数失败: {str(e)}")
        return False
    finally:
        conn.close()

def update_license_devices(license_key, devices):
    """更新许可证绑定的设备列表"""
    conn = get_db_connection()
    
    try:
        devices_str = ','.join(devices) if devices else ''
        conn.execute(
            'UPDATE licenses SET devices = ? WHERE code = ?',
            (devices_str, license_key)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"更新许可证设备列表失败: {str(e)}")
        return False
    finally:
        conn.close()

def log_action(license_id, action_type, client_ip, device_id, status, details=None):
    """记录许可证操作审计日志"""
    conn = get_db_connection()
    
    try:
        now = int(time.time())
        conn.execute(
            '''
            INSERT INTO license_logs (license_id, action_type, client_ip, device_id, status, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (license_id, action_type, client_ip, device_id, status, details, now)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"记录许可证操作日志失败: {str(e)}")
        # 如果失败不要抛出异常，记录日志不应该影响主要业务流程
        return False
    finally:
        conn.close()

def get_license_audit_logs(license_id):
    """获取许可证的审计日志
    
    Args:
        license_id: 许可证ID
        
    Returns:
        审计日志列表
    """
    conn = get_db_connection()
    
    try:
        cur = conn.execute(
            'SELECT * FROM license_logs WHERE license_id = ? ORDER BY created_at DESC',
            (license_id,)
        )
        logs = cur.fetchall()
        
        return [dict(log) for log in logs]
    except Exception as e:
        logger.error(f"获取许可证审计日志失败: {str(e)}")
        return []
    finally:
        conn.close()

def record_payment(transaction_id, zpay_trade_no=None, amount=0.0, payment_type=None, status='pending', email=None, license_id=None, details=None):
    """记录支付交易"""
    conn = get_db_connection()
    
    try:
        now = int(time.time())
        
        cur = conn.execute(
            '''
            INSERT INTO payments (transaction_id, zpay_trade_no, amount, payment_type, status, created_at, email, license_id, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (transaction_id, zpay_trade_no, amount, payment_type, status, now, email, license_id, details)
        )
        
        payment_id = cur.lastrowid
        conn.commit()
        
        return payment_id
    except Exception as e:
        conn.rollback()
        logger.error(f"记录支付交易失败: {str(e)}")
        raise
    finally:
        conn.close()

def get_payment_by_transaction_id(transaction_id):
    """根据交易ID获取支付记录"""
    conn = get_db_connection()
    
    try:
        cur = conn.execute('SELECT * FROM payments WHERE transaction_id = ?', (transaction_id,))
        payment_data = cur.fetchone()
        
        if payment_data:
            return dict(payment_data)
        return None
    except Exception as e:
        logger.error(f"获取支付记录失败: {str(e)}")
        return None
    finally:
        conn.close()

def update_payment(payment_id, **kwargs):
    """更新支付记录"""
    if not kwargs:
        return False
        
    conn = get_db_connection()
    
    try:
        set_clause = ', '.join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values())
        values.append(payment_id)
        
        conn.execute(f'UPDATE payments SET {set_clause} WHERE id = ?', values)
        conn.commit()
        
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"更新支付记录失败: {str(e)}")
        return False
    finally:
        conn.close()

def lock_transaction(transaction_id, timeout=10):
    """锁定交易处理，防止并发问题"""
    deadline = time.time() + timeout
    
    while time.time() < deadline:
        with transaction_lock:
            if transaction_id not in transaction_locks:
                transaction_locks[transaction_id] = True
                return True
        time.sleep(0.1)
    
    return False

def unlock_transaction(transaction_id):
    """解锁交易"""
    with transaction_lock:
        if transaction_id in transaction_locks:
            del transaction_locks[transaction_id]
            return True
    return False
