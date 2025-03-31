#!/usr/bin/env python
"""
测试支付回调脚本

此脚本用于模拟ZPay支付系统发送回调到许可证系统，用于手动测试和确认支付-许可证流程能正常工作。
"""

import os
import sys
import json
import hashlib
import argparse
import time
import uuid
import requests
from pathlib import Path

# 添加项目根目录到Python路径以支持绝对导入
current_dir = Path(__file__).parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 尝试导入配置
try:
    from server import config
    has_config = True
except ImportError:
    has_config = False
    print("警告: 无法导入配置模块，将使用命令行参数")

# 命令行参数
parser = argparse.ArgumentParser(description="测试许可证系统的ZPay支付回调")
parser.add_argument("--url", default="https://cradleintro.top/api/v1/license/payment/callback",
                    help="支付回调URL")
parser.add_argument("--email", default="test@example.com",
                    help="接收许可证的邮箱地址")
parser.add_argument("--plan", default="yearly",
                    choices=["monthly", "quarterly", "yearly", "lifetime"],
                    help="订阅计划ID")
parser.add_argument("--amount", type=float, default=140.00,
                    help="支付金额")
parser.add_argument("--pkey", 
                    default="6J3xhFQ2MzVuQI7KuWPiid2ZE5PSjYdq" if not has_config else config.ZPAY_PKEY,
                    help="ZPay商户密钥(ZPAY_PKEY)")
parser.add_argument("--pid", 
                    default="2025032112555648" if not has_config else config.ZPAY_PID,
                    help="ZPay商户ID(ZPAY_PID)")
parser.add_argument("--debug", action="store_true", help="显示调试信息")
args = parser.parse_args()

# 生成随机交易ID
transaction_id = f"test_{uuid.uuid4().hex[:10]}"

# 构造支付回调中的param参数（会被JSON编码）
param_data = {
    "email": args.email,
    "plan_type": args.plan,
    "original_amount": args.amount
}

# 构造ZPay回调表单数据
payment_data = {
    "pid": args.pid,  # 商户ID
    "trade_no": f"zpay_{uuid.uuid4().hex[:12]}",  # ZPay交易号
    "out_trade_no": transaction_id,  # 商户订单号
    "type": "alipay",  # 支付方式
    "name": f"Cradle AI {args.plan} Plan",  # 商品名称
    "money": str(args.amount),  # 支付金额
    "trade_status": "TRADE_SUCCESS",  # 交易状态
    "param": json.dumps(param_data),  # 附加参数
    "sign_type": "MD5"  # 签名类型
}

# 生成签名 (完全匹配ZPay官方SDK的方式)
params_copy = payment_data.copy()
# 移除空值参数并转换为字符串
params_filtered = {}
for k, v in params_copy.items():
    if v != '':
        params_filtered[k] = str(v)

# 按参数名ASCII码从小到大排序
param_names = sorted(params_filtered.keys())

# 拼接成URL键值对格式（严格按照ZPay的方式）
param_str = ""
for i, name in enumerate(param_names):
    if i > 0:
        param_str += "&"
    param_str += f"{name}={params_filtered[name]}"

# 将拼接好的字符串与商户密钥进行MD5加密
sign_str = param_str + args.pkey
sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest().lower()

# 添加签名到参数中
payment_data["sign"] = sign

if args.debug:
    print(f"\n调试信息:")
    print(f"参数排序后字符串: {param_str}")
    print(f"添加密钥后(密钥部分隐藏): {param_str}+{args.pkey[:4]}****")
    print(f"MD5签名: {sign}")
    # 打印完整的请求数据
    print(f"完整的请求数据: {payment_data}")

print(f"\n准备发送ZPay支付回调:")
print(f"URL: {args.url}")
print(f"交易ID: {transaction_id}")
print(f"ZPay交易号: {payment_data['trade_no']}")
print(f"计划: {args.plan}")
print(f"邮箱: {args.email}")
print(f"金额: {args.amount} CNY")
print(f"签名: {sign}")

# 发送HTTP请求（模拟表单提交）
try:
    response = requests.post(
        args.url,
        data=payment_data,
        headers={
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'ZPay Payment Gateway',
        }
    )
    
    print("\n回调响应:")
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {response.text}")
    
    # ZPay期望的响应是纯文本的"success"
    if response.status_code == 200 and response.text.strip() == "success":
        print("\n✅ 支付回调成功处理!")
        print(f"请检查邮箱 {args.email} 是否收到许可证邮件")
        print(f"您也可以查询数据库检查许可证是否生成")
    else:
        print("\n❌ 支付回调未能成功处理")
        print("请检查服务器日志了解详情")
except Exception as e:
    print(f"\n❌ 发送请求时出错: {str(e)}")

print("\n使用方法示例:")
print(f"python {os.path.basename(__file__)} --url http://localhost:5001/api/v1/license/payment/callback --email user@example.com --plan yearly --amount 140.00 --pkey YOUR_ZPAY_PKEY --debug")
