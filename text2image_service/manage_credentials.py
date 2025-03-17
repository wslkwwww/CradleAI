#!/usr/bin/env python
"""
NovelAI 凭据管理工具

此脚本用于管理多组 NovelAI 账号凭据，支持添加、删除、测试和列出凭据。
它使用轮询机制，当一个账号失效时自动切换到下一个。
"""

import argparse
import getpass
import logging
import sys
import os
import time
import json
import credentials
from novelai import NovelAIClient
from tabulate import tabulate  # 你可能需要安装: pip install tabulate

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('manage_credentials')

def test_credential(email, password, index=None):
    """测试单个账号凭据是否有效
    
    Args:
        email: NovelAI 账号邮箱
        password: NovelAI 账号密码
        index: 账号索引，仅用于日志记录
        
    Returns:
        tuple: (是否成功, 令牌或错误消息)
    """
    index_str = f"#{index}" if index is not None else ""
    logger.info(f"测试账号 {index_str}: {email}")
    
    try:
        # 创建客户端并尝试登录
        client = NovelAIClient()
        token = client.login_with_email_password(email, password)
        
        if token:
            logger.info(f"账号 {index_str}: {email} 认证成功！")
            return True, token
        else:
            logger.error(f"账号 {index_str}: {email} 认证失败，未获取到令牌")
            return False, "未获取到有效令牌"
    except Exception as e:
        logger.error(f"账号 {index_str}: {email} 认证失败: {e}")
        return False, str(e)

def add_credential(email=None, password=None):
    """添加新凭据
    
    Args:
        email: 邮箱，如果为None则提示输入
        password: 密码，如果为None则提示输入
        
    Returns:
        bool: 是否添加成功
    """
    # 如果未提供邮箱，提示用户输入
    if not email:
        email = input("请输入 NovelAI 账号邮箱: ")
    
    # 如果未提供密码，安全地提示用户输入
    if not password:
        password = getpass.getpass("请输入 NovelAI 账号密码: ")
    
    # 测试凭据是否有效
    success, message = test_credential(email, password)
    
    if success:
        # 保存凭据
        if credentials.save_credentials(email, password):
            logger.info(f"账号 {email} 已成功添加")
            return True
        else:
            logger.error("保存凭据失败")
            return False
    else:
        logger.error(f"无效的凭据，未保存: {message}")
        return False

def update_credential(index, email=None, password=None):
    """更新指定索引的凭据
    
    Args:
        index: 要更新的凭据索引
        email: 新邮箱，如果为None则使用原邮箱
        password: 新密码，如果为None则提示输入
        
    Returns:
        bool: 是否更新成功
    """
    # 获取所有凭据
    creds_list = credentials.get_all_credentials()
    
    # 检查索引是否有效
    if index < 0 or index >= len(creds_list):
        logger.error(f"无效的凭据索引: {index}")
        return False
    
    # 获取当前凭据
    current_cred = creds_list[index]
    
    # 如果未提供新邮箱，使用当前邮箱
    if not email:
        email = current_cred['email']
        
    # 如果未提供新密码，提示用户输入
    if not password:
        print(f"更新账号 #{index}: {email}")
        password = getpass.getpass("请输入新密码 (留空则保持不变): ")
        if not password:
            password = current_cred['password']
    
    # 测试新凭据是否有效
    success, message = test_credential(email, password, index)
    
    if success:
        # 保存凭据
        if credentials.save_credentials(email, password, index):
            logger.info(f"账号 #{index}: {email} 已成功更新")
            return True
        else:
            logger.error(f"更新账号 #{index}: {email} 失败")
            return False
    else:
        logger.error(f"无效的凭据，未更新账号 #{index}: {message}")
        return False

def list_credentials(test=False):
    """列出所有凭据
    
    Args:
        test: 是否测试每个凭据的有效性
        
    Returns:
        list: 凭据信息列表
    """
    # 获取所有凭据
    creds_list = credentials.get_all_credentials()
    
    if not creds_list:
        logger.info("没有找到存储的凭据")
        return []
    
    # 准备表格数据
    table_data = []
    for i, cred in enumerate(creds_list):
        email = cred.get('email', 'N/A')
        updated_at = cred.get('updated_at', 'N/A')
        
        # 测试凭据有效性
        status = "未测试"
        if test:
            logger.info(f"测试账号 #{i}: {email}")
            success, message = test_credential(email, cred.get('password', ''), i)
            status = "有效" if success else f"无效 ({message[:30]}...)" if len(message) > 30 else f"无效 ({message})"
            # 添加短暂延迟，避免API速率限制
            time.sleep(2)
        
        table_data.append({
            'Index': i,
            'Email': email,
            'Updated': updated_at,
            'Status': status
        })
    
    return table_data

def test_all_credentials():
    """测试所有凭据的有效性
    
    Returns:
        tuple: (有效凭据数, 总凭据数)
    """
    # 获取所有凭据
    creds_list = credentials.get_all_credentials()
    
    if not creds_list:
        logger.info("没有找到存储的凭据")
        return 0, 0
    
    valid_count = 0
    total_count = len(creds_list)
    
    for i, cred in enumerate(creds_list):
        email = cred.get('email', 'N/A')
        logger.info(f"测试账号 #{i}: {email}")
        
        success, message = test_credential(email, cred.get('password', ''), i)
        if success:
            valid_count += 1
        
        # 添加短暂延迟，避免API速率限制
        if i < total_count - 1:  # 如果不是最后一个
            time.sleep(2)
    
    return valid_count, total_count

def remove_credential(index):
    """删除指定索引的凭据
    
    Args:
        index: 要删除的凭据索引
        
    Returns:
        bool: 是否删除成功
    """
    # 获取所有凭据
    creds_list = credentials.get_all_credentials()
    
    # 检查索引是否有效
    if index < 0 or index >= len(creds_list):
        logger.error(f"无效的凭据索引: {index}")
        return False
    
    # 获取要删除的凭据的邮箱
    email = creds_list[index].get('email', 'unknown')
    
    # 删除凭据
    if credentials.remove_credential(index):
        logger.info(f"已成功删除账号 #{index}: {email}")
        return True
    else:
        logger.error(f"删除账号 #{index}: {email} 失败")
        return False

def show_credential_failures():
    """显示凭据失败记录
    
    Returns:
        dict: 失败记录
    """
    failure_log_file = os.path.join(os.path.dirname(credentials.CREDENTIALS_FILE), 'credential_failures.json')
    
    if not os.path.exists(failure_log_file):
        logger.info("没有找到失败记录文件")
        return {}
    
    try:
        with open(failure_log_file, 'r') as f:
            failures = json.load(f)
        
        if not failures:
            logger.info("没有失败记录")
            return {}
        
        # 获取所有凭据
        creds_list = credentials.get_all_credentials()
        
        # 打印失败记录
        for index_str, records in failures.items():
            index = int(index_str)
            
            # 获取对应的邮箱
            email = "unknown"
            if index < len(creds_list):
                email = creds_list[index].get('email', 'unknown')
            
            # 获取最近的失败记录
            recent_failures = records[-5:] if len(records) > 5 else records
            
            print(f"\n账号 #{index}: {email} 失败记录 (共 {len(records)} 次):")
            for record in recent_failures:
                print(f"  - {record.get('time')}")
        
        return failures
    except Exception as e:
        logger.error(f"读取失败记录时出错: {e}")
        return {}

def main():
    parser = argparse.ArgumentParser(description='NovelAI 凭据管理工具')
    subparsers = parser.add_subparsers(dest='command', help='子命令')
    
    # 添加凭据命令
    add_parser = subparsers.add_parser('add', help='添加新凭据')
    add_parser.add_argument('--email', help='NovelAI 账号邮箱')
    add_parser.add_argument('--password', help='NovelAI 账号密码')
    
    # 列出凭据命令
    list_parser = subparsers.add_parser('list', help='列出所有凭据')
    list_parser.add_argument('--test', action='store_true', help='测试每个凭据的有效性')
    
    # 测试所有凭据命令
    test_parser = subparsers.add_parser('test', help='测试所有凭据的有效性')
    
    # 更新凭据命令
    update_parser = subparsers.add_parser('update', help='更新指定索引的凭据')
    update_parser.add_argument('index', type=int, help='要更新的凭据索引')
    update_parser.add_argument('--email', help='新邮箱')
    update_parser.add_argument('--password', help='新密码')
    
    # 删除凭据命令
    remove_parser = subparsers.add_parser('remove', help='删除指定索引的凭据')
    remove_parser.add_argument('index', type=int, help='要删除的凭据索引')
    
    # 显示失败记录命令
    failures_parser = subparsers.add_parser('failures', help='显示凭据失败记录')
    
    args = parser.parse_args()
    
    # 处理命令
    if args.command == 'add':
        add_credential(args.email, args.password)
    
    elif args.command == 'list':
        creds_info = list_credentials(args.test)
        
        if creds_info:
            print("\n存储的凭据列表:")
            print(tabulate(creds_info, headers='keys', tablefmt='pretty'))
        else:
            print("没有找到存储的凭据")
    
    elif args.command == 'test':
        valid_count, total_count = test_all_credentials()
        print(f"\n凭据测试结果: {valid_count}/{total_count} 个有效")
    
    elif args.command == 'update':
        update_credential(args.index, args.email, args.password)
    
    elif args.command == 'remove':
        remove_credential(args.index)
    
    elif args.command == 'failures':
        show_credential_failures()
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
