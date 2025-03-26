import os
import sys
import time
import json
import hmac
import hashlib
import logging
from datetime import datetime
from functools import wraps
from pathlib import Path

# 添加项目根目录到Python路径以支持绝对导入
current_dir = Path(__file__).parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 现在导入Flask相关模块
try:
    from flask import Flask, request, jsonify, g
    from flask_cors import CORS
except ImportError as e:
    print(f"导入Flask时发生错误: {e}")
    print(f"Python路径: {sys.path}")
    raise

# 尝试导入redis
try:
    import redis
except ImportError:
    redis = None
    print("未安装redis模块，将禁用Redis功能")

# 现在导入自定义模块
try:
    from db import db_utils
    from server import config
    from server.license_generator import LicenseGenerator
    from server.license_validator import LicenseValidator
    from server.mailer import send_license_email
except ImportError as e:
    print(f"导入自定义模块时发生错误: {e}")
    raise

# 设置日志
try:
    log_file = config.LOG_FILE
    log_dir = os.path.dirname(log_file)
    if not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
        
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL),
        format=config.LOG_FORMAT,
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    logger = logging.getLogger(__name__)
except Exception as e:
    print(f"配置日志时发生错误: {e}")
    # 设置基本日志配置作为后备
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

# 初始化Flask应用 - 确保这是一个模块级变量
app = Flask(__name__)
CORS(app, supports_credentials=True)

# 初始化Redis连接（如果启用）
redis_client = None
if hasattr(config, 'REDIS_ENABLED') and config.REDIS_ENABLED and redis is not None:
    try:
        redis_client = redis.Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=config.REDIS_DB,
            password=config.REDIS_PASSWORD,
            socket_timeout=1
        )
        # 测试连接
        redis_client.ping()
        logger.info("Redis连接成功")
    except Exception as e:
        logger.warning(f"Redis连接失败: {str(e)}")
        redis_client = None
        if hasattr(config, 'REDIS_ENABLED'):
            config.REDIS_ENABLED = False

# 初始化许可证生成器和验证器
try:
    license_generator = LicenseGenerator()
    license_validator = LicenseValidator()
except Exception as e:
    logger.error(f"初始化许可证服务失败: {str(e)}")
    raise

# 管理员认证装饰器
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_token = request.headers.get('X-Admin-Token')
        
        if not auth_token or auth_token != config.API_ADMIN_TOKEN:
            logger.warning(f"管理员API未授权访问, IP: {request.remote_addr}")
            return jsonify({'success': False, 'error': '未授权访问'}), 401
            
        return f(*args, **kwargs)
    return decorated_function

# 速率限制装饰器
def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not config.RATE_LIMIT_ENABLED:
            return f(*args, **kwargs)
            
        client_ip = request.remote_addr
        
        # 如果Redis可用，使用Redis实现速率限制
        if redis_client:
            rate_key = f"ratelimit:{client_ip}"
            current_count = redis_client.get(rate_key)
            
            if current_count and int(current_count) >= config.RATE_LIMIT_MAX_REQUESTS:
                logger.warning(f"IP {client_ip} 超过速率限制")
                return jsonify({
                    'success': False,
                    'error': '请求过于频繁，请稍后再试'
                }), 429
                
            pipe = redis_client.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, config.RATE_LIMIT_WINDOW)
            pipe.execute()
        else:
            # 简单的内存速率限制（不适用于多进程部署）
            current_time = time.time()
            
            # 如果未初始化，创建速率限制字典
            if not hasattr(g, 'rate_limits'):
                g.rate_limits = {}
                
            # 清理过期的速率限制记录
            g.rate_limits = {
                ip: (count, timestamp) 
                for ip, (count, timestamp) in g.rate_limits.items()
                if current_time - timestamp < config.RATE_LIMIT_WINDOW
            }
            
            # 检查当前IP的请求数
            if client_ip in g.rate_limits:
                count, timestamp = g.rate_limits[client_ip]
                if count >= config.RATE_LIMIT_MAX_REQUESTS:
                    logger.warning(f"IP {client_ip} 超过速率限制")
                    return jsonify({
                        'success': False,
                        'error': '请求过于频繁，请稍后再试'
                    }), 429
                g.rate_limits[client_ip] = (count + 1, timestamp)
            else:
                g.rate_limits[client_ip] = (1, current_time)
                
        return f(*args, **kwargs)
    return decorated_function

# API路由
@app.route(f"{config.API_URL_PREFIX}/health", methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'success': True,
        'status': 'ok',
        'timestamp': int(time.time())
    })

@app.route(f"{config.API_URL_PREFIX}/license/verify", methods=['POST'])
@rate_limit
def verify_license():
    """验证许可证接口"""
    data = request.json
    
    # 验证请求参数
    if not data or 'license_key' not in data or 'device_id' not in data:
        return jsonify({
            'success': False,
            'error': '缺少必要参数'
        }), 400
        
    license_key = data['license_key']
    device_id = data['device_id']
    
    # 验证许可证
    result = license_validator.verify_license(
        license_key, 
        device_id,
        request.remote_addr
    )
    
    if result:
        return jsonify({
            'success': True,
            'license_info': {
                'license_key': result['license_key'],
                'plan_id': result['plan_id'],
                'expiry_date': result['expiry_date'],
                'device_count': result['device_count']
            }
        })
    else:
        return jsonify({
            'success': False,
            'error': '无效的许可证或设备ID'
        }), 403

@app.route(f"{config.API_URL_PREFIX}/license/generate", methods=['POST'])
@admin_required
def generate_license():
    """生成许可证接口（管理员）"""
    data = request.json
    
    # 验证请求参数
    if not data or 'plan_id' not in data:
        return jsonify({
            'success': False,
            'error': '缺少必要参数'
        }), 400
        
    plan_id = data['plan_id']
    validity_days = int(data.get('validity_days', config.LICENSE_DEFAULT_VALIDITY_DAYS))
    quantity = int(data.get('quantity', 1))
    
    if quantity < 1 or quantity > 100:
        return jsonify({
            'success': False,
            'error': '数量参数无效（1-100）'
        }), 400
        
    try:
        # 生成许可证
        licenses = []
        for _ in range(quantity):
            license_data = license_generator.generate_license(
                plan_id,
                validity_days,
                request.remote_addr
            )
            licenses.append(license_data)
            
        return jsonify({
            'success': True,
            'licenses': licenses
        })
    except Exception as e:
        logger.error(f"生成许可证时出错: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'生成许可证失败: {str(e)}'
        }), 500

@app.route(f"{config.API_URL_PREFIX}/license/revoke/<license_key>", methods=['POST'])
@admin_required
def revoke_license(license_key):
    """撤销许可证接口（管理员）"""
    data = request.json or {}
    reason = data.get('reason', '管理员操作')
    
    success = license_generator.revoke_license(
        license_key,
        request.remote_addr,
        reason
    )
    
    if success:
        return jsonify({
            'success': True,
            'message': f'许可证 {license_key} 已成功撤销'
        })
    else:
        return jsonify({
            'success': False,
            'error': f'无法撤销许可证 {license_key}'
        }), 404

@app.route(f"{config.API_URL_PREFIX}/license/info/<license_key>", methods=['GET'])
@admin_required
def get_license_info(license_key):
    """获取许可证信息接口（管理员）"""
    license_info = db_utils.get_license_by_code(license_key)
    
    if not license_info:
        return jsonify({
            'success': False,
            'error': f'未找到许可证 {license_key}'
        }), 404
        
    # 获取绑定设备数量
    devices = license_info['devices'].split(',') if license_info['devices'] else []
    
    # 格式化过期时间
    expiry_date = (
        datetime.fromtimestamp(license_info['expires_at']).strftime('%Y-%m-%d') 
        if license_info['expires_at'] else '永久'
    )
    
    return jsonify({
        'success': True,
        'license_info': {
            'license_key': license_info['code'],
            'plan_id': license_info['plan_id'],
            'created_at': datetime.fromtimestamp(license_info['created_at']).strftime('%Y-%m-%d %H:%M:%S'),
            'expiry_date': expiry_date,
            'is_active': bool(license_info['is_active']),
            'device_count': len(devices),
            'devices': devices,
            'failed_attempts': license_info['failed_attempts'],
            'last_verified_at': (
                datetime.fromtimestamp(license_info['last_verified_at']).strftime('%Y-%m-%d %H:%M:%S')
                if license_info['last_verified_at'] else None
            )
        }
    })

@app.route(f"{config.API_URL_PREFIX}/payment/callback", methods=['POST'])
def payment_callback():
    """支付回调接口"""
    # 验证签名
    signature = request.headers.get('X-Payment-Signature')
    payload = request.get_data()
    
    if not config.PAYMENT_WEBHOOK_SECRET or not signature:
        logger.error("支付密钥未配置或请求缺少签名")
        return jsonify({'error': '配置错误'}), 500
    
    expected_signature = hmac.new(
        config.PAYMENT_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_signature, signature):
        logger.warning(f"支付回调签名无效, IP: {request.remote_addr}")
        return jsonify({'error': '签名无效'}), 401
    
    # 解析支付数据
    payment_data = request.json
    transaction_id = payment_data.get('transaction_id')
    amount = payment_data.get('amount')
    currency = payment_data.get('currency')
    status = payment_data.get('status')
    customer_email = payment_data.get('customer_email')
    plan_id = payment_data.get('plan_id')
    
    if not all([transaction_id, amount, currency, status, customer_email, plan_id]):
        logger.warning(f"支付回调缺少必要参数: {payment_data}")
        return jsonify({'error': '缺少必要参数'}), 400
    
    try:
        # 检查交易ID是否已处理（幂等性）
        existing_payment = db_utils.get_payment_by_transaction_id(transaction_id)
        if existing_payment:
            logger.info(f"支付交易已处理: {transaction_id}")
            return jsonify({
                'success': True,
                'message': '交易已处理'
            })
        
        # 记录交易
        details = json.dumps(payment_data)
        payment_id = db_utils.record_payment(
            transaction_id, amount, currency, status, customer_email, None, details
        )
        
        # 如果支付成功，生成许可证
        if status.lower() in ('completed', 'success', 'paid'):
            # 确定有效期（可基于计划ID）
            validity_days = config.LICENSE_DEFAULT_VALIDITY_DAYS
            if 'lifetime' in plan_id.lower():
                validity_days = None  # 无限期
            elif 'monthly' in plan_id.lower():
                validity_days = 30
            
            # 生成许可证
            license_data = license_generator.generate_license(
                plan_id, 
                validity_days,
                request.remote_addr
            )
            
            # 更新交易记录，关联许可证ID
            db_utils.record_payment(
                transaction_id, amount, currency, status, customer_email, 
                license_data['license_id'], details
            )
            
            # 发送许可证邮件给客户
            email_sent = send_license_email(
                customer_email, 
                license_data['license_key'], 
                plan_id,
                license_data['expiry_date']
            )
            
            result = {
                'success': True,
                'message': '支付处理成功并生成许可证',
                'license': license_data['license_key'],
                'email_sent': email_sent
            }
        else:
            result = {
                'success': True,
                'message': f'支付状态已记录: {status}'
            }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"处理支付回调时出错: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'服务器内部错误: {str(e)}'
        }), 500

@app.route(f"{config.API_URL_PREFIX}/send-license-email", methods=['POST'])
@admin_required
def send_license_email_endpoint():
    """发送许可证邮件接口（管理员）"""
    data = request.json
    
    # 验证请求参数
    if not data or 'license_key' not in data or 'email' not in data:
        return jsonify({
            'success': False,
            'error': '缺少必要参数'
        }), 400
        
    license_key = data['license_key']
    email = data['email']
    
    # 获取许可证信息
    license_info = db_utils.get_license_by_code(license_key)
    
    if not license_info:
        return jsonify({
            'success': False,
            'error': f'未找到许可证 {license_key}'
        }), 404
        
    # 格式化过期时间
    expiry_date = (
        datetime.fromtimestamp(license_info['expires_at']).strftime('%Y-%m-%d') 
        if license_info['expires_at'] else '永久'
    )
    
    # 发送邮件
    email_sent = send_license_email(
        email, 
        license_key, 
        license_info['plan_id'],
        expiry_date
    )
    
    if email_sent:
        return jsonify({
            'success': True,
            'message': f'许可证邮件已发送至 {email}'
        })
    else:
        return jsonify({
            'success': False,
            'error': '发送邮件失败'
        }), 500

# 这个部分确保app变量可以被Gunicorn导入
application = app  # 为WSGI服务器提供一个application变量

# 只有直接运行此文件时才会执行的代码
if __name__ == '__main__':
    # 确保数据库初始化
    db_utils.init_db()
    
    # 打印服务信息
    logger.info(f"许可证管理系统启动于 http://{config.API_HOST}:{config.API_PORT}{config.API_URL_PREFIX}")
    logger.info(f"环境: {config.ENV}")
    logger.info(f"Redis状态: {'启用' if hasattr(config, 'REDIS_ENABLED') and config.REDIS_ENABLED else '禁用'}")
    logger.info(f"速率限制: {'启用' if hasattr(config, 'RATE_LIMIT_ENABLED') and config.RATE_LIMIT_ENABLED else '禁用'}")
    
    app.run(
        host=config.API_HOST,
        port=config.API_PORT,
        debug=(config.ENV == 'development')
    )
