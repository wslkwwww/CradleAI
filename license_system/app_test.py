#!/usr/bin/env python
"""
支付回调测试脚本

使用方法：
python app_test.py --email your@email.com --secret your_webhook_secret
"""

import os
import sys
import json
import hmac
import hashlib
import argparse
import time
import uuid
import requests
from pathlib import Path

def test_payment_callback():
    # 命令行参数
    parser = argparse.ArgumentParser(description="测试许可证系统的支付回调")
    parser.add_argument("--url", default="http://localhost:5000/api/v1/payment/callback",
                        help="支付回调URL")
    parser.add_argument("--email", required=True,
                        help="接收许可证的邮箱地址")
    parser.add_argument("--plan", default="premium_annual",
                        choices=["premium_annual", "premium_monthly", "premium_lifetime"],
                        help="订阅计划ID")
    parser.add_argument("--amount", type=float, default=99.00,
                        help="支付金额")
    parser.add_argument("--secret", required=True,
                        help="支付Webhook共享密钥")
    parser.add_argument("--status", default="completed",
                        choices=["completed", "pending", "failed"],
                        help="支付状态")
    args = parser.parse_args()

    # 生成随机交易ID
    transaction_id = f"test_{uuid.uuid4().hex}"

    # 构造支付数据
    payment_data = {
        "transaction_id": transaction_id,
        "amount": args.amount,
        "currency": "CNY",
        "status": args.status,
        "customer_email": args.email,
        "plan_id": args.plan,
        "timestamp": int(time.time()),
        "payment_method": "test",
        "test_mode": True
    }

    # 转换为JSON
    payload = json.dumps(payment_data).encode()

    # 使用HMAC-SHA256计算签名
    signature = hmac.new(
        args.secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    print(f"\n===== 准备发送支付回调 =====")
    print(f"URL: {args.url}")
    print(f"交易ID: {transaction_id}")
    print(f"计划: {args.plan}")
    print(f"邮箱: {args.email}")
    print(f"金额: {args.amount} CNY")
    print(f"状态: {args.status}")
    print(f"签名: {signature}")
    print("=============================\n")

    # 发送HTTP请求
    try:
        response = requests.post(
            args.url,
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'X-Payment-Signature': signature
            }
        )
        
        print("\n===== 回调响应 =====")
        print(f"状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            print(f"响应内容: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
            
            if response.status_code == 200 and response_data.get('success') and args.status == 'completed':
                print("\n✅ 支付回调成功!")
                if 'license' in response_data:
                    print(f"许可证密钥: {response_data['license']}")
                    print(f"请检查邮箱 {args.email} 是否收到许可证邮件")
                else:
                    print("没有生成新的许可证，可能是重复的交易ID")
            else:
                print("\n❌ 支付回调未能完成许可证生成")
        except json.JSONDecodeError:
            print(f"响应内容: {response.text}")
            print("\n❌ 响应不是有效的JSON")
    except Exception as e:
        print(f"\n❌ 发送请求时出错: {str(e)}")

def test_health_check():
    """测试健康检查接口"""
    url = "http://localhost:5000/api/v1/health"
    try:
        response = requests.get(url)
        print(f"\n===== 健康检查响应 =====")
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        if response.status_code == 200:
            print("✅ 健康检查成功!")
        else:
            print("❌ 健康检查失败!")
    except Exception as e:
        print(f"❌ 健康检查请求出错: {str(e)}")

if __name__ == "__main__":
    # 先测试健康检查
    test_health_check()
    
    # 测试支付回调
    test_payment_callback()
