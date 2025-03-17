import base64
import hashlib
import logging
import time
import os
import argon2.low_level
from hashlib import blake2b
import zipfile
import io
import uuid

# 配置日志 - 修复格式化错误
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'  # 修复: 'levellevel' -> 'levelname'
)
logger = logging.getLogger('text2image.utils')

class ArgonHelper:
    """Argon2 加密辅助类"""
    
    @staticmethod
    def generate_salt(email, password, domain):
        """生成 NovelAI 使用的盐值 - 按照官方方法使用 blake2b
        
        Args:
            email: 用户邮箱
            password: 用户密码
            domain: 盐值域名后缀
        
        Returns:
            bytes: 16字节长度的盐值
        """
        # 确保输入是小写的，NovelAI可能对邮箱不区分大小写
        email = email.lower()
        
        # 去除任何可能的空格
        email = email.strip()
        password = password.strip()
        
        # 标准化域名
        domain = domain.strip()
        
        pre_salt = f"{password[:6]}{email}{domain}"
        
        # 记录pre_salt用于调试（隐藏部分密码）
        logger.debug(f"Pre-salt composition (masked): {password[:2]}****{email}{domain}")
        
        # 使用 blake2b 计算盐值并取前 16 字节
        blake = blake2b(digest_size=16)
        blake.update(pre_salt.encode())
        return blake.digest()
    
    @staticmethod
    def calculate_access_key(email, password):
        """计算 NovelAI 接口验证所需的访问密钥 - 按照官方方法
        
        Args:
            email: 用户邮箱
            password: 用户密码
        
        Returns:
            str: 访问密钥
        """
        try:
            # 规范化输入
            email = email.lower().strip()
            password = password.strip()
            
            # 记录输入信息（隐藏敏感信息）
            masked_email = f"{email[:3]}***{email[email.find('@'):] if '@' in email else ''}"
            logger.debug(f"计算访问密钥 - 邮箱: {masked_email}, 密码长度: {len(password)}")
            
            # 生成盐值
            domain = "novelai_data_access_key"
            salt = ArgonHelper.generate_salt(email, password, domain)
            salt_hex = salt.hex()
            logger.debug(f"盐值 (hex): {salt_hex}")
            
            # 使用与官方相同的参数
            raw = argon2.low_level.hash_secret_raw(
                secret=password.encode(),
                salt=salt,
                time_cost=2,
                memory_cost=int(2000000 / 1024),  # 与官方一致，约2048
                parallelism=1,
                hash_len=64,
                type=argon2.low_level.Type.ID
            )
            
            # 使用 urlsafe_b64encode 编码结果，确保无填充
            hashed = base64.urlsafe_b64encode(raw).decode().rstrip('=')
            
            logger.debug("访问密钥计算完成")
            logger.debug(f"密钥原始长度: {len(hashed)}")
            
            # 确保密钥满足正确的长度
            result = hashed[:64]
            logger.debug(f"密钥最终长度: {len(result)}")
            
            return result  # 取前64字符
                
        except Exception as e:
            logger.error(f"访问密钥计算失败: {e}")
            raise
    
    @staticmethod
    def calculate_encryption_key(email, password):
        """计算 NovelAI 数据加密密钥 - 按照官方方法
        
        Args:
            email: 用户邮箱
            password: 用户密码
        
        Returns:
            bytes: 加密密钥的原始字节
        """
        try:
            # 生成预密钥
            pre_key = ArgonHelper.argon_hash(email, password, 128, "novelai_data_encryption_key").replace("=", "")
            
            # 使用 blake2b 处理预密钥
            blake = blake2b(digest_size=32)  # 官方使用32字节长度
            blake.update(pre_key.encode())
            
            return blake.digest()  # 返回原始字节
                
        except Exception as e:
            logger.error(f"加密密钥计算失败: {e}")
            raise
    
    @staticmethod
    def argon_hash(email, password, size, domain):
        """通用的 argon2 哈希函数 - 按照官方方法
        
        Args:
            email: 用户邮箱
            password: 用户密码
            size: 哈希长度
            domain: 盐值域名后缀
        
        Returns:
            str: base64 编码的哈希值
        """
        # 生成盐值
        salt = ArgonHelper.generate_salt(email, password, domain)
        
        # 使用与官方相同的参数
        raw = argon2.low_level.hash_secret_raw(
            password.encode(),
            salt,
            time_cost=2,
            memory_cost=int(2000000 / 1024),  # 与官方一致，约2048
            parallelism=1,
            hash_len=size,
            type=argon2.low_level.Type.ID
        )
        
        # 使用 urlsafe_b64encode 编码结果
        return base64.urlsafe_b64encode(raw).decode()

def resolution_to_dimensions(resolution):
    """将分辨率预设名称转换为宽高尺寸
    
    Args:
        resolution: 'portrait', 'landscape' 或 'square' 
    
    Returns:
        dict: 包含 width 和 height 的字典
    """
    if resolution == 'portrait':
        return {'width': 832, 'height': 1216}
    elif resolution == 'landscape':
        return {'width': 1216, 'height': 832}
    elif resolution == 'square':
        return {'width': 1024, 'height': 1024}
    else:
        # 默认返回竖图
        return {'width': 832, 'height': 1216}

def base64_to_image_url(base64_data, mime_type='image/png'):
    """将 base64 转换为图像数据 URL
    
    Args:
        base64_data: base64 编码的图像数据
        mime_type: 图像 MIME 类型
    
    Returns:
        str: 图像数据 URL
    """
    if base64_data.startswith('data:'):
        return base64_data
    
    # 检查base64数据长度，如果太长可能导致客户端问题
    if len(base64_data) > 1000000:  # 约1MB的base64数据
        logger.warning(f"Base64数据过大: {len(base64_data)} 字符，可能导致客户端性能问题")
    
    return f"data:{mime_type};base64,{base64_data}"

def save_base64_as_image(base64_data, output_path):
    """将base64数据保存为图像文件
    
    Args:
        base64_data: base64编码的图像数据
        output_path: 输出文件路径
        
    Returns:
        str: 输出文件路径
    """
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # 解码并保存图像
        with open(output_path, 'wb') as f:
            f.write(base64.b64decode(base64_data))
            
        logger.info(f"图像已保存到: {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"保存图像失败: {e}")
        raise

def extract_images_from_zip(zip_data):
    """从 ZIP 数据中提取图像
    
    Args:
        zip_data: ZIP 文件的二进制内容
        
    Returns:
        list: 包含提取的图像数据的列表
    """
    try:
        # 创建 IO 缓冲区来处理 ZIP 数据
        zip_buffer = io.BytesIO(zip_data)
        
        # 打开 ZIP 文件
        images = []
        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
            # 列出 ZIP 中的所有文件
            file_list = zip_ref.namelist()
            logger.info(f"ZIP 文件中包含 {len(file_list)} 个文件: {file_list}")
            
            # 提取所有文件
            for file_name in file_list:
                # 检查是否为图像文件
                if file_name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    image_data = zip_ref.read(file_name)
                    images.append({
                        'name': file_name,
                        'data': image_data
                    })
        
        logger.info(f"已成功从 ZIP 文件中提取 {len(images)} 张图像")
        return images
    except zipfile.BadZipFile:
        logger.error("无效的 ZIP 文件数据")
        return []
    except Exception as e:
        logger.error(f"提取图像时出错: {e}")
        return []

def save_binary_image(image_data, output_path):
    """将二进制图像数据保存为文件
    
    Args:
        image_data: 二进制图像数据
        output_path: 输出文件路径
        
    Returns:
        str: 输出文件路径
    """
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # 保存图像
        with open(output_path, 'wb') as f:
            f.write(image_data)
            
        logger.info(f"图像已保存到: {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"保存图像失败: {e}")
        raise

def get_content_type(file_extension):
    """根据文件扩展名获取 MIME 类型
    
    Args:
        file_extension: 文件扩展名
        
    Returns:
        str: MIME 类型
    """
    extension = file_extension.lower()
    
    if extension.endswith('.jpg') or extension.endswith('.jpeg'):
        return 'image/jpeg'
    elif extension.endswith('.png'):
        return 'image/png'
    elif extension.endswith('.gif'):
        return 'image/gif'
    elif extension.endswith('.webp'):
        return 'image/webp'
    elif extension.endswith('.bmp'):
        return 'image/bmp'
    else:
        return 'application/octet-stream'

def is_allowed_image_type(content_type):
    """检查是否允许的图片类型
    
    Args:
        content_type: MIME 类型
        
    Returns:
        bool: 是否允许
    """
    allowed_types = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
        'image/webp', 'image/bmp', 'image/tiff'
    ]
    return content_type in allowed_types
