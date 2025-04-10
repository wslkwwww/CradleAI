#!/usr/bin/env python
"""
Simple utility to check if the server is running and accessible.
"""

import requests
import argparse
import sys
import logging
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('check_server')

def check_server(url, timeout=5):
    """Check if a server is running and accessible"""
    try:
        # Parse URL to get host and scheme
        parsed_url = urlparse(url)
        host = parsed_url.netloc
        scheme = parsed_url.scheme
        
        logger.info(f"Checking server at {url}...")
        
        # Try to connect to the server
        response = requests.get(url, timeout=timeout)
        
        # Check status code
        if response.status_code < 400:
            logger.info(f"✅ Server is running at {url}")
            logger.info(f"Status code: {response.status_code}")
            return True
        else:
            logger.error(f"❌ Server returned error status code: {response.status_code}")
            logger.info(f"Response: {response.text[:200]}...")
            return False
            
    except requests.exceptions.ConnectionError as e:
        logger.error(f"❌ Connection error: {e}")
        return False
    except requests.exceptions.Timeout as e:
        logger.error(f"❌ Connection timeout: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Error checking server: {e}")
        return False

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Check if a server is running')
    parser.add_argument('--url', default='http://localhost:5000', help='Server URL to check')
    parser.add_argument('--timeout', type=int, default=5, help='Connection timeout in seconds')
    
    args = parser.parse_args()
    
    # Check server
    success = check_server(args.url, args.timeout)
    
    # Try both HTTP and HTTPS if it fails
    if not success and 'localhost' in args.url:
        if args.url.startswith('http://'):
            https_url = args.url.replace('http://', 'https://')
            logger.info(f"Trying HTTPS: {https_url}")
            success = check_server(https_url, args.timeout)
        elif args.url.startswith('https://'):
            http_url = args.url.replace('https://', 'http://')
            logger.info(f"Trying HTTP: {http_url}")
            success = check_server(http_url, args.timeout)
    
    if success:
        print("\n✅ Server is running")
        sys.exit(0)
    else:
        print("\n❌ Server is not running or not accessible")
        sys.exit(1)

if __name__ == "__main__":
    main()
