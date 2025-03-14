#!/usr/bin/env python3
import time
import schedule
from api_key_manager import rotate_api_keys, load_api_keys_from_db

def job():
    """Job to rotate API keys"""
    print("Starting API key rotation...")
    rotate_api_keys(percentage=25)  # Rotate 25% of keys
    print("API key rotation complete!")

# Schedule key rotation job
schedule.every(7).days.do(job)  # Run every week

# Initial load of API keys
load_api_keys_from_db()

if __name__ == "__main__":
    print("API Key Rotation service started")
    print("Keys will be rotated weekly")
    
    # Run job once at startup
    job()
    
    # Keep running
    while True:
        schedule.run_pending()
        time.sleep(3600)  # Check every hour for pending jobs
