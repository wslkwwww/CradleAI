"""
测试许可证系统的兼容性
确保generate_test_license生成的许可证可以被app.py的验证方法验证通过
"""
import os
import sys
import unittest
import time
import requests
import json
from pathlib import Path
import tempfile
import subprocess

# 添加父目录到Python路径
sys.path.append(str(Path(__file__).parent.parent))

# 导入需要的模块
from server.license_generator import LicenseGenerator
from server.license_validator import LicenseValidator
from server import config
from generate_test_license import generate_test_license

# 设置测试环境
os.environ["ENV"] = "test"
os.environ["LICENSE_MASTER_KEY"] = "test_master_key_for_compatibility_testing"

class TestLicenseCompatibility(unittest.TestCase):
    """测试许可证生成和验证的兼容性"""
    
    @classmethod
    def setUpClass(cls):
        """启动Flask应用作为测试服务器"""
        # 保存当前环境变量
        cls.original_env = os.environ.copy()
        
        # 设置测试环境变量
        os.environ["ENV"] = "test"
        os.environ["LICENSE_MASTER_KEY"] = "test_master_key_for_compatibility_testing"
        os.environ["API_PORT"] = "5123"  # 使用不同端口避免冲突
        
        # 启动Flask应用
        flask_app_path = Path(__file__).parent.parent / "server" / "app.py"
        cls.flask_process = subprocess.Popen(
            [sys.executable, str(flask_app_path)],
            env=os.environ,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # 等待应用启动
        time.sleep(3)
    
    @classmethod
    def tearDownClass(cls):
        """关闭Flask应用"""
        if hasattr(cls, 'flask_process'):
            cls.flask_process.terminate()
            cls.flask_process.wait()
            
        # 恢复环境变量
        os.environ.clear()
        os.environ.update(cls.original_env)
    
    def setUp(self):
        """设置测试环境"""
        # 创建许可证生成器和验证器实例
        self.generator = LicenseGenerator()
        self.validator = LicenseValidator()
        
        # 测试用的计划ID和设备ID
        self.plan_id = "compatibility_test_plan"
        self.device_id = "test_device_compatibility"
        
        # 设置API URL
        self.api_url = f"http://127.0.0.1:5123{config.API_URL_PREFIX}/license/verify"
        
        # 存储生成的许可证密钥
        self.license_key = None
    
    def test_direct_validation(self):
        """测试直接使用验证器验证生成的许可证"""
        # 使用generate_test_license生成许可证
        license_data = generate_test_license(
            plan_id=self.plan_id, 
            validity_days=30,
            device_id=None,  # 不进行验证
            verify=False
        )
        self.assertIsNotNone(license_data, "生成许可证失败")
        self.license_key = license_data['license_key']
        
        # 直接使用LicenseValidator验证许可证
        result = self.validator.verify_license(self.license_key, self.device_id)
        self.assertIsNotNone(result, "验证结果不应为None")
        self.assertTrue(result['is_valid'], "许可证应该是有效的")
        self.assertEqual(result['license_key'], self.license_key, "许可证密钥应该匹配")
        
        print(f"\n直接验证成功 - 生成的许可证: {self.license_key}")
    
    def test_api_validation(self):
        """测试通过API验证生成的许可证"""
        # 使用generate_test_license生成许可证
        license_data = generate_test_license(
            plan_id=self.plan_id, 
            validity_days=30,
            device_id=None,
            verify=False
        )
        self.assertIsNotNone(license_data, "生成许可证失败")
        self.license_key = license_data['license_key']
        
        # 使用Flask API验证许可证
        try:
            # 测试服务器健康状态
            health_url = f"http://127.0.0.1:5123{config.API_URL_PREFIX}/health"
            health_response = requests.get(health_url)
            self.assertEqual(health_response.status_code, 200, f"健康检查失败: {health_response.text}")
            
            # 准备验证请求
            validation_payload = {
                "license_key": self.license_key,
                "device_id": self.device_id
            }
            
            # 发送验证请求
            response = requests.post(self.api_url, json=validation_payload)
            self.assertEqual(response.status_code, 200, f"验证请求返回非200状态码: {response.status_code}")
            
            # 解析响应
            result = response.json()
            print(f"API验证响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            # 检查验证结果
            self.assertTrue(result.get('success'), f"许可证验证失败: {result.get('error', '未知错误')}")
            self.assertIn('license_info', result, "响应缺少license_info字段")
            self.assertEqual(result['license_info']['license_key'], self.license_key, "响应中的许可证密钥与生成的不匹配")
            self.assertEqual(result['license_info']['plan_id'], self.plan_id, "响应中的计划ID与生成的不匹配")
            
            print(f"\nAPI验证成功 - 生成的许可证: {self.license_key}")
            
        except requests.exceptions.ConnectionError:
            self.fail("无法连接到Flask应用，请确保它正在运行")
    
    def test_generate_and_validate_workflow(self):
        """测试完整的生成和验证工作流"""
        # 1. 使用generate_test_license生成许可证
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            output_file = f.name
        
        license_data = generate_test_license(
            plan_id=self.plan_id, 
            validity_days=30,
            output_file=output_file,
            device_id=self.device_id,
            verify=True
        )
        self.assertIsNotNone(license_data, "生成许可证失败")
        self.license_key = license_data['license_key']
        
        # 2. 检查许可证文件是否已生成
        self.assertTrue(os.path.exists(output_file), f"许可证文件未生成: {output_file}")
        
        # 3. 读取许可证文件
        with open(output_file, 'r') as f:
            file_content = json.load(f)
        self.assertEqual(file_content['license_key'], self.license_key, "文件中的许可证密钥与生成的不匹配")
        
        # 4. 通过API验证许可证
        validation_payload = {
            "license_key": self.license_key,
            "device_id": "another_device_id"  # 使用不同的设备ID
        }
        
        try:
            response = requests.post(self.api_url, json=validation_payload)
            self.assertEqual(response.status_code, 200, f"验证请求返回非200状态码: {response.status_code}")
            
            result = response.json()
            self.assertTrue(result.get('success'), f"许可证验证失败: {result.get('error', '未知错误')}")
            
            print(f"\n完整工作流测试成功:")
            print(f"- 生成的许可证: {self.license_key}")
            print(f"- 文件保存到: {output_file}")
            print(f"- API验证成功")
            
        except requests.exceptions.ConnectionError:
            self.fail("无法连接到Flask应用，请确保它正在运行")
        finally:
            # 清理临时文件
            try:
                os.unlink(output_file)
            except:
                pass

if __name__ == '__main__':
    unittest.main()
