#!/usr/bin/env python
"""
许可证系统配置检查工具

此脚本用于检查环境变量配置和测试SMTP设置等关键组件
"""

import os
import sys
import argparse
import smtplib
import platform
import subprocess
from email.mime.text import MIMEText
from pathlib import Path

def check_python_version():
    """检查Python版本"""
    print(f"Python版本: {platform.python_version()}")
    print(f"Python路径: {sys.executable}")
    print(f"系统: {platform.system()} {platform.release()}")
    
    min_version = (3, 8, 0)
    current = sys.version_info[:3]
    
    if current < min_version:
        print(f"⚠️ 警告: 当前Python版本 {'.'.join(map(str, current))} 低于推荐的 {'.'.join(map(str, min_version))}")
    else:
        print(f"✅ Python版本符合要求")
    print("")

def check_pip_packages():
    """检查关键pip包版本"""
    try:
        import flask
        import werkzeug
        import argon2
        
        print(f"Flask版本: {flask.__version__}")
        print(f"Werkzeug版本: {werkzeug.__version__}")
        print(f"argon2-cffi版本: {argon2.__version__ if hasattr(argon2, '__version__') else '未知'}")
        
        # 检查Flask和Werkzeug版本兼容性
        if flask.__version__.startswith('2.2') and not werkzeug.__version__.startswith('2.2'):
            print(f"⚠️ 警告: Flask 2.2.x 需要 Werkzeug 2.2.x，当前为 {werkzeug.__version__}")
        else:
            print("✅ Flask与Werkzeug版本兼容")
    except ImportError as e:
        print(f"❌ 导入错误: {e}")
        print("请执行 'pip install -r requirements.txt' 安装所需依赖")
    print("")

def check_environment_variables():
    """检查关键环境变量"""
    required_vars = {
        'LICENSE_MASTER_KEY': "主密钥，用于派生许可证密钥",
        'API_ADMIN_TOKEN': "管理员API访问令牌",
        'PAYMENT_WEBHOOK_SECRET': "支付回调共享密钥"
    }
    
    print("环境变量检查:")
    
    all_present = True
    for var, desc in required_vars.items():
        value = os.environ.get(var)
        if value:
            masked = value[:3] + "*" * (len(value) - 3) if len(value) > 3 else "***"
            print(f"✅ {var}: {masked}")
        else:
            print(f"❌ {var} 未设置 - {desc}")
            all_present = False
    
    # 检查可选环境变量
    optional_vars = {
        'SMTP_SERVER': "SMTP服务器地址",
        'SMTP_PORT': "SMTP端口",
        'SMTP_USERNAME': "SMTP用户名",
        'SMTP_PASSWORD': "SMTP密码",
        'EMAIL_SENDER': "发件人地址",
        'LICENSE_DB_PATH': "数据库路径",
        'LOG_FILE': "日志文件路径"
    }
    
    print("\n可选环境变量:")
    for var, desc in optional_vars.items():
        value = os.environ.get(var)
        if var == 'SMTP_PASSWORD' and value:
            print(f"✅ {var}: ********")
        elif value:
            print(f"✅ {var}: {value}")
        else:
            print(f"⚠️ {var} 未设置 - {desc}")
    
    print("")
    return all_present
        
def test_smtp_connection(args):
    """测试SMTP连接"""
    smtp_server = args.smtp_server or os.environ.get('SMTP_SERVER')
    smtp_port = int(args.smtp_port or os.environ.get('SMTP_PORT', '587'))
    smtp_user = args.smtp_user or os.environ.get('SMTP_USERNAME')
    smtp_pass = args.smtp_pass or os.environ.get('SMTP_PASSWORD')
    sender = args.sender or os.environ.get('EMAIL_SENDER', 'noreply@cradleintro.top')
    recipient = args.test_email
    
    if not all([smtp_server, smtp_port, smtp_user, smtp_pass, recipient]):
        print("❌ SMTP测试失败: 缺少必要参数")
        print("请提供--smtp-server, --smtp-port, --smtp-user, --smtp-pass和--test-email参数")
        print("或设置相应的环境变量: SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD")
        return False
    
    print(f"正在测试SMTP连接: {smtp_server}:{smtp_port}")
    
    try:
        # 创建简单的测试邮件
        msg = MIMEText('这是一封来自许可证系统的测试邮件。\n如果您收到此邮件，说明SMTP设置正确。')
        msg['Subject'] = '许可证系统SMTP测试'
        msg['From'] = sender
        msg['To'] = recipient
        
        # 连接SMTP服务器
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.set_debuglevel(1)  # 启用详细日志
        server.starttls()  # 启用TLS加密
        server.login(smtp_user, smtp_pass)
        
        # 发送邮件
        server.sendmail(sender, recipient, msg.as_string())
        server.quit()
        
        print(f"✅ SMTP测试成功! 测试邮件已发送至 {recipient}")
        return True
    except Exception as e:
        print(f"❌ SMTP测试失败: {str(e)}")
        return False

def setup_env_interactive():
    """交互式设置环境变量"""
    import getpass
    
    print("\n===== 许可证系统环境变量设置向导 =====")
    print("此向导将帮助您设置许可证系统所需的环境变量")
    print("所有信息将保存到 .env 文件中，可以在需要时手动加载\n")
    
    env_vars = {}
    
    # 核心密钥
    env_vars['LICENSE_MASTER_KEY'] = input("主密钥 (用于许可证派生，需要足够安全): ") or secrets.token_hex(32)
    env_vars['API_ADMIN_TOKEN'] = input("管理员API令牌 (用于管理接口认证): ") or secrets.token_urlsafe(32)
    env_vars['PAYMENT_WEBHOOK_SECRET'] = input("支付回调密钥 (用于验证支付回调): ") or secrets.token_hex(24)
    
    # 邮件设置
    print("\n--- SMTP设置 ---")
    env_vars['SMTP_SERVER'] = input("SMTP服务器地址 (如 smtp.qq.com): ")
    env_vars['SMTP_PORT'] = input("SMTP端口 (通常为587或465): ") or "587"
    env_vars['SMTP_USERNAME'] = input("SMTP用户名 (通常是邮箱地址): ")
    env_vars['SMTP_PASSWORD'] = getpass.getpass("SMTP密码 (或应用专用密码): ")
    env_vars['EMAIL_SENDER'] = input("发件人地址和名称 (如 '许可证系统 <noreply@domain.com>'): ") or f"许可证系统 <{env_vars['SMTP_USERNAME']}>"
    
    # 其他设置
    print("\n--- 其他设置 ---")
    env_vars['LICENSE_DB_PATH'] = input("数据库路径 (留空使用默认): ") or ""
    env_vars['LOG_FILE'] = input("日志文件路径 (留空使用默认): ") or ""
    
    # 写入.env文件
    env_file = Path(__file__).parent / '.env'
    with open(env_file, 'w') as f:
        for key, value in env_vars.items():
            if value:  # 只写入非空值
                f.write(f"{key}={value}\n")
    
    print(f"\n✅ 环境变量已保存到 {env_file}")
    print("您可以通过以下命令加载这些环境变量:")
    print("  在Linux/macOS上: source .env")
    print("  在Windows上运行: ")
    print("    PowerShell: Get-Content .env | ForEach-Object { $_.Split('=', 2) | ForEach-Object { Set-Item -Path \"Env:$($_[0])\" -Value $_[1] } }")
    print("    CMD: for /f \"tokens=1,2 delims==\" %G in (.env) do set %G=%H")
    
def main():
    parser = argparse.ArgumentParser(description="许可证系统配置检查工具")
    parser.add_argument("--smtp-test", action="store_true", help="测试SMTP连接")
    parser.add_argument("--smtp-server", help="SMTP服务器地址")
    parser.add_argument("--smtp-port", type=int, help="SMTP端口")
    parser.add_argument("--smtp-user", help="SMTP用户名")
    parser.add_argument("--smtp-pass", help="SMTP密码")
    parser.add_argument("--sender", help="发件人地址")
    parser.add_argument("--test-email", help="用于测试的收件人邮箱")
    parser.add_argument("--setup", action="store_true", help="交互式设置环境变量")
    
    args = parser.parse_args()
    
    if args.setup:
        setup_env_interactive()
        return
    
    print("===== 许可证系统配置检查 =====\n")
    
    # 检查Python版本
    check_python_version()
    
    # 检查pip包
    check_pip_packages()
    
    # 检查环境变量
    env_ok = check_environment_variables()
    
    # 测试SMTP连接
    if args.smtp_test:
        if not args.test_email:
            print("❌ 缺少--test-email参数")
            return
        smtp_ok = test_smtp_connection(args)
    else:
        smtp_ok = None
    
    # 总结
    print("\n===== 检查结果摘要 =====")
    print(f"环境变量: {'✅ 已设置' if env_ok else '❌ 缺少关键项'}")
    if smtp_ok is not None:
        print(f"SMTP设置: {'✅ 正常' if smtp_ok else '❌ 异常'}")
    else:
        print("SMTP设置: 未测试")
    
    if env_ok and (smtp_ok is None or smtp_ok):
        print("\n✅ 系统配置看起来正常")
    else:
        print("\n⚠️ 系统配置存在问题，请修复上述问题")
    
if __name__ == "__main__":
    try:
        import secrets  # 用于生成安全密钥
        main()
    except KeyboardInterrupt:
        print("\n操作已取消")
    except Exception as e:
        print(f"发生错误: {str(e)}")
