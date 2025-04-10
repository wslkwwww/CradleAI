import os
import logging
import threading
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from celery.result import AsyncResult
from worker import celery_app, generate_image
from config import (
    SECRET_KEY,
    MINIO_ENDPOINT,
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY, 
    MINIO_SECURE,
    MINIO_BUCKET
)
import uuid
from utils import save_binary_image
from minio_client import MinioStorage
from rate_limiter import rate_limiter
from license_validator import require_license, license_validator

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('text2image.app')

# 创建 Flask 应用
app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = SECRET_KEY

# 处理过的任务缓存，避免重复处理相同任务
app.processed_tasks = set()

# 确保图片存储目录存在
IMAGES_DIR = os.path.join(app.static_folder, 'images')
os.makedirs(IMAGES_DIR, exist_ok=True)
logger.info(f"本地图片存储目录: {IMAGES_DIR}")

# 创建 MinIO 客户端
try:
    minio_storage = MinioStorage(
        endpoint=MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE
    )
    
    # 确保存储桶存在
    if (minio_storage.ensure_bucket_exists(MINIO_BUCKET)):
        logger.info(f"MinIO 存储桶 '{MINIO_BUCKET}' 已确认可用")
    else:
        logger.error(f"MinIO 存储桶 '{MINIO_BUCKET}' 不可用")
except Exception as e:
    logger.error(f"初始化 MinIO 客户端失败: {e}")
    minio_storage = None

# 启用跨域请求支持
CORS(app, resources={r"/*": {"origins": "*"}})

# 结果缓存，键为任务ID，值为结果字典
task_results_cache = {}

# 结果缓存清理函数
def clean_task_results_cache():
    """定期清理结果缓存，防止内存泄漏"""
    while True:
        try:
            time.sleep(3600)  # 每小时检查一次
            
            now = datetime.now().timestamp()
            keys_to_remove = []
            
            for task_id, result in task_results_cache.items():
                # 缓存项超过1天则删除
                cache_time = result.get('cache_timestamp', now - 86000)
                if now - cache_time > 86400:  # 1天 = 86400秒
                    keys_to_remove.append(task_id)
            
            # 删除过期缓存项
            for key in keys_to_remove:
                task_results_cache.pop(key, None)
                
            logger.info(f"清理了 {len(keys_to_remove)} 个过期的结果缓存项")
        except Exception as e:
            logger.error(f"清理缓存时出错: {e}")

# 启动清理线程
cleaner_thread = threading.Thread(target=clean_task_results_cache, daemon=True)
cleaner_thread.start()

# 静态图片服务
@app.route('/static/images/<path:filename>')
def serve_image(filename):
    """提供静态图片文件"""
    return send_from_directory(IMAGES_DIR, filename)

# 添加全局队列状态变量
task_queue_status = {
    "total_pending": 0,
    "queue_positions": {},  # 任务ID到队列位置的映射
    "last_updated": datetime.now().timestamp()
}

# 添加任务优先级管理
task_priorities = {}  # 任务ID到优先级值的映射

# 更新任务队列状态的函数
def update_queue_status():
    """更新任务队列状态"""
    global task_queue_status
    
    try:
        # 获取等待中的任务
        i = celery_app.control.inspect()
        active_tasks = i.active() or {}
        reserved_tasks = i.reserved() or {}
        
        # 合并所有worker的活跃和预留任务
        all_tasks = []
        for worker, tasks in active_tasks.items():
            for task in tasks:
                all_tasks.append((task['id'], task.get('delivery_info', {}).get('priority', 0), 'active'))
                
        for worker, tasks in reserved_tasks.items():
            for task in tasks:
                all_tasks.append((task['id'], task.get('delivery_info', {}).get('priority', 0), 'reserved'))
        
        # 根据优先级和时间排序
        all_tasks.sort(key=lambda x: (-task_priorities.get(x[0], 0), x[1]))
        
        # 更新队列状态
        queue_positions = {}
        for idx, (task_id, _, _) in enumerate(all_tasks):
            queue_positions[task_id] = idx + 1
        
        task_queue_status = {
            "total_pending": len(all_tasks),
            "queue_positions": queue_positions,
            "last_updated": datetime.now().timestamp()
        }
        
        logger.debug(f"更新了队列状态，当前待处理任务: {len(all_tasks)}")
    except Exception as e:
        logger.error(f"更新队列状态时出错: {e}")

# 定期更新队列状态的线程
def queue_status_updater():
    """定期更新队列状态"""
    while True:
        try:
            update_queue_status()
            time.sleep(5)  # 每5秒更新一次
        except Exception as e:
            logger.error(f"队列状态更新线程出错: {e}")
            time.sleep(30)  # 出错后等待较长时间再重试

# 启动队列状态更新线程
queue_updater_thread = threading.Thread(target=queue_status_updater, daemon=True)
queue_updater_thread.start()

@app.route('/generate', methods=['POST'])
@require_license  # 添加许可证验证
def api_generate():
    """接收图像生成请求并将任务放入 Celery 队列"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '未提供有效的请求数据'
            }), 400
            
        # 验证必要的参数
        if not data.get('prompt'):
            return jsonify({
                'success': False,
                'error': '未提供提示词'
            }), 400
        
        # 检查是否为测试请求
        is_test_request = data.get('is_test_request', False)
        
        # 对非测试请求检查每日请求配额
        if not is_test_request and rate_limiter.get_remaining_quota() <= 0:
            return jsonify({
                'success': False,
                'error': '已达到每日请求限制',
                'rate_limit_info': {
                    'daily_limit': rate_limiter.daily_limit,
                    'requests_today': rate_limiter.get_request_count(),
                    'remaining': 0
                }
            }), 429
        
        # 获取用户优先级（可从请求头或请求体中获取）
        user_priority = data.get('priority', 0)
        
        # 验证优先级值的范围
        try:
            user_priority = int(user_priority)
            if user_priority < 0:
                user_priority = 0
            elif user_priority > 10:
                user_priority = 10
        except (ValueError, TypeError):
            user_priority = 0
        
        # 在任务参数中标记是否为测试请求
        data['is_test_request'] = is_test_request
        
        # 提交 Celery 任务
        task = generate_image.apply_async(
            args=[data],
            priority=user_priority  # 设置任务优先级
        )
        
        # 记录任务优先级
        task_priorities[task.id] = user_priority
        
        logger.info(f"任务已提交，ID: {task.id}，优先级: {user_priority}, 测试请求: {is_test_request}")
        
        # 更新队列状态
        update_queue_status()
        
        # 获取队列位置
        queue_position = task_queue_status["queue_positions"].get(task.id, 0)
        
        # 返回任务 ID 和队列信息
        response = {
            'success': True,
            'task_id': task.id,
            'message': '图像生成任务已提交',
            'queue_info': {
                'position': queue_position,
                'total_pending': task_queue_status["total_pending"],
            }
        }
        
        # 添加速率限制信息
        if not is_test_request:
            response['rate_limit_info'] = {
                'daily_limit': rate_limiter.daily_limit,
                'requests_today': rate_limiter.get_request_count(),
                'remaining': rate_limiter.get_remaining_quota()
            }
            
            # 添加时间窗口信息
            hour = rate_limiter._get_sg_hour()
            allowed_windows = [
                (6, 9),    # 早上
                (12, 14),  # 中午
                (19, 23),  # 晚上
            ]
            response['rate_limit_info']['current_sg_hour'] = hour
            response['rate_limit_info']['allowed_windows'] = allowed_windows
            
            # 检查当前时间是否在允许的窗口内
            in_allowed_window = any(start <= hour < end for start, end in allowed_windows)
            response['rate_limit_info']['in_allowed_window'] = in_allowed_window
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"处理请求时出错: {e}")
        return jsonify({
            'success': False,
            'error': f'处理请求时出错: {str(e)}'
        }), 500

@app.route('/task_status/<task_id>', methods=['GET'])
@require_license  # 添加许可证验证
def api_task_status(task_id):
    """查询任务状态"""
    try:
        # 首先检查是否有缓存的结果
        if task_id in task_results_cache:
            logger.debug(f"返回缓存的任务结果 (task_id: {task_id})")
            return jsonify({
                'task_id': task_id,
                'status': 'SUCCESS',
                'done': True,
                **task_results_cache[task_id]
            })
            
        # 查询任务状态
        task_result = AsyncResult(task_id, app=celery_app)
        
        # 准备基本响应
        response = {
            'task_id': task_id,
            'status': task_result.status,
            'done': task_result.ready()
        }
        
        # 添加队列位置信息
        queue_position = task_queue_status["queue_positions"].get(task_id, 0)
        if queue_position > 0 and not response['done']:
            response['queue_info'] = {
                'position': queue_position,
                'total_pending': task_queue_status["total_pending"],
                'estimated_wait': queue_position * 30  # 每个任务估计30秒，可根据实际情况调整
            }
        
        # 如果任务完成，添加结果信息
        if task_result.ready():
            if task_result.successful():
                result = task_result.result
                
                # 如果是成功的任务且包含图像数据，且尚未处理
                if result.get('success') and result.get('images') and task_id not in app.processed_tasks:
                    try:
                        # 标记任务已处理，避免重复处理
                        app.processed_tasks.add(task_id)
                        
                        # 处理图像
                        image_urls = []
                        
                        # 使用 MinIO 存储图像
                        if minio_storage:
                            logger.info(f"使用 MinIO 处理任务图像 (task_id: {task_id})")
                            
                            for index, image_info in enumerate(result['images']):
                                # 生成唯一文件名
                                original_name = image_info.get('name', f"image_{index}.png")
                                ext = os.path.splitext(original_name)[1] or '.png'
                                
                                # 确定内容类型
                                content_type = 'image/png'
                                if ext.lower() in ('.jpg', '.jpeg'):
                                    content_type = 'image/jpeg'
                                elif ext.lower() == '.gif':
                                    content_type = 'image/gif'
                                elif ext.lower() == '.webp':
                                    content_type = 'image/webp'
                                
                                # 上传到 MinIO
                                success, url = minio_storage.upload_binary(
                                    bucket_name=MINIO_BUCKET,
                                    binary_data=image_info['data'],
                                    content_type=content_type
                                )
                                
                                if success:
                                    image_urls.append(url)
                                else:
                                    logger.error(f"上传图像到 MinIO 失败: {url}")
                                    # 降级到本地存储
                                    filename = f"novelai_{uuid.uuid4().hex}{ext}"
                                    filepath = os.path.join(IMAGES_DIR, filename)
                                    save_binary_image(image_info['data'], filepath)
                                    image_url = f"/static/images/{filename}"
                                    image_urls.append(request.url_root.rstrip('/') + image_url)
                        else:
                            # 本地存储
                            logger.info(f"使用本地存储处理任务图像 (task_id: {task_id})")
                            
                            for index, image_info in enumerate(result['images']):
                                original_name = image_info.get('name', f"image_{index}.png")
                                ext = os.path.splitext(original_name)[1] or '.png'
                                filename = f"novelai_{uuid.uuid4().hex}{ext}"
                                filepath = os.path.join(IMAGES_DIR, filename)
                                save_binary_image(image_info['data'], filepath)
                                image_url = f"/static/images/{filename}"
                                image_urls.append(request.url_root.rstrip('/') + image_url)
                        
                        # 更新结果
                        result['image_urls'] = image_urls
                        if image_urls:
                            result['image_url'] = image_urls[0]
                        
                        # 移除二进制数据
                        if 'images' in result:
                            del result['images']
                        
                        # 缓存处理后的结果
                        result['cache_timestamp'] = datetime.now().timestamp()
                        task_results_cache[task_id] = result
                        
                        logger.info(f"已处理 {len(image_urls)} 张图像，任务ID: {task_id}")
                    except Exception as e:
                        logger.error(f"处理图像失败: {e}")
                        result['error'] = f"处理图像失败: {str(e)}"
                        result['success'] = False
                
                # 更新响应
                response.update(result)
            else:
                error = str(task_result.result) if task_result.result else "未知错误"
                response.update({
                    'success': False,
                    'error': f'任务失败: {error}'
                })
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"查询任务状态时出错: {e}")
        return jsonify({
            'success': False,
            'error': f'查询任务状态时出错: {str(e)}',
            'task_id': task_id
        }), 500

# 添加新的端点来获取队列状态
@app.route('/queue_status', methods=['GET'])
@require_license  # 添加许可证验证
def api_queue_status():
    """获取当前队列状态"""
    return jsonify({
        'queue_status': task_queue_status,
        'active_tasks': len(task_queue_status["queue_positions"]),
        'last_updated': datetime.fromtimestamp(task_queue_status["last_updated"]).strftime('%Y-%m-%d %H:%M:%S')
    })

# 添加取消任务的端点
@app.route('/cancel_task/<task_id>', methods=['POST'])
@require_license  # 添加许可证验证
def api_cancel_task(task_id):
    """取消指定的任务"""
    try:
        # 尝试撤销任务
        celery_app.control.revoke(task_id, terminate=True)
        
        # 从队列状态中移除
        if task_id in task_queue_status["queue_positions"]:
            del task_queue_status["queue_positions"][task_id]
        
        # 从优先级映射中移除
        if task_id in task_priorities:
            del task_priorities[task_id]
        
        return jsonify({
            'success': True,
            'message': f'任务 {task_id} 已取消'
        })
    except Exception as e:
        logger.error(f"取消任务时出错: {e}")
        return jsonify({
            'success': False,
            'error': f'取消任务时出错: {str(e)}'
        }), 500

# 添加速率限制状态的端点
@app.route('/rate_limit_status', methods=['GET'])
@require_license  # 添加许可证验证
def api_rate_limit_status():
    """获取当前速率限制状态"""
    try:
        # 获取新加坡时间的小时
        hour = rate_limiter._get_sg_hour()
        sg_date = rate_limiter._get_sg_date()
        
        # 定义允许请求的时间窗口(新加坡时间)
        allowed_windows = [
            (6, 9),    # 早上
            (12, 14),  # 中午
            (19, 23),  # 晚上
        ]
        
        # 检查当前时间是否在允许的窗口内
        in_allowed_window = any(start <= hour < end for start, end in allowed_windows)
        
        return jsonify({
            'success': True,
            'rate_limit_info': {
                'daily_limit': rate_limiter.daily_limit,
                'requests_today': rate_limiter.get_request_count(),
                'remaining': rate_limiter.get_remaining_quota(),
                'singapore_time': {
                    'date': sg_date,
                    'hour': hour,
                },
                'allowed_windows': allowed_windows,
                'in_allowed_window': in_allowed_window,
                'window_description': ', '.join([f"{start}:00-{end}:00" for start, end in allowed_windows])
            }
        })
    except Exception as e:
        logger.error(f"获取速率限制状态时出错: {e}")
        return jsonify({
            'success': False,
            'error': f'获取速率限制状态时出错: {str(e)}'
        }), 500

# 修复token_status端点中的拼写错误（trip -> strip）
@app.route('/token_status', methods=['GET'])
@require_license  # 添加许可证验证
def api_token_status():
    """获取令牌缓存状态"""
    try:
        # 获取请求参数
        token = None
        email = None
        
        # 从Authorization头获取token
        auth_header = request.headers.get('Authorization')
        if (auth_header and auth_header.startswith('Bearer ')):
            token = auth_header[7:].strip()  # 修复此处的拼写错误 (trip -> strip)
        
        # 从查询参数获取email
        email = request.args.get('email')
        
        # 创建NovelAI客户端
        from novelai import NovelAIClient
        client = NovelAIClient()
        
        # 检查令牌缓存状态
        cache_key = email or "default"
        is_cached = False
        days_remaining = None
        cached_email = None
        
        # 如果提供了令牌，检查令牌是否在缓存中
        if token:
            for key, token_data in client.token_cache.items():
                if token_data.get('token') == token:
                    is_cached = True
                    cache_key = key
                    now = time.time()
                    expiry = token_data.get('expiry', 0)
                    days_remaining = (expiry - now) / (24 * 3600)  # 转换为天数
                    cached_email = key if key != "default" else None
                    break
        # 如果提供了email但没有提供token，检查该email是否有缓存的令牌
        elif email:
            if email in client.token_cache:
                is_cached = True
                cache_key = email
                now = time.time()
                token_data = client.token_cache[email]
                expiry = token_data.get('expiry', 0)
                days_remaining = (expiry - now) / (24 * 3600)  # 转换为天数
                cached_email = email
        
        return jsonify({
            'success': True,
            'isCached': is_cached,
            'daysRemaining': days_remaining,
            'email': cached_email
        })
    except Exception as e:
        logger.error(f"查询令牌状态时出错: {e}")
        return jsonify({
            'success': False,
            'error': f'查询令牌状态时出错: {str(e)}'
        }), 500

# 添加许可证验证端点
@app.route('/verify_license', methods=['POST'])
def api_verify_license():
    """验证许可证"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '未提供有效的请求数据'
            }), 400
            
        license_key = data.get('license_key')
        device_id = data.get('device_id')
        
        if not license_key or not device_id:
            return jsonify({
                'success': False,
                'error': '许可证密钥和设备ID是必需的'
            }), 400
            
        # 验证许可证
        license_info = license_validator.verify_license(license_key, device_id)
        
        if not license_info:
            return jsonify({
                'success': False,
                'error': '无效的许可证或许可证已过期'
            }), 403
            
        # 返回许可证信息
        return jsonify({
            'success': True,
            'license_info': license_info
        })
        
    except Exception as e:
        logger.error(f"验证许可证时出错: {e}")
        return jsonify({
            'success': False,
            'error': f'验证许可证时出错: {str(e)}'
        }), 500

# 添加许可证状态端点
@app.route('/license_status', methods=['GET'])
def api_license_status():
    """获取许可证状态"""
    try:
        # 从请求头中获取许可证信息
        license_key = request.headers.get('X-License-Key')
        device_id = request.headers.get('X-Device-ID')
        
        if not license_key or not device_id:
            return jsonify({
                'success': False,
                'has_license': False,
                'error': '未提供许可证信息'
            })
            
        # 验证许可证
        license_info = license_validator.verify_license(license_key, device_id)
        
        if not license_info:
            return jsonify({
                'success': False,
                'has_license': False,
                'error': '无效的许可证'
            })
            
        # 返回许可证状态
        return jsonify({
            'success': True,
            'has_license': True,
            'license_info': {
                'plan_id': license_info.get('plan_id'),
                'expiry_date': license_info.get('expiry_date'),
                'customer_email': license_info.get('customer_email')
            }
        })
        
    except Exception as e:
        logger.error(f"获取许可证状态时出错: {e}")
        return jsonify({
            'success': True,
            'has_license': False,
            'error': f'获取许可证状态时出错: {str(e)}'
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
