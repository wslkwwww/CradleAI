#!/usr/bin/env python
"""
设置 NovelAI 凭据

此脚本用于安全地设置和存储 NovelAI 的账号密码，
供服务端使用。凭据将被保存在安全的位置，
并且仅允许服务进程访问。
"""

import argparse
import getpass
import logging
import sys
import os
import credentials
from novelai import NovelAIClient

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('set_credentials')

def test_credentials(email, password):
    """测试 NovelAI 凭据是否有效
    
    Args:
        email: NovelAI 账号邮箱
        password: NovelAI 账号密码
        
    Returns:
        bool: 凭据是否有效
    """
    logger.info(f"测试 NovelAI 凭据 (邮箱: {email})")
    
    try:
        # 创建客户端并尝试登录
        client = NovelAIClient()
        token = client.login_with_email_password(email, password)
        
        if token:
            logger.info("认证成功！凭据有效")
            return True
        else:
            logger.error("认证失败，未能获取有效令牌")
            return False
    except Exception as e:
        logger.error(f"认证失败: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='设置 NovelAI 凭据')
    parser.add_argument('--email', help='NovelAI 账号邮箱')
    parser.add_argument('--test-only', action='store_true', help='仅测试现有凭据，不更新')
    
    args = parser.parse_args()
    
    # 如果只是测试现有凭据
    if args.test_only:
        if credentials.has_credentials():
            creds = credentials.get_credentials()
            result = test_credentials(creds['email'], creds['password'])
            sys.exit(0 if result else 1)
        else:
            logger.error("未找到凭据配置，无法测试")
            sys.exit(1)
    
    # 获取邮箱
    email = args.email
    if not email:
        email = input("请输入 NovelAI 账号邮箱: ")
    
    # 安全获取密码
    password = getpass.getpass("请输入 NovelAI 账号密码: ")
    
    # 测试凭据
    if test_credentials(email, password):
        # 保存凭据
        if credentials.save_credentials(email, password):
            logger.info("凭据已成功保存")
            sys.exit(0)
        else:
            logger.error("保存凭据失败")
            sys.exit(1)
    else:
        logger.error("无效的凭据，未保存")
        sys.exit(1)

if __name__ == "__main__":
    main()
