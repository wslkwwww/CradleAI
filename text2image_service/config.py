import os

# 从环境变量获取配置，便于部署时覆盖
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_DB = int(os.environ.get('REDIS_DB', 0))
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', '')  # 读取Redis密码

# 构建Redis URL，使用有效的Redis Auth语法
if REDIS_PASSWORD:
    # 注意这里的格式：redis://[:password@]host[:port][/db]
    REDIS_URL = f'redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'
else:
    REDIS_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'

# 打印Redis URL（生产环境中移除此行以防泄露密码）
print(f"使用Redis连接URL：{'redis://:*****@' + REDIS_HOST if REDIS_PASSWORD else REDIS_URL}")

# Celery 配置 - 明确设置带有密码的broker和backend
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)

# 添加Celery Broker连接池设置
BROKER_POOL_LIMIT = 10
BROKER_CONNECTION_TIMEOUT = 30

# 添加失败任务重试设置
BROKER_CONNECTION_RETRY = True
BROKER_CONNECTION_MAX_RETRIES = 5

# Flask 配置
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-for-flask')

# 应用配置
SERVER_PORT = int(os.environ.get('PORT', 5000))
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

# 其余配置保持不变

# 静态文件和图片存储配置
STATIC_FOLDER = os.environ.get('STATIC_FOLDER', 'static')
IMAGES_FOLDER = os.environ.get('IMAGES_FOLDER', os.path.join(STATIC_FOLDER, 'images'))
IMAGE_EXPIRY_DAYS = int(os.environ.get('IMAGE_EXPIRY_DAYS', 7))  # 图片过期时间（天）

# NovelAI API 端点
NOVELAI_API_LOGIN = 'https://api.novelai.net/user/login'
NOVELAI_API_SUBSCRIPTION = 'https://api.novelai.net/user/subscription'
NOVELAI_API_GENERATE = 'https://image.novelai.net/ai/generate-image'

# 任务配置
MAX_RETRIES = 3
RETRY_DELAY = 5  # 秒
REQUEST_TIMEOUT = 60  # 秒

# 日志配置
LOG_LEVEL = 'DEBUG'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# MinIO 配置
MINIO_ENDPOINT = os.environ.get('MINIO_ENDPOINT', '152.69.219.182:19000')
MINIO_ACCESS_KEY = os.environ.get('MINIO_ACCESS_KEY', 'PWhqUUegzsxgIVgJs8iV')
MINIO_SECRET_KEY = os.environ.get('MINIO_SECRET_KEY', 'VZWbbSByQ2r5XAkqLO8PT5MjB6xRCeKmwfxQXiEG')
MINIO_SECURE = os.environ.get('MINIO_SECURE', 'False') == 'True'
MINIO_BUCKET = os.environ.get('MINIO_BUCKET', 'cradleimg')

# 模型和采样器预设
DEFAULT_MODEL = 'nai-v3'  # 会在客户端中被映射到正确的官方名称
DEFAULT_SAMPLER = 'k_euler_ancestral'
DEFAULT_STEPS = 28
DEFAULT_SCALE = 11

# 模型名称映射
MODEL_MAP = {
    'nai': 'nai-diffusion',
    'nai-v1': 'nai-diffusion',
    'nai-v2': 'nai-diffusion-2',
    'nai-v3': 'nai-diffusion-3',
    'nai-v4-preview': 'nai-diffusion-4-curated-preview',
    'nai-v4-curated-preview': 'nai-diffusion-4-curated-preview',
    'nai-v4-full': 'nai-diffusion-4-full',
    'safe': 'safe-diffusion',
    'furry': 'nai-diffusion-furry',
}

# 令牌缓存文件路径
CACHE_DIR = os.environ.get('CACHE_DIR', os.path.join(os.path.dirname(__file__), 'cache'))
TOKEN_CACHE_FILE = os.environ.get('TOKEN_CACHE_FILE', os.path.join(CACHE_DIR, 'token_cache.json'))

# 速率限制配置
RATE_LIMIT_DAILY = int(os.environ.get('RATE_LIMIT_DAILY', 800))  # 每日最大请求数
RATE_LIMIT_MIN_INTERVAL = int(os.environ.get('RATE_LIMIT_MIN_INTERVAL', 8))  # 最小请求间隔(秒)
RATE_LIMIT_MAX_INTERVAL = int(os.environ.get('RATE_LIMIT_MAX_INTERVAL', 15))  # 最大请求间隔(秒)
RATE_LIMIT_ERROR_COOLDOWN_MIN = int(os.environ.get('RATE_LIMIT_ERROR_COOLDOWN_MIN', 5))  # 错误后最小冷却时间(秒)
RATE_LIMIT_ERROR_COOLDOWN_MAX = int(os.environ.get('RATE_LIMIT_ERROR_COOLDOWN_MAX', 12))  # 错误后最大冷却时间(秒)
RATE_LIMIT_MAX_RETRIES = int(os.environ.get('RATE_LIMIT_MAX_RETRIES', 3))  # 最大重试次数
