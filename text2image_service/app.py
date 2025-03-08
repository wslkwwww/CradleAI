import os
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from celery.result import AsyncResult
from worker import celery_app, generate_image
from config import SECRET_KEY  # 从配置文件导入SECRET_KEY
import uuid
from utils import save_base64_as_image  # 导入新添加的工具函数

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('text2image.app')

# 创建 Flask 应用
app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = SECRET_KEY

# 确保图片存储目录存在
IMAGES_DIR = os.path.join(app.static_folder, 'images')
os.makedirs(IMAGES_DIR, exist_ok=True)
logger.info(f"图片存储目录: {IMAGES_DIR}")

# 启用跨域请求支持
CORS(app, resources={r"/*": {"origins": "*"}})

# 静态图片服务
@app.route('/static/images/<path:filename>')
def serve_image(filename):
    """提供静态图片文件"""
    return send_from_directory(IMAGES_DIR, filename)

@app.route('/generate', methods=['POST'])
def api_generate():
    """接收图像生成请求并将任务放入 Celery 队列
    
    Expected JSON body:
    {
        "auth_type": "token" or "login",
        "token": "novelai-token",  // 如果 auth_type 是 "token"
        "email": "user@example.com",  // 如果 auth_type 是 "login"
        "password": "password123",    // 如果 auth_type 是 "login"
        "model": "nai-v3",
        "prompt": "正面提示词",
        "negative_prompt": "负面提示词",
        "sampler": "k_euler_ancestral",
        "steps": 28,
        "scale": 11,
        "resolution": "portrait",
        "seed": 1234567,  // 可选
        "source_image": "base64...",  // 可选，用于图像到图像
        "strength": 0.7,  // 可选，用于图像到图像
        "noise": 0.2      // 可选，用于图像到图像
    }
    
    Returns:
        JSON: 包含任务 ID 的响应
    """
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '未提供有效的请求数据'
            }), 400
            
        # 验证必要的参数
        auth_type = data.get('auth_type')
        if not auth_type:
            return jsonify({
                'success': False,
                'error': '未指定认证类型'
            }), 400
            
        if auth_type == 'token' and not data.get('token'):
            return jsonify({
                'success': False,
                'error': '未提供有效的 token'
            }), 400
            
        if auth_type == 'login' and (not data.get('email') or not data.get('password')):
            return jsonify({
                'success': False,
                'error': '未提供有效的邮箱或密码'
            }), 400
            
        if not data.get('prompt'):
            return jsonify({
                'success': False,
                'error': '未提供提示词'
            }), 400
        
        # 提交 Celery 任务
        task = generate_image.delay(data)
        
        logger.info(f"任务已提交，ID: {task.id}")
        
        # 返回任务 ID
        return jsonify({
            'success': True,
            'task_id': task.id,
            'message': '图像生成任务已提交'
        })
        
    except Exception as e:
        logger.error(f"处理请求时出错: {e}")
        return jsonify({
            'success': False,
            'error': f'处理请求时出错: {str(e)}'
        }), 500

@app.route('/task_status/<task_id>', methods=['GET'])
def api_task_status(task_id):
    """查询任务状态
    
    Args:
        task_id: Celery 任务 ID
        
    Returns:
        JSON: 包含任务状态和结果的响应
    """
    try:
        # 查询任务状态
        task_result = AsyncResult(task_id, app=celery_app)
        
        # 准备基本响应
        response = {
            'task_id': task_id,
            'status': task_result.status,
            'done': task_result.ready()
        }
        
        # 如果任务完成，添加结果或错误信息
        if task_result.ready():
            if task_result.successful():
                result = task_result.result
                
                # 如果有图像数据，保存为文件
                if result.get('success') and result.get('images'):
                    try:
                        image_urls = []  # 存储所有图像的URL
                        
                        for index, image_info in enumerate(result['images']):
                            # 生成唯一文件名
                            original_name = image_info['name']
                            ext = os.path.splitext(original_name)[1] or '.png'
                            filename = f"novelai_{uuid.uuid4()}{ext}"
                            filepath = os.path.join(IMAGES_DIR, filename)
                            
                            # 保存图像
                            from utils import save_binary_image
                            save_binary_image(image_info['data'], filepath)
                            
                            # 创建URL
                            image_url = f"/static/images/{filename}"
                            full_url = request.url_root.rstrip('/') + image_url
                            image_urls.append(full_url)
                            
                        # 在响应中包含所有图像URL
                        result['image_urls'] = image_urls
                        
                        # 为了向后兼容，将第一张图像作为主图像URL
                        if image_urls:
                            result['image_url'] = image_urls[0]
                            
                        # 移除原始二进制数据，避免大量数据传输
                        if 'images' in result:
                            del result['images']
                            
                        logger.info(f"已保存 {len(image_urls)} 张图像")
                    except Exception as e:
                        logger.error(f"保存图像文件失败: {e}")
                        # 如果保存失败，保留错误信息
                        result['error'] = f"保存图像失败: {str(e)}"
                        result['success'] = False
                
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
