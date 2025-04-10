#!/usr/bin/env python
"""
Test script for sending emails

This script tests the email sending functionality of the license system.
"""

import argparse
import sys
import logging
import time
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from load_dotenv import load_dotenv

# Load environment variables before importing config
load_dotenv()

from config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SENDER

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test_email')

def send_test_email(to_email):
    """Send a test email
    
    Args:
        to_email: Email address to send the test to
        
    Returns:
        bool: Whether the email was sent successfully
    """
    try:
        logger.info(f"开始发送测试邮件到: {to_email}")
        logger.info(f"SMTP配置: 服务器={SMTP_SERVER}, 端口={SMTP_PORT}, 用户名={SMTP_USERNAME}, 发件人={SMTP_SENDER}")
        
        msg = MIMEMultipart()
        msg['From'] = SMTP_SENDER
        msg['To'] = to_email
        msg['Subject'] = "测试邮件 - 许可证系统"
        
        # Create email content
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f5f5f5; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; }}
                .footer {{ font-size: 12px; text-align: center; margin-top: 30px; color: #777; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>许可证系统测试邮件</h2>
                </div>
                <div class="content">
                    <p>尊敬的用户，</p>
                    <p>这是一封测试邮件，用于验证许可证系统的邮件发送功能。</p>
                    <p>如果您收到这封邮件，说明邮件配置正确。</p>
                    <p>测试时间: {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
                <div class="footer">
                    <p>此邮件由系统自动发送，请勿直接回复。</p>
                    <p>&copy; 2023 许可证系统. 保留所有权利。</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Attach HTML content
        msg.attach(MIMEText(html, 'html'))
        
        logger.info("邮件内容已准备好，尝试连接到SMTP服务器...")
        
        # Connect to SMTP server and send
        if SMTP_PORT == 465:  # SSL连接
            import ssl
            context = ssl.create_default_context()
            logger.info(f"使用SSL连接到SMTP服务器 {SMTP_SERVER}:{SMTP_PORT}")
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
                logger.info(f"已连接到SMTP服务器，尝试登录...")
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                logger.info(f"登录成功，尝试发送邮件...")
                server.send_message(msg)
                logger.info(f"邮件已成功发送至 {to_email}")
        else:  # 标准SMTP或STARTTLS
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                logger.info(f"已连接到SMTP服务器，尝试启用STARTTLS...")
                server.starttls()
                logger.info(f"STARTTLS已启用，尝试登录...")
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                logger.info(f"登录成功，尝试发送邮件...")
                server.send_message(msg)
                logger.info(f"邮件已成功发送至 {to_email}")
        
        return True
        
    except Exception as e:
        logger.error(f"发送邮件失败: {e}", exc_info=True)
        return False

def main():
    parser = argparse.ArgumentParser(description='Test email sending')
    parser.add_argument('--email', required=True, help='Email address to send the test to')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show verbose output')
    
    args = parser.parse_args()
    
    # Print configuration in verbose mode
    if args.verbose:
        print("Email Configuration:")
        print(f"SMTP Server: {SMTP_SERVER}")
        print(f"SMTP Port: {SMTP_PORT}")
        print(f"SMTP Username: {SMTP_USERNAME}")
        print(f"SMTP Sender: {SMTP_SENDER}")
    
    print(f"尝试发送测试邮件到: {args.email}")
    result = send_test_email(args.email)
    
    if result:
        print("✅ 测试邮件发送成功！请检查您的收件箱。")
    else:
        print("❌ 测试邮件发送失败，请检查日志获取更多信息。")
        sys.exit(1)

if __name__ == "__main__":
    main()
