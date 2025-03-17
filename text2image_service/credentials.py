"""
NovelAI credentials management

This module handles the secure storage and retrieval of NovelAI credentials.
"""

import os
import json
import logging
import random
from datetime import datetime

# 配置日志
logger = logging.getLogger('text2image.credentials')

# 默认证书文件路径
CREDENTIALS_FILE = os.environ.get(
    'NOVELAI_CREDENTIALS_FILE', 
    os.path.join(os.path.dirname(__file__), 'secure', 'credentials.json')
)

# 当前使用的账号索引
_current_credential_index = 0
# 上次尝试失败的账号索引列表，避免短时间内重复尝试失败的账号
_failed_credential_indices = []
# 失败账号的冷却期(秒)
FAILED_CREDENTIAL_COOLDOWN = 1800  # 30分钟

def get_credentials():
    """获取存储的NovelAI凭据
    
    Returns:
        dict: 包含email和password的字典，如果未配置则返回None
    """
    global _current_credential_index, _failed_credential_indices
    
    try:
        if not os.path.exists(CREDENTIALS_FILE):
            logger.warning(f"凭据文件不存在: {CREDENTIALS_FILE}")
            return None
            
        with open(CREDENTIALS_FILE, 'r') as f:
            credentials_data = json.load(f)
        
        # 检查是否是多账号格式
        if isinstance(credentials_data, dict) and 'credentials' in credentials_data:
            # 新格式：多账号
            credentials_list = credentials_data['credentials']
            if not credentials_list:
                logger.error("凭据列表为空")
                return None
                
            # 清理超过冷却期的失败账号
            now = datetime.now().timestamp()
            _failed_credential_indices = [
                (idx, timestamp) for idx, timestamp in _failed_credential_indices
                if now - timestamp < FAILED_CREDENTIAL_COOLDOWN
            ]
            failed_indices = [idx for idx, _ in _failed_credential_indices]
            
            # 尝试使用可用账号
            available_indices = [i for i in range(len(credentials_list)) if i not in failed_indices]
            
            if not available_indices:
                # 所有账号都在冷却期，从失败列表中选取冷却时间最长的账号
                _failed_credential_indices.sort(key=lambda x: x[1])  # 按时间戳排序
                _current_credential_index = _failed_credential_indices[0][0]
                logger.warning(f"所有账号都在冷却期，使用冷却时间最长的账号 (索引: {_current_credential_index})")
            else:
                # 有可用账号，选择一个随机账号
                _current_credential_index = random.choice(available_indices)
                logger.info(f"使用可用账号 (索引: {_current_credential_index})")
                
            credentials = credentials_list[_current_credential_index]
            
            # 添加索引信息，便于追踪
            credentials['index'] = _current_credential_index
            credentials['total'] = len(credentials_list)
            
            # 验证凭据格式
            if not credentials.get('email') or not credentials.get('password'):
                logger.error(f"账号 {_current_credential_index} 格式无效，缺少email或password字段")
                mark_credential_failed(_current_credential_index)
                return get_credentials()  # 递归调用，尝试下一个账号
                
            return credentials
        else:
            # 旧格式：单账号
            # 验证凭据格式
            if not credentials_data.get('email') or not credentials_data.get('password'):
                logger.error("凭据文件格式无效，缺少email或password字段")
                return None
            
            # 添加索引信息
            credentials_data['index'] = 0
            credentials_data['total'] = 1
            
            return credentials_data
    except Exception as e:
        logger.error(f"读取凭据文件失败: {e}")
        return None

def mark_credential_failed(index=None):
    """标记当前使用的账号凭据已失效
    
    Args:
        index: 账号索引，如果为None则使用当前索引
    """
    global _current_credential_index, _failed_credential_indices
    
    if index is None:
        index = _current_credential_index
    
    # 记录失败时间
    now = datetime.now().timestamp()
    _failed_credential_indices.append((index, now))
    
    logger.warning(f"账号 {index} 已标记为失效，将在 {FAILED_CREDENTIAL_COOLDOWN/60:.1f} 分钟后重试")
    
    # 保存失败记录到文件（可选）
    try:
        failure_log_file = os.path.join(os.path.dirname(CREDENTIALS_FILE), 'credential_failures.json')
        
        # 读取现有记录
        failures = {}
        if os.path.exists(failure_log_file):
            with open(failure_log_file, 'r') as f:
                try:
                    failures = json.load(f)
                except:
                    failures = {}
        
        # 更新记录
        if str(index) not in failures:
            failures[str(index)] = []
        
        failures[str(index)].append({
            "timestamp": now,
            "time": datetime.fromtimestamp(now).strftime("%Y-%m-%d %H:%M:%S")
        })
        
        # 保存记录
        with open(failure_log_file, 'w') as f:
            json.dump(failures, f, indent=2)
    except Exception as e:
        logger.error(f"保存失败记录时出错: {e}")

def save_credentials(email, password, index=None):
    """保存NovelAI凭据
    
    Args:
        email: NovelAI账号邮箱
        password: NovelAI账号密码
        index: 账号索引，如果为None则追加新账号
        
    Returns:
        bool: 是否保存成功
    """
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(CREDENTIALS_FILE), exist_ok=True)
        
        # 准备新凭据
        new_credential = {
            'email': email,
            'password': password,
            'updated_at': datetime.now().isoformat()
        }
        
        # 尝试读取现有凭据文件
        if os.path.exists(CREDENTIALS_FILE):
            with open(CREDENTIALS_FILE, 'r') as f:
                try:
                    credentials_data = json.load(f)
                except:
                    credentials_data = {"credentials": []}
        else:
            credentials_data = {"credentials": []}
        
        # 确保数据格式是多账号格式
        if not isinstance(credentials_data, dict) or 'credentials' not in credentials_data:
            # 将旧格式转换为新格式
            if isinstance(credentials_data, dict) and 'email' in credentials_data and 'password' in credentials_data:
                old_cred = credentials_data
                credentials_data = {
                    "credentials": [old_cred],
                    "format_version": "2.0",
                    "updated_at": datetime.now().isoformat()
                }
            else:
                # 创建新的空列表
                credentials_data = {
                    "credentials": [],
                    "format_version": "2.0",
                    "updated_at": datetime.now().isoformat()
                }
        
        # 更新或追加凭据
        if index is not None and 0 <= index < len(credentials_data['credentials']):
            # 更新现有账号
            credentials_data['credentials'][index] = new_credential
            logger.info(f"更新账号 {index}: {email}")
        else:
            # 追加新账号
            credentials_data['credentials'].append(new_credential)
            logger.info(f"添加新账号: {email}")
        
        # 更新时间戳
        credentials_data['updated_at'] = datetime.now().isoformat()
        
        # 保存凭据
        with open(CREDENTIALS_FILE, 'w') as f:
            json.dump(credentials_data, f, indent=2)
            
        # 设置文件权限为只有所有者可读写
        os.chmod(CREDENTIALS_FILE, 0o600)
        
        logger.info(f"凭据已保存到: {CREDENTIALS_FILE}")
        return True
    except Exception as e:
        logger.error(f"保存凭据失败: {e}")
        return False

def has_credentials():
    """检查是否已配置凭据
    
    Returns:
        bool: 是否已配置有效凭据
    """
    return get_credentials() is not None

def get_all_credentials():
    """获取所有存储的凭据
    
    Returns:
        list: 所有凭据的列表
    """
    try:
        if not os.path.exists(CREDENTIALS_FILE):
            return []
            
        with open(CREDENTIALS_FILE, 'r') as f:
            credentials_data = json.load(f)
        
        # 检查是否是多账号格式
        if isinstance(credentials_data, dict) and 'credentials' in credentials_data:
            return credentials_data['credentials']
        elif isinstance(credentials_data, dict) and 'email' in credentials_data:
            # 旧格式，只有一个账号
            return [credentials_data]
        else:
            return []
    except Exception as e:
        logger.error(f"读取凭据文件失败: {e}")
        return []

def remove_credential(index):
    """删除指定索引的凭据
    
    Args:
        index: 要删除的凭据索引
        
    Returns:
        bool: 是否删除成功
    """
    try:
        if not os.path.exists(CREDENTIALS_FILE):
            return False
            
        with open(CREDENTIALS_FILE, 'r') as f:
            credentials_data = json.load(f)
        
        # 检查是否是多账号格式
        if not isinstance(credentials_data, dict) or 'credentials' not in credentials_data:
            logger.error("凭据文件不是多账号格式")
            return False
        
        # 检查索引是否有效
        if index < 0 or index >= len(credentials_data['credentials']):
            logger.error(f"无效的凭据索引: {index}")
            return False
        
        # 记录要删除的邮箱
        email = credentials_data['credentials'][index].get('email', 'unknown')
        
        # 删除凭据
        del credentials_data['credentials'][index]
        
        # 更新时间戳
        credentials_data['updated_at'] = datetime.now().isoformat()
        
        # 保存凭据
        with open(CREDENTIALS_FILE, 'w') as f:
            json.dump(credentials_data, f, indent=2)
        
        logger.info(f"已删除账号 {index}: {email}")
        return True
    except Exception as e:
        logger.error(f"删除凭据失败: {e}")
        return False
