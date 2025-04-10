import os
import time
import logging
import traceback
import random
from celery import Celery
from celery.exceptions import MaxRetriesExceededError
from config import (
    CELERY_BROKER_URL, 
    CELERY_RESULT_BACKEND, 
    MAX_RETRIES,
    RETRY_DELAY,
    REDIS_PASSWORD
)
from novelai import NovelAIClient
import credentials
from rate_limiter import rate_limiter

# 配置日志
logger = logging.getLogger('text2image.worker')

# 验证Redis配置
logger.info(f"Redis配置: URL={CELERY_BROKER_URL[:15]}*** (密码已隐藏)")
if REDIS_PASSWORD:
    logger.info("Redis密码已设置")
else:
    logger.warning("Redis密码未设置，这可能导致认证错误")

# 创建 Celery 应用 - 添加额外的连接选项
celery_app = Celery(
    'text2image_tasks',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    broker_connection_retry=True,
    broker_connection_max_retries=5
)

# 配置 Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Shanghai',
    enable_utc=True,
    # 添加任务优先级配置
    task_queue_max_priority=10,
    task_default_priority=5,
    broker_transport_options={
        'priority_steps': list(range(11)),  # 0-10的优先级
        'visibility_timeout': 3600,  # 设置更长的可见性超时避免任务丢失
        'socket_timeout': 30,  # 增加套接字超时以避免连接问题
        'socket_connect_timeout': 30,  # 连接超时设置
    },
    # Redis连接选项
    broker_pool_limit=10,  # Redis连接池数量限制
    broker_connection_timeout=30,  # Redis连接超时设置
)

@celery_app.task(bind=True, max_retries=MAX_RETRIES)
def generate_image(self, request_params):
    """生成图像的 Celery 任务
    
    Args:
        request_params: 从 Flask 应用传来的请求参数
            
    Returns:
        dict: 包含生成结果的字典
    """
    logger.info(f"开始处理图像生成任务: {self.request.id}")
    logger.debug(f"接收到的参数: {request_params}")
    
    # 检查是否为测试请求
    is_test_request = request_params.get('is_test_request', False)
    if is_test_request:
        logger.info("这是测试请求，将优先处理")
    
    # 添加标记到参数中，以便在NovelAI客户端中使用
    request_params['is_test_request'] = is_test_request
    
    # 内部重试次数计数
    retry_count = request_params.get('_retry_count', 0)
    
    try:
        # 创建 NovelAI 客户端
        client = NovelAIClient()
        
        # 检查服务器存储的凭据
        if credentials.has_credentials():
            # 使用服务器存储的凭据
            try:
                logger.info(f"使用服务器存储的凭据登录 NovelAI (多账号轮询)")
                client.login_with_credentials()
            except Exception as e:
                logger.error(f"使用服务器存储的凭据登录失败: {e}")
                
                # 如果请求中提供了认证信息，尝试使用请求中的认证信息
                if request_params.get('auth_type'):
                    logger.info("尝试使用请求提供的认证信息...")
                else:
                    # 如果没有备用认证信息，重新抛出异常
                    raise
        
        # 如果服务器没有存储凭据或登录失败，则尝试使用请求中的认证信息
        if not client.access_token:
            # 如果服务器没有存储凭据，则尝试使用请求中的认证信息
            auth_type = request_params.get('auth_type')
            logger.info(f"使用请求提供的认证信息 (类型: {auth_type})")
            
            if auth_type == 'token':
                token = request_params.get('token')
                if not token:
                    logger.error("未提供有效的令牌")
                    return {
                        'success': False,
                        'error': '未提供有效的 token 且服务器未配置凭据'
                    }
                
                logger.info(f"使用令牌认证，令牌长度: {len(token)}")
                # 清理令牌，移除可能的空格或换行符
                token = token.strip()
                client.login_with_token(token)
                
            elif auth_type == 'login':
                email = request_params.get('email')
                password = request_params.get('password')
                if not email or not password:
                    logger.error("未提供有效的邮箱或密码")
                    return {
                        'success': False,
                        'error': '未提供有效的邮箱或密码且服务器未配置凭据'
                    }
                
                logger.info(f"使用账号密码认证，邮箱: {email}")
                client.login_with_email_password(email, password)
                
            else:
                logger.error(f"服务器未配置凭据，且请求未提供有效的认证信息")
                return {
                    'success': False,
                    'error': '服务器未配置 NovelAI 凭据，且请求中未提供有效的认证信息'
                }
        
        # 随机延迟，模拟人类行为
        delay = random.uniform(1.0, 3.0)
        logger.info(f"模拟人类行为：等待 {delay:.1f} 秒")
        time.sleep(delay)
        
        # 准备图像生成参数
        generation_params = {
            'model': request_params.get('model'),
            'prompt': request_params.get('prompt'),
            'negative_prompt': request_params.get('negative_prompt'),
            'sampler': request_params.get('sampler'),
            'steps': int(request_params.get('steps', 28)),
            'scale': float(request_params.get('scale', 11)),
            'seed': int(request_params.get('seed', time.time() * 1000)) if request_params.get('seed') else None,
            'resolution': request_params.get('resolution', 'portrait'),
            'batch_size': int(request_params.get('batch_size', 1)),
            # 添加官方 API 支持的其他参数
            'smea': request_params.get('smea', False),
            'smeaDyn': request_params.get('smeaDyn', False),
            'ucPreset': request_params.get('ucPreset', 0),
        }
        
        # 判断模型是否为 V4 类型
        model_name = request_params.get('model', 'nai-v3')
        is_v4_model = 'nai-v4' in model_name
        
        if is_v4_model:
            # 添加 V4 特有的参数
            generation_params.update({
                'noise_schedule': request_params.get('noise_schedule', 'karras'),
                # 如果前端传递了角色提示词，也添加进来
                'character_prompt': request_params.get('character_prompt', ''),
            })
        
        # 如果是图像到图像转换
        if request_params.get('source_image'):
            generation_params.update({
                'source_image': request_params.get('source_image'),
                'strength': float(request_params.get('strength', 0.7)),
                'noise': float(request_params.get('noise', 0.2)),
            })
        
        # 详细记录重要参数，帮助调试
        logger.info(f"生成参数: 模型={generation_params.get('model')}, "
                    f"采样器={generation_params.get('sampler')}, "
                    f"步数={generation_params.get('steps')}, "
                    f"比例={generation_params.get('scale')}")
        
        # 调用 NovelAI API 生成图像
        images = client.generate_image(generation_params)
        
        # 检查是否成功获取图像
        if not images或len(images) == 0:
            return {
                'success': False,
                'error': '未能生成图像',
                'task_id': self.request.id
            }
        
        # 只返回第一张图像的信息，其余图像信息存储在元数据中
        first_image = images[0]
        
        # 注意：我们不在这里保存图像文件，而是将原始数据返回给 API 处理
        # 因为图像文件应该存储在静态文件目录中，供 Flask 应用访问
        
        logger.info(f"图像生成成功: {self.request.id}, 获取到 {len(images)} 张图像")
        
        # 返回结果时添加任务ID，便于追踪
        return {
            'success': True,
            'images': images,  # 返回包含所有图像的列表
            'task_id': self.request.id,
            'processed': False  # 标记图像尚未处理，避免重复处理
        }
        
    except Exception as e:
        logger.error(f"图像生成失败: {e}")
        logger.error(traceback.format_exc())
        
        # 重试机制
        retry_count += 1
        
        if retry_count <= 3:  # 最多内部重试3次
            # 更新重试计数并放回队列
            request_params['_retry_count'] = retry_count
            
            # 计算随机的重试延迟
            retry_delay = random.uniform(5, 12)
            logger.info(f"任务将在 {retry_delay:.1f} 秒后进行第 {retry_count} 次重试")
            
            # 修复: 使用Celery的重试机制，只传递一次request_params
            # 不要在kwargs中再次传递request_params
            try:
                raise self.retry(
                    exc=e,
                    countdown=retry_delay,
                )
            except MaxRetriesExceededError:
                logger.error(f"超过最大重试次数: {retry_count-1}")
                return {
                    'success': False,
                    'error': f'生成失败 (已重试 {retry_count-1} 次): {str(e)}',
                    'task_id': self.request.id
                }
        else:
            # 超过最大重试次数
            logger.error(f"超过最大重试次数: {retry_count-1}")
            return {
                'success': False,
                'error': f'生成失败 (已重试 {retry_count-1} 次): {str(e)}',
                'task_id': self.request.id
            }
