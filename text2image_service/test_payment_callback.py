#!/usr/bin/env python
"""
Test script for payment callback functionality
This script simulates a payment provider sending a webhook to the license system
"""

import argparse
import requests
import json
import hmac
import hashlib
import time
import logging
import uuid
import urllib3
from config import PAYMENT_WEBHOOK_SECRET, APP_BASE_URL, SSL_VERIFY

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('')

def generate_payload():
    """Generate a mock payment payload"""
    return {
        "transaction_id": f"test-{int(time.time())}-{uuid.uuid4().hex[:8]}",
        "amount": 19.99,
        "currency": "USD",
        "status": "completed",
        "customer_email": "test@example.com",
        "plan_id": "premium_monthly"
    }

def generate_signature(payload, secret):
    """Generate HMAC signature for the payload"""
    payload_bytes = json.dumps(payload).encode()
    return hmac.new(
        secret.encode(),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

def test_payment_callback(base_url=None, verify_ssl=True, local=False):
    """Send a test webhook to the payment callback endpoint"""
    
    # Disable SSL warnings if verification is disabled
    if not verify_ssl:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        logger.warning("SSL certificate verification is disabled")
    
    # Determine the callback URL
    if local:
        base_url = "http://127.0.0.1:5000"
        logger.info(f"Using local testing URL: {base_url}")
    elif not base_url:
        base_url = APP_BASE_URL
        logger.info(f"Using configured base URL: {base_url}")
    
    callback_url = f"{base_url}/v1/license/payment_callback"
    logger.info(f"Payment callback URL: {callback_url}")
    
    # Generate payload and signature
    payload = generate_payload()
    signature = generate_signature(payload, PAYMENT_WEBHOOK_SECRET)
    
    logger.info(f"Generated test transaction: {payload['transaction_id']}")
    logger.info(f"Customer email: {payload['customer_email']}")
    logger.info(f"Plan: {payload['plan_id']}")
    
    # Set up headers
    headers = {
        'Content-Type': 'application/json',
        'X-Payment-Signature': signature
    }
    
    try:
        # Send the request with a timeout
        logger.info(f"Sending request to {callback_url}")
        response = requests.post(
            callback_url,
            json=payload,
            headers=headers,
            timeout=10,
            verify=verify_ssl
        )
        
        # Process response
        if response.status_code == 200:
            logger.info("Request successful!")
            logger.info(f"Response: {response.text}")
            
            try:
                result = response.json()
                if result.get('success') and result.get('license'):
                    license_key = result['license'].get('license_key')
                    logger.info(f"Generated license key: {license_key}")
                    return True
            except Exception as e:
                logger.error(f"Failed to parse response JSON: {e}")
                
        else:
            logger.error(f"Request failed with status code: {response.status_code}")
            logger.error(f"Response: {response.text}")
    
    except requests.exceptions.Timeout:
        logger.error(f"请求超时: Connection to {callback_url} timed out")
    except requests.exceptions.SSLError as e:
        logger.error(f"SSL错误: {e}")
        logger.info("Try running with --no-verify to bypass SSL verification")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"连接错误: {e}")
        logger.info("Check if the server is running and accessible")
    except Exception as e:
        logger.error(f"发送请求时出错: {e}")
    
    return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test payment callback webhook')
    parser.add_argument('--url', help='Base URL of the application (default: from config)')
    parser.add_argument('--local', action='store_true', help='Test against local server (http://127.0.0.1:5000)')
    parser.add_argument('--no-verify', action='store_true', help='Disable SSL certificate verification')
    
    args = parser.parse_args()
    
    # Use configured SSL_VERIFY if not explicitly set through command line
    verify_ssl = not args.no_verify if args.no_verify is not None else SSL_VERIFY
    
    success = test_payment_callback(args.url, verify_ssl, args.local)
    
    if success:
        print("\n✅ Payment callback test completed successfully!")
    else:
        print("\n❌ Payment callback test failed!")
        
    if args.local:
        print("\nTip: Make sure your local server is running on port 5000")
    elif not args.url:
        print(f"\nTip: If testing against remote server, verify the URL ({APP_BASE_URL}) is correct")
    
    if not verify_ssl:
        print("Note: SSL certificate verification was disabled for this test")
