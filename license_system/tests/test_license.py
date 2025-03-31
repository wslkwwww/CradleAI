import os
import sys
import unittest
import time
import json
import tempfile
from pathlib import Path

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from server.license_generator import LicenseGenerator
from server.license_validator import LicenseValidator
from db import db_utils
from server import config

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
        
        # 存储生成的许可证密钥以便在tearDown中清理
        self.generated_license_keys = []
        
    def tearDown(self):
        """清理测试环境"""
        # 撤销所有在测试期间创建的许可证
        for license_key in self.generated_license_keys:
            self.generator.revoke_license(license_key, "test", "测试清理")
            
    def test_license_generation(self):
        """测试许可证生成"""
        # 生成一个测试许可证
        license_data = self.generator.generate_license(self.plan_id)
        self.generated_license_keys.append(license_data['license_key'])
        
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
        
        # 验证许可证信息是否完整
        self.assertTrue(license_info['is_active'])
        self.assertGreater(license_info['expires_at'], int(time.time()))
        self.assertIsNotNone(license_info['hash'])
        self.assertIsNotNone(license_info['salt'])
        
        # 验证生成的许可证密钥格式
        self.assertRegex(license_data['license_key'], r'^[A-Za-z0-9_-]+$')
        
    def test_license_validation(self):
        """测试许可证验证"""
        # 生成一个测试许可证
        license_data = self.generator.generate_license(self.plan_id)
        license_key = license_data['license_key']
        self.generated_license_keys.append(license_key)
        
        # 使用设备ID验证许可证
        validation_result = self.validator.verify_license(license_key, self.device_id)
        
        # 验证结果
        self.assertIsNotNone(validation_result)
        self.assertTrue(validation_result['is_valid'])
        self.assertEqual(validation_result['license_key'], license_key)
        self.assertEqual(validation_result['plan_id'], self.plan_id)
        
        # 验证设备已绑定
        license_info = db_utils.get_license_by_code(license_key)
        self.assertIn(self.device_id, license_info['devices'].split(','))
        
        # 再次验证相同设备的许可证 (应该成功，不会重复绑定)
        second_validation = self.validator.verify_license(license_key, self.device_id)
        self.assertIsNotNone(second_validation)
        self.assertTrue(second_validation['is_valid'])
        
        # 验证审计日志
        audit_logs = db_utils.get_license_audit_logs(validation_result['license_id'])
        self.assertGreater(len(audit_logs), 0)
        
        # 应该至少有一条验证成功的日志 - 修正字段名称
        verification_logs = [log for log in audit_logs if log['action_type'] == 'verify' and log['status'] == 'success']
        self.assertGreater(len(verification_logs), 0)
        
    def test_device_limit(self):
        """测试设备数量限制"""
        # 生成一个测试许可证
        license_data = self.generator.generate_license(self.plan_id)
        license_key = license_data['license_key']
        self.generated_license_keys.append(license_key)
        
        # 添加最大数量的设备
        max_devices = 3  # 使用固定值，避免依赖config模块中可能不存在的常量
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
            self.assertIn(device_id, license_info['devices'].split(','))
            
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
        self.generated_license_keys.append(license_key)
        
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
        # 生成一个即将过期的测试许可证（有效期设为2秒，而不是1秒，给验证留出足够时间）
        license_data = self.generator.generate_license(self.plan_id, validity_days=2/86400)  # 2秒
        license_key = license_data['license_key']
        self.generated_license_keys.append(license_key)
        
        # 验证许可证当前有效
        validation_result = self.validator.verify_license(license_key, self.device_id)
        
        # 确保第一次验证成功
        self.assertIsNotNone(validation_result, "验证结果不应为None，请检查许可证生成是否成功")
        self.assertTrue(validation_result['is_valid'], "许可证应该是有效的")
        
        # 等待许可证过期
        print(f"等待许可证过期...")
        time.sleep(3)  # 等待3秒，确保超过2秒的有效期
        
        # 再次验证，应该失败
        validation_result = self.validator.verify_license(license_key, self.device_id)
        self.assertIsNone(validation_result, "许可证应该已过期")
        
        # 获取许可证信息并检查
        license_info = db_utils.get_license_by_code(license_key)
        self.assertIsNotNone(license_info, "许可证记录应该存在于数据库中")
        self.assertTrue(license_info['expires_at'] < int(time.time()), 
                       f"许可证应该已过期 (过期时间: {license_info['expires_at']}, 当前时间: {int(time.time())})")
        
    def test_invalid_license(self):
        """测试无效许可证"""
        # 使用不存在的许可证密钥
        validation_result = self.validator.verify_license("invalid_license_key", self.device_id)
        self.assertIsNone(validation_result)
        
    def test_real_world_scenario(self):
        """测试更真实的场景，包括完整的生成、验证、多设备、过期等情况"""
        # 使用更长的有效期生成许可证
        license_data = self.generator.generate_license(
            plan_id="premium", 
            validity_days=30
        )
        license_key = license_data['license_key']
        self.generated_license_keys.append(license_key)
        
        # 打印许可证信息（用于调试）
        print(f"\n生成的许可证信息:")
        print(f"许可证密钥: {license_key}")
        print(f"计划ID: {license_data['plan_id']}")
        print(f"过期时间: {license_data['expiry_date']}")
        
        # 模拟三个设备验证
        devices = ["mobile_device_123", "desktop_device_456", "tablet_device_789"]
        
        for device_id in devices:
            result = self.validator.verify_license(license_key, device_id)
            self.assertIsNotNone(result)
            self.assertTrue(result['is_valid'])
            print(f"设备 {device_id} 验证成功")
            
        # 获取许可证详细信息
        license_info = db_utils.get_license_by_code(license_key)
        print(f"已绑定设备: {license_info['devices']}")
        
        # 验证所有设备已正确绑定
        for device_id in devices:
            self.assertIn(device_id, license_info['devices'])
            
        # 获取并检查审计日志
        audit_logs = db_utils.get_license_audit_logs(license_data['license_id'])
        self.assertGreaterEqual(len(audit_logs), len(devices) + 1)  # 生成 + 验证次数
        
        # 确认有一次生成操作和多次验证操作 - 修正字段名称
        generate_logs = [log for log in audit_logs if log['action_type'] == 'generate']
        verify_logs = [log for log in audit_logs if log['action_type'] == 'verify']
        
        self.assertGreaterEqual(len(generate_logs), 1)
        self.assertGreaterEqual(len(verify_logs), len(devices))
        
    def test_create_exportable_license(self):
        """创建一个可导出的真实许可证（可以在实际应用中使用）"""
        # 使用特定的计划ID和较长的有效期
        license_data = self.generator.generate_license(
            plan_id="pro_plan", 
            validity_days=365  # 一年有效期
        )
        license_key = license_data['license_key']
        self.generated_license_keys.append(license_key)
        
        # 验证许可证
        validation_result = self.validator.verify_license(license_key, "test_export_device")
        self.assertIsNotNone(validation_result)
        self.assertTrue(validation_result['is_valid'])
        
        # 准备导出数据
        export_data = {
            "license_key": license_key,
            "plan_id": license_data['plan_id'],
            "device_id": "test_export_device",
            "created_at": license_data['created_at'],
            "expires_at": license_data['expires_at'],
            "expiry_date": license_data['expiry_date']
        }
        
        # 将许可证信息导出到临时文件
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            json.dump(export_data, f, indent=2)
            export_file = f.name
            
        print(f"\n可导出的许可证已创建: {export_file}")
        print(f"许可证密钥: {license_key}")
        print(f"计划ID: {license_data['plan_id']}")
        print(f"过期时间: {license_data['expiry_date']}")
        
        # 可选：显示导出的文件内容
        with open(export_file, 'r') as f:
            export_content = f.read()
            print("\n导出的许可证文件内容:")
            print(export_content)
            
        # 清理临时文件
        os.unlink(export_file)
        
if __name__ == '__main__':
    unittest.main()
