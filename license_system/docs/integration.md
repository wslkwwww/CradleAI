# 许可证系统集成指南

本文档详细介绍如何将许可证系统集成到现有应用中，使其能够验证和利用由许可证管理系统颁发的许可证。

## 目录

1. [概述](#概述)
2. [Flask应用集成](#flask应用集成)
   1. [快速入门](#快速入门)
   2. [详细步骤](#详细步骤)
   3. [安全注意事项](#安全注意事项)
3. [客户端集成](#客户端集成)
   1. [React Native/Web客户端](#react-nativeweb客户端)
   2. [Python客户端](#python客户端)
   3. [其他客户端](#其他客户端)
4. [高级配置](#高级配置)
   1. [缓存策略](#缓存策略)
   2. [离线验证](#离线验证)
   3. [自定义验证逻辑](#自定义验证逻辑)
5. [常见问题](#常见问题)

## 概述

许可证系统使用HTTP头部传递许可证信息，任何能够发送HTTP请求的应用都可以验证许可证。集成主要包括两部分：

1. **服务端集成**：验证许可证的有效性，并根据许可证信息提供相应服务
2. **客户端集成**：在API请求中包含许可证信息

## Flask应用集成

### 快速入门

1. 创建`license_middleware.py`文件，包含许可证验证逻辑
2. 在Flask视图中使用`@require_license`装饰器

```python
# license_middleware.py (简化版)
from flask import request, jsonify, g
import requests

def require_license(f):
    def decorated_function(*args, **kwargs):
        license_key = request.headers.get('X-License-Key')
        device_id = request.headers.get('X-Device-ID')
        
        if not license_key or not device_id:
            return jsonify({'error': '需要许可证'}), 401
            
        # 验证许可证
        response = requests.post(
            'https://cradleintro.top/api/v1/license/verify',
            json={'license_key': license_key, 'device_id': device_id}
        )
        
        if response.status_code != 200 or not response.json().get('success'):
            return jsonify({'error': '无效的许可证'}), 403
            
        g.license_info = response.json().get('license_info')
        return f(*args, **kwargs)
    return decorated_function

# 在视图中使用
@app.route('/protected-api')
@require_license
def protected_api():
    # 使用g.license_info
    return jsonify({'data': '受保护的数据'})
```

### 详细步骤

#### 1. 创建许可证验证工具类

创建一个完整的验证工具类，处理验证、缓存和错误情况：

```python
# license_validator.py
import os
import json
import time
import requests

class LicenseValidator:
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
        self.license_cache = {}
    
    def verify_license(self, license_key, device_id):
        """验证许可证"""
        # 检查缓存
        cache_key = f"{license_key}:{device_id}"
        if cache_key in self.license_cache:
            cached_data = self.license_cache[cache_key]
            if time.time() < cached_data['expires_at']:
                return cached_data['result']
        
        # 调用API验证
        try:
            response = requests.post(
                self.license_api_url,
                json={'license_key': license_key, 'device_id': device_id},
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
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
            print(f"许可证验证失败: {e}")
            return None
```

#### 2. 创建Flask中间件

```python
# license_middleware.py
import functools
from flask import request, jsonify, g
from .license_validator import LicenseValidator

# 创建验证器实例
validator = LicenseValidator()

def require_license(f):
    """需要有效许可证的装饰器"""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        license_key = request.headers.get('X-License-Key')
        device_id = request.headers.get('X-Device-ID')
        
        if not license_key or not device_id:
            return jsonify({'success': False, 'error': '需要许可证'}), 401
        
        license_info = validator.verify_license(license_key, device_id)
        if not license_info:
            return jsonify({'success': False, 'error': '无效的许可证'}), 403
        
        g.license_info = license_info
        return f(*args, **kwargs)
    
    return decorated_function

def plan_requires(plan_prefix):
    """要求特定许可证计划的装饰器"""
    def decorator(f):
        @functools.wraps(f)
        @require_license
        def decorated_function(*args, **kwargs):
            plan_id = g.license_info.get('plan_id', '')
            
            if not plan_id.startswith(plan_prefix):
                return jsonify({
                    'success': False,
                    'error': f'需要{plan_prefix}级别的许可证',
                    'current_plan': plan_id
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
```

#### 3. 在Flask应用中集成

```python
# app.py
from flask import Flask, jsonify, g
from .license_middleware import require_license, plan_requires

app = Flask(__name__)

@app.route('/api/public', methods=['GET'])
def public_api():
    """公开API - 无需许可证"""
    return jsonify({'success': True, 'message': '这是公开信息'})

@app.route('/api/basic', methods=['GET'])
@require_license
def basic_api():
    """基础API - 需要任何级别的许可证"""
    return jsonify({
        'success': True, 
        'message': '这是基础API',
        'plan': g.license_info.get('plan_id')
    })

@app.route('/api/premium', methods=['GET'])
@plan_requires('premium_')
def premium_api():
    """高级API - 需要高级许可证"""
    return jsonify({
        'success': True, 
        'message': '这是高级API',
        'plan': g.license_info.get('plan_id')
    })

# 全应用许可证验证（可选）
@app.before_request
def check_license_for_all():
    if request.path.startswith('/api/public'):
        return None  # 跳过公开路径
        
    # 其余代码同require_license装饰器
    # ...
```

### 安全注意事项

1. **使用HTTPS**：确保所有API通信都通过HTTPS进行加密
2. **错误处理**：正确处理许可证验证过程中的异常
3. **缓存注意事项**：确保缓存合理，不会因缓存而导致撤销的许可证仍然有效
4. **验证超时处理**：设置合理的超时，避免因验证服务不可用而阻塞应用
5. **日志安全**：确保日志中不包含敏感信息，如完整的许可证密钥

## 客户端集成

### React Native/Web客户端

#### 1. 创建许可证服务

```typescript
// license-service.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LicenseInfo {
  licenseKey: string;
  deviceId: string;
  planId?: string;
  expiryDate?: string;
}

class LicenseService {
  private static instance: LicenseService;
  private licenseInfo: LicenseInfo | null = null;
  private readonly storageKey = 'license_info';
  
  private constructor() {
    this.loadLicenseInfo();
  }
  
  public static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }
  
  private async loadLicenseInfo(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      if (data) {
        this.licenseInfo = JSON.parse(data);
      }
    } catch (error) {
      console.error('加载许可证信息失败:', error);
    }
  }
  
  public async activateLicense(licenseKey: string): Promise<LicenseInfo> {
    // 获取设备ID
    const deviceId = await this.getDeviceId();
    
    // 验证许可证
    const response = await fetch('https://cradleintro.top/api/v1/license/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ license_key: licenseKey, device_id: deviceId })
    });
    
    if (!response.ok) {
      throw new Error('许可证验证失败');
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '许可证无效');
    }
    
    // 保存许可证信息
    this.licenseInfo = {
      licenseKey,
      deviceId,
      planId: data.license_info?.plan_id,
      expiryDate: data.license_info?.expiry_date
    };
    
    await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.licenseInfo));
    return this.licenseInfo;
  }
  
  public async getLicenseHeaders(): Promise<Record<string, string>> {
    if (!this.licenseInfo) {
      return {};
    }
    
    return {
      'X-License-Key': this.licenseInfo.licenseKey,
      'X-Device-ID': this.licenseInfo.deviceId
    };
  }
  
  // ... 其他方法
}

export const licenseService = LicenseService.getInstance();
```

#### 2. 创建HTTP客户端封装

```typescript
// api-client.ts
import { licenseService } from './license-service';

class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async get(endpoint: string) {
    const licenseHeaders = await licenseService.getLicenseHeaders();
    
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...licenseHeaders
      }
    });
    
    return response.json();
  }
  
  async post(endpoint: string, data: any) {
    const licenseHeaders = await licenseService.getLicenseHeaders();
    
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...licenseHeaders
      },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }
}

export const apiClient = new ApiClient('https://api.example.com');
```

#### 3. 使用许可证服务

```typescript
// 使用示例
import { licenseService } from './services/license-service';
import { apiClient } from './services/api-client';

// 激活许可证
async function activateLicense(licenseKey: string) {
  try {
    const licenseInfo = await licenseService.activateLicense(licenseKey);
    console.log('许可证激活成功:', licenseInfo);
  } catch (error) {
    console.error('许可证激活失败:', error);
  }
}

// 调用受保护的API
async function fetchProtectedData() {
  try {
    const data = await apiClient.get('protected-resource');
    console.log('受保护的数据:', data);
  } catch (error) {
    console.error('获取数据失败:', error);
  }
}
```

### Python客户端

```python
# license_client.py
import os
import json
import time
import uuid
import platform
import hashlib
import requests

class LicenseClient:
    def __init__(self, storage_path=None):
        self.storage_path = storage_path or os.path.expanduser('~/.license_client.json')
        self.license_key = None
        self.device_id = None
        self.license_info = None
        self.load_license()
    
    def generate_device_id(self):
        """生成设备唯一标识符"""
        system_info = [
            platform.node(),
            platform.system(),
            platform.processor(),
            str(uuid.getnode())
        ]
        device_info = ':'.join(system_info)
        return hashlib.sha256(device_info.encode()).hexdigest()
    
    def load_license(self):
        """从文件加载许可证信息"""
        if not os.path.exists(self.storage_path):
            return False
        
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
                self.license_key = data.get('license_key')
                self.device_id = data.get('device_id')
                self.license_info = data.get('license_info')
            return True
        except Exception as e:
            print(f"加载许可证失败: {e}")
            return False
    
    def save_license(self):
        """保存许可证信息到文件"""
        try:
            with open(self.storage_path, 'w') as f:
                json.dump({
                    'license_key': self.license_key,
                    'device_id': self.device_id,
                    'license_info': self.license_info,
                    'updated_at': time.time()
                }, f)
            return True
        except Exception as e:
            print(f"保存许可证失败: {e}")
            return False
    
    def activate_license(self, license_key, api_url=None):
        """激活许可证"""
        self.license_key = license_key
        
        if not self.device_id:
            self.device_id = self.generate_device_id()
        
        api_url = api_url or 'https://cradleintro.top/api/v1/license/verify'
        
        try:
            response = requests.post(
                api_url,
                json={
                    'license_key': license_key,
                    'device_id': self.device_id
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.license_info = data.get('license_info')
                    self.save_license()
                    return True
            
            return False
        except Exception as e:
            print(f"激活许可证失败: {e}")
            return False
    
    def get_license_headers(self):
        """获取许可证HTTP头"""
        if not self.license_key or not self.device_id:
            return {}
        
        return {
            'X-License-Key': self.license_key,
            'X-Device-ID': self.device_id
        }
```

### 其他客户端

任何能够发送HTTP请求的客户端都可以集成许可证验证。关键步骤是：

1. 保存激活的许可证密钥和设备ID
2. 在每个API请求中添加许可证头
3. 处理许可证验证失败的情况

## 高级配置

### 缓存策略

为提高性能和容错能力，可以实施多层缓存策略：

```python
# 服务端缓存示例
class CachedLicenseValidator:
    def __init__(self):
        self.memory_cache = {}  # 一级缓存（内存）
        self.redis_client = self._connect_redis()  # 二级缓存（Redis）
        self.cache_ttl = 300  # 缓存有效期（秒）
    
    def _connect_redis(self):
        try:
            import redis
            return redis.Redis(host='localhost', port=6379, db=0)
        except:
            return None
    
    def verify_license(self, license_key, device_id):
        # 生成缓存键
        cache_key = f"license:{license_key}:{device_id}"
        
        # 检查内存缓存
        if cache_key in self.memory_cache:
            cached = self.memory_cache[cache_key]
            if time.time() < cached['expires_at']:
                return cached['data']
        
        # 检查Redis缓存
        if self.redis_client:
            redis_data = self.redis_client.get(cache_key)
            if redis_data:
                data = json.loads(redis_data)
                # 更新内存缓存
                self.memory_cache[cache_key] = {
                    'data': data,
                    'expires_at': time.time() + self.cache_ttl
                }
                return data
        
        # 调用API验证
        # ...
        
        # 更新缓存
        if result:
            self.memory_cache[cache_key] = {
                'data': result,
                'expires_at': time.time() + self.cache_ttl
            }
            
            if self.redis_client:
                self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps(result)
                )
```

### 离线验证

对于可能需要在没有网络连接的情况下工作的应用，可以实施离线验证：

```python
# 离线验证示例
class OfflineLicenseValidator:
    def __init__(self, public_key_path):
        self.public_key = self._load_public_key(public_key_path)
    
    def _load_public_key(self, path):
        with open(path, 'r') as f:
            from cryptography.hazmat.primitives.serialization import load_pem_public_key
            return load_pem_public_key(f.read().encode())
    
    def verify_offline_license(self, license_data):
        """验证离线许可证"""
        try:
            # 解析许可证数据
            data, signature = license_data.split('.')
            data_json = json.loads(base64.b64decode(data))
            signature_bytes = base64.b64decode(signature)
            
            # 验证签名
            from cryptography.hazmat.primitives.asymmetric import padding
            from cryptography.hazmat.primitives import hashes
            
            self.public_key.verify(
                signature_bytes,
                data.encode(),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            # 验证设备ID和过期时间
            device_id = self._get_device_id()
            if data_json['device_id'] != device_id:
                return False
                
            if 'expires_at' in data_json and time.time() > data_json['expires_at']:
                return False
                
            return data_json
            
        except Exception as e:
            print(f"离线许可证验证失败: {e}")
            return False
```

### 自定义验证逻辑

根据业务需求，可以实施自定义验证逻辑：

```python
# 自定义验证逻辑
def validate_with_custom_logic(license_info):
    """基于自定义业务规则验证许可证"""
    
    # 验证用户配额
    if 'user_quota' in license_info:
        active_users = get_active_users_count()
        if active_users > license_info['user_quota']:
            return False, f"超出用户配额: {active_users}/{license_info['user_quota']}"
    
    # 验证功能限制
    if 'features' in license_info:
        required_feature = 'advanced_reporting'
        if required_feature not in license_info['features']:
            return False, f"许可证不包含所需功能: {required_feature}"
    
    # 验证使用次数限制
    if 'usage_limit' in license_info:
        current_usage = get_current_usage()
        if current_usage >= license_info['usage_limit']:
            return False, f"超出使用限制: {current_usage}/{license_info['usage_limit']}"
    
    return True, None
```

## 常见问题

### 1. 许可证验证失败怎么办？

确保检查以下内容：
- 许可证密钥是否正确
- 设备ID生成是否一致
- 网络连接是否正常
- 许可证是否已过期或被撤销

### 2. 如何处理离线场景？

实施离线验证机制：
- 在线时获取并缓存签名的许可证数据
- 离线时使用公钥验证签名
- 设置合理的离线许可证有效期

### 3. 如何提高许可证验证性能？

- 实施多级缓存机制
- 设置合理的缓存过期时间
- 使用异步验证方式
- 考虑批量验证多个许可证

### 4. 如何防止许可证被盗用？

- 将许可证与设备ID绑定
- 限制单个许可证可以激活的设备数量
- 实施额外的安全验证机制
- 定期要求重新验证许可证
