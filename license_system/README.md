# 许可证管理系统

本系统实现了安全、可靠的许可证生成、验证、撤销和审计功能，基于secure.MD文档的规范实现。

## 目录结构

```
license_system/
├── db/                      # 数据库相关文件
│   ├── schema.sql           # 数据库表结构定义
│   └── db_utils.py          # 数据库操作工具
├── server/                  # 服务器端代码
│   ├── app.py               # Flask应用主文件
│   ├── config.py            # 配置文件
│   ├── license_generator.py # 许可证生成模块
│   ├── license_validator.py # 许可证验证模块
│   ├── payment_handler.py   # 支付回调处理
│   └── audit_logger.py      # 审计日志模块
├── deployment/              # 部署相关文件
│   ├── nginx.conf           # Nginx配置
│   ├── cloudflare_worker.js # Cloudflare Worker脚本
│   └── .env.example         # 环境变量示例
├── tests/                   # 测试代码
│   ├── test_license.py      # 许可证测试
│   └── test_payment.py      # 支付回调测试
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
cp deployment/.env.example .env
# 编辑.env文件，填入必要的配置
```

4. 初始化数据库
```bash
python -m db.init_db
```

5. 启动服务
```bash
python -m server.app
```

## 安全配置

- 确保所有密钥都通过环境变量设置，而不是硬编码
- 主密钥和支付密钥应当保密并定期轮换
- 数据库应该启用加密，并定期备份
- Nginx和Cloudflare配置应确保TLS 1.3的支持

## 客户端集成

客户端应通过以下步骤集成许可证验证:

1. 实现设备ID生成机制
2. 将许可证密钥和设备ID作为HTTP头部发送至API
3. 根据API响应处理许可证状态
