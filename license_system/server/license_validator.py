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
                # 检查哈希值是否存在
                stored_hash = license_info['hash']
                if not stored_hash:
                    logger.error(f"许可证 {license_key} 缺少哈希值")
                    
                    # 尝试修复缺失的哈希值
                    try:
                        logger.warning(f"尝试修复缺失的哈希值...")
                        key_material = f"{license_key}:{self.master_key}"
                        new_hash = self.ph.hash(key_material)
                        db_utils.update_license(license_info['id'], hash=new_hash)
                        stored_hash = new_hash
                        logger.info(f"已修复许可证 {license_key} 的哈希值")
                    except Exception as e:
                        logger.error(f"修复哈希值失败: {str(e)}")
                        self._log_failed_verification(license_info['id'], device_id, client_ip, "许可证数据不完整")
                        return None
                
                # 显示更多调试信息以帮助诊断问题
                logger.debug(f"验证许可证哈希值: (密钥前缀) {license_key[:4]}****:{self.master_key[:4]}****")
                logger.debug(f"存储的哈希值前缀: {stored_hash[:30]}...")
                
                key_material = f"{license_key}:{self.master_key}"
                verification_result = False
                
                try:
                    # 尝试标准验证
                    self.ph.verify(stored_hash, key_material)
                    verification_result = True
                    logger.debug(f"许可证 {license_key} 标准哈希验证成功")
                except argon2.exceptions.VerifyMismatchError:
                    logger.warning(f"许可证标准哈希验证失败: {license_key}")
                    
                    # 尝试重新计算哈希值并更新
                    try:
                        logger.warning(f"尝试重新生成并更新哈希值...")
                        new_hash = self.ph.hash(key_material)
                        db_utils.update_license(license_info['id'], hash=new_hash)
                        
                        # 再次验证
                        self.ph.verify(new_hash, key_material)
                        verification_result = True
                        logger.info(f"使用重新生成的哈希值验证成功")
                    except Exception as e:
                        logger.error(f"重新生成哈希值验证失败: {str(e)}")
                
                if not verification_result:
                    self._log_failed_verification(license_info['id'], device_id, client_ip, "密钥验证失败")
                    db_utils.increment_failed_attempts(license_key)
                    return None
                    
            except Exception as e:
                logger.error(f"验证哈希时出错: {str(e)}")
                self._log_failed_verification(license_info['id'], device_id, client_ip, f"哈希验证错误: {str(e)}")
                return None
                
            # 检查设备绑定
            devices = license_info['devices'].split(',') if license_info['devices'] else []
            # 过滤空字符串
            devices = [d for d in devices if d]
            
            if device_id not in devices:
                # 如果设备数量已达上限
                max_devices = license_info.get('max_devices', config.MAX_DEVICES_PER_LICENSE)
                if len(devices) >= max_devices:
                    logger.warning(f"许可证 {license_key} 设备数量已达上限: {len(devices)}/{max_devices}")
                    self._log_failed_verification(license_info['id'], device_id, client_ip, "设备数量超限")
                    return None
                    
                # 添加新设备
                devices.append(device_id)
                db_utils.update_license_devices(license_key, devices)
                logger.info(f"许可证 {license_key} 新增设备绑定: {device_id}")
            else:
                logger.debug(f"设备 {device_id} 已绑定到许可证 {license_key}")
                
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
            # 确保在发生异常时license_info变量已定义
            license_id = getattr(license_info, 'id', None) if 'license_info' in locals() else None
            self._log_failed_verification(
                license_id, device_id, client_ip, f"服务器错误: {str(e)}"
            )
            # 添加详细的堆栈跟踪以便调试
            import traceback
            logger.error(traceback.format_exc())
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
