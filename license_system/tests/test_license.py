import os
import sys
import unittest
import time
from pathlib import Path

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from server.license_generator import LicenseGenerator
from server.license_validator import LicenseValidator
from db import db_utils

# Setup a test environment
os.environ["ENV"] = "test"
os.environ["LICENSE_DB_PATH"] = ":memory:"  # Use in-memory SQLite for testing
os.environ["LICENSE_MASTER_KEY"] = "test_master_key_for_testing_purposes_only"

class TestLicenseSystem(unittest.TestCase):
    """测试许可证系统的生成与验证功能"""
    
    def setUp(self):
        """设置测试环境"""
        # 确保数据库已初始化
        db_utils.init_db()
        
        # 创建许可证生成器和验证器实例
        self.generator = LicenseGenerator()
        self.validator = LicenseValidator()
        
        # 测试用的计划ID和设备ID
        self.plan_id = "test_plan"
        self.device_id = "test_device_01"
        
    def test_license_generation(self):
        """测试许可证生成"""
        # 生成一个测试许可证
        license_data = self.generator.generate_license(self.plan_id)
        
        # 验证返回的数据
        self.assertIsNotNone(license_data)
        self.assertIn('license_key', license_data)
        self.assertIn('license_id', license_data)
        self.assertIn('plan_id', license_data)
        self.assertIn('expires_at', license_data)
        
        # 验证数据库中的许可证
        license_info = db_utils.get_license_by_code(license_data['license_key'])
        self.assertIsNotNone(license_info)
        self.assertEqual(license_info['plan_id'], self.plan_id)
        
        # 验证审计日志
        # 这里应该有一个查询审计日志的工具函数，但为简化测试，我们跳过这一部分
        
    def test_license_validation(self):
        """测试许可证验证"""
        # 生成一个测试许可证
        license_data = self.generator.generate_license(self.plan_id)
        license_key = license_data['license_key']
        
        # 使用设备ID验证许可证
        validation_result = self.validator.verify_license(license_key, self.device_id)
        
        # 验证结果
        self.assertIsNotNone(validation_result)
        self.assertTrue(validation_result['is_valid'])
        self.assertEqual(validation_result['license_key'], license_key)
        self.assertEqual(validation_result['plan_id'], self.plan_id)
        
        # 验证设备已绑定
        license_info = db_utils.get_license_by_code(license_key)
        self.assertIn(self.device_id, license_info['devices'])
        
    def test_device_limit(self):
        """测试设备数量限制"""
        # 生成一个测试许可证
        license_data = self.generator.generate_license(self.plan_id)
        license_key = license_data['license_key']
        
        # 添加最大数量的设备
        max_devices = 3
        devices = []
        
        for i in range(max_devices):
            device_id = f"test_device_{i:02d}"
            devices.append(device_id)
            validation_result = self.validator.verify_license(license_key, device_id)
            self.assertIsNotNone(validation_result)
            self.assertTrue(validation_result['is_valid'])
            
        # 验证所有设备已绑定
        license_info = db_utils.get_license_by_code(license_key)
        for device_id in devices:
            self.assertIn(device_id, license_info['devices'])
            
        # 尝试添加超出限制的设备
        extra_device = "test_device_extra"
        validation_result = self.validator.verify_license(license_key, extra_device)
        self.assertIsNone(validation_result)  # 应该返回None表示验证失败
        
        # 验证多余设备未被绑定
        license_info = db_utils.get_license_by_code(license_key)
        self.assertNotIn(extra_device, license_info['devices'])
        
    def test_license_revocation(self):
        """测试许可证撤销"""
        # 生成一个测试许可证
        license_data = self.generator.generate_license(self.plan_id)
        license_key = license_data['license_key']
        
        # 先验证许可证有效
        validation_result = self.validator.verify_license(license_key, self.device_id)
        self.assertIsNotNone(validation_result)
        self.assertTrue(validation_result['is_valid'])
        
        # 撤销许可证
        revocation_result = self.generator.revoke_license(license_key)
        self.assertTrue(revocation_result)
        
        # 再次验证，应该失败
        validation_result = self.validator.verify_license(license_key, self.device_id)
        self.assertIsNone(validation_result)
        
        # 检查许可证状态
        license_info = db_utils.get_license_by_code(license_key)
        self.assertFalse(license_info['is_active'])
        
    def test_expired_license(self):
        """测试过期许可证"""
        # 生成一个即将过期的测试许可证（有效期1秒）
        license_data = self.generator.generate_license(self.plan_id, validity_days=1/86400)  # 1秒
        license_key = license_data['license_key']
        
        # 验证许可证当前有效
        validation_result = self.validator.verify_license(license_key, self.device_id)
        self.assertIsNotNone(validation_result)
        self.assertTrue(validation_result['is_valid'])
        
        # 等待许可证过期
        time.sleep(2)
        
        # 再次验证，应该失败
        validation_result = self.validator.verify_license(license_key, self.device_id)
        self.assertIsNone(validation_result)
        
    def test_invalid_license(self):
        """测试无效许可证"""
        # 使用不存在的许可证密钥
        validation_result = self.validator.verify_license("invalid_license_key", self.device_id)
        self.assertIsNone(validation_result)
        
if __name__ == '__main__':
    unittest.main()
