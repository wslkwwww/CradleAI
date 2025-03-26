import os
import sys
import unittest
import json
import hmac
import hashlib
import time
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

# 设置测试环境变量
os.environ["ENV"] = "test"
os.environ["LICENSE_DB_PATH"] = ":memory:"  # 使用内存数据库
os.environ["LICENSE_MASTER_KEY"] = "test_master_key_for_testing_purposes_only"
os.environ["PAYMENT_WEBHOOK_SECRET"] = "test_payment_webhook_secret"

from server.app import app
from db import db_utils

class TestPaymentCallback(unittest.TestCase):
    """测试支付回调处理"""
    
    def setUp(self):
        """设置测试环境"""
        # 初始化数据库
        db_utils.init_db()
        
        # 设置Flask测试客户端
        app.config['TESTING'] = True
        self.client = app.test_client()
        
        # 准备测试数据
        self.payment_data = {
            "transaction_id": f"test_tx_{int(time.time())}",
            "amount": 99.00,
            "currency": "CNY",
            "status": "completed",
            "customer_email": "test@example.com",
            "plan_id": "premium_annual"
        }
        
        # 计算签名
        self.payload = json.dumps(self.payment_data).encode()
        self.signature = hmac.new(
            os.environ["PAYMENT_WEBHOOK_SECRET"].encode(),
            self.payload,
            hashlib.sha256
        ).hexdigest()
        
    def test_payment_callback_success(self):
        """测试支付回调成功处理"""
        with patch('server.app.send_license_email', return_value=True) as mock_send_email:
            # 发送支付回调请求
            response = self.client.post(
                '/api/v1/payment/callback',
                data=self.payload,
                content_type='application/json',
                headers={'X-Payment-Signature': self.signature}
            )
            
            # 验证响应
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertIn('license', data)
            
            # 验证许可证是否生成
            license_key = data['license']
            license_info = db_utils.get_license_by_code(license_key)
            self.assertIsNotNone(license_info)
            self.assertEqual(license_info['plan_id'], self.payment_data['plan_id'])
            
            # 验证是否发送了邮件
            mock_send_email.assert_called_once()
            
    def test_payment_idempotency(self):
        """测试支付回调幂等性（重复调用）"""
        # 第一次调用
        response1 = self.client.post(
            '/api/v1/payment/callback',
            data=self.payload,
            content_type='application/json',
            headers={'X-Payment-Signature': self.signature}
        )
        
        # 获取第一次调用的结果
        data1 = json.loads(response1.data)
        license_key1 = data1.get('license')
        
        # 第二次调用（相同的交易ID）
        response2 = self.client.post(
            '/api/v1/payment/callback',
            data=self.payload,
            content_type='application/json',
            headers={'X-Payment-Signature': self.signature}
        )
        
        # 验证第二次调用仍然成功，但提示已处理
        self.assertEqual(response2.status_code, 200)
        data2 = json.loads(response2.data)
        self.assertTrue(data2['success'])
        self.assertIn('message', data2)
        self.assertIn('已处理', data2['message'])
        
        # 验证只创建了一个许可证
        # 这里我们需要一个函数来计算许可证总数，但为简化测试，我们暂时跳过
        
    def test_invalid_signature(self):
        """测试无效签名"""
        # 使用错误的签名
        invalid_signature = "invalid_signature"
        
        # 发送支付回调请求
        response = self.client.post(
            '/api/v1/payment/callback',
            data=self.payload,
            content_type='application/json',
            headers={'X-Payment-Signature': invalid_signature}
        )
        
        # 验证响应是401未授权
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertIn('error', data)
        self.assertIn('签名无效', data['error'])
        
    def test_missing_required_fields(self):
        """测试缺少必要字段"""
        # 创建缺少字段的支付数据
        incomplete_data = {
            "transaction_id": f"test_tx_{int(time.time())}"
            # 缺少其他必要字段
        }
        
        # 计算签名
        payload = json.dumps(incomplete_data).encode()
        signature = hmac.new(
            os.environ["PAYMENT_WEBHOOK_SECRET"].encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # 发送支付回调请求
        response = self.client.post(
            '/api/v1/payment/callback',
            data=payload,
            content_type='application/json',
            headers={'X-Payment-Signature': signature}
        )
        
        # 验证响应是400无效请求
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)
        self.assertIn('缺少必要参数', data['error'])
        
    def test_different_plan_validity(self):
        """测试不同计划的有效期"""
        # 测试月度计划
        monthly_data = self.payment_data.copy()
        monthly_data["plan_id"] = "premium_monthly"
        monthly_data["transaction_id"] = f"test_tx_monthly_{int(time.time())}"
        
        monthly_payload = json.dumps(monthly_data).encode()
        monthly_signature = hmac.new(
            os.environ["PAYMENT_WEBHOOK_SECRET"].encode(),
            monthly_payload,
            hashlib.sha256
        ).hexdigest()
        
        # 发送月度计划支付回调
        monthly_response = self.client.post(
            '/api/v1/payment/callback',
            data=monthly_payload,
            content_type='application/json',
            headers={'X-Payment-Signature': monthly_signature}
        )
        
        # 验证响应
        self.assertEqual(monthly_response.status_code, 200)
        monthly_result = json.loads(monthly_response.data)
        monthly_license = monthly_result['license']
        
        # 验证许可证
        monthly_license_info = db_utils.get_license_by_code(monthly_license)
        self.assertIsNotNone(monthly_license_info)
        
        # 计算预期过期时间（30天）
        expected_monthly_expiry = monthly_license_info['created_at'] + (30 * 86400)
        self.assertEqual(monthly_license_info['expires_at'], expected_monthly_expiry)
        
        # 测试终身计划
        lifetime_data = self.payment_data.copy()
        lifetime_data["plan_id"] = "premium_lifetime"
        lifetime_data["transaction_id"] = f"test_tx_lifetime_{int(time.time())}"
        
        lifetime_payload = json.dumps(lifetime_data).encode()
        lifetime_signature = hmac.new(
            os.environ["PAYMENT_WEBHOOK_SECRET"].encode(),
            lifetime_payload,
            hashlib.sha256
        ).hexdigest()
        
        # 发送终身计划支付回调
        lifetime_response = self.client.post(
            '/api/v1/payment/callback',
            data=lifetime_payload,
            content_type='application/json',
            headers={'X-Payment-Signature': lifetime_signature}
        )
        
        # 验证响应
        self.assertEqual(lifetime_response.status_code, 200)
        lifetime_result = json.loads(lifetime_response.data)
        lifetime_license = lifetime_result['license']
        
        # 验证许可证
        lifetime_license_info = db_utils.get_license_by_code(lifetime_license)
        self.assertIsNotNone(lifetime_license_info)
        
        # 终身许可证应该没有过期时间
        self.assertIsNone(lifetime_license_info['expires_at'])
        
if __name__ == '__main__':
    unittest.main()
