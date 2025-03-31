```markdown
# 许可证管理系统

本系统实现了安全、可靠的许可证生成、验证、撤销和审计功能，基于Argon2密码哈希算法提供了高安全性的软件许可证管理解决方案。

## 功能特性

- **安全生成**：基于Argon2密码哈希技术创建防伪造的许可证密钥
- **多设备支持**：每个许可证可绑定多个设备（默认最多3个）
- **验证API**：提供RESTful API验证许可证有效性
- **自动修复**：内置自动修复机制，处理损坏的许可证
- **审计日志**：详细记录所有许可证操作，保障安全性
- **支付集成**：支持在线支付回调，自动创建和发送许可证
- **可靠存储**：使用SQLite数据库本地存储许可证数据
- **跨平台兼容**：服务端和客户端均支持多平台部署

## 目录结构

```
license_system/
├── db/                      # 数据库相关文件
│   ├── schema.sql           # 数据库表结构定义
│   └── db_utils.py          # 数据库操作工具
├── server/                  # 服务器端代码
│   ├── __init__.py          # 服务器包初始化文件
│   ├── app.py               # Flask应用主文件
│   ├── config.py            # 配置文件
│   ├── license_generator.py # 许可证生成模块
│   ├── license_validator.py # 许可证验证模块
│   └── mailer.py            # 邮件发送模块
├── tests/                   # 测试代码
│   ├── test_license.py      # 许可证单元测试
│   └── test_compatibility.py # 兼容性测试
├── fix_broken_licenses.py   # 批量修复损坏的许可证工具
├── generate_test_license.py # 生成测试许可证工具
├── repair_license.py        # 修复单个许可证工具
├── test_license_system.py   # 许可证系统集成测试
└── README.md                # 项目说明
```

## 快速开始

1. 创建并激活 Python 虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # 在Windows上使用: venv\Scripts\activate
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 设置环境变量
```bash
# 设置主密钥，生产环境中应使用随机生成的安全密钥
export LICENSE_MASTER_KEY="your_secure_master_key"
# 设置API服务端口
export API_PORT=5000
```

4. 初始化数据库
```bash
python -m db.db_utils
```

5. 启动服务
```bash
python -m server.app
```

## 生成测试许可证

可以使用`generate_test_license.py`脚本生成测试许可证：

```bash
python generate_test_license.py --plan standard --days 365 --device test_device_1 --verify
```

参数说明：
- `--plan`：许可证计划类型（例如：standard, pro, enterprise）
- `--days`：许可证有效期（天数）
- `--device`：用于验证的设备ID（可选）
- `--verify`：生成后立即验证许可证
- `--output`：指定输出文件路径（默认为license_info.json）
- `--check`：检查已有许可证信息

## 许可证修复工具

系统提供了两个工具用于修复损坏的许可证：

### 批量修复工具

```bash
python fix_broken_licenses.py --verify --fix
```

参数说明：
- `--verify`：验证许可证有效性
- `--fix`：修复损坏的许可证
- `--license`：指定要修复的许可证密钥（可选，不指定则检查所有许可证）

### 单个许可证修复工具

```bash
python repair_license.py <license_key> --force
```

参数说明：
- `license_key`：要修复的许可证密钥
- `--force`：即使许可证看似正常也强制重新生成哈希值
- `--no-verify`：不验证修复后的许可证

## API接口

系统提供了以下主要API接口：

### 验证许可证
```
POST /api/v1/license/verify
Content-Type: application/json

{
  "license_key": "your_license_key",
  "device_id": "device_identifier"
}
```

### 健康检查
```
GET /api/v1/health
```

### 管理员接口
以下接口需要提供管理员令牌：

#### 生成许可证
```
POST /api/v1/license/generate
X-Admin-Token: your_admin_token
Content-Type: application/json

{
  "plan_id": "standard",
  "validity_days": 365,
  "quantity": 1
}
```

#### 撤销许可证
```
POST /api/v1/license/revoke/{license_key}
X-Admin-Token: your_admin_token
```

#### 获取许可证信息
```
GET /api/v1/license/info/{license_key}
X-Admin-Token: your_admin_token
```

## 测试与验证

系统包含多种测试工具确保许可证生成和验证的可靠性：

1. 单元测试：`tests/test_license.py`
2. 兼容性测试：`tests/test_compatibility.py`
3. 集成测试：`test_license_system.py`

运行兼容性测试以确保系统各组件协同工作：
```bash
python -m tests.test_compatibility
```

## 安全配置建议

- **主密钥保护**：确保`LICENSE_MASTER_KEY`安全性，定期轮换
- **HTTPS部署**：生产环境应使用HTTPS保护API通信
- **API令牌管理**：管理员令牌应使用强密码并定期更换
- **数据库备份**：定期备份许可证数据库
- **日志监控**：监控失败验证尝试，防范暴力破解
- **防火墙配置**：限制API访问来源

## 客户端集成

使用以下步骤将许可证系统集成到客户端：

1. 生成唯一设备标识符
2. 存储许可证密钥和设备ID
3. 定期向许可证服务器验证
4. 处理验证成功/失败逻辑

示例代码（Node.js）：
```javascript
async function verifyLicense(licenseKey, deviceId) {
  const response = await fetch('https://your-license-server.com/api/v1/license/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: licenseKey, device_id: deviceId })
  });
  
  return await response.json();
}
```

## 许可证问题排查

如果遇到许可证验证问题，可尝试以下步骤：

1. 检查许可证状态：`python generate_test_license.py --check YOUR_LICENSE_KEY`
2. 尝试修复许可证：`python repair_license.py YOUR_LICENSE_KEY --force`
3. 确认环境变量设置正确，特别是`LICENSE_MASTER_KEY`
4. 检查许可证数据库完整性
5. 查看服务器日志了解详细错误信息

## 注意事项

- 请使用相同版本的Argon2库进行生成和验证
- 确保数据库权限设置正确
- 主密钥更改将导致所有现有许可证失效
- 设备ID应具有唯一性但又相对稳定
- 客户端应妥善处理网络连接问题，必要时使用本地缓存的验证结果
```

Made changes.