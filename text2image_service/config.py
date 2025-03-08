import os

# 从环境变量获取配置，便于部署时覆盖
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_DB = int(os.environ.get('REDIS_DB', 0))
REDIS_URL = os.environ.get('REDIS_URL', f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}')

# Celery 配置
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)

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
