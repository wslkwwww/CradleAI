#!/usr/bin/env python
"""
许可证系统服务健康检查脚本

此脚本检查许可证服务的可用性和健康状态，并进行简单的测试请求
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

def check_service_health():
    """检查服务健康状态"""
    parser = argparse.ArgumentParser(description="检查许可证系统服务健康状态")
    parser.add_argument("--url", default="https://cradleintro.top/api/v1/health",
                        help="健康检查URL")
    parser.add_argument("--check-payment", action="store_true",
                        help="同时检查支付回调接口")
    parser.add_argument("--email", default="test@example.com",
                        help="测试邮箱地址")
    parser.add_argument("--secret", default="test_secret",
                        help="支付Webhook共享密钥")
    args = parser.parse_args()

    # 清理可能的缓存（有助于测试）
    requests.session().close()
    
    # 检查健康状态
    print(f"正在检查服务健康状态...\n")
    print(f"URL: {args.url}")
    
    try:
        response = requests.get(args.url, timeout=10)
        print(f"状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            print(f"响应内容: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
            
            if response.status_code == 200 and response_data.get('success'):
                print("\n✅ 许可证服务正常运行!")
                
                # 如果需要，同时检查支付回调
                if args.check_payment:
                    check_payment_callback(args.url.replace('/health', '/payment/callback'), args.email, args.secret)
            else:
                print("\n❌ 服务响应异常!")
                
        except json.JSONDecodeError:
            print(f"响应内容: {response.text[:500]}")
            print("\n❌ 响应不是有效的JSON，可能存在配置问题或中间件干扰")
    except requests.RequestException as e:
        print(f"\n❌ 请求错误: {str(e)}")
        print("\n请检查：")
        print("1. 域名是否正确解析到服务器IP")
        print("2. 服务器防火墙是否开放相应端口")
        print("3. Nginx/Apache配置是否正确")
        print("4. Python应用是否正常运行")
        print("5. Cloudflare设置是否正确")

def check_payment_callback(url, email, secret):
    """检查支付回调接口"""
    print("\n正在检查支付回调接口...\n")
    
    # 生成随机交易ID（测试用）
    transaction_id = f"test_{uuid.uuid4().hex}"
    
    # 构造支付数据
    payment_data = {
        "transaction_id": transaction_id,
        "amount": 0.01,
        "currency": "CNY",
        "status": "completed",
        "customer_email": email,
        "plan_id": "test_plan",
        "timestamp": int(time.time()),
        "payment_method": "test",
        "test_mode": True
    }
    
    # 转换为JSON并计算签名
    payload = json.dumps(payment_data).encode()
    signature = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    print(f"URL: {url}")
    print(f"交易ID: {transaction_id}")
    print(f"签名: {signature[:10]}...{signature[-10:]}")
    
    try:
        response = requests.post(
            url,
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'X-Payment-Signature': signature
            },
            timeout=15
        )
        
        print(f"状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            print(f"响应内容: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
            
            if response.status_code == 200 and response_data.get('success'):
                print("\n✅ 支付回调接口正常!")
            else:
                print("\n❌ 支付回调接口异常!")
        except json.JSONDecodeError:
            print(f"响应内容: {response.text[:500]}")
            print("\n❌ 响应不是有效的JSON")
    except requests.RequestException as e:
        print(f"\n❌ 请求错误: {str(e)}")

def test_smtp_connection():
    """测试SMTP连接"""
    print("\n正在测试SMTP连接...\n")
    
    import os
    import smtplib
    import ssl
    from email.mime.text import MIMEText
    
    # 从环境变量获取配置
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', '465'))
    smtp_user = os.environ.get('SMTP_USERNAME', '')
    smtp_pass = os.environ.get('SMTP_PASSWORD', '')
    email_sender = os.environ.get('EMAIL_SENDER', smtp_user)
    
    # 验证配置是否完整
    if not all([smtp_server, smtp_port, smtp_user, smtp_pass]):
        print("❌ SMTP配置不完整，请检查环境变量")
        print(f"  SMTP_SERVER: {smtp_server}")
        print(f"  SMTP_PORT: {smtp_port}")
        print(f"  SMTP_USERNAME: {'设置' if smtp_user else '未设置'}")
        print(f"  SMTP_PASSWORD: {'设置' if smtp_pass else '未设置'}")
        return False
    
    test_email = input("请输入测试邮箱地址: ")
    if not test_email:
        print("❌ 未提供测试邮箱地址")
        return False
    
    print(f"测试配置:")
    print(f"  服务器: {smtp_server}")
    print(f"  端口: {smtp_port}")
    print(f"  用户名: {smtp_user}")
    print(f"  发送到: {test_email}")
    
    try:
        # 创建测试邮件
        msg = MIMEText('这是一封来自许可证系统的测试邮件。如果您收到此邮件，说明SMTP配置正确。')
        msg['Subject'] = '许可证系统SMTP测试'
        msg['From'] = email_sender
        msg['To'] = test_email
        
        print("\n正在连接SMTP服务器...")
        
        # 根据端口选择连接方式
        if smtp_port == 465:
            # SSL连接
            print("使用SSL连接...")
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context) as server:
                print("正在登录...")
                server.login(smtp_user, smtp_pass)
                print("正在发送邮件...")
                server.sendmail(smtp_user, test_email, msg.as_string())
        else:
            # STARTTLS连接
            print("使用STARTTLS连接...")
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.set_debuglevel(1)  # 启用详细日志
            server.ehlo()
            server.starttls()
            print("正在登录...")
            server.login(smtp_user, smtp_pass)
            print("正在发送邮件...")
            server.sendmail(smtp_user, test_email, msg.as_string())
            server.quit()
        
        print("\n✅ SMTP测试成功! 邮件已发送，请检查收件箱。")
        return True
    except Exception as e:
        print(f"\n❌ SMTP测试失败: {str(e)}")
        import traceback
        print(f"\n错误详情:\n{traceback.format_exc()}")
        return False

if __name__ == "__main__":
    print("=== 许可证系统服务检查 ===\n")
    
    import argparse
    parser = argparse.ArgumentParser(description="检查许可证系统服务健康状态")
    parser.add_argument("--test-smtp", action="store_true", help="仅测试SMTP连接")
    args = parser.parse_args()
    
    if args.test_smtp:
        test_smtp_connection()
    else:
        check_service_health()
