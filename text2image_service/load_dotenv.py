import os
import logging
from pathlib import Path

logger = logging.getLogger("text2image.dotenv")

def load_dotenv(dotenv_path=None):
    """
    Load environment variables from .env file
    
    Args:
        dotenv_path: Path to .env file, if None, try to find it in the current directory
        
    Returns:
        bool: Whether the .env file was loaded successfully
    """
    if dotenv_path is None:
        dotenv_path = Path(os.path.dirname(os.path.abspath(__file__))) / '.env'
    
    if not os.path.exists(dotenv_path):
        logger.warning(f"No .env file found at {dotenv_path}")
        return False
    
    logger.info(f"Loading environment variables from {dotenv_path}")
    
    try:
        with open(dotenv_path, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                
                # Parse key-value pairs
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                # Remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                
                # Set environment variable
                os.environ[key] = value
                logger.debug(f"Set environment variable: {key}={value}")
        
        logger.info(f"Successfully loaded environment variables")
        return True
    except Exception as e:
        logger.error(f"Failed to load .env file: {e}")
        return False
