import requests
import json
import argparse
import time
import logging
import base64
from utils import ArgonHelper

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test_api')

def get_token(email, password):
    """使用邮箱密码获取令牌"""
    try:
        # 计算访问密钥
        access_key = ArgonHelper.calculate_access_key(email, password)
        logger.info("访问密钥计算成功")
        
        # 发送登录请求
        response = requests.post(
            'https://api.novelai.net/user/login',
            json={"key": access_key},
            timeout=30
        )
        
        response.raise_for_status()
        data = response.json()
        return data.get('accessToken')
    
    except Exception as e:
        logger.error(f"登录失败: {e}")
        return None

def test_generate(token, prompt, model='nai-v3'):
    """测试图像生成接口"""
    # 映射简写模型名到官方模型名
    model_map = {
        'nai': 'nai-diffusion',
        'nai-v1': 'nai-diffusion',
        'nai-v2': 'nai-diffusion-2',
        'nai-v3': 'nai-diffusion-3',
        'nai-v4-preview': 'nai-diffusion-4-curated-preview',
        'nai-v4-full': 'nai-diffusion-4-full',
        'safe': 'safe-diffusion',
        'furry': 'nai-diffusion-furry',
    }
    
    # 获取正确的模型名称
    official_model = model_map.get(model, model)
    
    # 构建完全符合官方要求的请求体
    request_data = {
        "action": "generate",
        "input": prompt,
        "model": official_model,  # 使用映射后的官方模型名
        "parameters": {
            "width": 832,
            "height": 1216,
            "scale": 11,
            "sampler": "k_euler_ancestral",
            "steps": 28,
            "n_samples": 1,
            "ucPreset": 0,
            "qualityToggle": False,
            "seed": int(time.time() * 1000) % (2**32)
        }
    }
    
    # 设置请求头
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/octet-stream"  # 请求二进制响应
    }
    
    logger.info(f"发送请求到 https://image.novelai.net/ai/generate-image")
    logger.info(f"请求数据: {json.dumps(request_data, indent=2)}")
    
    try:
        response = requests.post(
            'https://image.novelai.net/ai/generate-image',
            json=request_data,
            headers=headers,
            timeout=60
        )
        
        # 分析响应
        logger.info(f"响应状态码: {response.status_code}")
        logger.info(f"响应头: {response.headers}")
        
        if response.status_code == 200:
            # 保存图像
            with open('test_output.png', 'wb') as f:
                f.write(response.content)
            logger.info("图像已保存为 test_output.png")
            return True
        else:
            try:
                error_data = response.json()
                logger.error(f"错误响应: {error_data}")
            except:
                logger.error(f"错误响应（非JSON）: {response.text[:200]}")
            return False
    
    except Exception as e:
        logger.error(f"请求失败: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='测试 NovelAI API')
    parser.add_argument('--token', help='NovelAI 访问令牌')
    parser.add_argument('--email', help='NovelAI 账号邮箱')
    parser.add_argument('--password', help='NovelAI 账号密码')
    parser.add_argument('--prompt', default='A beautiful landscape, high quality', help='提示词')
    parser.add_argument('--model', default='nai-v3', help='模型名称')
    
    args = parser.parse_args()
    
    # 获取令牌
    token = args.token
    if not token and args.email and args.password:
        logger.info("使用邮箱密码登录...")
        token = get_token(args.email, args.password)
        if not token:
            logger.error("登录失败，无法获取令牌")
            return
    
    if not token:
        logger.error("未提供令牌，且未能通过邮箱密码获取令牌")
        return
        
    # 测试生成
    logger.info(f"使用令牌: {token[:10]}...")
    success = test_generate(token, args.prompt, args.model)
    
    if success:
        logger.info("测试成功！")
    else:
        logger.error("测试失败！")

if __name__ == "__main__":
    main()
