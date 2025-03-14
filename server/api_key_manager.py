import os
import random
import requests
import json
import time
from datetime import datetime
from hashlib import blake2b
from threading import Lock
from db import connect_db, close_db
from cryptography.fernet import Fernet

# OpenRouter API provisioning constants
PROVISION_KEY = os.environ.get('OPENROUTER_PROVISION_KEY', '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')
PROVISION_API_URL = "https://openrouter.ai/api/v1/keys"

# Encryption key for API keys (should be stored securely)
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

# In-memory cache of API keys for faster access
api_key_cache = []
api_key_lock = Lock()  # Lock for thread safety

def encrypt_api_key(api_key):
    """Encrypt an API key for storage"""
    return cipher_suite.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key):
    """Decrypt an API key for use"""
    return cipher_suite.decrypt(encrypted_key.encode()).decode()

def hash_api_key(api_key):
    """Create a hash of the API key for lookup and identification"""
    blake = blake2b(digest_size=32)
    blake.update(api_key.encode())
    return blake.hexdigest()

def create_api_key(name):
    """Create a new API key using the OpenRouter provisioning API"""
    headers = {
        'Authorization': f'Bearer {PROVISION_KEY}',
        'Content-Type': 'application/json'
    }
    data = {
        'name': name
    }
    
    try:
        response = requests.post(
            PROVISION_API_URL,
            headers=headers,
            json=data
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['data']['key'], result['data']['hash'], result['data']['name']
        else:
            print(f"Failed to create API key: {response.text}")
            return None, None, None
            
    except Exception as e:
        print(f"Error creating API key: {str(e)}")
        return None, None, None

def update_api_key(key_hash):
    """Update/rotate an API key using the OpenRouter provisioning API"""
    headers = {
        'Authorization': f'Bearer {PROVISION_KEY}',
        'Content-Type': 'application/json'
    }
    data = {}
    
    try:
        response = requests.patch(
            f"{PROVISION_API_URL}/{key_hash}",
            headers=headers,
            json=data
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['data']['key'], result['data']['hash']
        else:
            print(f"Failed to update API key: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"Error updating API key: {str(e)}")
        return None, None

def load_api_keys_from_db():
    """Load API keys from the database into cache"""
    conn = connect_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            "SELECT id, name, api_key, api_key_hash, enabled FROM api_keys WHERE enabled = TRUE"
        )
        keys = cursor.fetchall()
        
        with api_key_lock:
            api_key_cache.clear()
            for key in keys:
                try:
                    decrypted_key = decrypt_api_key(key['api_key'])
                    api_key_cache.append({
                        'id': key['id'],
                        'name': key['name'],
                        'key': decrypted_key,
                        'hash': key['api_key_hash'],
                        'enabled': key['enabled']
                    })
                except Exception as e:
                    print(f"Error decrypting API key {key['id']}: {str(e)}")
        
        return len(api_key_cache) > 0
        
    except Exception as e:
        print(f"Error loading API keys from database: {str(e)}")
        return False
        
    finally:
        close_db(conn)

def store_api_key(name, api_key, api_key_hash):
    """Store an API key in the database"""
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Encrypt the API key before storing
        encrypted_key = encrypt_api_key(api_key)
        
        cursor.execute(
            """
            INSERT INTO api_keys (name, api_key, api_key_hash, enabled)
            VALUES (%s, %s, %s, TRUE)
            """,
            (name, encrypted_key, api_key_hash)
        )
        conn.commit()
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"Error storing API key: {str(e)}")
        return False
        
    finally:
        close_db(conn)

def update_api_key_usage(api_key_id):
    """Update the last_used timestamp and use_count for an API key"""
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """
            UPDATE api_keys
            SET last_used = CURRENT_TIMESTAMP, use_count = use_count + 1
            WHERE id = %s
            """,
            (api_key_id,)
        )
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating API key usage: {str(e)}")
        
    finally:
        close_db(conn)

def get_api_key():
    """Get a random API key from the cache"""
    with api_key_lock:
        if not api_key_cache:
            if not load_api_keys_from_db():
                return None
        
        # Select a random API key from the cache
        if api_key_cache:
            selected = random.choice(api_key_cache)
            # Update usage statistics asynchronously
            try:
                update_api_key_usage(selected['id'])
            except Exception:
                # Don't fail if updating usage fails
                pass
            return selected['key']
    
    return None

def initialize_api_key_pool(min_keys=3):
    """Initialize the API key pool, creating new keys if needed"""
    # First, load existing keys from the database
    load_api_keys_from_db()
    
    # If we don't have enough keys, create more
    with api_key_lock:
        if len(api_key_cache) < min_keys:
            keys_to_create = min_keys - len(api_key_cache)
            print(f"Creating {keys_to_create} new API keys")
            
            for i in range(keys_to_create):
                name = f"app_key_{datetime.now().strftime('%Y%m%d%H%M%S')}_{i}"
                api_key, api_key_hash, key_name = create_api_key(name)
                
                if api_key and api_key_hash:
                    # Store in database
                    success = store_api_key(key_name or name, api_key, api_key_hash)
                    if success:
                        # Add to cache
                        api_key_cache.append({
                            'id': -1,  # Temporary ID until we reload from DB
                            'name': key_name or name,
                            'key': api_key,
                            'hash': api_key_hash,
                            'enabled': True
                        })
                        print(f"Created and stored API key: {key_name or name}")
                    else:
                        print(f"Failed to store API key in database")
                else:
                    print(f"Failed to create API key #{i+1}")
                
                # Avoid rate limits
                time.sleep(1)
            
            # Reload from database to get proper IDs
            load_api_keys_from_db()

def rotate_api_keys(percentage=25):
    """Rotate a percentage of API keys"""
    with api_key_lock:
        if not api_key_cache:
            load_api_keys_from_db()
            if not api_key_cache:
                print("No API keys to rotate")
                return
        
        # Calculate how many keys to rotate
        num_keys_to_rotate = max(1, int(len(api_key_cache) * percentage / 100))
        keys_to_rotate = random.sample(api_key_cache, num_keys_to_rotate)
        
        print(f"Rotating {num_keys_to_rotate} API keys")
        
        for key in keys_to_rotate:
            new_key, new_hash = update_api_key(key['hash'])
            if new_key and new_hash:
                # Update in database
                conn = connect_db()
                cursor = conn.cursor()
                
                try:
                    encrypted_key = encrypt_api_key(new_key)
                    cursor.execute(
                        """
                        UPDATE api_keys
                        SET api_key = %s, api_key_hash = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        """,
                        (encrypted_key, new_hash, key['id'])
                    )
                    conn.commit()
                    print(f"Rotated API key: {key['name']}")
                
                except Exception as e:
                    conn.rollback()
                    print(f"Error updating rotated API key in database: {str(e)}")
                
                finally:
                    close_db(conn)
            else:
                print(f"Failed to rotate API key: {key['name']}")
            
            # Avoid rate limits
            time.sleep(1)
        
        # Reload the cache after rotation
        load_api_keys_from_db()
