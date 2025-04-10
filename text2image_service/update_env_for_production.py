#!/usr/bin/env python
"""
Update environment variables for production deployment.
This script modifies the .env file to use HTTPS configuration.
"""

import os
import sys
import shutil
from pathlib import Path

def update_env_file():
    """Update the .env file with production settings"""
    env_file = Path(__file__).parent / '.env'
    backup_file = Path(__file__).parent / '.env.backup'
    
    # Create backup of current .env file
    if env_file.exists():
        shutil.copy2(env_file, backup_file)
        print(f"Created backup of .env at {backup_file}")
    
    # Get SSL certificate paths
    ssl_option = input("Choose SSL option:\n1. aaPanel/BT Panel path (default)\n2. Let's Encrypt path\n3. Custom path\nEnter choice (1-3): ")
    
    if ssl_option == "2":
        cert_path = "/www/wwwroot/text2image_service/fullchain.pem"
        key_path = "/www/wwwroot/text2image_service/privkey.pem"
        print(f"Using Let's Encrypt certificate paths")
    elif ssl_option == "3":
        cert_path = input("Enter path to SSL certificate file: ")
        key_path = input("Enter path to SSL key file: ")
    else:
        cert_path = "/www/wwwroot/text2image_service/fullchain.pem"
        key_path = "/www/wwwroot/text2image_service/privkey.pem"
        print(f"Using aaPanel/BT Panel certificate paths")
    
    # Check if files exist
    if not os.path.exists(cert_path):
        print(f"Warning: SSL certificate file not found at {cert_path}")
    if not os.path.exists(key_path):
        print(f"Warning: SSL key file not found at {key_path}")
    
    # SSL settings
    ssl_enabled = input("Enable SSL? (yes/no, default: yes): ").lower() != "no"
    ssl_verify = input("Verify SSL certificates for outgoing requests? (yes/no, default: yes): ").lower() != "no"
    
    # Update or create new .env file
    with open(env_file, 'w') as f:
        f.write(f"""# Flask Production Configuration
SECRET_KEY=your-super-secret-key-change-this-in-production
DEBUG=False
PORT=5000
FLASK_APP=app:app

# HTTPS Configuration
SSL_ENABLED={str(ssl_enabled)}
SSL_CERT_PATH={cert_path}
SSL_KEY_PATH={key_path}
SSL_VERIFY={str(ssl_verify)}

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_URL=redis://localhost:6379/0

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# NovelAI API Configuration
REQUEST_TIMEOUT=60

# Rate Limit Configuration
RATE_LIMIT_DAILY=800
RATE_LIMIT_MIN_INTERVAL=8
RATE_LIMIT_MAX_INTERVAL=15
RATE_LIMIT_ERROR_COOLDOWN_MIN=5
RATE_LIMIT_ERROR_COOLDOWN_MAX=12
RATE_LIMIT_MAX_RETRIES=3

# Database Configuration
LICENSE_DB_PATH=./database/licenses.db
LICENSE_MASTER_KEY=your-secure-master-key-for-production

# Email Configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=l7963599@gmail.com
SMTP_PASSWORD=dyhovejhrwntgmnt
SMTP_SENDER=l7963599@gmail.com

# Security Configuration
PAYMENT_WEBHOOK_SECRET=your-webhook-secret-for-production
ADMIN_API_TOKEN=admin-api-token-for-production

# Rate Limit Configuration
LICENSE_RATE_LIMIT_WINDOW=60
LICENSE_RATE_LIMIT_MAX_REQUESTS=10

# Application Base URL (for callbacks)
APP_BASE_URL=https://cradleintro.top
""")
    
    print(f"Updated .env file with production settings at {env_file}")
    if ssl_enabled:
        print("SSL/HTTPS configuration has been enabled.")
    else:
        print("SSL/HTTPS has been disabled.")
    print("Please restart your application for changes to take effect.")

if __name__ == "__main__":
    print("Updating environment for production deployment...")
    update_env_file()
    print("Done!")
