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
import requests
import json
import base64
from utils import ArgonHelper

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('set_credentials')

# 添加更详细的调试日志处理器
debug_handler = logging.FileHandler('novelai_auth_debug.log')
debug_handler.setLevel(logging.DEBUG)
debug_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levellevel)s - %(message)s')
debug_handler.setFormatter(debug_formatter)
logger.addHandler(debug_handler)

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

def direct_login_test(email, password):
    """使用直接API调用测试登录，绕过客户端实现
    
    用于诊断问题，显示中间结果
    """
    try:
        logger.info(f"直接API登录测试 (邮箱: {email})")
        
        # 规范化输入
        email = email.lower().strip()
        password = password.strip()
        
        # 计算访问密钥
        access_key = ArgonHelper.calculate_access_key(email, password)
        logger.info(f"计算的访问密钥: {access_key[:10]}...")
        
        # 构建API请求
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
            "Content-Type": "application/json"
        }
        
        data = {"key": access_key}
        
        logger.info("发送登录请求...")
        response = requests.post(
            "https://api.novelai.net/user/login",
            json=data,
            headers=headers,
            timeout=30
        )
        
        logger.info(f"响应状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            logger.info(f"响应内容: {json.dumps(response_data)[:100]}...")
        except:
            logger.info(f"响应不是JSON格式: {response.text[:100]}")
        
        if response.status_code == 200:
            logger.info("直接API登录成功!")
            return True
        else:
            logger.info("直接API登录失败")
            return False
            
    except Exception as e:
        logger.error(f"直接API测试失败: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='设置 NovelAI 凭据')
    parser.add_argument('--email', help='NovelAI 账号邮箱')
    parser.add_argument('--test-only', action='store_true', help='仅测试现有凭据，不更新')
    parser.add_argument('--direct-test', action='store_true', help='使用直接API调用测试登录')
    parser.add_argument('--debug', action='store_true', help='启用详细调试日志')
    
    args = parser.parse_args()
    
    # 设置调试级别
    if args.debug:
        logger.setLevel(logging.DEBUG)
        logger.debug("调试模式已启用")
    
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
    
    # 执行直接API测试
    if args.direct_test:
        direct_result = direct_login_test(email, password)
        logger.info(f"直接API测试结果: {'成功' if direct_result else '失败'}")
    
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
