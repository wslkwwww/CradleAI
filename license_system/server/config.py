import os
import secrets
from pathlib import Path

# 基础配置
BASE_DIR = Path(__file__).parent.parent
ENV = os.environ.get("ENV", "development")

# 数据库配置
DB_PATH = os.environ.get("LICENSE_DB_PATH", str(BASE_DIR / "db" / "license.db"))

# 安全配置
MASTER_KEY = os.environ.get("LICENSE_MASTER_KEY", "")
if not MASTER_KEY and ENV != "test":
    # 如果未设置主密钥且不是测试环境，生成警告
    print("警告: 未设置LICENSE_MASTER_KEY环境变量，将使用随机生成的密钥（重启后将失效）")
    MASTER_KEY = secrets.token_hex(32)

# 密钥派生配置
KEY_DERIVATION_TIME_COST = 3
KEY_DERIVATION_MEMORY_COST = 65536  # 64MB
KEY_DERIVATION_PARALLELISM = 4
KEY_DERIVATION_HASH_LEN = 32

# 许可证配置
LICENSE_KEY_LENGTH = 24  # 许可证密钥长度
MAX_DEVICES_PER_LICENSE = 3  # 每个许可证最多绑定设备数
LICENSE_DEFAULT_VALIDITY_DAYS = 365  # 默认许可证有效期（天）

# API配置
API_HOST = os.environ.get("API_HOST", "127.0.0.1")
API_PORT = int(os.environ.get("API_PORT", 5000))
API_URL_PREFIX = os.environ.get("API_URL_PREFIX", "/api/v1")
API_ADMIN_TOKEN = os.environ.get("API_ADMIN_TOKEN", "")
if not API_ADMIN_TOKEN and ENV != "test":
    print("警告: 未设置API_ADMIN_TOKEN环境变量，将使用随机生成的令牌（重启后将失效）")
    API_ADMIN_TOKEN = secrets.token_urlsafe(32)

# 支付配置
PAYMENT_WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "")
if not PAYMENT_WEBHOOK_SECRET and ENV != "test":
    print("警告: 未设置PAYMENT_WEBHOOK_SECRET环境变量，将使用随机生成的密钥（重启后将失效）")
    PAYMENT_WEBHOOK_SECRET = secrets.token_hex(32)

# 速率限制配置
RATE_LIMIT_ENABLED = os.environ.get("RATE_LIMIT_ENABLED", "1") == "1"
RATE_LIMIT_WINDOW = int(os.environ.get("RATE_LIMIT_WINDOW", 60))  # 速率限制窗口（秒）
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("RATE_LIMIT_MAX_REQUESTS", 5))  # 窗口内最大请求数
MAX_FAILED_ATTEMPTS = int(os.environ.get("MAX_FAILED_ATTEMPTS", 5))  # 锁定前的最大失败尝试次数
LOCKOUT_DURATION = int(os.environ.get("LOCKOUT_DURATION", 600))  # 锁定时长（秒）

# 邮件配置
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 465))  # 确保是整数
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
EMAIL_SENDER = os.environ.get("EMAIL_SENDER", SMTP_USERNAME)

# Redis配置（可选，用于缓存和速率限制）
REDIS_ENABLED = os.environ.get("REDIS_ENABLED", "0") == "1"
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", None)

# 日志配置
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
LOG_FILE = os.environ.get("LOG_FILE", str(BASE_DIR / "logs" / "license_server.log"))
LOG_FORMAT = os.environ.get("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")

# CloudFlare配置
CF_DOMAIN = os.environ.get("CF_DOMAIN", "cradleintro.top")
CF_API_URL = f"https://{CF_DOMAIN}/api"
