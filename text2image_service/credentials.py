"""
NovelAI credentials management

This module handles the secure storage and retrieval of NovelAI credentials.
"""

import os
import json
import logging
from datetime import datetime

# 配置日志
logger = logging.getLogger('text2image.credentials')

# 默认证书文件路径
CREDENTIALS_FILE = os.environ.get(
    'NOVELAI_CREDENTIALS_FILE', 
    os.path.join(os.path.dirname(__file__), 'secure', 'credentials.json')
)

def get_credentials():
    """获取存储的NovelAI凭据
    
    Returns:
        dict: 包含email和password的字典，如果未配置则返回None
    """
    try:
        if not os.path.exists(CREDENTIALS_FILE):
            logger.warning(f"凭据文件不存在: {CREDENTIALS_FILE}")
            return None
            
        with open(CREDENTIALS_FILE, 'r') as f:
            credentials = json.load(f)
            
        # 验证凭据格式
        if not credentials.get('email') or not credentials.get('password'):
            logger.error("凭据文件格式无效，缺少email或password字段")
            return None
            
        return credentials
    except Exception as e:
        logger.error(f"读取凭据文件失败: {e}")
        return None

def save_credentials(email, password):
    """保存NovelAI凭据
    
    Args:
        email: NovelAI账号邮箱
        password: NovelAI账号密码
        
    Returns:
        bool: 是否保存成功
    """
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(CREDENTIALS_FILE), exist_ok=True)
        
        # 保存凭据
        credentials = {
            'email': email,
            'password': password,
            'updated_at': datetime.now().isoformat()
        }
        
        with open(CREDENTIALS_FILE, 'w') as f:
            json.dump(credentials, f, indent=2)
            
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
