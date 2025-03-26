import secrets
import time
import argon2
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 添加项目根目录到Python路径以支持绝对导入
current_dir = Path(__file__).parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 现在导入依赖模块
from db import db_utils
from server import config

# 设置日志
logger = logging.getLogger(__name__)

class LicenseGenerator:
    """许可证生成器类"""
    
    def __init__(self, master_key=None):
        """初始化许可证生成器
        
        Args:
            master_key: 用于派生许可证密钥的主密钥，如果未提供则使用配置中的主密钥
        """
        self.master_key = master_key or config.MASTER_KEY
        if not self.master_key:
            raise ValueError("未提供主密钥，无法初始化许可证生成器")
            
        # 初始化Argon2密码哈希器
        self.ph = argon2.PasswordHasher(
            time_cost=config.KEY_DERIVATION_TIME_COST,
            memory_cost=config.KEY_DERIVATION_MEMORY_COST,
            parallelism=config.KEY_DERIVATION_PARALLELISM,
            hash_len=config.KEY_DERIVATION_HASH_LEN
        )
        
        logger.debug("许可证生成器初始化完成")
        
    def generate_license(self, plan_id, validity_days=None, client_ip=None):
        """生成新的许可证
        
        Args:
            plan_id: 订阅计划ID
            validity_days: 许可证有效期（天），如果未提供则使用配置中的默认值
            client_ip: 客户端IP地址，用于审计日志
        
        Returns:
            包含许可证信息的字典
        """
        if validity_days is None:
            validity_days = config.LICENSE_DEFAULT_VALIDITY_DAYS
            
        # 生成随机许可证编码
        license_key = secrets.token_urlsafe(config.LICENSE_KEY_LENGTH)
        
        # 生成随机盐值
        salt = secrets.token_hex(16)
        
        # 计算过期时间
        created_at = int(time.time())
        expires_at = created_at + (validity_days * 86400)
        expiry_date = datetime.fromtimestamp(expires_at).strftime('%Y-%m-%d')
        
        try:
            # 派生密钥并生成哈希
            key_material = f"{license_key}:{self.master_key}"
            hash_value = self.ph.hash(key_material)
            
            # 将许可证信息存储到数据库
            license_id = db_utils.create_license(
                license_key, salt, hash_value, plan_id, validity_days
            )
            
            if not license_id:
                logger.error(f"创建许可证失败: {license_key}")
                raise Exception("创建许可证失败")
                
            # 记录审计日志
            db_utils.log_action(
                license_id,
                "generate",
                client_ip or "internal",
                None,
                "success",
                f"plan_id={plan_id}, validity_days={validity_days}"
            )
            
            logger.info(f"成功生成许可证: {license_key}, 计划: {plan_id}, 有效期: {validity_days}天")
            
            # 返回许可证信息
            return {
                "license_id": license_id,
                "license_key": license_key,
                "plan_id": plan_id,
                "created_at": created_at,
                "expires_at": expires_at,
                "expiry_date": expiry_date
            }
            
        except Exception as e:
            logger.error(f"生成许可证时出错: {str(e)}")
            raise
            
    def revoke_license(self, license_key, client_ip=None, reason=None):
        """撤销许可证
        
        Args:
            license_key: 要撤销的许可证密钥
            client_ip: 客户端IP地址，用于审计日志
            reason: 撤销原因，用于审计日志
            
        Returns:
            布尔值，表示操作是否成功
        """
        try:
            # 获取许可证信息
            license_info = db_utils.get_license_by_code(license_key)
            if not license_info:
                logger.warning(f"尝试撤销不存在的许可证: {license_key}")
                return False
                
            # 撤销许可证
            success = db_utils.revoke_license(license_key)
            
            if success:
                # 记录审计日志
                db_utils.log_action(
                    license_info['id'],
                    "revoke",
                    client_ip or "internal",
                    None,
                    "success",
                    reason or "管理员操作"
                )
                
                logger.info(f"成功撤销许可证: {license_key}")
                
            return success
            
        except Exception as e:
            logger.error(f"撤销许可证时出错: {str(e)}")
            return False
            
    def regenerate_license(self, old_license_key, validity_days=None, client_ip=None):
        """重新生成许可证（续订或升级场景）
        
        Args:
            old_license_key: 旧许可证密钥
            validity_days: 新许可证的有效期（天）
            client_ip: 客户端IP地址，用于审计日志
            
        Returns:
            包含新许可证信息的字典，如果操作失败则为None
        """
        try:
            # 获取旧许可证信息
            old_license = db_utils.get_license_by_code(old_license_key)
            if not old_license:
                logger.warning(f"尝试续订不存在的许可证: {old_license_key}")
                return None
                
            # 生成新许可证
            new_license = self.generate_license(
                old_license['plan_id'],
                validity_days,
                client_ip
            )
            
            # 撤销旧许可证
            self.revoke_license(
                old_license_key,
                client_ip,
                f"已续订为新许可证: {new_license['license_key']}"
            )
            
            logger.info(f"许可证续订成功: {old_license_key} -> {new_license['license_key']}")
            
            return new_license
            
        except Exception as e:
            logger.error(f"重新生成许可证时出错: {str(e)}")
            return None
