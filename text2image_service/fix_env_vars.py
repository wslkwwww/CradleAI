#!/usr/bin/env python
"""
Utility to fix environment variable loading issues
"""

import os
import sys
import subprocess
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('fix_env_vars')

def check_env_file():
    """Check and validate the .env file"""
    env_path = Path('.env')
    
    if not env_path.exists():
        logger.error(".env file not found. Creating default .env file...")
        create_default_env()
        return False
    
    # Check for required variables
    required_vars = ['PORT', 'REDIS_HOST', 'REDIS_PORT', 'FLASK_APP', 'SECRET_KEY']
    missing_vars = []
    
    # Read the current .env file
    with open(env_path, 'r') as f:
        env_content = f.read()
        
    # Check for each required variable
    for var in required_vars:
        if not any(line.strip().startswith(f"{var}=") for line in env_content.splitlines()):
            missing_vars.append(var)
    
    if missing_vars:
        logger.warning(f"Missing required variables in .env: {', '.join(missing_vars)}")
        # Add the missing variables
        with open(env_path, 'a') as f:
            f.write("\n# Added by fix_env_vars.py\n")
            for var in missing_vars:
                if var == 'PORT':
                    f.write("PORT=5000\n")
                elif var == 'REDIS_HOST':
                    f.write("REDIS_HOST=localhost\n")
                elif var == 'REDIS_PORT':
                    f.write("REDIS_PORT=6379\n")
                elif var == 'FLASK_APP':
                    f.write("FLASK_APP=app:app\n")
                elif var == 'SECRET_KEY':
                    import secrets
                    f.write(f"SECRET_KEY={secrets.token_hex(16)}\n")
        
        logger.info(f"Added missing variables to .env: {', '.join(missing_vars)}")
        return False
    
    return True

def create_default_env():
    """Create a default .env file"""
    import secrets
    
    with open('.env', 'w') as f:
        f.write("""# Flask Configuration
PORT=5000
FLASK_APP=app:app
SECRET_KEY=""" + secrets.token_hex(16) + """

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_URL=redis://localhost:6379/0

# Other Configuration
DEBUG=False
""")
    
    logger.info("Created default .env file")

def test_env_loading():
    """Test if environment variables are properly loaded"""
    try:
        # Run a test to see if variables can be loaded
        result = subprocess.run(
            ['python', '-c', 'import os; print("PORT=" + os.environ.get("PORT", "NOT_SET"))'],
            env={**os.environ, **load_env_to_dict()},
            capture_output=True,
            text=True
        )
        
        logger.info(f"Test environment loading: {result.stdout.strip()}")
        
        if 'NOT_SET' in result.stdout:
            logger.warning("Environment variables may not be loading correctly")
            return False
        
        return True
    except Exception as e:
        logger.error(f"Error testing environment loading: {e}")
        return False

def load_env_to_dict():
    """Load .env file to a dictionary"""
    env_vars = {}
    
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                    
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
        
        return env_vars
    except Exception as e:
        logger.error(f"Error loading .env file: {e}")
        return {}

def create_systemd_service():
    """Create a systemd service file for the application"""
    app_dir = os.path.abspath(os.getcwd())
    
    service_content = f"""[Unit]
Description=Text2Image Service
After=network.target redis.service

[Service]
User=root
Group=root
WorkingDirectory={app_dir}
ExecStart=/bin/bash {app_dir}/run_gunicorn.sh
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
"""
    
    service_path = Path('/tmp/text2image.service')
    
    try:
        with open(service_path, 'w') as f:
            f.write(service_content)
        
        logger.info(f"Created systemd service file at {service_path}")
        logger.info("To install the service, run:")
        logger.info(f"  sudo mv {service_path} /etc/systemd/system/")
        logger.info("  sudo systemctl daemon-reload")
        logger.info("  sudo systemctl enable text2image")
        logger.info("  sudo systemctl start text2image")
        
        return True
    except Exception as e:
        logger.error(f"Error creating systemd service file: {e}")
        return False

def main():
    logger.info("Starting environment variable fix utility")
    
    # Check and fix .env file
    if check_env_file():
        logger.info(".env file looks good")
    else:
        logger.info(".env file has been updated")
    
    # Test environment variable loading
    if test_env_loading():
        logger.info("Environment variables are loading correctly")
    else:
        logger.warning("There may be issues with environment variable loading")
        logger.info("Consider using the explicit export method in run_gunicorn.sh")
    
    # Create systemd service file
    create_systemd_service()
    
    logger.info("Environment fix utility completed")
    
    # Suggest next steps
    print("\nNext steps:")
    print("1. Restart the application: ./run_gunicorn.sh")
    print("2. Test connectivity: python test_app.py")
    print("3. Check logs if issues persist: tail -f logs/gunicorn-error.log")

if __name__ == "__main__":
    main()
