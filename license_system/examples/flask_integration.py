#!/usr/bin/env python
"""
Flask 许可证集成示例

此文件演示如何在现有的Flask应用中集成许可证验证功能。
"""

import os
import json
import time
import functools
import requests
from flask import Flask, request, jsonify, g

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
                return cached_data['result']
        
        # 调用许可证验证API
        try:
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
                    # 缓存结果
                    self.license_cache[cache_key] = {
                        'result': data.get('license_info'),
                        'expires_at': time.time() + self.cache_ttl
                    }
                    return data.get('license_info')
            
            return None
        except Exception as e:
            print(f"许可证验证请求失败: {str(e)}")
            return None

# 创建全局验证器实例
license_validator = LicenseValidator()

def require_license(f):
    """需要有效许可证的装饰器"""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # 从请求头中获取许可证信息
        license_key = request.headers.get('X-License-Key')
        device_id = request.headers.get('X-Device-ID')
        
        if not license_key or not device_id:
            return jsonify({
                'success': False,
                'error': '缺少许可证信息'
            }), 401
        
        # 验证许可证
        license_info = license_validator.verify_license(license_key, device_id)
        if not license_info:
            return jsonify({
                'success': False,
                'error': '无效的许可证'
            }), 403
        
        # 将许可证信息存储在g对象中，供视图函数使用
        g.license_info = license_info
        
        # 调用原始视图函数
        return f(*args, **kwargs)
    
    return decorated_function

# =================================================
# 示例 Flask 应用 - 演示如何集成许可证验证
# =================================================

app = Flask(__name__)

# 健康检查端点 - 无需许可证
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'status': 'ok',
        'timestamp': int(time.time())
    })

# 受保护的API端点 - 需要许可证
@app.route('/api/protected', methods=['GET'])
@require_license
def protected_endpoint():
    # 可以通过g.license_info访问许可证信息
    plan_id = g.license_info.get('plan_id')
    expiry_date = g.license_info.get('expiry_date')
    
    return jsonify({
        'success': True,
        'message': '您已成功访问受保护的API',
        'license_info': {
            'plan': plan_id,
            'expiry': expiry_date
        }
    })

# 高级功能端点 - 仅限高级许可证
@app.route('/api/premium-feature', methods=['GET'])
@require_license
def premium_feature():
    # 检查许可证计划是否为高级版
    plan_id = g.license_info.get('plan_id', '')
    
    if not plan_id.startswith('premium_'):
        return jsonify({
            'success': False,
            'error': '此功能需要高级许可证',
            'current_plan': plan_id
        }), 403
    
    return jsonify({
        'success': True,
        'message': '您已成功访问高级功能',
        'data': '这是一些高级内容'
    })

# 混合访问端点 - 基本功能对所有人开放，高级功能需要许可证
@app.route('/api/mixed-content', methods=['GET'])
def mixed_content():
    response_data = {
        'success': True,
        'basic_content': '这是基本内容，对所有用户开放'
    }
    
    # 从请求头中获取许可证信息
    license_key = request.headers.get('X-License-Key')
    device_id = request.headers.get('X-Device-ID')
    
    # 如果提供了许可证信息，尝试验证
    if license_key and device_id:
        license_info = license_validator.verify_license(license_key, device_id)
        
        if license_info:
            # 将高级内容添加到响应中
            response_data['premium_content'] = '这是高级内容，仅对授权用户开放'
            response_data['license_plan'] = license_info.get('plan_id')
    
    return jsonify(response_data)

# 在生产环境使用全局拦截器（可选）
if os.environ.get('ENV') == 'production':
    @app.before_request
    def global_license_check():
        # 跳过不需要验证的路径
        exempt_paths = ['/api/health', '/api/mixed-content']
        if request.path in exempt_paths or request.path.startswith('/public'):
            return None
            
        # 从请求头中获取许可证信息
        license_key = request.headers.get('X-License-Key')
        device_id = request.headers.get('X-Device-ID')
        
        if not license_key or not device_id:
            return jsonify({
                'success': False,
                'error': '缺少许可证信息'
            }), 401
        
        # 验证许可证
        license_info = license_validator.verify_license(license_key, device_id)
        
        if not license_info:
            return jsonify({
                'success': False,
                'error': '无效的许可证'
            }), 403
        
        # 将许可证信息存储在g对象中
        g.license_info = license_info
        return None

# 示例自定义处理程序来处理特定计划的需求
def plan_requires(plan_prefix):
    """要求特定许可证计划的装饰器"""
    def decorator(f):
        @functools.wraps(f)
        @require_license  # 先验证许可证
        def decorated_function(*args, **kwargs):
            # 检查计划前缀
            plan_id = g.license_info.get('plan_id', '')
            
            if not plan_id.startswith(plan_prefix):
                return jsonify({
                    'success': False,
                    'error': f'此功能需要{plan_prefix}许可证',
                    'current_plan': plan_id
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# 使用自定义装饰器
@app.route('/api/enterprise-feature', methods=['GET'])
@plan_requires('enterprise_')  # 需要企业级许可证
def enterprise_feature():
    return jsonify({
        'success': True,
        'message': '您已成功访问企业级功能'
    })

if __name__ == '__main__':
    # 设置环境变量
    os.environ['LICENSE_API_URL'] = 'https://cradleintro.top/api/v1/license/verify'
    
    # 启动应用
    app.run(host='0.0.0.0', port=5050, debug=True)
