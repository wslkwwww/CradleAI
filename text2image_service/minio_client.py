import logging
import uuid
import os
import mimetypes
from minio import Minio
from minio.error import S3Error

# 配置日志
logger = logging.getLogger('text2image.minio_client')

class MinioStorage:
    """MinIO 存储服务客户端封装"""
    
    def __init__(self, endpoint, access_key, secret_key, secure=False):
        """初始化 MinIO 客户端
        
        Args:
            endpoint: MinIO 服务器地址和端口
            access_key: MinIO Access Key
            secret_key: MinIO Secret Key
            secure: 是否使用 HTTPS
        """
        self.endpoint = endpoint
        self.client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure
        )
        
        # 期望的图片 MIME 类型
        self.allowed_content_types = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/webp', 'image/bmp', 'image/tiff'
        ]
        
        logger.info(f"MinIO 客户端初始化完成，连接到: {endpoint}")
    
    def ensure_bucket_exists(self, bucket_name):
        """确保存储桶存在，不存在则创建
        
        Args:
            bucket_name: 存储桶名称
            
        Returns:
            bool: 如果存储桶存在或成功创建则返回 True
        """
        try:
            if not self.client.bucket_exists(bucket_name):
                logger.info(f"存储桶 {bucket_name} 不存在，开始创建...")
                self.client.make_bucket(bucket_name)
                logger.info(f"存储桶 {bucket_name} 创建成功")
            else:
                logger.info(f"存储桶 {bucket_name} 已存在")
            return True
        except S3Error as e:
            logger.error(f"确认/创建存储桶时出错: {e}")
            return False
    
    def upload_file(self, bucket_name, file_data, content_type=None):
        """上传文件到 MinIO
        
        Args:
            bucket_name: 存储桶名称
            file_data: 文件数据（二进制）
            content_type: 文件 MIME 类型，如未提供则自动检测
            
        Returns:
            tuple: (成功标志, 文件对象名或错误消息)
        """
        try:
            # 确保存储桶存在
            if not self.ensure_bucket_exists(bucket_name):
                return False, "无法确认存储桶存在性"
            
            # 检验内容类型
            if content_type is None:
                # 使用 Python 的 mimetypes 模块猜测
                content_type, _ = mimetypes.guess_type('temp.png')
                if content_type is None:
                    content_type = 'application/octet-stream'
            
            # 检查是否允许的图片类型
            if content_type not in self.allowed_content_types:
                return False, f"不支持的文件类型: {content_type}"
            
            # 生成唯一的文件名
            file_extension = mimetypes.guess_extension(content_type) or '.bin'
            if file_extension == '.jpe':
                file_extension = '.jpg'  # 修复 JPEG 扩展名
                
            object_name = f"novelai_{uuid.uuid4().hex}{file_extension}"
            
            # 创建临时文件
            temp_file_path = f"/tmp/{object_name}"
            with open(temp_file_path, 'wb') as f:
                f.write(file_data)
            
            # 获取文件大小
            file_size = os.path.getsize(temp_file_path)
            
            # 上传文件到 MinIO
            logger.info(f"开始上传文件 {object_name} 到存储桶 {bucket_name}...")
            self.client.fput_object(
                bucket_name=bucket_name,
                object_name=object_name,
                file_path=temp_file_path,
                content_type=content_type
            )
            
            # 删除临时文件
            os.unlink(temp_file_path)
            
            logger.info(f"文件 {object_name} 上传成功，大小: {file_size/1024:.2f} KB")
            
            # 构建访问 URL
            url = f"http://{self.endpoint}/{bucket_name}/{object_name}"
            return True, url
            
        except S3Error as e:
            logger.error(f"上传到 MinIO 时出错: {e}")
            return False, f"上传到 MinIO 时出错: {str(e)}"
        except Exception as e:
            logger.error(f"处理文件上传时出错: {e}")
            return False, f"处理文件上传时出错: {str(e)}"

    def upload_binary(self, bucket_name, binary_data, content_type=None):
        """直接上传二进制数据到 MinIO
        
        Args:
            bucket_name: 存储桶名称
            binary_data: 二进制数据
            content_type: 文件 MIME 类型，如未提供则自动检测
            
        Returns:
            tuple: (成功标志, 文件对象名或错误消息)
        """
        try:
            # 确保存储桶存在
            if not self.ensure_bucket_exists(bucket_name):
                return False, "无法确认存储桶存在性"
            
            # 检验内容类型
            if content_type is None:
                content_type = 'image/png'  # 默认为 PNG
            
            # 检查是否允许的图片类型
            if content_type not in self.allowed_content_types:
                return False, f"不支持的文件类型: {content_type}"
            
            # 生成唯一的文件名
            file_extension = mimetypes.guess_extension(content_type) or '.bin'
            if file_extension == '.jpe':
                file_extension = '.jpg'  # 修复 JPEG 扩展名
            
            object_name = f"novelai_{uuid.uuid4().hex}{file_extension}"
            
            # 上传文件到 MinIO
            from io import BytesIO
            file_data = BytesIO(binary_data)
            
            logger.info(f"开始上传二进制数据到存储桶 {bucket_name} 作为 {object_name}...")
            self.client.put_object(
                bucket_name=bucket_name,
                object_name=object_name,
                data=file_data,
                length=len(binary_data),
                content_type=content_type
            )
            
            logger.info(f"二进制数据上传成功，大小: {len(binary_data)/1024:.2f} KB")
            
            # 构建访问 URL
            url = f"http://{self.endpoint}/{bucket_name}/{object_name}"
            return True, url
            
        except S3Error as e:
            logger.error(f"上传到 MinIO 时出错: {e}")
            return False, f"上传到 MinIO 时出错: {str(e)}"
        except Exception as e:
            logger.error(f"处理二进制数据上传时出错: {e}")
            return False, f"处理二进制数据上传时出错: {str(e)}"
