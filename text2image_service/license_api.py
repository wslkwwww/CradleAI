from flask import Blueprint, request, jsonify, g
from functools import wraps
import hmac
import hashlib
import time
import uuid
import logging
import os
from license_generator import license_generator
from license_validator import license_validator, require_license
from config import PAYMENT_WEBHOOK_SECRET

# Configure logging
logger = logging.getLogger('text2image.license_api')

# Create a Blueprint for license management
license_bp = Blueprint('license', __name__, url_prefix='/v1/license')

# Admin authentication decorator
def admin_auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_token = request.headers.get('X-Admin-Token')
        
        # In production, you should implement a more secure authentication mechanism
        if not auth_token or auth_token != os.environ.get('ADMIN_API_TOKEN'):
            return jsonify({'success': False, 'error': '未授权访问'}), 401
            
        return f(*args, **kwargs)
    return decorated_function

# Generate a new license (admin only)
@license_bp.route('/generate', methods=['POST'])
@admin_auth_required
def api_generate_license():
    """Generate a new license (admin access only)"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': '无效的请求数据'}), 400
        
        plan_id = data.get('plan_id')
        customer_email = data.get('customer_email')
        validity_days = int(data.get('validity_days', 365))
        
        if not plan_id:
            return jsonify({'success': False, 'error': '计划ID是必需的'}), 400
            
        if not customer_email:
            return jsonify({'success': False, 'error': '客户邮箱是必需的'}), 400
        
        # Generate the license
        license_data = license_generator.generate_license(
            plan_id=plan_id,
            customer_email=customer_email,
            validity_days=validity_days
        )
        
        return jsonify({
            'success': True,
            'message': '许可证生成成功',
            'license': license_data
        })
        
    except Exception as e:
        logger.error(f"License generation error: {e}")
        return jsonify({
            'success': False,
            'error': f'生成许可证时出错: {str(e)}'
        }), 500

# Revoke a license (admin only)
@license_bp.route('/revoke/<license_key>', methods=['POST'])
@admin_auth_required
def api_revoke_license(license_key):
    """Revoke a license (admin access only)"""
    success = license_generator.revoke_license(license_key)
    
    if success:
        return jsonify({
            'success': True,
            'message': f'许可证 {license_key} 已成功撤销'
        })
    else:
        return jsonify({
            'success': False,
            'error': f'撤销许可证 {license_key} 失败'
        }), 404

# Get license information (admin only)
@license_bp.route('/info/<license_key>', methods=['GET'])
@admin_auth_required
def api_license_info(license_key):
    """Get license information (admin access only)"""
    license_info = license_validator.get_license_info(license_key)
    
    if license_info:
        return jsonify({
            'success': True,
            'license': license_info
        })
    else:
        return jsonify({
            'success': False,
            'error': f'未找到许可证 {license_key}'
        }), 404

# Verify a license
@license_bp.route('/verify', methods=['POST'])
def api_verify_license():
    """Verify a license key and bind to device"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': '无效的请求数据'}), 400
        
        license_key = data.get('license_key')
        device_id = data.get('device_id')
        
        if not license_key:
            return jsonify({'success': False, 'error': '许可证密钥是必需的'}), 400
            
        if not device_id:
            # Generate a device ID if not provided
            device_id = str(uuid.uuid4())
        
        # Verify the license
        is_valid = license_validator.verify_license(license_key, device_id)
        
        if is_valid:
            # Get license info for the response
            license_info = license_validator.get_license_info(license_key)
            
            return jsonify({
                'success': True,
                'message': '许可证有效',
                'device_id': device_id,
                'license_info': license_info
            })
        else:
            return jsonify({
                'success': False,
                'error': '无效或已过期的许可证'
            }), 403
            
    except Exception as e:
        logger.error(f"License verification error: {e}")
        return jsonify({
            'success': False,
            'error': f'验证许可证时出错: {str(e)}'
        }), 500

# Payment webhook
@license_bp.route('/payment_callback', methods=['POST'])
def api_payment_callback():
    """Handle payment webhooks and generate licenses"""
    try:
        # Verify webhook signature
        signature = request.headers.get('X-Payment-Signature')
        payload = request.get_data()
        
        if not PAYMENT_WEBHOOK_SECRET or not signature:
            logger.error("Missing payment webhook configuration")
            return jsonify({'success': False, 'error': '缺少配置'}), 500
        
        expected_signature = hmac.new(
            PAYMENT_WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_signature, signature):
            logger.warning("Invalid payment webhook signature")
            return jsonify({'success': False, 'error': '无效的签名'}), 401
        
        # Parse payment data
        payment_data = request.json
        transaction_id = payment_data.get('transaction_id')
        amount = payment_data.get('amount')
        currency = payment_data.get('currency')
        status = payment_data.get('status')
        customer_email = payment_data.get('customer_email')
        plan_id = payment_data.get('plan_id')
        
        if not all([transaction_id, amount, currency, status, customer_email, plan_id]):
            return jsonify({'success': False, 'error': '缺少必需的支付数据'}), 400
        
        # Check if this is a duplicate request
        import sqlite3
        conn = sqlite3.connect(license_validator.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id FROM payment_transactions WHERE transaction_id = ?",
            (transaction_id,)
        )
        
        if cursor.fetchone():
            conn.close()
            return jsonify({
                'success': True,
                'message': '交易已处理'
            })
        
        # Record the transaction
        cursor.execute(
            """
            INSERT INTO payment_transactions
            (transaction_id, amount, currency, status, customer_email, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (transaction_id, amount, currency, status, customer_email, int(time.time()))
        )
        
        # If payment is completed, generate a license
        license_data = None
        if status.lower() == 'completed':
            # Determine validity based on plan
            validity_days = 365  # Default 1 year
            
            # Generate license
            license_data = license_generator.generate_license(
                plan_id=plan_id,
                customer_email=customer_email,
                validity_days=validity_days
            )
            
            # Update transaction record with license ID
            cursor.execute(
                "UPDATE payment_transactions SET code_id = ? WHERE transaction_id = ?",
                (license_data.get('license_id'), transaction_id)
            )
        
        conn.commit()
        conn.close()
        
        if license_data:
            return jsonify({
                'success': True,
                'message': '支付处理完成，已生成许可证',
                'license': license_data
            })
        else:
            return jsonify({
                'success': True,
                'message': f'已记录支付状态: {status}'
            })
            
    except Exception as e:
        logger.error(f"Payment processing error: {e}")
        return jsonify({
            'success': False,
            'error': f'处理支付时出错: {str(e)}'
        }), 500

# Get license status endpoint - for client to check their license
@license_bp.route('/status', methods=['GET'])
@require_license
def api_license_status():
    """Get the status of a license (requires valid license)"""
    license_key = g.license_key
    device_id = g.device_id
    
    # Since the @require_license decorator has already validated the license,
    # we just need to get and return the license info
    license_info = license_validator.get_license_info(license_key)
    
    return jsonify({
        'success': True,
        'license': license_info,
        'device_id': device_id
    })

# Test endpoint that requires a license
@license_bp.route('/protected-test', methods=['GET'])
@require_license
def api_protected_test():
    """Protected test endpoint that requires a valid license"""
    return jsonify({
        'success': True,
        'message': '您的许可证有效，可以访问受保护的API',
        'timestamp': time.time()
    })
