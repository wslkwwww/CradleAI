import smtplib
import logging
import sys
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pathlib import Path

# 添加项目根目录到Python路径以支持绝对导入
current_dir = Path(__file__).parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 现在导入依赖模块
from server import config

# 设置日志
logger = logging.getLogger(__name__)

def send_license_email(to_email, license_key, plan_id, expiry_date):
    """发送许可证激活邮件
    
    Args:
        to_email: 收件人邮箱
        license_key: 许可证密钥
        plan_id: 订阅计划ID
        expiry_date: 过期日期字符串
        
    Returns:
        布尔值，表示邮件是否发送成功
    """
    # 如果未配置SMTP，记录警告并返回
    if not all([config.SMTP_SERVER, config.SMTP_USERNAME, config.SMTP_PASSWORD]):
        logger.warning("SMTP未配置，无法发送邮件")
        return False
        
    try:
        # 创建邮件对象
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'您的许可证激活码 - {plan_id}'
        msg['From'] = config.EMAIL_SENDER
        msg['To'] = to_email
        
        # 获取当前日期
        current_date = datetime.now().strftime('%Y-%m-%d')
        
        # 创建HTML内容
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>许可证激活码</title>
            <style>
                body {{ font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
                .container {{ border: 1px solid #ddd; border-radius: 5px; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 20px; }}
                .logo {{ max-width: 150px; }}
                h1 {{ color: #2c3e50; font-size: 24px; }}
                .license-key {{ background-color: #f8f9fa; border: 1px solid #ddd; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0; }}
                .details {{ margin: 20px 0; }}
                .detail-item {{ margin-bottom: 10px; }}
                .detail-label {{ font-weight: bold; color: #555; }}
                .instructions {{ background-color: #f0f7fb; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0; }}
                .footer {{ margin-top: 30px; font-size: 12px; color: #777; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>许可证激活码</h1>
                </div>
                
                <p>尊敬的用户：</p>
                
                <p>感谢您购买我们的服务。以下是您的激活码信息：</p>
                
                <div class="license-key">{license_key}</div>
                
                <div class="details">
                    <div class="detail-item">
                        <span class="detail-label">订阅计划：</span> {plan_id}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">发放日期：</span> {current_date}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">有效期至：</span> {expiry_date}
                    </div>
                </div>
                
                <div class="instructions">
                    <h3>如何激活：</h3>
                    <ol>
                        <li>打开应用程序</li>
                        <li>前往"API设置"页面</li>
                        <li>找到"激活码"选项并启用</li>
                        <li>输入上方的激活码</li>
                        <li>点击"验证激活"按钮</li>
                    </ol>
                    <p><strong>注意：</strong> 此激活码可以在最多3台设备上使用。首次使用会自动绑定设备。</p>
                </div>
                
                <p>如有任何问题，请随时联系我们的客户支持团队。</p>
                
                <p>祝您使用愉快！</p>
                
                <div class="footer">
                    <p>此邮件由系统自动发送，请勿直接回复。</p>
                    <p>&copy; {datetime.now().year} CradleIntro. 保留所有权利。</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # 添加HTML内容
        msg.attach(MIMEText(html_content, 'html'))
        
        # 连接SMTP服务器并发送邮件
        # 根据端口选择正确的连接方式
        logger.info(f"正在尝试连接SMTP服务器 {config.SMTP_SERVER}:{config.SMTP_PORT}")
        
        if config.SMTP_PORT == 465:
            # 使用SSL上下文直接连接
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(config.SMTP_SERVER, config.SMTP_PORT, context=context) as server:
                server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
                logger.info(f"已成功登录SMTP服务器，发送邮件到: {to_email}")
                server.sendmail(config.SMTP_USERNAME, to_email, msg.as_string())
        else:
            # 使用STARTTLS
            server = smtplib.SMTP(config.SMTP_SERVER, config.SMTP_PORT)
            server.set_debuglevel(1)  # 启用详细日志以便调试
            server.starttls()
            server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
            logger.info(f"已成功登录SMTP服务器，发送邮件到: {to_email}")
            server.sendmail(config.SMTP_USERNAME, to_email, msg.as_string())
            server.quit()
        
        logger.info(f"已成功发送许可证邮件到: {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"发送许可证邮件失败: {str(e)}")
        # 更详细的错误日志
        import traceback
        logger.error(f"错误详情: {traceback.format_exc()}")
        return False
