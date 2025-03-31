"""
测试许可证系统的生成和验证功能
"""
import os
import sys
import logging
from pathlib import Path
import time
import json

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent))

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 导入需要的模块
from db import db_utils
from server.license_generator import LicenseGenerator
from server.license_validator import LicenseValidator
from generate_test_license import generate_test_license

def test_create_and_verify():
    """测试许可证创建和验证的完整流程"""
    logger.info("=== 开始测试许可证创建和验证 ===")
    
    # 确保有主密钥
    if "LICENSE_MASTER_KEY" not in os.environ or not os.environ["LICENSE_MASTER_KEY"]:
        master_key = "test_master_key_for_end_to_end_testing"
        os.environ["LICENSE_MASTER_KEY"] = master_key
        logger.info(f"使用测试主密钥: {master_key[:4]}****")
    else:
        master_key = os.environ["LICENSE_MASTER_KEY"]
        logger.info(f"使用环境变量中的主密钥: {master_key[:4]}****")
    
    # 初始化数据库
    logger.info("初始化数据库...")
    db_utils.init_db()
    
    # 步骤1: 使用LicenseGenerator直接创建许可证
    logger.info("\n步骤1: 使用LicenseGenerator直接创建许可证")
    generator = LicenseGenerator(master_key)
    validator = LicenseValidator(master_key)
    
    license_data = generator.generate_license("test_plan", 30)
    license_key = license_data['license_key']
    
    logger.info(f"许可证创建成功: {license_key}")
    
    # 步骤2: 验证刚创建的许可证
    logger.info("\n步骤2: 验证刚创建的许可证")
    device_id = "test_device_direct"
    verification_result = validator.verify_license(license_key, device_id)
    
    if verification_result and verification_result['is_valid']:
        logger.info("许可证验证成功!")
    else:
        logger.error("许可证验证失败!")
    
    # 步骤3: 使用generate_test_license创建许可证
    logger.info("\n步骤3: 使用generate_test_license创建许可证")
    test_license = generate_test_license(
        plan_id="generated_test_plan",
        validity_days=30,
        device_id=None,  # 暂不验证
        verify=False
    )
    
    if test_license:
        test_license_key = test_license['license_key']
        logger.info(f"测试许可证创建成功: {test_license_key}")
        
        # 步骤4: 验证测试许可证
        logger.info("\n步骤4: 验证测试许可证")
        test_device_id = "test_device_generated"
        test_verification = validator.verify_license(test_license_key, test_device_id)
        
        if test_verification and test_verification['is_valid']:
            logger.info("测试许可证验证成功!")
        else:
            logger.error("测试许可证验证失败!")
            
            # 尝试修复并重新验证
            from repair_license import repair_license
            logger.info("尝试修复许可证...")
            
            if repair_license(test_license_key, force=True, verify=True):
                logger.info("修复成功并已验证!")
            else:
                logger.error("即使修复后验证仍然失败!")
    else:
        logger.error("测试许可证创建失败!")
    
    logger.info("\n=== 许可证测试完成 ===")

if __name__ == "__main__":
    test_create_and_verify()
