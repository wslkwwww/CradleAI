import os
import secrets
import time
import sqlite3
import logging
import argon2
import hmac
import hashlib
import json
import socket
from datetime import datetime
from flask import request
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import (
    LICENSE_DB_PATH,
    LICENSE_MASTER_KEY,
    SMTP_SERVER,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    SMTP_SENDER
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('text2image.license_generator')

class LicenseGenerator:
    """License generation and management"""
    
    def __init__(self, db_path=LICENSE_DB_PATH, master_key=LICENSE_MASTER_KEY):
        """Initialize the license generator
        
        Args:
            db_path: Path to the database file
            master_key: Master key for license generation
        """
        self.db_path = db_path
        self.master_key = master_key
        
        if not self.master_key:
            logger.warning("No master key provided, using a random key (NOT RECOMMENDED FOR PRODUCTION)")
            self.master_key = secrets.token_hex(32)  # Temporary random key
            
        # Initialize Argon2 hasher
        self.ph = argon2.PasswordHasher(
            time_cost=3,
            memory_cost=65536,
            parallelism=4,
            hash_len=32,
            salt_len=16
        )
        
        # Ensure database exists
        from database.schema import initialize_database
        initialize_database(db_path)
    
    def get_db_connection(self):
        """Get a database connection with row factory enabled"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def generate_license(self, plan_id, customer_email, validity_days=365):
        """Generate a new license
        
        Args:
            plan_id: The subscription plan ID
            customer_email: Customer's email for sending the license
            validity_days: License validity in days
            
        Returns:
            dict: Generated license information
        """
        # Generate a random license code (24 bytes, URL-safe)
        license_key = secrets.token_urlsafe(24)
        
        # Generate a random salt
        salt = secrets.token_hex(16)
        
        # Derive key using Argon2
        key_material = f"{license_key}:{self.master_key}"
        hash_value = self.ph.hash(key_material)
        
        # Calculate expiration timestamp
        expires_at = int(time.time()) + (validity_days * 86400)
        created_at = int(time.time())
        
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Insert the new license
            cursor.execute(
                """
                INSERT INTO activation_codes 
                (code, salt, hash, plan_id, created_at, expires_at, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                (license_key, salt, hash_value, plan_id, created_at, expires_at)
            )
            
            license_id = cursor.lastrowid
            
            # Log the license generation
            self._log_license_action(cursor, license_id, "generate", None, "success")
            
            conn.commit()
            
            # Format expiration date
            expiry_date = datetime.fromtimestamp(expires_at).strftime('%Y-%m-%d %H:%M:%S')
            
            license_data = {
                "license_id": license_id,
                "license_key": license_key,
                "plan_id": plan_id,
                "created_at": created_at,
                "expires_at": expires_at,
                "expiry_date": expiry_date
            }
            
            # Send the license by email
            if customer_email:
                self._send_license_email(customer_email, license_data)
            
            return license_data
            
        except Exception as e:
            if 'conn' in locals() and conn:
                conn.rollback()
            logger.error(f"License generation error: {e}")
            raise
        finally:
            if 'conn' in locals() and conn:
                conn.close()
    
    def revoke_license(self, license_key):
        """Revoke a license
        
        Args:
            license_key: The license key to revoke
            
        Returns:
            bool: Whether the revocation was successful
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Get license ID first for logging
            cursor.execute("SELECT id FROM activation_codes WHERE code = ?", (license_key,))
            result = cursor.fetchone()
            
            if not result:
                return False
                
            license_id = result['id']
            
            # Update the license to inactive
            cursor.execute(
                "UPDATE activation_codes SET is_active = 0 WHERE code = ?",
                (license_key,)
            )
            
            if cursor.rowcount == 0:
                return False
            
            # Log the revocation
            self._log_license_action(cursor, license_id, "revoke", None, "success")
            
            conn.commit()
            return True
            
        except Exception as e:
            if 'conn' in locals() and conn:
                conn.rollback()
            logger.error(f"License revocation error: {e}")
            return False
        finally:
            if 'conn' in locals() and conn:
                conn.close()
    
    def _log_license_action(self, cursor, code_id, action, device_id, status):
        """Log a license action to the audit log
        
        Args:
            cursor: Database cursor
            code_id: License ID
            action: Action type (generate, verify, revoke)
            device_id: Device ID (if applicable)
            status: Operation status
        """
        client_ip = request.remote_addr if request and hasattr(request, 'remote_addr') else "internal"
        
        cursor.execute(
            """
            INSERT INTO license_audit_log 
            (code_id, action, timestamp, client_ip, device_id, status) 
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                code_id,
                action,
                int(time.time()),
                client_ip,
                device_id,
                status
            )
        )
    
    def _send_license_email(self, customer_email, license_data):
        """Send a license email to the customer
        
        Args:
            customer_email: Customer's email address
            license_data: License information
        """
        try:
            logger.info(f"开始发送许可证邮件到: {customer_email}")
            logger.info(f"SMTP配置: 服务器={SMTP_SERVER}, 端口={SMTP_PORT}, 用户名={SMTP_USERNAME}, 发件人={SMTP_SENDER}")
            
            # Check if email configuration is valid
            if SMTP_SERVER == 'smtp.example.com' or not SMTP_USERNAME or not SMTP_PASSWORD:
                logger.error("SMTP configuration is not properly set up. Please check your .env file.")
                logger.error("Current configuration:")
                logger.error(f"  SMTP_SERVER: {SMTP_SERVER}")
                logger.error(f"  SMTP_PORT: {SMTP_PORT}")
                logger.error(f"  SMTP_USERNAME: {SMTP_USERNAME}")
                logger.error(f"  SMTP_SENDER: {SMTP_SENDER}")
                return False
            
            msg = MIMEMultipart()
            msg['From'] = SMTP_SENDER
            msg['To'] = customer_email
            msg['Subject'] = "您的应用激活码"
            
            # Create email content
            license_key = license_data['license_key']
            expiry_date = license_data['expiry_date']
            plan_id = license_data['plan_id']
            
            html = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background-color: #f5f5f5; padding: 20px; text-align: center; }}
                    .content {{ padding: 20px; }}
                    .license-key {{ background-color: #f0f0f0; padding: 15px; border-radius: 5px; 
                                   font-family: monospace; font-size: 18px; text-align: center; 
                                   margin: 20px 0; word-break: break-all; }}
                    .footer {{ font-size: 12px; text-align: center; margin-top: 30px; color: #777; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>感谢您的购买</h2>
                    </div>
                    <div class="content">
                        <p>尊敬的用户，</p>
                        <p>感谢您购买我们的服务。以下是您的激活码信息：</p>
                        
                        <div class="license-key">{license_key}</div>
                        
                        <p><strong>订阅计划:</strong> {plan_id}</p>
                        <p><strong>有效期至:</strong> {expiry_date}</p>
                        
                        <h3>如何使用您的激活码:</h3>
                        <ol>
                            <li>打开应用程序</li>
                            <li>前往"设置" > "API设置"页面</li>
                            <li>启用"激活码"选项</li>
                            <li>输入上方的激活码</li>
                            <li>点击"保存设置"</li>
                        </ol>
                        
                        <p>激活成功后，您将获得完整的API访问权限。</p>
                        <p>如有任何问题，请回复此邮件联系客服。</p>
                    </div>
                    <div class="footer">
                        <p>此邮件由系统自动发送，请勿直接回复。</p>
                        <p>&copy; 2023 Cradle Services. 保留所有权利。</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Attach HTML content
            msg.attach(MIMEText(html, 'html'))
            
            logger.info("邮件内容已准备好，尝试连接到SMTP服务器...")
            
            # Connect to SMTP server and send - correct handling for Gmail
            if SMTP_PORT == 465:  # SSL连接
                import ssl
                context = ssl.create_default_context()
                logger.info(f"使用SSL连接到SMTP服务器 {SMTP_SERVER}:{SMTP_PORT}")
                try:
                    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
                        logger.info(f"已连接到SMTP服务器，尝试登录...")
                        server.login(SMTP_USERNAME, SMTP_PASSWORD)
                        logger.info(f"登录成功，尝试发送邮件...")
                        server.send_message(msg)
                        logger.info(f"邮件已成功发送至 {customer_email}")
                except socket.gaierror as e:
                    logger.error(f"DNS解析失败: {e}. 请检查SMTP服务器地址: {SMTP_SERVER}")
                    return False
                except smtplib.SMTPAuthenticationError as e:
                    logger.error(f"SMTP身份验证失败: {e}. 请检查用户名和密码。")
                    return False
                
            else:  # 标准SMTP或STARTTLS
                try:
                    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                        logger.info(f"已连接到SMTP服务器，尝试启用STARTTLS...")
                        server.starttls()
                        logger.info(f"STARTTLS已启用，尝试登录...")
                        server.login(SMTP_USERNAME, SMTP_PASSWORD)
                        logger.info(f"登录成功，尝试发送邮件...")
                        server.send_message(msg)
                        logger.info(f"邮件已成功发送至 {customer_email}")
                except socket.gaierror as e:
                    logger.error(f"DNS解析失败: {e}. 请检查SMTP服务器地址: {SMTP_SERVER}")
                    return False
                except smtplib.SMTPAuthenticationError as e:
                    logger.error(f"SMTP身份验证失败: {e}. 请检查用户名和密码。")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"发送许可证邮件失败: {e}", exc_info=True)
            logger.error(f"SMTP配置: {SMTP_SERVER}:{SMTP_PORT}, 用户={SMTP_USERNAME}")
            return False

# Create a global instance
license_generator = LicenseGenerator()
