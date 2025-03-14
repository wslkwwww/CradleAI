好的，这是一份详细的需求文档，旨在帮助你的 App 开发者理解上述需求，并进行相应的开发工作：

**项目名称：** OpenRouter API 代理及用户鉴权系统升级

**1.  引言**

1.1.  **背景**

*   当前 App 直接与 OpenRouter API 交互，存在安全风险（API Key 暴露）和难以集中管理的问题。 本项目旨在通过引入服务器端代理和用户鉴权机制，提高 App 的安全性和可维护性，并为后续功能扩展奠定基础。
*   `Openrouter provision key`：`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` 用于对APIkey池的维护，包括创建，删除，更新APIkey。


1.2.  **目标**

*   实现基于服务器端的 OpenRouter API 请求代理，统一管理 API Key。
*   客户端和服务器之间，建立用户注册、登录和身份验证机制，保护 API 使用权限。
*   确保用户数据安全，并尽可能减少服务器端存储的用户敏感信息。

**2.  功能需求**



2.0.  **API池构建**

创建一个脚本，使用`Openrouter provision key`作为<token>鉴权，创建APIkey池，或后续向APIkey池加入新的key

```
    ///REQUEST:
curl -X POST https://openrouter.ai/api/v1/keys \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
  "name": "name"
}'
    ///RESPONSE:
{
  "data": {
    "name": "name",
    "label": "label",
    "limit": 1.1,
    "disabled": true,
    "created_at": "created_at",
    "updated_at": "updated_at",
    "hash": "hash",
    "key": "key"
  }
}
```

并安全地在数据库中存储这些key

2.1.  **用户注册/登录**

    *   **注册功能：**
        *   用户能够通过 App 注册账号。
        *   App 需收集用户名和密码。
        *   App 使用 `BLAKE2` 和 `Argon2` 对用户名和密码进行密钥派生。完全按照`util_ref.py`的方式执行。
        *   App 将密钥发送到服务器。
        *   服务器验证用户名是否已存在。 如果不存在，则为注册场景，服务器将密钥存储到数据库中。
        *   注册成功后，服务器返回成功状态码 (201 Created)。
    *   **登录功能：**
        *   用户能够通过 App 登录账号。
        *   App 需收集用户名和密码。
        *   App 对用户名和密码进行密钥派生。
        *   App 将用户密钥发送到服务器。
        *   服务器查询数据库以查找匹配的用户密钥。
        *   服务器验证密钥是否正确。
        *   登录成功后，服务器生成一个 JSON Web Token (JWT) 并返回给 App。

2.2.  **OpenRouter API 代理**

    *   **身份验证：**
        *   App 将 JWT 存储在本地 (例如，localStorage, Cookie)。
        *   App 在每个 OpenRouter API 请求的 `Authorization` Header 中包含 JWT。
        *   服务器验证 JWT 的有效性。 如果无效，则返回 401 Unauthorized 错误。
    *   **请求转发：**
        *   服务器接收来自客户端的 OpenRouter API 请求。
        *   服务器从 API Key 池中获取一个可用的 OpenRouter API Key。
        *   服务器将 OpenRouter API Key 添加到转发给 OpenRouter 的请求中。
        *   服务器将请求转发给 OpenRouter API。
    *   **响应返回：**
        *   服务器接收来自 OpenRouter API 的响应。
        *   服务器将响应返回给客户端。
    *   **错误处理：**
        *   服务器能够处理来自 OpenRouter API 的错误，并将错误信息返回给客户端。
    *   **隐私：**
        *   服务器只记录错误信息，不记录任何请求内容，以确保用户隐私。

2.3.  **API Key 管理**

    *   **API Key 池：**
        *   服务器维护一个 OpenRouter API Key 池。
        *   API Key 池中包含多个可用的 OpenRouter API Key。
    *   **API Key 轮询：**
        *   服务器能够从 API Key 池中随机选择一个 API Key，并将该 API Key 用于转发给 OpenRouter 的请求。
    *   **API Key 轮换：**
        *   服务器能够定期轮换 API Key 池中的 API Key，使用 OpenRouter Provisioning API Key 创建新的 API Key，并将旧的 API Key 移除。

**3.  技术需求**

3.1.  **客户端 (App)**

    *   编程语言：(与现有 App 保持一致)
    *   需要实现的功能：
        *   UI：`在global-setting.tsx`页面注册、登录界面。
        *   基于`BLAKE2``Argon2` 进行密钥派生。完全按照`util_ref.py`的方式执行。
        *   JWT 存储和管理。
        *   API 请求构建和发送（包括 `Authorization` Header）。
        *   错误处理。

3.2.  **服务器**

    *   编程语言：(python)
    *   Web 框架：(flask)
    *   数据库：(MySQL)
    *   需要实现的功能：
        *   API 端点：注册、登录、OpenRouter API 代理。
        *   `BLAKE2` 散列用户名。
        *   `Argon2` 密码哈希和验证。
        *   JWT 生成和验证。
        *   OpenRouter API 请求转发。
        *   API Key 池管理和轮询。
        *   API Key 轮换 (使用 Provisioning API)。
        *   API Key 加密存储 (使用 KMS 或 HSM)。
        *   数据库访问。
        *   错误处理。
        *   日志记录 (可选)。

**4.  安全需求**

4.1.  **数据加密**

    *   用户密码必须使用 `Argon2` 进行哈希处理。
    *   OpenRouter API Key 必须加密存储在数据库中 (使用 AES 或 ChaCha20)。
    *   客户端和服务器之间的通信必须使用 HTTPS 加密。

4.2.  **身份验证**

    *   必须使用 JWT 或其他安全的身份验证机制来验证用户的身份。
    *   JWT 必须安全存储在客户端。
    *   服务器必须验证 JWT 的有效性。
    *   双向 TLS 验证: 客户端需要信任服务器提供的 TLS 证书。如果有中间人使用自签名证书进行攻击，客户端会拒绝连接。

4.3.  **API Key 管理**

    *   必须安全存储 OpenRouter API Key。
    *   必须定期轮换 OpenRouter API Key。更新OpenRouter API Key的方式：
    ```
    ///REQUEST:

    curl -X PATCH https://openrouter.ai/api/v1/keys/hash \
     -H "Authorization: Bearer <token>" \ ///token是provision key的值
     -H "Content-Type: application/json" \
     -d '{}'

    ///RESPONSE:

     {
  "data": {
    "name": "name",//New display name for the key
    "label": "label",
    "limit": 1.1,
    "disabled": false, ///Whether the key should be disabled
    "created_at": "created_at",
    "updated_at": "updated_at",
    "hash": "hash",
    "key": "key"
  }
}
    ```


4.4.  **日志记录**

    *   必须仔细考虑日志记录的内容，避免记录用户敏感信息。
    *   必须安全存储日志文件。

**5.  性能需求**

5.1.  **响应时间**

    *   API 请求响应时间应尽可能短，理想情况下应低于 200 毫秒。

5.2.  **可扩展性**

    *   服务器应能够处理大量的并发请求。
    *   服务器应能够轻松扩展以满足未来的需求。

**6.  非功能需求**

6.1.  **易用性**

    *   API 接口应设计清晰，易于理解和使用。

6.2.  **可维护性**

    *   代码应结构清晰，易于阅读和维护。
    *   应编写详细的文档，说明 API 的使用方法和服务器的配置。

6.3.  **可测试性**

    *   应编写单元测试和集成测试，以确保代码的质量。

**7.  接口规范**

（需要详细定义每个 API 端点的请求和响应格式，包括：URL, HTTP 方法, 请求头, 请求体, 响应状态码, 响应体）

*   `/register` (POST): 用户注册
*   `/login` (POST): 用户登录
*   `/api/proxy/openrouter` (POST): OpenRouter API 代理

**8.  开发规范**

*   代码风格：(指定代码风格规范，例如 PEP 8, Google Java Style Guide 等)
*   版本控制：(指定版本控制系统，例如 Git)
*   代码审查：(指定代码审查流程)
*   测试：(指定测试框架和测试覆盖率要求)

**9.  部署**

*   部署环境：(指定部署环境，例如 AWS, Azure, Google Cloud Platform)
*   部署方式：(指定部署方式，例如 Docker 容器化)

**10. 验收标准**

*   所有功能需求都已实现。
*   所有安全需求都已满足。
*   所有性能需求都已满足。
*   所有非功能需求都已满足。
*   已编写详细的文档。
*   已编写单元测试和集成测试。

**11. 交付物**

*   完整的源代码 (客户端和服务器)。
*   API 文档。
*   数据库 schema。
*   部署文档。
*   测试报告。