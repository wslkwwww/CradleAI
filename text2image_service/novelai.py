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
    REQUEST_TIMEOUT,
    TOKEN_CACHE_FILE
)
import os
import datetime
from rate_limiter import rate_limiter  # 导入速率限制器
import random
import credentials  # 导入凭据管理模块

# 配置日志
logger = logging.getLogger('text2image.novelai')

class NovelAIClient:
    """NovelAI API 客户端封装"""
    
    def __init__(self):
        self.access_token = None
        # 令牌缓存数据结构
        self.token_cache = {}
        # 加载已缓存的令牌
        self._load_token_cache()
    
    def _load_token_cache(self):
        """从文件加载令牌缓存"""
        try:
            if os.path.exists(TOKEN_CACHE_FILE):
                with open(TOKEN_CACHE_FILE, 'r') as f:
                    self.token_cache = json.load(f)
                logger.info("已从文件加载令牌缓存")
        except Exception as e:
            logger.error(f"加载令牌缓存失败: {e}")
            self.token_cache = {}
    
    def _save_token_cache(self):
        """保存令牌缓存到文件"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(TOKEN_CACHE_FILE), exist_ok=True)
            with open(TOKEN_CACHE_FILE, 'w') as f:
                json.dump(self.token_cache, f)
            logger.info("已保存令牌缓存到文件")
        except Exception as e:
            logger.error(f"保存令牌缓存失败: {e}")
    
    def _get_cached_token(self, email):
        """获取缓存的令牌，如果有效则返回"""
        cache_key = email or "default"
        if cache_key in self.token_cache:
            token_data = self.token_cache[cache_key]
            # 获取当前时间和过期时间
            now = time.time()
            expiry = token_data.get('expiry', 0)
            # 计算距离过期还有多少天
            days_remaining = (expiry - now) / (24 * 3600)  # 转换为天数
            
            # 如果令牌还有超过10天有效期，直接返回
            if now < expiry and days_remaining > 10:
                logger.info(f"使用缓存的令牌，剩余有效期约 {days_remaining:.1f} 天")
                self.access_token = token_data['token']
                return token_data['token']
            
            # 如果令牌还有效但少于10天，标记为需要刷新
            if now < expiry:
                logger.info(f"缓存的令牌即将过期（剩余 {days_remaining:.1f} 天），将重新获取")
            else:
                logger.info(f"缓存的令牌已过期，将重新获取")
        
        return None
    
    def _cache_token(self, email, token):
        """缓存令牌"""
        cache_key = email or "default"
        # NovelAI令牌有效期为30天（2592000秒）
        expiry = time.time() + 2592000  # 当前时间 + 30天
        
        self.token_cache[cache_key] = {
            'token': token,
            'expiry': expiry,
            'timestamp': time.time()
        }
        self._save_token_cache()
        
        # 格式化时间为人类可读形式
        expiry_date = datetime.datetime.fromtimestamp(expiry).strftime('%Y-%m-%d %H:%M:%S')
        logger.info(f"令牌已缓存，有效期至: {expiry_date}")
    
    def login_with_credentials(self):
        """使用配置的凭据登录，支持多账号轮询
        
        Returns:
            str: 访问令牌
            
        Raises:
            Exception: 所有凭据都登录失败时抛出异常
        """
        # 获取当前凭据
        creds = credentials.get_credentials()
        if not creds:
            raise Exception("未配置任何有效凭据")
        
        try:
            email = creds['email']
            password = creds['password']
            index = creds.get('index', 0)
            total = creds.get('total', 1)
            
            logger.info(f"尝试使用账号 {index+1}/{total}: {email} 登录")
            
            token = self.login_with_email_password(email, password)
            if token:
                logger.info(f"账号 {index+1}/{total}: {email} 登录成功")
                return token
            
            # 标记当前账号登录失败
            credentials.mark_credential_failed(index)
            raise Exception(f"账号 {index+1}/{total}: {email} 登录失败，尝试下一个账号")
            
        except Exception as e:
            logger.error(f"使用账号 {creds['email']} 登录失败: {e}")
            
            # 标记当前账号登录失败
            credentials.mark_credential_failed(creds.get('index', 0))
            
            # 递归调用自身，尝试下一个账号
            # 为防止无限递归，检查是否还有可用账号
            if creds.get('total', 1) > 1:
                logger.info("尝试使用下一个账号...")
                return self.login_with_credentials()
            else:
                raise Exception("所有配置的账号都登录失败")
    
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
        # 首先尝试获取缓存的令牌
        cached_token = self._get_cached_token(email)
        if (cached_token):
            return cached_token
        
        logger.info(f"缓存中没有有效令牌，使用邮箱 {email} 登录 NovelAI")
        
        # 应用请求速率限制
        if not rate_limiter.wait_if_needed(is_test_request=False):
            raise Exception("请求被速率限制，请稍后再试")
        
        try:
            # 计算 NovelAI 访问密钥
            access_key = ArgonHelper.calculate_access_key(email, password)
            logger.debug("访问密钥计算完成")
            logger.debug(f"访问密钥: {access_key[:10]}...")
            
            # 增加诊断信息
            logger.debug(f"访问密钥完整内容 (用于诊断): {access_key}")
            
            # 构建请求头
            headers = {
                "User-Agent": rate_limiter.get_user_agent(),
                "Content-Type": "application/json",
                "Accept": "application/json"  # 明确指定我们想要JSON响应
            }
            
            # 构建请求体 - 使用原始密钥，不做任何处理
            request_body = {"key": access_key}
            
            # 模拟人类行为：在发送请求前加入短暂的随机延迟
            time.sleep(random.uniform(0.5, 2.0))
            
            # 发送登录请求
            logger.debug(f"发送登录请求到: {NOVELAI_API_LOGIN}")
            logger.debug(f"请求体: {json.dumps(request_body)}")
            
            response = requests.post(
                NOVELAI_API_LOGIN,
                json=request_body,
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )
            
            # 检查响应状态
            logger.debug(f"登录响应状态码: {response.status_code}")
            
            # 尝试解析响应体，即使状态码不是200
            try:
                response_data = response.json()
                logger.debug(f"登录响应内容: {json.dumps(response_data)}")
            except:
                logger.debug(f"响应不是JSON格式: {response.text[:200]}")
            
            response.raise_for_status()
            
            # 解析并存储访问令牌
            data = response.json()
            logger.debug(f"登录响应: {json.dumps(data)[:100]}...")
            self.access_token = data.get('accessToken')
            
            if not self.access_token:
                raise Exception("登录响应中未找到访问令牌")
                
            logger.info("登录成功，获取到新访问令牌")
            
            # 缓存令牌
            self._cache_token(email, self.access_token)
            
            return self.access_token
            
        except requests.exceptions.RequestException as e:
            # 请求错误后等待一段时间
            rate_limiter.wait_after_error()
            
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
        # 首先尝试从缓存中获取令牌的有效期信息
        for cache_key, token_data in self.token_cache.items():
            if token_data.get('token') == token:
                # 获取当前时间和过期时间
                now = time.time()
                expiry = token_data.get('expiry', 0)
                # 计算距离过期还有多少天
                days_remaining = (expiry - now) / (24 * 3600)  # 转换为天数
                
                # 如果令牌还有超过10天有效期，直接返回
                if now < expiry and days_remaining > 10:
                    logger.info(f"使用提供的令牌，根据缓存信息剩余有效期约 {days_remaining:.1f} 天")
                    self.access_token = token
                    return token
                
                # 如果令牌即将过期或已过期，进行验证
                if now < expiry:
                    logger.info(f"提供的令牌即将过期（剩余 {days_remaining:.1f} 天），将验证有效性")
                else:
                    logger.info(f"提供的令牌可能已过期，将验证有效性")
                break
        
        logger.info("验证提供的令牌")
        logger.debug(f"验证令牌: {token[:10]}...")
        
        # 应用请求速率限制
        if not rate_limiter.wait_if_needed(is_test_request=False):
            raise Exception("请求被速率限制，请稍后再试")
        
        try:
            # 构建请求头
            headers = {
                "Authorization": f"Bearer {token}",
                "User-Agent": rate_limiter.get_user_agent()
            }
            
            endpoint = NOVELAI_API_SUBSCRIPTION
            logger.debug(f"发送验证请求到: {endpoint}")
            
            # 模拟人类行为：在发送请求前加入短暂的随机延迟
            time.sleep(random.uniform(0.5, 1.5))
            
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
            
            # 缓存令牌（使用默认键或尝试提取用户信息）
            try:
                # 尝试从响应中提取用户邮箱
                response_data = response.json()
                user_email = response_data.get('emailVerified') or "default"
                self._cache_token(user_email, token)
            except:
                # 如果无法获取用户信息，使用默认键
                self._cache_token("default", token)
            
            return token
            
        except requests.exceptions.RequestException as e:
            # 请求错误后等待一段时间
            rate_limiter.wait_after_error()
            
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
            list: 生成的图像的文件路径列表
            
        Raises:
            Exception: 生成失败时抛出异常
        """
        # 检查是否已登录，如果没有则尝试使用配置的凭据登录
        if not self.access_token:
            try:
                self.login_with_credentials()
            except Exception as e:
                raise Exception(f"未登录且自动登录失败: {str(e)}")

        # 检查是否为测试请求
        is_test_request = params.get('is_test_request', False)
        
        # 应用请求速率限制
        if not rate_limiter.wait_if_needed(is_test_request=is_test_request):
            raise Exception(f"请求被速率限制，请稍后再试 (今日剩余配额: {rate_limiter.get_remaining_quota()})")
            
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
        
        # 检测是否使用 V4 模型
        is_v4_model = 'nai-diffusion-4' in official_model
        
        # 构建请求参数
        request_data = {
            "action": "generate",
            "input": params.get('prompt', ''),
            "model": official_model,
            "parameters": {
                "width": dimensions.get('width', 832),
                "height": dimensions.get('height', 1216),
                "scale": params.get('scale', 5.5),
                "sampler": params.get('sampler', 'k_euler_ancestral'),
                "steps": params.get('steps', 28),
                "n_samples": params.get('batch_size', 1),
                "ucPreset": 0,  # 简单设置为0，可能需要根据实际需求调整
                "seed": params.get('seed', int(time.time() * 1000) % (2**32)),
                "sm": params.get('smea', False),
                "sm_dyn": params.get('smeaDyn', False),
                "add_original_image": True,
                "legacy": False
            }
        }
        
        # 处理负面提示词
        negative_prompt = params.get('negative_prompt', '')
        
        # 对V4模型添加特殊处理
        if is_v4_model:
            # 设置V4特有的参数
            request_data["parameters"]["params_version"] = 3
            request_data["parameters"]["qualityToggle"] = True
            request_data["parameters"]["prefer_brownian"] = True
            request_data["parameters"]["autoSmea"] = False
            request_data["parameters"]["dynamic_thresholding"] = False
            request_data["parameters"]["controlnet_strength"] = 1
            request_data["parameters"]["legacy_v3_extend"] = False
            request_data["parameters"]["deliberate_euler_ancestral_bug"] = False
            
            # 修改噪声调度设置
            request_data["parameters"]["noise_schedule"] = params.get('noise_schedule', 'karras')
            
            # 处理V4的提示词结构
            characterPrompt = params.get('character_prompt', '')
            
            # 设置基本的v4_prompt结构
            request_data["parameters"]["v4_prompt"] = {
                "caption": {
                    "base_caption": params.get('prompt', ''),
                    "char_captions": [
                        {
                            "char_caption": characterPrompt,
                            "centers": [
                                {
                                    "x": 0,
                                    "y": 0
                                }
                            ]
                        }
                    ]
                },
                "use_coords": False,
                "use_order": True
            }
            
            # 设置负面提示词
            request_data["parameters"]["v4_negative_prompt"] = {
                "caption": {
                    "base_caption": negative_prompt or "blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, multiple views, logo, too many watermarks, white blank page, blank page",
                    "char_captions": [
                        {
                            "char_caption": "",
                            "centers": [
                                {
                                    "x": 0,
                                    "y": 0
                                }
                            ]
                        }
                    ]
                }
            }
            
            # 如果有角色提示词，也添加到characterPrompts
            if characterPrompt:
                request_data["parameters"]["characterPrompts"] = [
                    {
                        "prompt": characterPrompt,
                        "uc": "",
                        "center": {
                            "x": 0,
                            "y": 0
                        }
                    }
                ]
        
        # 对非V4模型设置标准的负面提示词参数
        if not is_v4_model and negative_prompt:
            request_data["parameters"]["negative_prompt"] = negative_prompt
        
        # 添加所有模型都通用的负面提示词字段
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
            # 构建请求头
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "Accept": "application/x-zip-compressed",  # 明确请求ZIP格式
                "User-Agent": rate_limiter.get_user_agent()
            }
            
            # 模拟真实用户: 添加Referer和Origin
            headers["Referer"] = "https://novelai.net/image"
            headers["Origin"] = "https://novelai.net"
            headers["sec-ch-ua"] = '"Chromium";v="106", "Google Chrome";v="106", "Not;A=Brand";v="99"'
            headers["sec-ch-ua-platform"] = '"Windows"'
            headers["sec-ch-ua-mobile"] = "?0"
            headers["Accept-Language"] = "en-US,en;q=0.9"
            
            # 模拟真实用户: 随机化请求顺序
            if random.random() < 0.3:
                # 30%的概率先请求一个常见资源，如CSS或图标
                dummy_headers = headers.copy()
                dummy_headers["Accept"] = "text/css,*/*;q=0.1"
                dummy_url = "https://novelai.net/static/css/main.css"
                logger.debug(f"发送模拟请求到 {dummy_url}")
                try:
                    requests.get(
                        dummy_url,
                        headers=dummy_headers,
                        timeout=5
                    )
                except:
                    pass  # 忽略模拟请求的错误
                
                # 添加小延迟
                time.sleep(random.uniform(0.5, 2.0))
            
            logger.info(f"发送请求到 {NOVELAI_API_GENERATE}")
            
            # 模拟真实用户：在发送主请求前的随机等待
            time.sleep(random.uniform(0.8, 2.5))
            
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
                    
                    # 401错误时尝试切换账号重新登录
                    if response.status_code == 401:
                        logger.warning("令牌无效，尝试切换账号重新登录")
                        self.access_token = None  # 清除当前令牌
                        
                        # 标记当前账号为失败
                        creds = credentials.get_credentials()
                        if creds:
                            credentials.mark_credential_failed(creds.get('index', 0))
                        
                        # 重新登录并递归调用自身
                        self.login_with_credentials()
                        return self.generate_image(params)
                    
                    raise Exception(f"图像生成失败（{response.status_code}）: {error_data.get('message', '未知错误')}")
                except json.JSONDecodeError:
                    # 如果响应不是JSON格式
                    logger.error(f"非JSON响应：{response.text[:200]}")
                    raise Exception(f"图像生成失败（{response.status_code}）：服务器返回了非JSON格式响应")
                
                # 请求错误后等待一段时间
                rate_limiter.wait_after_error()
                raise Exception(f"图像生成失败（{response.status_code}）：服务器返回错误")
            
            # 检查内容类型
            content_type = response.headers.get('Content-Type', '')
            logger.info(f"响应成功，Content-Type: {content_type}, 数据大小: {len(response.content) / 1024:.2f} KB")
            
            # 处理ZIP数据
            from utils import extract_images_from_zip
            images = extract_images_from_zip(response.content)
            
            if not images:
                logger.error("未能从响应中提取有效图像")
                raise Exception("图像生成失败：未能从响应中提取有效图像")
            
            logger.info(f"成功提取 {len(images)} 张图像")
            return images
            
        except Exception as e:
            # 请求错误后等待一段时间
            rate_limiter.wait_after_error()
            
            logger.error(f"图像生成请求失败: {e}")
            if hasattr(e, 'response') and e.response:
                status_code = e.response.status_code
                try:
                    error_text = e.response.json()
                    logger.error(f"状态码: {status_code}, JSON错误信息: {error_text}")
                except:
                    error_text = e.response.text[:200]
                    logger.error(f"状态码: {status_code}, 错误信息: {error_text}")
                
                # 401错误时尝试切换账号重新登录
                if status_code == 401:
                    logger.warning("令牌无效，尝试切换账号重新登录")
                    self.access_token = None  # 清除当前令牌
                    
                    # 标记当前账号为失败
                    creds = credentials.get_credentials()
                    if creds:
                        credentials.mark_credential_failed(creds.get('index', 0))
                    
                    # 重新登录并递归调用自身
                    try:
                        self.login_with_credentials()
                        return self.generate_image(params)
                    except Exception as login_error:
                        raise Exception(f"切换账号失败: {str(login_error)}")
                
                elif status_code == 400:
                    raise Exception(f"请求参数错误：{error_text}")
                elif status_code == 429:
                    raise Exception("请求过于频繁，请稍后再试")
            raise Exception(f"图像生成失败: {str(e)}")
