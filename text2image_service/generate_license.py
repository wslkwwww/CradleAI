#!/usr/bin/env python
"""
Generate a license directly without using the webhook

This script directly uses the license_generator module to create a new license.
"""

import argparse
import logging
import sys
import os
import time
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('generate_license')

def main():
    parser = argparse.ArgumentParser(description='Generate a license directly')
    parser.add_argument('--email', required=True, help='Customer email to send the license to')
    parser.add_argument('--plan', default='premium_monthly', help='Subscription plan ID')
    parser.add_argument('--days', type=int, default=365, help='Validity period in days')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Set verbose logging if requested
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        # Add the current directory to the Python path to find the modules
        script_dir = os.path.dirname(os.path.abspath(__file__))
        if script_dir not in sys.path:
            sys.path.append(script_dir)
        
        # Import the license generator
        logger.info("Importing license_generator module...")
        from license_generator import license_generator
        
        # Generate the license
        logger.info(f"Generating license for {args.email} (Plan: {args.plan}, Validity: {args.days} days)...")
        license_data = license_generator.generate_license(
            plan_id=args.plan,
            customer_email=args.email,
            validity_days=args.days
        )
        
        # Print the result
        print("\n" + "="*60)
        print(f"✅ License successfully generated!")
        print(f"📝 License Key: {license_data['license_key']}")
        print(f"🆔 Plan: {license_data['plan_id']}")
        print(f"📅 Created: {datetime.fromtimestamp(license_data['created_at']).strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📅 Expires: {license_data['expiry_date']}")
        print(f"📧 Email: {args.email}")
        print("="*60)
        
        # Remind about email
        print("\nNote: If email is configured correctly, a license email should be sent to the customer.")
        print("Use `python test_email.py --email your-email@example.com` to test email functionality.")
        
    except ImportError as e:
        logger.error(f"Failed to import license_generator: {e}")
        logger.error("Make sure you're running this script from the main application directory or")
        logger.error("that all required dependencies are installed.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to generate license: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
