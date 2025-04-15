# Cradle AI 服务端

Cradle AI 服务端是一个中转 API 服务，用于处理各类 AI 模型请求，提供许可证验证、余额管理和模型代理功能。

## 功能特性

- 支持 OpenRouter API 代理，访问多种 AI 模型
- 提供 Hugging Face Space 集成，支持多种 Gemini 模型
- 许可证验证和设备绑定系统
- 基于余额的精准扣费机制
- 每日首次请求自动扣费 (0.33 额度/天)
- 支持多个 HF Space 负载均衡和请求路由

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
│   └── mailer.py            # 邮件发送模块
├── mailer/                  # 邮件模板相关
│   └── credit_notification.py # 余额变动通知
├── deployment/              # 部署相关文件
│   ├── nginx.conf           # Nginx配置
│   ├── cloudflare_worker.js # Cloudflare Worker脚本
│   └── .env.example         # 环境变量示例
├── tests/                   # 测试代码
│   ├── test_license.py      # 许可证测试
│   ├── test_credits.py      # 余额功能测试
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
pip install -r server/requirements.txt
```

3. 设置环境变量
```bash
cp deployment/.env.example server/.env
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

## 余额系统使用指南

### 概述
系统现已支持基于余额的许可证管理，每个许可证可以关联一个邮箱和余额。前端应用可以查询余额、消费余额，并在用户操作时实时显示余额信息。

## API认证说明

系统API分为两类：
1. **公开API** - 不需要认证，任何客户端都可以访问
2. **管理员API** - 需要管理员令牌认证，用于敏感操作

### 管理员认证方法

需要管理员权限的API请求需要在HTTP请求头中包含管理员令牌：

```
X-Admin-Token: 您的管理员令牌
```

管理员令牌在服务器配置文件中设置（`server/config.py`中的`API_ADMIN_TOKEN`），或通过环境变量`API_ADMIN_TOKEN`设置。

### API权限分类

#### 公开API（无需认证）
- `GET /api/v1/health` - 健康检查
- `POST /api/v1/license/verify` - 验证许可证
- `GET /api/v1/license/balance/<email>` - 查询许可证余额

#### 管理员API（需要认证）
- `POST /api/v1/license/generate` - 生成许可证
- `POST /api/v1/license/revoke/<license_key>` - 撤销许可证
- `GET /api/v1/license/info/<license_key>` - 获取许可证详细信息
- `POST /api/v1/license/recharge` - 为许可证充值
- `POST /api/v1/license/deduct` - 扣除许可证余额
- `POST /api/v1/send-license-email` - 发送许可证邮件

### 管理员API示例

#### 扣除余额请求示例

```bash
curl -X POST https://yourdomain.com/api/v1/license/deduct \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN_HERE" \
  -d '{
    "email": "user@example.com",
    "amount": 10.0
  }'
```

#### Python示例
```python
import requests
import json

API_URL = "https://yourdomain.com/api/v1"
ADMIN_TOKEN = "YOUR_ADMIN_TOKEN_HERE"  # 替换为实际的管理员令牌

# 扣除余额
def deduct_credits(email, amount):
    headers = {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_TOKEN
    }
    
    data = {
        "email": email,
        "amount": amount
    }
    
    response = requests.post(
        f"{API_URL}/license/deduct",
        headers=headers,
        data=json.dumps(data)
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"扣除成功，剩余余额: {result['remaining_credits']}")
        return True, result['remaining_credits']
    elif response.status_code == 401:
        print("认证失败：管理员令牌无效")
        return False, 0
    else:
        print(f"扣除失败: {response.text}")
        return False, 0

# 添加余额
def add_credits(email, amount):
    headers = {
        "Content-Type: application/json",
        "X-Admin-Token": ADMIN_TOKEN
    }
    
    data = {
        "email": email,
        "amount": amount
    }
    
    response = requests.post(
        f"{API_URL}/license/recharge",
        headers=headers,
        data=json.dumps(data)
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"充值成功，新余额: {result['license_info']['credits']}")
        return True
    else:
        print(f"充值失败: {response.text}")
        return False
```

### 集成建议

1. **管理员令牌管理**
   - 不要在客户端代码中硬编码管理员令牌
   - 使用环境变量或配置文件存储令牌
   - 定期轮换管理员令牌以提高安全性

2. **请求失败处理**
   - 检查HTTP状态码，特别是401（未授权）和403（禁止访问）
   - 实现重试机制处理临时网络故障
   - 记录API调用失败的详细日志

3. **服务间通信**
   - 确保服务间通信使用TLS加密
   - 考虑实现内部服务的IP白名单
   - 使用专门的API密钥用于服务间通信

## 许可证系统说明

许可证系统现在采用基于余额的模式，不再限制许可证的有效期。新的运作方式如下：

1. **永久有效许可证** - 许可证没有过期日期，只要账户中有余额，就可以使用
2. **基于余额消费** - 使用软件功能时会消耗账户余额
3. **余额充值** - 余额不足时可以随时充值

### 特性变更

- 移除了许可证有效期限制
- 许可证信息中显示"发行日期"而不是"过期日期"
- 所有现有许可证自动转为永久许可证

### API接口

#### 1. 查询余额

**请求**:
```
GET /api/v1/license/balance/{email}
```

**响应**:
```json
{
  "success": true,
  "email": "user@example.com",
  "credits": 150.0,
  "license_key": "abcdefg123456"
}
```

**使用场景**:
- 应用启动时检查用户余额
- 显示用户当前剩余额度
- 决定是否允许用户执行付费操作

#### 2. 扣除余额

**请求**:
```
POST /api/v1/license/deduct
Content-Type: application/json

{
  "email": "user@example.com",
  "amount": 10.0
}
```

**响应**:
```json
{
  "success": true,
  "message": "成功扣除 10.0 余额",
  "remaining_credits": 140.0
}
```

**使用场景**:
- 用户使用付费功能时
- 按量计费场景
- 完成批量任务后扣除相应费用

#### 3. 充值余额

**请求**:
```
POST /api/v1/license/recharge
Content-Type: application/json
X-Admin-Token: {管理员令牌}

{
  "email": "user@example.com",
  "amount": 50.0
}
```

**响应**:
```json
{
  "success": true,
  "license_info": {
    "license_key": "abcdefg123456",
    "email": "user@example.com",
    "credits": 190.0,
    "last_updated_at": "2023-06-30 12:34:56"
  }
}
```

**使用场景**:
- 用户充值成功后
- 管理员手动充值
- 赠送奖励额度

### 前端集成指南

#### 余额查询与显示

1. **应用启动时查询余额**:

```javascript
// 在应用启动或登录后检查余额
async function checkBalance(email) {
  try {
    const response = await fetch(`https://yourdomain.com/api/v1/license/balance/${email}`);
    const data = await response.json();
    
    if (data.success) {
      // 更新UI显示余额
      updateBalanceUI(data.credits);
      return data.credits;
    } else {
      // 处理错误情况
      handleErrorState(data.error);
      return 0;
    }
  } catch (error) {
    console.error("查询余额失败:", error);
    return 0;
  }
}

// 更新UI中的余额显示
function updateBalanceUI(credits) {
  const balanceElement = document.getElementById('user-balance');
  balanceElement.textContent = `余额: ${credits.toFixed(2)}`;
  
  // 根据余额状态调整UI元素可用性
  const premiumFeatures = document.querySelectorAll('.premium-feature');
  if (credits <= 0) {
    premiumFeatures.forEach(el => el.classList.add('disabled'));
  } else {
    premiumFeatures.forEach(el => el.classList.remove('disabled'));
  }
}
```

2. **余额不足提醒**:

```javascript
function checkBalanceBeforeOperation(requiredCredits, userCredits) {
  if (userCredits < requiredCredits) {
    // 显示充值提醒
    showRechargePrompt(requiredCredits - userCredits);
    return false;
  }
  return true;
}

function showRechargePrompt(neededAmount) {
  // 显示需要充值的弹窗
  const modal = document.getElementById('recharge-modal');
  document.getElementById('needed-amount').textContent = neededAmount.toFixed(2);
  modal.classList.add('active');
}
```

#### 执行付费操作并扣除余额

1. **操作前检查余额**:

```javascript
async function executePremiumFeature(email, featureName, requiredCredits) {
  // 先检查余额
  const currentBalance = await checkBalance(email);
  
  if (!checkBalanceBeforeOperation(requiredCredits, currentBalance)) {
    return false;
  }
  
  // 显示操作中状态
  showLoadingState(`正在处理 ${featureName}...`);
  
  try {
    // 执行相关操作
    const operationResult = await performFeatureOperation();
    
    if (operationResult.success) {
      // 操作成功后扣除余额
      const deductResult = await deductCredits(email, requiredCredits);
      
      if (deductResult.success) {
        // 更新UI显示新余额
        updateBalanceUI(deductResult.remaining_credits);
        showSuccess(`${featureName} 完成，已扣除 ${requiredCredits} 积分`);
        return true;
      } else {
        // 扣费失败但操作已完成，需要记录日志
        logDeductionFailure(email, requiredCredits, operationResult);
        showWarning(`${featureName} 已完成，但扣除积分失败，请联系客服`);
        return true;
      }
    } else {
      // 操作失败
      showError(`${featureName} 失败: ${operationResult.error}`);
      return false;
    }
  } catch (error) {
    console.error(`执行 ${featureName} 时出错:`, error);
    showError(`操作失败，请稍后再试`);
    return false;
  }
}

// 扣除积分的API请求
async function deductCredits(email, amount) {
  try {
    const response = await fetch('https://yourdomain.com/api/v1/license/deduct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error("扣除积分失败:", error);
    return {
      success: false,
      error: "网络错误，请检查连接"
    };
  }
}
```

2. **批量任务的余额管理**:

```javascript
async function processBatchOperation(email, items, creditsPerItem) {
  const totalRequired = items.length * creditsPerItem;
  const currentBalance = await checkBalance(email);
  
  // 检查总余额是否足够
  if (currentBalance < totalRequired) {
    // 计算能处理的最大项目数
    const affordableCount = Math.floor(currentBalance / creditsPerItem);
    
    if (affordableCount <= 0) {
      showError("余额不足，请充值后再试");
      return {
        success: false,
        processedCount: 0
      };
    }
    
    // 提示用户余额只够处理部分项目
    const willProceed = await confirmPartialProcessing(affordableCount, items.length);
    if (!willProceed) {
      return {
        success: false,
        processedCount: 0
      };
    }
    
    // 减少处理项目数量
    items = items.slice(0, affordableCount);
  }
  
  // 处理批量任务
  let processedCount = 0;
  let totalDeducted = 0;
  
  for (const item of items) {
    try {
      // 处理单个项目
      const result = await processItem(item);
      
      if (result.success) {
        processedCount++;
        totalDeducted += creditsPerItem;
      }
    } catch (err) {
      console.error(`处理项目 ${item.id} 时出错:`, err);
    }
  }
  
  // 批量扣除积分(只扣除成功处理的部分)
  if (processedCount > 0) {
    const finalCharge = processedCount * creditsPerItem;
    const deductResult = await deductCredits(email, finalCharge);
    
    if (deductResult.success) {
      updateBalanceUI(deductResult.remaining_credits);
      showSuccess(`成功处理 ${processedCount} 个项目，扣除 ${finalCharge} 积分`);
    } else {
      logDeductionFailure(email, finalCharge, { processedItems: processedCount });
      showWarning(`项目已处理，但扣除积分失败，请联系客服`);
    }
  }
  
  return {
    success: true,
    processedCount,
    totalDeducted
  };
}
```

### 最佳实践

1. **余额安全性**
   - 始终在服务端验证用户操作和余额扣除
   - 不要只依赖前端的余额验证
   - 监控异常的余额消费模式

2. **用户体验**
   - 在UI中始终保持余额显示的实时性
   - 在执行付费操作前明确告知用户将消费的积分数量
   - 提供余额不足时的充值引导

3. **故障恢复**
   - 实现操作与扣费的事务一致性
   - 记录所有扣费失败的情况，以便后续手动处理
   - 设计重试机制处理临时网络故障

4. **集成示例**
   - 在GUI应用标题栏或状态栏显示当前余额
   - 在每次操作前检查余额并扣除相应费用
   - 执行耗时操作后再扣除积分，避免操作失败仍扣费的情况

## 安全配置

- 确保所有密钥都通过环境变量设置，而不是硬编码
- 主密钥和支付密钥应当保密并定期轮换
- 数据库应该启用加密，并定期备份
- Nginx和Cloudflare配置应确保TLS 1.3的支持

## 支付回调信息

支付回调中的`param`参数现在包含以下信息:
* `email`: 用户邮箱
* `type`: 类型，可为`activation`(首充激活)或`recharge`(充值)
* `credits`: 充值金额（实际到账余额）
* `original_amount`: 原始充值金额(用于参考)

## 特殊测试邮箱

系统对以下邮箱有特殊处理:
* `943113638@qq.com`: 测试邮箱
  * 可以创建无限数量的许可证（不受一个邮箱一个许可证的限制）
  * 拥有无限余额，无论扣款多少都不会减少

## 邮箱限制说明

* 系统对激活许可证的邮箱有以下限制:
  * 每个普通邮箱只能激活一个有效许可证
  * 测试邮箱`943113638@qq.com`可以激活无限数量的许可证，用于测试目的

## 客户端集成

客户端应通过以下步骤集成许可证验证:

1. 实现设备ID生成机制
2. 将许可证密钥和设备ID作为HTTP头部发送至API
3. 根据API响应处理许可证状态
4. 在客户端显示当前余额并管理扣费操作
## API 端点

### OpenRouter 代理

- `POST /api/chat/completion` - 代理到 OpenRouter 的聊天完成请求

### Hugging Face 集成

- `POST /api/huggingface/completion` - 代理到 Hugging Face Space 的聊天完成请求
- `GET /api/huggingface/spaces/usage` - 获取空间使用统计（管理员 API）

## 配置

服务通过环境变量进行配置，主要配置项包括：

- `OPENROUTER_API_KEY` - OpenRouter API 密钥
- `HF_SPACE_URL_1` - Hugging Face Space URL
- `HF_SPACE_PASSWORD_1` - Hugging Face Space 密码
- `LICENSE_API_URL` - 许可证 API URL
- `LICENSE_ADMIN_TOKEN` - 许可证管理员令牌
- `PORT` - 服务端口
- `ALLOWED_ORIGINS` - CORS 允许的源，逗号分隔

## Role 映射说明

在请求处理过程中，系统会自动处理不同 API 之间的角色映射：

1. 客户端到服务端：接受 `user`、`assistant` 和 `model` 角色
2. 服务端到 HF Space：将 `model` 角色自动转换为 `assistant` 角色

这确保了与不同 AI 提供商 API 的兼容性。

## Hugging Face Space 模型支持

目前支持的 Gemini 模型有：

- `gemini-2.5-pro-exp-03-25` (推荐)
- `gemini-2.0-flash-exp`
- `gemini-2.0-pro-exp-02-05`
- `gemini-exp-1206`
- `gemini-2.0-flash-thinking-exp-1219`
- `gemini-exp-1121`
- `gemini-exp-1114`
- `gemini-1.5-pro-exp-0827`
- `gemini-1.5-pro-exp-0801`
- `gemini-1.5-flash-8b-exp-0924`
- `gemini-1.5-flash-8b-exp-0827`

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行服务
```bash
npm start
```

### 测试
```bash
node test/testHuggingFace.js
```



## 安全注意事项

确保 LICENSE_ADMIN_TOKEN 保密且定期轮换
使用 HTTPS 连接保护 API 通信
请勿在客户端存储敏感凭据
