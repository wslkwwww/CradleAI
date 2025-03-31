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
    from db.db_utils import get_db_connection  # 显式导入get_db_connection函数
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

# 添加MD5签名验证函数 - 严格按照ZPay官方SDK的方式实现
def verify_zpay_signature(params, key):
    """验证ZPay签名"""
    # 记录详细的验证开始日志
    logger.info(f"开始验证ZPay回调签名，原始参数: {params}")
    
    try:
        # 获取签名
        params_copy = params.copy()
        if 'sign' not in params_copy:
            logger.warning("ZPay回调缺少sign参数")
            return False
        received_sign = params_copy.pop('sign')
        logger.debug(f"获取到的原始签名值: {received_sign}")
        
        # 移除sign_type参数（不参与签名）
        if 'sign_type' in params_copy:
            params_copy.pop('sign_type')
        
        # 将所有参数变为字符串并移除空值参数
        params_filtered = {}
        for k, v in params_copy.items():
            if v != '':
                params_filtered[k] = str(v)
        
        # 按参数名ASCII码从小到大排序
        param_names = sorted(params_filtered.keys())
        logger.debug(f"参数排序后的顺序: {param_names}")
        
        # 拼接成URL键值对格式（严格按照ZPay的方式）
        param_str = ""
        for i, name in enumerate(param_names):
            if i > 0:
                param_str += "&"
            param_str += f"{name}={params_filtered[name]}"
            
        logger.debug(f"参数拼接后的字符串: {param_str}")
        
        # 拼接商户密钥并进行MD5加密
        sign_str = param_str + key
        logger.debug(f"拼接商户密钥后的字符串(密钥部分隐藏): {param_str}+******")
        
        # 计算MD5（使用小写）
        calculated_sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest().lower()
        logger.debug(f"计算得到的MD5签名: {calculated_sign}")
        
        # 比较签名（转为小写比较）
        is_valid = calculated_sign == received_sign.lower()
        
        if is_valid:
            logger.info("ZPay签名验证成功!")
        else:
            logger.warning(f"ZPay签名验证失败:")
            logger.warning(f"收到的签名: {received_sign}")
            logger.warning(f"计算的签名: {calculated_sign}")
            logger.warning(f"参数字符串: {param_str}")
            
            # 调试: 单独记录每个参数的值
            for name in param_names:
                logger.debug(f"参数 {name} = '{params_filtered[name]}'")
            
            # 如果密钥可能有问题，记录下来（但不泄露完整密钥）
            if key != config.ZPAY_PKEY:
                logger.error(f"商户密钥不匹配: 使用的密钥与配置中的ZPAY_PKEY不一致")
                
        return is_valid
        
    except Exception as e:
        logger.error(f"验证签名时出错: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

@app.route(f"{config.API_URL_PREFIX}/license/payment/callback", methods=['GET', 'POST'])
def payment_callback():
    """ZPay支付回调接口"""
    try:
        # 获取回调参数
        if request.method == 'GET':
            params = request.args.to_dict()
            logger.info(f"收到ZPay GET回调: {params}")
        else:  # POST
            params = request.form.to_dict()
            logger.info(f"收到ZPay POST回调: {params}")
            logger.debug(f"回调请求头: {dict(request.headers)}")
        
        # 记录回调信息
        logger.info(f"收到支付回调: {params}")
        
        # 必要参数检查
        required_params = ['pid', 'trade_no', 'out_trade_no', 'type', 'name', 'money', 'trade_status', 'sign', 'sign_type']
        missing_params = [param for param in required_params if param not in params]
        if missing_params:
            logger.warning(f"支付回调缺少必要参数: {missing_params}")
            return "success", 200  # 仍返回success以避免重复通知
        
        # 验证PID是否与配置匹配
        if params['pid'] != config.ZPAY_PID:
            logger.warning(f"收到非预期商户ID的回调: 预期 {config.ZPAY_PID}，实际 {params['pid']}")
            
        # 验证签名
        signature_verification = verify_zpay_signature(params.copy(), config.ZPAY_PKEY)
        if not signature_verification:
            logger.warning(f"支付回调签名验证失败, IP: {request.remote_addr}")
            # 记录使用的密钥 (小心不要泄露完整密钥)
            logger.debug(f"使用的商户密钥前4位: {config.ZPAY_PKEY[:4]}****")
            return "success", 200  # 仍返回success以避免重复通知
        
        # 检查支付状态
        if params['trade_status'] != 'TRADE_SUCCESS':
            logger.info(f"支付状态非成功: {params['trade_status']}")
            return "success", 200
        
        # 获取交易信息
        transaction_id = params['out_trade_no']  # 商户订单号
        zpay_trade_no = params['trade_no']      # ZPay交易号
        payment_type = params['type']           # 支付方式
        amount = params['money']                # 订单金额
        param_data = params.get('param', '')    # 附加数据
        
        # 尝试从多个来源获取邮箱地址和计划类型
        customer_email = ''
        plan_id = ''
        original_amount = ''
        
        # 1. 从param JSON参数中获取
        try:
            if param_data:
                param_json = json.loads(param_data)
                customer_email = param_json.get('email', '')
                plan_id = param_json.get('plan_type', '')
                original_amount = param_json.get('original_amount', '')
                
                if original_amount:
                    logger.info(f"原始价格: {original_amount}, 测试价格: {amount}")
        except json.JSONDecodeError:
            logger.warning(f"无法解析param数据: {param_data}")
        
        # 2. 从URL查询参数中获取邮箱（作为备用）
        url_email = request.args.get('email', '')
        if not customer_email and url_email:
            customer_email = url_email
            logger.info(f"从URL参数获取到邮箱: {customer_email}")
        
        # 3. 如果还是没有邮箱，从return_url中提取
        if not customer_email and 'return_url' in params:
            try:
                from urllib.parse import urlparse, parse_qs
                return_url = params['return_url']
                parsed_url = urlparse(return_url)
                query_params = parse_qs(parsed_url.query)
                if 'email' in query_params:
                    customer_email = query_params['email'][0]
                    logger.info(f"从return_url中获取到邮箱: {customer_email}")
            except Exception as e:
                logger.warning(f"从return_url提取邮箱失败: {str(e)}")
        
        # 验证邮箱有效性
        if not customer_email or '@' not in customer_email:
            logger.warning(f"无效的邮箱地址: {customer_email}")
            # 表明没有有效的邮箱地址，不继续处理
            return "success", 200
        
        # 加锁处理交易，防止并发问题
        if not db_utils.lock_transaction(transaction_id):
            logger.warning(f"交易 {transaction_id} 正在处理中，跳过")
            return "success", 200
        
        try:
            # 检查交易是否已处理（幂等性处理）
            existing_payment = db_utils.get_payment_by_transaction_id(transaction_id)
            if existing_payment:
                logger.info(f"支付交易已处理: {transaction_id}")
                
                # 如果之前处理时没有发送邮件（没有email字段）但现在有了email，则发送许可证邮件
                if (not existing_payment['email'] or existing_payment['email'] == '') and customer_email:
                    # 获取关联的许可证
                    if existing_payment['license_id']:
                        # 查询许可证信息
                        license_info = db_utils.get_license_by_id(existing_payment['license_id'])
                        if license_info:
                            # 格式化过期时间
                            expiry_date = (
                                datetime.fromtimestamp(license_info['expires_at']).strftime('%Y-%m-%d') 
                                if license_info['expires_at'] else '永久'
                            )
                            
                            # 发送许可证邮件
                            send_license_email(
                                customer_email, 
                                license_info['code'], 
                                license_info['plan_id'],
                                expiry_date
                            )
                            
                            # 更新支付记录的邮箱
                            db_utils.update_payment(
                                existing_payment['id'],
                                email=customer_email
                            )
                            
                            logger.info(f"补发许可证邮件: {license_info['code']} 给 {customer_email}")
                
                return "success", 200
            
            # 记录交易
            payment_details = json.dumps(params)
            payment_id = db_utils.record_payment(
                transaction_id, 
                zpay_trade_no, 
                float(amount), 
                payment_type, 
                'success', 
                customer_email, 
                None, 
                payment_details
            )
            
            # 如果支付成功，生成许可证
            if params['trade_status'] == 'TRADE_SUCCESS':
                # 确定有效期（基于计划ID）
                validity_days = config.LICENSE_DEFAULT_VALIDITY_DAYS
                if plan_id:
                    if 'monthly' in plan_id.lower():
                        validity_days = 30
                    elif 'quarterly' in plan_id.lower():
                        validity_days = 90
                    elif 'yearly' in plan_id.lower():
                        validity_days = 365
                
                # 生成许可证
                license_data = license_generator.generate_license(
                    plan_id or 'standard', 
                    validity_days,
                    request.remote_addr
                )
                
                # 更新交易记录，关联许可证ID
                db_utils.update_payment(
                    payment_id, 
                    license_id=license_data['license_id']
                )
                
                # 发送许可证邮件给客户
                if customer_email:
                    email_sent = send_license_email(
                        customer_email, 
                        license_data['license_key'], 
                        plan_id or 'standard',
                        license_data['expiry_date']
                    )
                    
                    if email_sent:
                        logger.info(f"成功发送许可证邮件: {license_data['license_key']} 给 {customer_email}")
                    else:
                        logger.error(f"发送许可证邮件失败: {license_data['license_key']} 给 {customer_email}")
                else:
                    logger.warning(f"未提供有效邮箱，无法发送许可证: {license_data['license_key']}")
                
                logger.info(f"支付处理成功，生成许可证: {license_data['license_key']} 给 {customer_email}")
            
            # 返回成功响应，必须是纯字符串"success"
            return "success", 200
            
        except Exception as e:
            logger.error(f"处理支付回调时出错: {str(e)}")
            # 返回success避免ZPay重复通知
            return "success", 200
        finally:
            # 解锁交易
            db_utils.unlock_transaction(transaction_id)
    except Exception as e:
        logger.error(f"处理支付回调时出现未捕获异常: {str(e)}")
        return "success", 200  # 仍返回success避免重复通知

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
