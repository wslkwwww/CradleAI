import requests
import logging
import time
import base64
import json
from utils import ArgonHelper
from config import (
    NOVELAI_API_LOGIN, 
    NOVELAI_API_SUBSCRIPTION, 
    NOVELAI_API_GENERATE,
    REQUEST_TIMEOUT
)

# 配置日志
logger = logging.getLogger('text2image.novelai')

class NovelAIClient:
    """NovelAI API 客户端封装"""
    
    def __init__(self):
        self.access_token = None
    
    def login_with_email_password(self, email, password):
        """使用邮箱和密码登录
        
        Args:
            email: 用户邮箱
            password: 用户密码
            
        Returns:
            str: 访问令牌
            
        Raises:
            Exception: 登录失败时抛出异常
        """
        logger.info(f"使用邮箱 {email} 登录 NovelAI")
        
        try:
            # 计算 NovelAI 访问密钥
            access_key = ArgonHelper.calculate_access_key(email, password)
            logger.debug("访问密钥计算完成")
            logger.debug(f"访问密钥: {access_key[:10]}...")
            
            # 发送登录请求
            logger.debug(f"发送登录请求到: {NOVELAI_API_LOGIN}")
            response = requests.post(
                NOVELAI_API_LOGIN,
                json={"key": access_key},
                timeout=REQUEST_TIMEOUT
            )
            
            # 检查响应状态
            logger.debug(f"登录响应状态码: {response.status_code}")
            response.raise_for_status()
            
            # 解析并存储访问令牌
            data = response.json()
            logger.debug(f"登录响应: {json.dumps(data)[:100]}...")
            self.access_token = data.get('accessToken')
            
            if not self.access_token:
                raise Exception("登录响应中未找到访问令牌")
                
            logger.info("登录成功，获取到访问令牌")
            return self.access_token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"登录请求失败: {e}")
            if hasattr(e, 'response') and e.response:
                status_code = e.response.status_code
                error_text = e.response.text
                logger.error(f"状态码: {status_code}, 错误信息: {error_text}")
                
                if status_code == 401:
                    logger.error("认证失败: 可能是密钥计算不正确或者账户凭据无效")
                    raise Exception(f"登录失败: 用户名或密码错误 (401 Unauthorized)")
                elif status_code == 400:
                    logger.error("请求参数错误: 可能是请求格式不正确")
                    raise Exception(f"登录失败: 请求参数错误 (400 Bad Request)")
            raise Exception(f"登录失败: {str(e)}")
    
    def login_with_token(self, token):
        """使用令牌直接登录
        
        Args:
            token: NovelAI 访问令牌
            
        Returns:
            str: 验证通过的访问令牌
            
        Raises:
            Exception: 令牌验证失败时抛出异常
        """
        logger.info("使用令牌登录 NovelAI")
        logger.debug(f"验证令牌: {token[:10]}...")
        
        try:
            # 使用令牌验证权限
            headers = {"Authorization": f"Bearer {token}"}
            endpoint = NOVELAI_API_SUBSCRIPTION
            logger.debug(f"发送验证请求到: {endpoint}")
            
            response = requests.get(
                endpoint,
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )
            
            logger.debug(f"验证响应状态码: {response.status_code}")
            
            # 检查响应状态
            response.raise_for_status()
            
            # 验证通过，存储令牌
            self.access_token = token
            logger.info("令牌验证成功")
            return token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"令牌验证失败: {e}")
            if hasattr(e, 'response') and e.response:
                status_code = e.response.status_code
                error_text = e.response.text
                logger.error(f"状态码: {status_code}, 错误信息: {error_text}")
                
                if status_code == 401:
                    raise Exception("令牌无效或已过期 (401 Unauthorized)")
            raise Exception(f"令牌验证失败: {str(e)}")
    
    def generate_image(self, params):
        """生成图像
        
        Args:
            params: 包含生成参数的字典
            
        Returns:
            str: 生成的图像的 base64 数据 URL
            
        Raises:
            Exception: 生成失败时抛出异常
        """
        if not self.access_token:
            raise Exception("未登录，请先调用 login_with_email_password 或 login_with_token")
            
        logger.info(f"开始生成图像，参数概要: 提示词='{params.get('prompt', '')[:30]}...'")
        
        # 处理分辨率
        resolution = params.get('resolution', 'portrait')
        dimensions = params.get('dimensions') or {}
        
        # 如果没有提供明确的宽高，根据分辨率预设计算
        if not dimensions.get('width') or not dimensions.get('height'):
            from utils import resolution_to_dimensions
            dimensions = resolution_to_dimensions(resolution)
        
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
        model_name = params.get('model', 'nai-v3')
        official_model = model_map.get(model_name, model_name)
        
        logger.info(f"使用模型: {model_name} -> {official_model}")
        
        # 构建与官方 API 格式一致的请求参数
        request_data = {
            "action": "generate",
            "input": params.get('prompt', ''),
            "model": official_model,
            "parameters": {
                "width": dimensions.get('width', 832),
                "height": dimensions.get('height', 1216),
                "scale": params.get('scale', 11),
                "sampler": params.get('sampler', 'k_euler_ancestral'),
                "steps": params.get('steps', 28),
                "n_samples": params.get('batch_size', 1),
                "ucPreset": 0,  # 简单设置为0，可能需要根据实际需求调整
                "qualityToggle": False,
                "seed": params.get('seed', int(time.time() * 1000) % (2**32)),
                "sm": params.get('smea', False),
                "sm_dyn": params.get('smeaDyn', False)
            }
        }
        
        # 处理负面提示词
        negative_prompt = params.get('negative_prompt')
        if negative_prompt:
            request_data["parameters"]["negative_prompt"] = negative_prompt
        
        # 处理图像到图像的情况
        if params.get('source_image'):
            request_data["parameters"].update({
                "image": params.get('source_image', ''),
                "strength": params.get('strength', 0.7),
                "noise": params.get('noise', 0.2)
            })
        
        logger.debug(f"已构建请求数据，包含 {len(request_data.get('parameters', {}))} 个参数")
        
        # 发送请求
        try:
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "Accept": "application/octet-stream"  # 重要：告知服务器我们期望二进制响应
            }
            
            logger.info(f"发送请求到 {NOVELAI_API_GENERATE}")
            response = requests.post(
                NOVELAI_API_GENERATE,
                json=request_data,
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )
            
            # 检查响应状态
            if response.status_code != 200:
                logger.error(f"请求失败，状态码：{response.status_code}")
                try:
                    error_data = response.json()
                    logger.error(f"错误信息：{error_data}")
                    raise Exception(f"图像生成失败（{response.status_code}）: {error_data.get('message', '未知错误')}")
                except json.JSONDecodeError:
                    # 如果响应不是JSON格式
                    logger.error(f"非JSON响应：{response.text[:200]}")
                    raise Exception(f"图像生成失败（{response.status_code}）：服务器返回了非JSON格式响应")
            
            # 返回响应内容，图像的二进制数据
            content_type = response.headers.get('Content-Type', '')
            logger.info(f"响应成功，Content-Type: {content_type}")
            
            # 这里不需要修改，因为我们在task_status API中处理base64转换和图像存储
            image_data = base64.b64encode(response.content).decode('utf-8')
            logger.info("图像生成成功，数据大小：{:.2f} KB".format(len(response.content) / 1024))
            
            return f"data:image/png;base64,{image_data}"
            
        except requests.exceptions.RequestException as e:
            logger.error(f"图像生成请求失败: {e}")
            if hasattr(e, 'response') and e.response:
                status_code = e.response.status_code
                try:
                    error_text = e.response.json()
                    logger.error(f"状态码: {status_code}, JSON错误信息: {error_text}")
                except:
                    error_text = e.response.text[:200]
                    logger.error(f"状态码: {status_code}, 错误信息: {error_text}")
                
                if status_code == 401:
                    raise Exception("访问令牌无效或已过期")
                elif status_code == 400:
                    raise Exception(f"请求参数错误：{error_text}")
                elif status_code == 429:
                    raise Exception("请求过于频繁，请稍后再试")
            raise Exception(f"图像生成失败: {str(e)}")
