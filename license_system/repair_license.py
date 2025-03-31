"""
修复或重新生成许可证哈希值的工具
"""
import os
import sys
import argon2
import logging
import argparse
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent))

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 导入需要的模块
from db import db_utils
from server import config
from server.license_validator import LicenseValidator

def repair_license(license_key, force=False, verify=True):
    """
    修复许可证的哈希值
    
    Args:
        license_key: 要修复的许可证密钥
        force: 即使许可证看似正常也强制重新生成哈希值
        verify: 修复后验证许可证
    
    Returns:
        布尔值，表示操作是否成功
    """
    # 初始化数据库
    logger.info("初始化数据库...")
    db_utils.init_db()
    
    # 获取许可证信息
    license_info = db_utils.get_license_by_code(license_key)
    if not license_info:
        logger.error(f"找不到许可证: {license_key}")
        return False
    
    logger.info(f"找到许可证: {license_key} (ID: {license_info['id']})")
    
    # 检查哈希值是否存在
    if not license_info['hash'] or force:
        action = "生成" if not license_info['hash'] else "重新生成"
        logger.info(f"{action}许可证哈希值...")
        
        # 创建Argon2密码哈希器
        ph = argon2.PasswordHasher(
            time_cost=config.KEY_DERIVATION_TIME_COST,
            memory_cost=config.KEY_DERIVATION_MEMORY_COST,
            parallelism=config.KEY_DERIVATION_PARALLELISM,
            hash_len=config.KEY_DERIVATION_HASH_LEN
        )
        
        # 生成哈希值
        master_key = config.MASTER_KEY
        key_material = f"{license_key}:{master_key}"
        new_hash = ph.hash(key_material)
        
        # 更新许可证
        if db_utils.update_license(license_info['id'], hash=new_hash):
            logger.info(f"成功{action}许可证哈希值")
        else:
            logger.error(f"{action}许可证哈希值失败")
            return False
    else:
        logger.info("许可证哈希值已存在，未进行修改")
    
    # 验证许可证
    if verify:
        logger.info("验证许可证...")
        device_id = "repair_tool_device"
        validator = LicenseValidator()
        result = validator.verify_license(license_key, device_id)
        
        if result and result['is_valid']:
            logger.info("许可证验证成功!")
            return True
        else:
            logger.error("许可证验证失败!")
            logger.info("尝试删除设备绑定并再次验证...")
            
            # 删除设备绑定
            db_utils.update_license_devices(license_key, [])
            logger.info("已清除设备绑定")
            
            # 重置失败次数
            db_utils.update_license(license_info['id'], failed_attempts=0)
            logger.info("已重置失败尝试次数")
            
            # 再次验证
            result = validator.verify_license(license_key, device_id)
            if result and result['is_valid']:
                logger.info("清除设备绑定后许可证验证成功!")
                return True
            else:
                logger.error("清除设备绑定后许可证验证仍然失败!")
                return False
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="修复许可证的哈希值")
    parser.add_argument("license_key", help="要修复的许可证密钥")
    parser.add_argument("--force", action="store_true", help="即使许可证看似正常也强制重新生成哈希值")
    parser.add_argument("--no-verify", action="store_true", help="不验证修复后的许可证")
    
    args = parser.parse_args()
    
    # 确保有主密钥
    if "LICENSE_MASTER_KEY" not in os.environ or not os.environ["LICENSE_MASTER_KEY"]:
        os.environ["LICENSE_MASTER_KEY"] = "test_master_key_for_testing_purposes_only"
        logger.info("使用测试主密钥")
    
    success = repair_license(args.license_key, args.force, not args.no_verify)
    if success:
        logger.info("许可证修复成功")
        sys.exit(0)
    else:
        logger.error("许可证修复失败")
        sys.exit(1)
