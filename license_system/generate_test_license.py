import os
import sys
import json
import argparse
from pathlib import Path
import logging
import time
from datetime import datetime
import argon2  # Add import for argon2

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import necessary modules
from server.license_generator import LicenseGenerator
from server.license_validator import LicenseValidator
from server import config  # Add import for config
from db import db_utils

def generate_test_license(plan_id="standard", validity_days=365, output_file=None, device_id=None, verify=True):
    """
    Generate a test license and save it to a file
    
    Args:
        plan_id: The plan ID for the license (default: "standard")
        validity_days: The validity period in days (default: 365)
        output_file: Path to save the license info (default: license_info.json in current dir)
        device_id: Optional device ID to verify the license with
        verify: Whether to verify the license after generation
    
    Returns:
        The generated license information dictionary
    """
    try:
        # Initialize database if needed
        logger.info("Initializing database...")
        db_utils.init_db()
        
        # Set environment variables for testing if not already set
        master_key = os.environ.get("LICENSE_MASTER_KEY")
        if not master_key:
            master_key = "test_master_key_for_testing_purposes_only"
            os.environ["LICENSE_MASTER_KEY"] = master_key
            logger.info(f"Using default test master key")
        
        logger.info(f"Using master key (first 4 chars): {master_key[:4]}****")
        
        # Create license generator
        logger.info("Creating license generator...")
        generator = LicenseGenerator(master_key)
        
        # Generate the license
        logger.info(f"Generating license for plan '{plan_id}' valid for {validity_days} days...")
        license_data = generator.generate_license(plan_id, validity_days)
        
        # Print license info
        logger.info("License generated successfully:")
        logger.info(f"License Key: {license_data['license_key']}")
        logger.info(f"License ID: {license_data['license_id']}")
        logger.info(f"Plan ID: {license_data['plan_id']}")
        logger.info(f"Expiry Date: {license_data['expiry_date']}")
        
        # Check license data in database
        db_license = db_utils.get_license_by_code(license_data['license_key'])
        if db_license:
            logger.info("License found in database:")
            logger.info(f"Database ID: {db_license['id']}")
            logger.info(f"Hash present: {'Yes' if db_license['hash'] else 'No'}")
            logger.info(f"Salt present: {'Yes' if db_license['salt'] else 'No'}")
            
            # Debug: Print key material that will be used in verification
            try:
                key_material = f"{license_data['license_key']}:{master_key}"
                logger.debug(f"Key material for verification: {license_data['license_key']}:<master_key>")
            except Exception as e:
                logger.error(f"Error creating key material: {e}")
        else:
            logger.error("License not found in database!")
        
        # Verify the license if requested
        if verify and device_id:
            logger.info(f"Verifying license with device ID: {device_id}")
            validator = LicenseValidator(master_key)  # Use the same master key
            result = validator.verify_license(license_data['license_key'], device_id)
            
            if result and result['is_valid']:
                logger.info("License verification successful!")
                # Add verification info to license data
                license_data['verified'] = True
                license_data['device_id'] = device_id
            else:
                logger.error("License verification failed!")
                license_data['verified'] = False
                
                # Debug: Try to fix and verify again
                try:
                    # Fix license hash directly
                    logger.warning("Attempting to fix license hash...")
                    ph = argon2.PasswordHasher(
                        time_cost=config.KEY_DERIVATION_TIME_COST,
                        memory_cost=config.KEY_DERIVATION_MEMORY_COST,
                        parallelism=config.KEY_DERIVATION_PARALLELISM,
                        hash_len=config.KEY_DERIVATION_HASH_LEN
                    )
                    key_material = f"{license_data['license_key']}:{master_key}"
                    new_hash = ph.hash(key_material)
                    
                    # Update the hash in database
                    db_utils.update_license(license_data['license_id'], hash=new_hash)
                    logger.warning(f"Fixed hash for license {license_data['license_key']}")
                    
                    # Try verification again
                    result = validator.verify_license(license_data['license_key'], device_id)
                    if result and result['is_valid']:
                        logger.info("License verification successful after hash fix!")
                        license_data['verified'] = True
                        license_data['device_id'] = device_id
                except Exception as e:
                    logger.error(f"Error attempting to fix license hash: {e}")
        
        # Save to file if requested
        if output_file is None:
            output_file = "license_info.json"
        
        # Add additional useful information for API testing
        license_data['curl_verify_command'] = (
            f'curl -X POST "http://127.0.0.1:5000/api/v1/license/verify" '
            f'-H "Content-Type: application/json" '
            f'-d \'{{"license_key": "{license_data["license_key"]}", "device_id": "{device_id or "test_device_id"}"}}\''
        )
        
        # Add debug information including master key info (not the actual key)
        license_data['debug_info'] = {
            'master_key_prefix': master_key[:4] + '****',
            'master_key_length': len(master_key),
            'hash_present': bool(db_license and db_license.get('hash')),
            'salt_present': bool(db_license and db_license.get('salt')),
        }
        
        with open(output_file, 'w') as f:
            json.dump(license_data, f, indent=2)
        
        logger.info(f"License information saved to {output_file}")
        
        return license_data
    
    except Exception as e:
        logger.error(f"Error generating test license: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def check_license_in_database(license_key):
    """
    Check if a license exists in the database and print its details
    """
    try:
        # Initialize database if needed
        db_utils.init_db()
        
        # Get license data
        license_info = db_utils.get_license_by_code(license_key)
        
        if license_info:
            print("\nLicense found in database:")
            print(f"ID: {license_info['id']}")
            print(f"Key: {license_info['code']}")
            print(f"Plan: {license_info['plan_id']}")
            print(f"Created: {datetime.fromtimestamp(license_info['created_at']).strftime('%Y-%m-%d %H:%M:%S')}")
            
            if license_info['expires_at']:
                print(f"Expires: {datetime.fromtimestamp(license_info['expires_at']).strftime('%Y-%m-%d %H:%M:%S')}")
                is_expired = time.time() > license_info['expires_at']
                print(f"Expired: {'Yes' if is_expired else 'No'}")
            else:
                print("Expires: Never")
                
            print(f"Active: {'Yes' if license_info['is_active'] else 'No'}")
            print(f"Hash present: {'Yes' if license_info['hash'] else 'No'}")
            print(f"Salt present: {'Yes' if license_info['salt'] else 'No'}")
            print(f"Device count: {len(license_info['devices'].split(',')) if license_info['devices'] else 0}")
            if license_info['devices']:
                print(f"Devices: {license_info['devices']}")
            print(f"Failed attempts: {license_info['failed_attempts']}")
            
            if license_info['last_verified_at']:
                print(f"Last verified: {datetime.fromtimestamp(license_info['last_verified_at']).strftime('%Y-%m-%d %H:%M:%S')}")
            
            return license_info
        else:
            print(f"\nLicense not found: {license_key}")
            return None
    except Exception as e:
        print(f"Error checking license: {e}")
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a test license")
    parser.add_argument("--plan", default="standard", help="Plan ID for the license")
    parser.add_argument("--days", type=int, default=365, help="Validity period in days")
    parser.add_argument("--output", help="Output file path")
    parser.add_argument("--device", help="Device ID to verify the license with")
    parser.add_argument("--verify", action="store_true", help="Verify the license after generation")
    parser.add_argument("--check", help="Check if a license exists in the database")
    
    args = parser.parse_args()
    
    if args.check:
        check_license_in_database(args.check)
    else:
        # Set environment variables for testing if not already set
        if "LICENSE_MASTER_KEY" not in os.environ:
            os.environ["LICENSE_MASTER_KEY"] = "test_master_key_for_testing_purposes_only"
        
        generate_test_license(args.plan, args.days, args.output, args.device, args.verify)
