#!/usr/bin/env python
"""
Diagnostics tool for checking server connectivity and configuration issues.
"""

import os
import sys
import socket
import subprocess
import requests
import logging
import json
import argparse
import platform
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('diagnostics')

def check_port_in_use(host, port):
    """Check if a port is in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0

def check_service_running(service_name):
    """Check if a system service is running"""
    if platform.system() == 'Linux':
        try:
            result = subprocess.run(['systemctl', 'is-active', service_name], 
                                   capture_output=True, text=True)
            return result.stdout.strip() == 'active'
        except:
            return False
    return None  # Not supported on this platform

def check_environment_variables():
    """Check if required environment variables are set"""
    required_vars = [
        'PORT', 'REDIS_HOST', 'REDIS_PORT', 
        'FLASK_APP', 'SECRET_KEY'
    ]
    
    results = {}
    for var in required_vars:
        value = os.environ.get(var)
        results[var] = {
            'exists': value is not None,
            'value': value if var != 'SECRET_KEY' else '[HIDDEN]' if value else None
        }
    
    return results

def check_pip_packages():
    """Check installed pip packages"""
    try:
        result = subprocess.run([sys.executable, '-m', 'pip', 'list'], 
                               capture_output=True, text=True)
        packages = result.stdout.strip().split('\n')[2:]  # Skip the header rows
        
        required_packages = [
            'flask', 'gunicorn', 'redis', 'celery', 'requests',
            'argon2-cffi', 'minio'
        ]
        
        package_dict = {}
        for line in packages:
            parts = line.strip().split()
            if len(parts) >= 2:
                package_dict[parts[0].lower()] = parts[1]
        
        results = {}
        for package in required_packages:
            results[package] = {
                'installed': package in package_dict,
                'version': package_dict.get(package, None)
            }
        
        return results
    except Exception as e:
        logger.error(f"Error checking pip packages: {e}")
        return {}

def check_api_endpoints(base_url):
    """Check API endpoints"""
    endpoints = [
        '/health',
        '/v1/imagen/health',
    ]
    
    results = {}
    for endpoint in endpoints:
        url = f"{base_url.rstrip('/')}{endpoint}"
        try:
            response = requests.get(url, timeout=5)
            results[endpoint] = {
                'status_code': response.status_code,
                'success': response.status_code < 400,
                'content': response.text[:100] + '...' if len(response.text) > 100 else response.text
            }
        except Exception as e:
            results[endpoint] = {
                'status_code': None,
                'success': False,
                'error': str(e)
            }
    
    return results

def check_file_permissions(file_paths):
    """Check file permissions for critical files"""
    results = {}
    for path in file_paths:
        try:
            file_path = Path(path)
            results[path] = {
                'exists': file_path.exists(),
                'is_file': file_path.is_file() if file_path.exists() else None,
                'readable': os.access(path, os.R_OK) if file_path.exists() else None,
                'writeable': os.access(path, os.W_OK) if file_path.exists() else None,
                'executable': os.access(path, os.X_OK) if file_path.exists() else None,
                'size': file_path.stat().st_size if file_path.exists() and file_path.is_file() else None
            }
        except Exception as e:
            results[path] = {
                'exists': False,
                'error': str(e)
            }
    
    return results

def check_directory():
    """Check current working directory"""
    return {
        'current_directory': os.getcwd(),
        'directory_contents': os.listdir('.')[:10],  # List first 10 files
        'has_app_py': os.path.exists('app.py'),
        'has_env_file': os.path.exists('.env'),
        'has_wsgi_py': os.path.exists('wsgi.py'),
    }

def run_diagnostics(args):
    """Run all diagnostics"""
    logger.info("Starting server diagnostics...")
    
    # Basic system information
    results = {
        'system': {
            'platform': platform.platform(),
            'python_version': platform.python_version(),
            'hostname': socket.gethostname(),
        },
        'directory': check_directory(),
        'ports': {
            'flask_port': {
                'port': args.port,
                'in_use': check_port_in_use('localhost', args.port)
            },
            'redis_port': {
                'port': 6379,
                'in_use': check_port_in_use('localhost', 6379)
            }
        },
        'environment_variables': check_environment_variables(),
        'packages': check_pip_packages(),
    }
    
    # Service checks (Linux only)
    if platform.system() == 'Linux':
        results['services'] = {
            'nginx': {
                'running': check_service_running('nginx')
            },
            'redis': {
                'running': check_service_running('redis')
            }
        }
    
    # Check file permissions for critical files
    critical_files = [
        'app.py',
        'wsgi.py',
        '.env',
        'config.py',
        'run_gunicorn.sh',
        'run_flask.sh',
    ]
    results['file_permissions'] = check_file_permissions(critical_files)
    
    # Check API endpoints
    if args.check_api:
        logger.info(f"Checking API endpoints at {args.base_url}...")
        results['api_endpoints'] = check_api_endpoints(args.base_url)
    
    return results

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Server diagnostics tool')
    parser.add_argument('--check-api', action='store_true', help='Check API endpoints')
    parser.add_argument('--base-url', default='http://localhost:5000', help='Base URL for API checks')
    parser.add_argument('--port', type=int, default=5000, help='Port to check')
    parser.add_argument('--output', help='Save results to file')
    
    args = parser.parse_args()
    
    try:
        results = run_diagnostics(args)
        
        # Print results
        print("\n===== DIAGNOSTIC RESULTS =====\n")
        
        # System info
        print(f"System: {results['system']['platform']}")
        print(f"Python: {results['system']['python_version']}")
        print(f"Hostname: {results['system']['hostname']}")
        
        # Directory info
        print("\nDirectory:")
        print(f"  Current: {results['directory']['current_directory']}")
        print(f"  Has app.py: {results['directory']['has_app_py']}")
        print(f"  Has .env: {results['directory']['has_env_file']}")
        
        # Port checks
        print("\nPorts:")
        for port_name, port_info in results['ports'].items():
            status = "🔴 NOT IN USE" if not port_info['in_use'] else "🟢 IN USE"
            print(f"  {port_name} ({port_info['port']}): {status}")
        
        # Environment variables
        print("\nEnvironment Variables:")
        for var, info in results['environment_variables'].items():
            status = "🟢 SET" if info['exists'] else "🔴 MISSING"
            value = info['value'] if info['exists'] else "N/A"
            print(f"  {var}: {status} ({value})")
        
        # Package checks
        print("\nRequired Packages:")
        for package, info in results['packages'].items():
            status = "🟢 INSTALLED" if info['installed'] else "🔴 MISSING"
            version = info['version'] if info['installed'] else "N/A"
            print(f"  {package}: {status} ({version})")
        
        # API endpoint checks
        if 'api_endpoints' in results:
            print("\nAPI Endpoints:")
            for endpoint, info in results['api_endpoints'].items():
                status = "🟢 OK" if info.get('success', False) else "🔴 FAILED"
                status_code = info.get('status_code', 'N/A')
                error = info.get('error', '')
                print(f"  {endpoint}: {status} ({status_code}) {error}")
        
        # Save results to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\nResults saved to {args.output}")
        
        # Check if all critical tests passed
        critical_failures = []
        
        # Check if Flask port is not in use
        if 'flask_port' in results['ports'] and not results['ports']['flask_port']['in_use']:
            critical_failures.append("Flask application is not running")
        
        # Check if Redis is not running
        if 'redis_port' in results['ports'] and not results['ports']['redis_port']['in_use']:
            critical_failures.append("Redis server is not running")
        
        # Print final result
        print("\n===== SUMMARY =====")
        if critical_failures:
            print("❌ ISSUES DETECTED:")
            for failure in critical_failures:
                print(f"  - {failure}")
        else:
            print("✅ All critical checks passed!")
        
    except Exception as e:
        logger.error(f"Error running diagnostics: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
