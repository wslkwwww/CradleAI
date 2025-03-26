-- 许可证管理系统数据库表结构

-- 激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,  -- 许可证编码
    salt TEXT NOT NULL,         -- 随机盐值
    hash TEXT NOT NULL,         -- 存储的哈希值
    devices TEXT,               -- 已绑定设备列表，逗号分隔
    plan_id TEXT,               -- 关联的订阅计划ID
    created_at INTEGER NOT NULL,-- 创建时间戳
    expires_at INTEGER,         -- 过期时间戳
    is_active BOOLEAN DEFAULT 1,-- 激活状态
    failed_attempts INTEGER DEFAULT 0, -- 失败尝试次数
    last_verified_at INTEGER    -- 最后验证时间
);

-- 许可证审计日志表
CREATE TABLE IF NOT EXISTS license_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_id INTEGER,            -- 关联的许可证ID
    action TEXT NOT NULL,       -- 操作类型：生成/验证/撤销等
    timestamp INTEGER NOT NULL, -- 操作时间戳
    client_ip TEXT,             -- 客户端IP
    device_id TEXT,             -- 设备ID
    status TEXT,                -- 操作状态：成功/失败
    details TEXT,               -- 附加详细信息
    FOREIGN KEY (code_id) REFERENCES activation_codes (id)
);

-- 支付交易表
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE NOT NULL, -- 支付平台交易ID
    amount REAL NOT NULL,       -- 交易金额
    currency TEXT NOT NULL,     -- 交易货币
    status TEXT NOT NULL,       -- 交易状态
    customer_email TEXT,        -- 客户邮箱
    code_id INTEGER,            -- 关联的许可证ID
    timestamp INTEGER NOT NULL, -- 交易时间戳
    details TEXT,               -- 交易详情JSON
    FOREIGN KEY (code_id) REFERENCES activation_codes (id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_audit_code_id ON license_audit_log(code_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON license_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_payment_transaction_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_activation_code ON activation_codes(code);
