#!/usr/bin/env python
"""
Check licenses in the database

This script checks all licenses in the database and their status.
"""

import argparse
import sqlite3
import sys
import datetime
from config import LICENSE_DB_PATH

def main():
    parser = argparse.ArgumentParser(description='Check licenses in the database')
    parser.add_argument('--email', help='Filter by customer email')
    parser.add_argument('--days', type=int, default=30, help='Show licenses created in the last N days')
    parser.add_argument('--all', action='store_true', help='Show all licenses regardless of age')
    
    args = parser.parse_args()
    
    try:
        conn = sqlite3.connect(LICENSE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Join with payment_transactions to get email
        query = """
        SELECT a.id, a.code, a.plan_id, a.created_at, a.expires_at, a.is_active, 
               a.devices, a.last_verified_at, pt.customer_email
        FROM activation_codes a
        LEFT JOIN payment_transactions pt ON a.id = pt.code_id
        WHERE 1=1
        """
        
        params = []
        
        # Filter by email if provided
        if args.email:
            query += " AND pt.customer_email LIKE ?"
            params.append(f"%{args.email}%")
        
        # Filter by creation date
        if not args.all and args.days:
            cutoff_time = int(datetime.datetime.now().timestamp()) - (args.days * 86400)
            query += " AND a.created_at > ?"
            params.append(cutoff_time)
        
        cursor.execute(query, params)
        licenses = cursor.fetchall()
        
        if not licenses:
            print("没有找到匹配的许可证记录")
            
            # Check if there are any payment transactions
            if args.email:
                cursor.execute(
                    "SELECT * FROM payment_transactions WHERE customer_email LIKE ?", 
                    (f"%{args.email}%",)
                )
            else:
                cursor.execute("SELECT * FROM payment_transactions")
                
            transactions = cursor.fetchall()
            if transactions:
                print(f"\n找到 {len(transactions)} 条支付交易记录:")
                print("-" * 100)
                for tx in transactions:
                    tx_time = datetime.datetime.fromtimestamp(tx['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"ID: {tx['id']}")
                    print(f"交易ID: {tx['transaction_id']}")
                    print(f"金额: {tx['amount']} {tx['currency']}")
                    print(f"状态: {tx['status']}")
                    print(f"客户邮箱: {tx['customer_email']}")
                    print(f"关联许可证ID: {tx['code_id'] or '无'}")
                    print(f"时间: {tx_time}")
                    print("-" * 100)
            return
        
        print(f"找到 {len(licenses)} 条许可证记录:")
        print("-" * 100)
        
        for license in licenses:
            created_date = datetime.datetime.fromtimestamp(license['created_at']).strftime('%Y-%m-%d %H:%M:%S')
            expires_date = "Never"
            if license['expires_at']:
                expires_date = datetime.datetime.fromtimestamp(license['expires_at']).strftime('%Y-%m-%d %H:%M:%S')
            
            last_verified = "Never"
            if license['last_verified_at']:
                last_verified = datetime.datetime.fromtimestamp(license['last_verified_at']).strftime('%Y-%m-%d %H:%M:%S')
            
            status = "Active" if license['is_active'] else "Inactive"
            
            print(f"ID: {license['id']}")
            print(f"License Key: {license['code']}")
            print(f"Plan: {license['plan_id']}")
            print(f"Email: {license['customer_email'] or 'Unknown'}")
            print(f"Created: {created_date}")
            print(f"Expires: {expires_date}")
            print(f"Status: {status}")
            print(f"Devices: {license['devices'] or 'None'}")
            print(f"Last Verified: {last_verified}")
            print("-" * 100)
        
        # Check audit logs related to these licenses
        license_ids = [str(l['id']) for l in licenses]
        if license_ids:
            cursor.execute(
                f"SELECT * FROM license_audit_log WHERE code_id IN ({','.join(['?'] * len(license_ids))}) ORDER BY timestamp DESC LIMIT 20",
                license_ids
            )
            logs = cursor.fetchall()
            
            if logs:
                print("\n最近的许可证审计日志:")
                print("-" * 100)
                for log in logs:
                    log_time = datetime.datetime.fromtimestamp(log['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"ID: {log['id']}")
                    print(f"许可证ID: {log['code_id']}")
                    print(f"操作: {log['action']}")
                    print(f"状态: {log['status']}")
                    print(f"IP: {log['client_ip']}")
                    print(f"设备ID: {log['device_id']}")
                    print(f"时间: {log_time}")
                    print("-" * 100)
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()
