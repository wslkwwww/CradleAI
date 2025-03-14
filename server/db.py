import mysql.connector
import os
from mysql.connector import pooling
import time

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'openrouter_proxy')
}

# Connection pool for database connections
connection_pool = None

def initialize_db():
    """Initialize database and create necessary tables if they don't exist"""
    # Try to connect to MySQL server
    max_retries = 5
    retry_delay = 5  # seconds
    
    for i in range(max_retries):
        try:
            conn = mysql.connector.connect(
                host=DB_CONFIG['host'],
                user=DB_CONFIG['user'],
                password=DB_CONFIG['password']
            )
            cursor = conn.cursor()
            
            # Create database if it doesn't exist
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
            cursor.execute(f"USE {DB_CONFIG['database']}")
            
            # Create users table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username_hash VARCHAR(64) NOT NULL UNIQUE,
                key_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL
            )
            """)
            
            # Create api_keys table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                api_key TEXT NOT NULL,
                api_key_hash VARCHAR(64) NOT NULL UNIQUE,
                enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_used TIMESTAMP NULL,
                use_count INT DEFAULT 0
            )
            """)
            
            conn.commit()
            print("Database initialized successfully")
            return True
            
        except mysql.connector.Error as err:
            print(f"Error initializing database (attempt {i+1}/{max_retries}): {err}")
            if i < max_retries - 1:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("Maximum retries reached. Database initialization failed.")
                return False
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

def setup_connection_pool():
    """Create a connection pool for database access"""
    global connection_pool
    try:
        connection_pool = pooling.MySQLConnectionPool(
            pool_name="openrouter_pool",
            pool_size=10,
            **DB_CONFIG
        )
        print("Connection pool created successfully")
    except mysql.connector.Error as err:
        print(f"Error creating connection pool: {err}")
        raise

def connect_db():
    """Get a connection from the pool"""
    global connection_pool
    if connection_pool is None:
        setup_connection_pool()
    return connection_pool.get_connection()

def close_db(conn):
    """Close a database connection"""
    if conn.is_connected():
        conn.close()

# Initialize database on module import
initialize_db()
setup_connection_pool()
