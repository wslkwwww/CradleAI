#!/usr/bin/env python
"""
Check email configuration script

This script prints out the current email configuration.
"""

from config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SENDER

def main():
    print("Current email configuration:")
    print(f"SMTP Server: {SMTP_SERVER}")
    print(f"SMTP Port: {SMTP_PORT}")
    print(f"SMTP Username: {SMTP_USERNAME}")
    print(f"SMTP Password: {'*' * len(SMTP_PASSWORD) if SMTP_PASSWORD else 'Not set'}")
    print(f"SMTP Sender: {SMTP_SENDER}")
    print("\nTo test sending an email, run:")
    print("python test_email.py --email recipient@example.com")

if __name__ == "__main__":
    main()
