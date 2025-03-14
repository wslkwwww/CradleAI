from hashlib import blake2b
import argon2
import base64
from db import connect_db, close_db

def argon_hash(email, password, size, domain):
    """
    Implementation of argon_hash function as shown in the reference utility file.
    """
    pre_salt = f"{password[:6]}{email}{domain}"
    
    # salt
    blake = blake2b(digest_size=16)
    blake.update(pre_salt.encode())
    salt = blake.digest()
    
    raw = argon2.low_level.hash_secret_raw(
        password.encode(),
        salt,
        2,
        int(2000000 / 1024),
        1,
        size,
        argon2.low_level.Type.ID,
    )
    hashed = base64.urlsafe_b64encode(raw).decode()
    
    return hashed

def hash_username(username):
    """
    Create a consistent hash of the username using BLAKE2
    """
    blake = blake2b(digest_size=32)
    blake.update(username.encode())
    return blake.hexdigest()

def register_user(username, derived_key):
    """
    Register a new user in the database
    
    Args:
        username: The username
        derived_key: The derived key from client-side processing
        
    Returns:
        (success, message): Tuple of success flag and message
    """
    # Hash username for storage
    username_hash = hash_username(username)
    
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE username_hash = %s", (username_hash,))
        if cursor.fetchone():
            return False, "Username already exists"
        
        # Insert new user
        cursor.execute(
            "INSERT INTO users (username_hash, key_hash) VALUES (%s, %s)",
            (username_hash, derived_key)
        )
        conn.commit()
        return True, "User registered successfully"
        
    except Exception as e:
        conn.rollback()
        return False, f"Registration failed: {str(e)}"
        
    finally:
        close_db(conn)

def validate_login(username, derived_key):
    """
    Validate user login credentials
    
    Args:
        username: The username
        derived_key: The derived key from client-side processing
        
    Returns:
        (success, user_id): Tuple of success flag and user ID if successful
    """
    # Hash username for lookup
    username_hash = hash_username(username)
    
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Find user by username hash
        cursor.execute("SELECT id, key_hash FROM users WHERE username_hash = %s", (username_hash,))
        user = cursor.fetchone()
        
        if not user:
            return False, None
            
        user_id, stored_key = user
        
        # Compare derived key with stored key
        if derived_key == stored_key:
            return True, user_id
        return False, None
        
    except Exception as e:
        print(f"Login validation error: {str(e)}")
        return False, None
        
    finally:
        close_db(conn)
