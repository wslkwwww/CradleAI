#!/usr/bin/env python
"""
ZPay签名调试脚本

此脚本用于调试ZPay的签名生成和验证过程，帮助排查签名不匹配的问题。
"""

import sys
import json
import hashlib
from pathlib import Path

# 添加项目根目录到Python路径以支持绝对导入
current_dir = Path(__file__).parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 示例参数
params = {
    'pid': '2025032112555648',
    'trade_no': 'zpay_64c1ab753187',
    'out_trade_no': 'test_eac846edfa',
    'type': 'alipay',
    'name': 'Cradle AI yearly Plan',
    'money': '140.0',
    'trade_status': 'TRADE_SUCCESS',
    'param': '{"email": "943113638@qq.com", "plan_type": "yearly", "original_amount": 140.0}',
    'sign_type': 'MD5',
    'sign': '3d8835902f4a2af56721c8bcdf7e430f'
}

pkey = '6J3xhFQ2MzVuQI7KuWPiid2ZE5PSjYdq'

def generate_signature(params, key):
    """按照ZPay文档生成签名"""
    # 复制并移除sign和sign_type
    params_copy = params.copy()
    if 'sign' in params_copy:
        params_copy.pop('sign')
    if 'sign_type' in params_copy:
        params_copy.pop('sign_type')
    
    # 移除空值参数
    params_copy = {k: v for k, v in params_copy.items() if v != ''}
    
    # 按参数名ASCII码从小到大排序
    param_names = sorted(params_copy.keys())
    
    # 拼接成URL键值对格式
    param_str = '&'.join([f"{name}={params_copy[name]}" for name in param_names])
    
    # 拼接商户密钥并进行MD5加密
    sign_str = param_str + key
    sign = hashlib.md5(sign_str.encode()).hexdigest().lower()
    
    return sign, param_str, sign_str

def generate_zpay_signature(params, key):
    """严格按照ZPay官方SDK实现签名生成"""
    # 复制并移除sign和sign_type
    params_copy = params.copy()
    if 'sign' in params_copy:
        params_copy.pop('sign')
    if 'sign_type' in params_copy:
        params_copy.pop('sign_type')
    
    # 将参数值转为字符串并移除空值
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
    
    # 拼接商户密钥并进行MD5加密
    sign_str = param_str + key
    sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest().lower()
    
    return sign, param_str, sign_str

# 模拟签名过程
calculated_sign, param_str, sign_str = generate_signature(params, pkey)

print(f"手动检查签名计算过程:")
print(f"1. 原始参数：{json.dumps(params, ensure_ascii=False)}")
print(f"2. 移除sign和sign_type后的参数：{json.dumps({k: v for k, v in params.items() if k not in ['sign', 'sign_type']}, ensure_ascii=False)}")
print(f"3. 按参数名ASCII排序并拼接：\n   {param_str}")
print(f"4. 添加密钥后（仅显示前10个字符）：\n   {param_str}+{pkey[:4]}****")
print(f"5. 计算得到的签名：{calculated_sign}")
print(f"6. 收到的签名：{params['sign']}")
print(f"7. 签名是否匹配：{'是' if calculated_sign == params['sign'] else '否'}")

# 检查签名字符串中是否有特殊字符
special_chars = []
for i, char in enumerate(param_str):
    if ord(char) < 32 or ord(char) > 126:
        special_chars.append((i, char, ord(char), param_str[i-5:i+5]))

if special_chars:
    print("\n发现特殊字符:")
    for pos, char, code, context in special_chars:
        print(f"位置 {pos}: '{char}' (Unicode {code}), 上下文: '{context}'")

# 尝试不同的签名方法
print("\n尝试其他签名计算方法:")

# 方法1: 使用 UTF-8 编码
sign_str_1 = param_str + pkey
sign_1 = hashlib.md5(sign_str_1.encode('utf-8')).hexdigest().lower()
print(f"方法1 (UTF-8编码): {sign_1}")

# 方法2: 使用 GBK 编码
try:
    sign_str_2 = param_str + pkey
    sign_2 = hashlib.md5(sign_str_2.encode('gbk')).hexdigest().lower()
    print(f"方法2 (GBK编码): {sign_2}")
except Exception as e:
    print(f"方法2 (GBK编码) 失败: {str(e)}")

# 方法3: 确保参数值使用双引号
params_copy3 = params.copy()
if 'sign' in params_copy3:
    params_copy3.pop('sign')
if 'sign_type' in params_copy3:
    params_copy3.pop('sign_type')

# 处理json参数，确保json也使用双引号
for k, v in params_copy3.items():
    if k == 'param' and v.startswith('{'):
        # 重新解析并序列化json，确保使用双引号
        try:
            json_data = json.loads(v)
            params_copy3[k] = json.dumps(json_data, ensure_ascii=False)
        except:
            pass

param_names3 = sorted(params_copy3.keys())
param_str_3 = '&'.join([f"{name}={params_copy3[name]}" for name in param_names3])
sign_str_3 = param_str_3 + pkey
sign_3 = hashlib.md5(sign_str_3.encode()).hexdigest().lower()
print(f"方法3 (处理JSON参数): {sign_3}")

# 方法4: 反向解析签名
def find_key_from_sign(sign, param_str):
    """尝试找出能生成给定签名的密钥"""
    # 遍历一些可能的情况
    cases = [
        (param_str, ""),  # 没有密钥
        (param_str, pkey),  # 正常密钥
        (param_str.replace(' ', '+'), pkey),  # 空格替换为+
        (param_str.replace(' ', '%20'), pkey),  # 空格替换为%20
        (param_str.replace('"', "'"), pkey),  # 双引号替换为单引号
    ]
    
    for case_str, case_key in cases:
        test_str = case_str + case_key
        test_sign = hashlib.md5(test_str.encode()).hexdigest().lower()
        if test_sign == sign:
            return f"匹配: {case_str}+{case_key}"
    
    return "未找到匹配的密钥"

print(f"方法4 (反向解析签名): {find_key_from_sign(params['sign'], param_str)}")

# 方法5: 测试URL编码
import urllib.parse
params_copy = params.copy()
if 'sign' in params_copy:
    params_copy.pop('sign')
if 'sign_type' in params_copy:
    params_copy.pop('sign_type')
param_names = sorted(params_copy.keys())
param_str_5 = '&'.join([f"{name}={urllib.parse.quote(str(params_copy[name]))}" for name in param_names])
sign_str_5 = param_str_5 + pkey
sign_5 = hashlib.md5(sign_str_5.encode()).hexdigest().lower()
print(f"方法5 (URL编码): {sign_5}")

# 检查ZPay文档中是否有特殊规定
print("\nZPay文档中的签名要求:")
print("1. 将发送或接收到的所有参数按照参数名ASCII码从小到大排序")
print("2. 将排序后的参数拼接成URL键值对的格式，例如 a=b&c=d&e=f，参数值不要进行url编码")
print("3. 再将拼接好的字符串与商户密钥KEY进行MD5加密得出sign签名参数")
print("4. sign = md5(a=b&c=d&e=f+KEY), 注意+为字符串拼接符，不是字符")

print("\n使用ZPay官方SDK实现的签名算法:")
sdk_sign, sdk_param_str, sdk_sign_str = generate_zpay_signature(params, pkey)
print(f"1. 参数拼接字符串:\n   {sdk_param_str}")
print(f"2. 添加密钥后(密钥部分隐藏):\n   {sdk_param_str}+{pkey[:4]}****")
print(f"3. 计算得到的签名: {sdk_sign}")
print(f"4. 收到的签名: {params['sign']}")
print(f"5. 签名是否匹配: {'是' if sdk_sign == params['sign'].lower() else '否'}")

if sdk_sign != params['sign'].lower():
    print("\n分析差异:")
    # 检查两种方法参数拼接的差异
    if param_str != sdk_param_str:
        print(f"参数拼接不一致:")
        print(f"原方法: {param_str}")
        print(f"SDK方法: {sdk_param_str}")
    else:
        print("参数拼接一致，可能是编码或密钥问题")
