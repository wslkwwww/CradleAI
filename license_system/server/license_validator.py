import time
import argon2
import logging
import sys
from datetime import datetime
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

class LicenseValidator:
    """许可证验证器类"""
    
    def __init__(self, master_key=None):
        """初始化许可证验证器
        
        Args:
            master_key: 用于验证许可证的主密钥，如果未提供则使用配置中的主密钥
        """
        self.master_key = master_key or config.MASTER_KEY
        if not self.master_key:
            raise ValueError("未提供主密钥，无法初始化许可证验证器")
            
        # 初始化Argon2密码哈希器
        self.ph = argon2.PasswordHasher(
            time_cost=config.KEY_DERIVATION_TIME_COST,
            memory_cost=config.KEY_DERIVATION_MEMORY_COST,
            parallelism=config.KEY_DERIVATION_PARALLELISM,
            hash_len=config.KEY_DERIVATION_HASH_LEN
        )
        
        logger.debug("许可证验证器初始化完成")
        
    def verify_license(self, license_key, device_id, client_ip=None):
        """验证许可证
        
        Args:
            license_key: 许可证密钥
            device_id: 设备ID
            client_ip: 客户端IP地址，用于审计日志和速率限制
            
        Returns:
            如果许可证有效，返回包含许可证信息的字典；否则返回None
        """
        try:
            # 获取许可证信息
            license_info = db_utils.get_license_by_code(license_key)
            if not license_info:
                logger.warning(f"尝试验证不存在的许可证: {license_key}")
                self._log_failed_verification(None, device_id, client_ip, "不存在的许可证")
                return None
                
            # 检查许可证是否被撤销
            if not license_info['is_active']:
                logger.warning(f"尝试验证已撤销的许可证: {license_key}")
                self._log_failed_verification(license_info['id'], device_id, client_ip, "许可证已撤销")
                return None
                
            # 检查是否锁定（连续失败次数过多）
            if license_info['failed_attempts'] >= config.MAX_FAILED_ATTEMPTS:
                # 检查是否在锁定期内
                last_attempt = license_info.get('last_verified_at') or 0
                lockout_time = last_attempt + config.LOCKOUT_DURATION
                
                if time.time() < lockout_time:
                    remaining_time = int(lockout_time - time.time())
                    logger.warning(f"许可证 {license_key} 因多次验证失败而被锁定，剩余锁定时间: {remaining_time}秒")
                    self._log_failed_verification(license_info['id'], device_id, client_ip, "许可证暂时锁定")
                    return None
                else:
                    # 锁定期已过，重置失败次数
                    db_utils.update_license_last_verified(license_key)
                    
            # 检查是否过期
            if license_info['expires_at'] and time.time() > license_info['expires_at']:
                logger.warning(f"尝试验证已过期的许可证: {license_key}")
                self._log_failed_verification(license_info['id'], device_id, client_ip, "许可证已过期")
                db_utils.increment_failed_attempts(license_key)
                return None
                
            # 验证密钥
            try:
                key_material = f"{license_key}:{self.master_key}"
                stored_hash = license_info['hash']
                self.ph.verify(stored_hash, key_material)
            except argon2.exceptions.VerifyMismatchError:
                logger.warning(f"许可证密钥验证失败: {license_key}")
                self._log_failed_verification(license_info['id'], device_id, client_ip, "密钥验证失败")
                db_utils.increment_failed_attempts(license_key)
                return None
                
            # 检查设备绑定
            devices = license_info['devices'].split(',') if license_info['devices'] else []
            
            if device_id not in devices:
                # 如果设备数量已达上限
                if len(devices) >= config.MAX_DEVICES_PER_LICENSE:
                    logger.warning(f"许可证 {license_key} 设备数量已达上限: {len(devices)}/{config.MAX_DEVICES_PER_LICENSE}")
                    self._log_failed_verification(license_info['id'], device_id, client_ip, "设备数量超限")
                    return None
                    
                # 添加新设备
                devices.append(device_id)
                db_utils.update_license_devices(license_key, devices)
                logger.info(f"许可证 {license_key} 新增设备绑定: {device_id}")
                
            # 更新最后验证时间并重置失败次数
            db_utils.update_license_last_verified(license_key)
            
            # 记录成功的验证
            self._log_successful_verification(license_info['id'], device_id, client_ip)
            
            # 格式化过期时间
            expiry_date = (
                datetime.fromtimestamp(license_info['expires_at']).strftime('%Y-%m-%d') 
                if license_info['expires_at'] else '永久'
            )
            
            # 返回许可证信息
            return {
                "license_id": license_info['id'],
                "license_key": license_key,
                "plan_id": license_info['plan_id'],
                "is_valid": True,
                "created_at": license_info['created_at'],
                "expires_at": license_info['expires_at'],
                "expiry_date": expiry_date,
                "device_id": device_id,
                "device_count": len(devices)
            }
            
        except Exception as e:
            logger.error(f"验证许可证时出错: {str(e)}")
            # 记录失败，但不增加失败计数（因为这是服务器错误）
            if license_info:
                self._log_failed_verification(
                    license_info['id'], device_id, client_ip, f"服务器错误: {str(e)}"
                )
            return None
            
    def _log_successful_verification(self, license_id, device_id, client_ip):
        """记录成功的许可证验证"""
        try:
            db_utils.log_action(
                license_id,
                "verify",
                client_ip,
                device_id,
                "success"
            )
        except Exception as e:
            logger.error(f"记录成功验证时出错: {str(e)}")
            
    def _log_failed_verification(self, license_id, device_id, client_ip, reason):
        """记录失败的许可证验证"""
        try:
            db_utils.log_action(
                license_id,
                "verify",
                client_ip,
                device_id,
                "failed",
                reason
            )
        except Exception as e:
            logger.error(f"记录失败验证时出错: {str(e)}")
