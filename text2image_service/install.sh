#!/bin/bash

# Check if dotenv is installed
if ! pip show python-dotenv >/dev/null 2>&1; then
    echo "Installing python-dotenv..."
    pip install python-dotenv
fi

# Create database directory if it doesn't exist
if [ ! -d "database" ]; then
    echo "Creating database directory..."
    mkdir -p database
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Creating sample .env file..."
    cat > .env << 'EOL'
# Flask 应用配置
SECRET_KEY=your-super-secret-key-change-this-in-production
DEBUG=True
PORT=5000
FLASK_APP=app:app

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# NovelAI API 配置
REQUEST_TIMEOUT=60

# 速率限制配置
RATE_LIMIT_DAILY=800
RATE_LIMIT_MIN_INTERVAL=8
RATE_LIMIT_MAX_INTERVAL=15
RATE_LIMIT_ERROR_COOLDOWN_MIN=5
RATE_LIMIT_ERROR_COOLDOWN_MAX=12
RATE_LIMIT_MAX_RETRIES=3

# 数据库配置
LICENSE_DB_PATH=./database/licenses.db
LICENSE_MASTER_KEY=your-secure-master-key-for-testing

# 邮件配置 - Gmail示例 (请修改为您自己的邮箱配置)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_SENDER=your-email@gmail.com

# 安全配置
PAYMENT_WEBHOOK_SECRET=your-webhook-secret-for-testing
ADMIN_API_TOKEN=admin-api-token-for-testing

# 速率限制配置
LICENSE_RATE_LIMIT_WINDOW=60
LICENSE_RATE_LIMIT_MAX_REQUESTS=10
EOL
    echo "Please edit the .env file with your settings"
else
    echo ".env file already exists"
fi

# Initialize database
echo "Initializing database..."
python init_db.py

echo "Installation completed."
echo "To test email configuration, run: python check_email_config.py"
echo "To send a test email, run: python test_email.py --email recipient@example.com"
