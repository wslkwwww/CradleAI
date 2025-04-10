#!/usr/bin/env python
"""
Simple test script to check if the Flask application is accessible
"""

import requests
import socket
import argparse
import sys
import time

def check_local_port(port):
    """Check if a port is open on localhost"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    return result == 0

def test_endpoint(base_url, endpoint, expected_status=200, timeout=5):
    """Test an API endpoint"""
    url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
    
    try:
        print(f"Testing endpoint: {url}")
        response = requests.get(url, timeout=timeout)
        
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text[:100]}...")
        
        return response.status_code == expected_status
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Test Flask application connectivity')
    parser.add_argument('--host', default='localhost', help='Host to connect to')
    parser.add_argument('--port', type=int, default=5000, help='Port to connect to')
    parser.add_argument('--timeout', type=int, default=5, help='Request timeout')
    
    args = parser.parse_args()
    
    # Step 1: Check if the port is open locally
    print(f"\nChecking if port {args.port} is open on {args.host}...")
    if check_local_port(args.port):
        print(f"✅ Port {args.port} is open")
    else:
        print(f"❌ Port {args.port} is not open")
        print("The application may not be running. Try starting it with:")
        print("  ./run_gunicorn.sh")
        sys.exit(1)
    
    # Base URL for API calls
    base_url = f"http://{args.host}:{args.port}"
    
    # Step 2: Test basic endpoints
    print("\nTesting basic endpoints...")
    
    endpoints = [
        'system-health',
        'health',
        'v1/imagen/health'
    ]
    
    success_count = 0
    
    for endpoint in endpoints:
        print(f"\nTesting '{endpoint}'...")
        if test_endpoint(base_url, endpoint, timeout=args.timeout):
            print("✅ Success")
            success_count += 1
        else:
            print("❌ Failed")
    
    # Step 3: Display summary
    print(f"\nEndpoint tests completed: {success_count}/{len(endpoints)} successful")
    
    if success_count > 0:
        print("\n✅ The application is running and at least partially accessible")
        
        # Step 4: Try to determine why some endpoints might be failing
        if success_count < len(endpoints):
            print("\nPossible issues:")
            print("1. Some endpoints require Redis connectivity")
            print("2. Timeout settings might be too low")
            print("3. Application might be experiencing high load")
            print("\nNext steps:")
            print("- Check logs: tail -f logs/gunicorn-error.log")
            print("- Verify Redis connection in the application")
            print("- Try restarting with: ./run_gunicorn.sh")
    else:
        print("\n❌ The application is running but not responding to API requests")
        print("\nPossible issues:")
        print("1. Middleware or CORS issues blocking requests")
        print("2. Network firewall preventing access")
        print("3. Application startup errors")
        print("\nNext steps:")
        print("- Check logs: tail -f logs/gunicorn-error.log")
        print("- Verify application startup was successful")
        print("- Try manually restarting: ./run_gunicorn.sh")

if __name__ == "__main__":
    main()
