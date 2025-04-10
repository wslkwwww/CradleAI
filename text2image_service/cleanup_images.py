#!/usr/bin/env python
"""清理过期图片文件

此脚本可以作为定时任务运行，定期清理过期的图片文件，
防止存储空间占用过大。
"""

import os
import logging
import datetime
import argparse
from config import IMAGES_FOLDER, IMAGE_EXPIRY_DAYS

# 配置日志
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('cleanup_images')

def cleanup_old_images(images_dir, days_to_keep=7, dry_run=False):
    """清理超过指定天数的图片文件
    
    Args:
        images_dir: 图片存储目录
        days_to_keep: 保留的天数（默认7天）
        dry_run: 是否只是模拟运行而不实际删除文件
    
    Returns:
        int: 已清理的文件数量
    """
    if not os.path.exists(images_dir):
        logger.warning(f"目录不存在: {images_dir}")
        return 0
    
    cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days_to_keep)
    cutoff_timestamp = cutoff_date.timestamp()
    
    count = 0
    for filename in os.listdir(images_dir):
        filepath = os.path.join(images_dir, filename)
        
        # 跳过目录
        if os.path.isdir(filepath):
            continue
            
        # 检查文件修改时间
        file_mtime = os.path.getmtime(filepath)
        if file_mtime < cutoff_timestamp:
            if dry_run:
                logger.info(f"将删除 {filepath} (修改于 {datetime.datetime.fromtimestamp(file_mtime)})")
            else:
                try:
                    os.remove(filepath)
                    logger.info(f"已删除 {filepath}")
                    count += 1
                except Exception as e:
                    logger.error(f"删除 {filepath} 失败: {e}")
    
    return count

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='清理过期图片文件')
    parser.add_argument('--days', type=int, default=IMAGE_EXPIRY_DAYS,
                        help=f'保留的天数（默认 {IMAGE_EXPIRY_DAYS} 天）')
    parser.add_argument('--dir', type=str, default=IMAGES_FOLDER,
                        help=f'图片目录（默认 {IMAGES_FOLDER}）')
    parser.add_argument('--dry-run', action='store_true',
                        help='只显示要删除的文件，不实际删除')
    
    args = parser.parse_args()
    
    logger.info(f"开始清理超过 {args.days} 天的图片文件，目录: {args.dir}")
    if args.dry_run:
        logger.info("模拟运行模式（不会实际删除文件）")
        
    count = cleanup_old_images(args.dir, args.days, args.dry_run)
    
    logger.info(f"{'将删除' if args.dry_run else '已删除'} {count} 个文件")
