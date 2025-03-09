import os
import time
import logging
import traceback
from celery import Celery
from celery.exceptions import MaxRetriesExceededError
from config import (
    CELERY_BROKER_URL, 
    CELERY_RESULT_BACKEND, 
    MAX_RETRIES,
    RETRY_DELAY
)
from novelai import NovelAIClient

# 配置日志
logger = logging.getLogger('text2image.worker')

# 创建 Celery 应用
celery_app = Celery(
    'text2image_tasks',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

# 配置 Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Shanghai',
    enable_utc=True,
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
    
    try:
        # 创建 NovelAI 客户端
        client = NovelAIClient()
        
        # 登录 NovelAI
        auth_type = request_params.get('auth_type')
        logger.info(f"认证类型: {auth_type}")
        
        if auth_type == 'token':
            token = request_params.get('token')
            if not token:
                logger.error("未提供有效的令牌")
                return {
                    'success': False,
                    'error': '未提供有效的 token'
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
                    'error': '未提供有效的邮箱或密码'
                }
            
            logger.info(f"使用账号密码认证，邮箱: {email}")
            client.login_with_email_password(email, password)
            
        else:
            logger.error(f"不支持的认证类型: {auth_type}")
            return {
                'success': False,
                'error': f'不支持的认证类型: {auth_type}'
            }
        
        # 添加模拟延迟，避免 NovelAI API 速率限制
        logger.info("模拟 API 调用延迟...")
        time.sleep(2)
        
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
        if not images or len(images) == 0:
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
        try:
            # 只有对特定错误进行重试，避免无法解决的错误无限重试
            if "速率限制" in str(e) or "连接" in str(e):
                logger.info(f"将在 {RETRY_DELAY * (2 ** self.request.retries)} 秒后重试...")
                raise self.retry(
                    exc=e, 
                    countdown=RETRY_DELAY * (2 ** self.request.retries)
                )
            else:
                # 不需要重试的错误，直接返回错误信息
                return {
                    'success': False,
                    'error': f'生成失败: {str(e)}',
                    'task_id': self.request.id
                }
        except MaxRetriesExceededError:
            logger.error(f"超过最大重试次数: {MAX_RETRIES}")
            return {
                'success': False,
                'error': f'生成失败 (已重试 {MAX_RETRIES} 次): {str(e)}',
                'task_id': self.request.id
            }
