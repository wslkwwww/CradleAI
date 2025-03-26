import os
import json
import time
import logging
import requests
from functools import wraps
from flask import request, jsonify, g

# 配置日志
logger = logging.getLogger('text2image.license')

class LicenseValidator:
    """许可证验证器"""
    
    def __init__(self, license_api_url=None, cache_ttl=300):
        """初始化许可证验证器
        
        Args:
            license_api_url: 许可证验证API的URL
            cache_ttl: 许可证验证结果缓存时间（秒）
        """
        self.license_api_url = license_api_url or os.environ.get(
            'LICENSE_API_URL', 'https://cradleintro.top/api/v1/license/verify'
        )
        self.cache_ttl = cache_ttl
        self.license_cache = {}  # 简单的内存缓存
        logger.info(f"许可证验证器初始化，API URL: {self.license_api_url}")
    
    def verify_license(self, license_key, device_id):
        """验证许可证
        
        Args:
            license_key: 许可证密钥
            device_id: 设备ID
            
        Returns:
            验证成功返回许可证信息字典，失败返回None
        """
        # 检查缓存
        cache_key = f"{license_key}:{device_id}"
        if cache_key in self.license_cache:
            cached_data = self.license_cache[cache_key]
            if time.time() < cached_data['expires_at']:
                logger.debug(f"使用缓存的许可证信息: {license_key[:10]}...")
                return cached_data['result']
        
        # 调用许可证验证API
        try:
            logger.info(f"验证许可证: {license_key[:10]}...")
            response = requests.post(
                self.license_api_url,
                json={
                    'license_key': license_key,
                    'device_id': device_id
                },
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout=5  # 设置超时时间
            )
            
            # 检查响应
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    license_info = data.get('license_info')
                    # 缓存结果
                    self.license_cache[cache_key] = {
                        'result': license_info,
                        'expires_at': time.time() + self.cache_ttl
                    }
                    logger.info(f"许可证验证成功: {license_key[:10]}..., 计划类型: {license_info.get('plan_id')}")
                    return license_info
                else:
                    logger.warning(f"许可证验证失败: {license_key[:10]}..., 错误: {data.get('error')}")
            else:
                logger.error(f"许可证验证API响应错误: {response.status_code}")
            
            return None
        except Exception as e:
            logger.error(f"许可证验证请求失败: {str(e)}")
            return None

# 创建全局验证器实例
license_validator = LicenseValidator()

def require_license(f):
    """需要有效许可证的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 从请求头中获取许可证信息
        license_key = request.headers.get('X-License-Key')
        device_id = request.headers.get('X-Device-ID')
        
        if not license_key or not device_id:
            logger.warning(f"请求缺少许可证信息: {request.path}")
            return jsonify({
                'success': False,
                'error': '需要有效的许可证',
                'code': 'LICENSE_REQUIRED'
            }), 401
        
        # 验证许可证
        license_info = license_validator.verify_license(license_key, device_id)
        if not license_info:
            logger.warning(f"无效的许可证: {license_key[:10]}...")
            return jsonify({
                'success': False,
                'error': '无效的许可证或许可证已过期',
                'code': 'INVALID_LICENSE'
            }), 403
        
        # 将许可证信息存储在g对象中，供视图函数使用
        g.license_info = license_info
        return f(*args, **kwargs)
    
    return decorated_function

def plan_requires(plan_prefix):
    """要求特定许可证计划的装饰器"""
    def decorator(f):
        @wraps(f)
        @require_license
        def decorated_function(*args, **kwargs):
            # 检查计划前缀
            plan_id = g.license_info.get('plan_id', '')
            
            if not plan_id.startswith(plan_prefix):
                logger.warning(f"许可证计划不足: {plan_id}, 需要: {plan_prefix}")
                return jsonify({
                    'success': False,
                    'error': f'此功能需要{plan_prefix}计划',
                    'current_plan': plan_id,
                    'code': 'PLAN_REQUIRED'
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
