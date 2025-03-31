"""
修复数据库中的损坏许可证
"""
import os
import sys
import argon2
import logging
from pathlib import Path
import time
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent))

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 导入需要的模块
from db import db_utils
from server import config
from server.license_generator import LicenseGenerator

def fix_licenses(verify=False, fix=False, license_key=None):
    """
    检查并修复数据库中的许可证
    
    Args:
        verify: 是否验证许可证有效性
        fix: 是否修复损坏的许可证
        license_key: 指定许可证密钥，如果为None则检查所有许可证
    """
    # 初始化数据库
    logger.info("初始化数据库...")
    db_utils.init_db()
    
    # 获取数据库连接
    conn = db_utils.get_db_connection()
    
    try:
        # 查询许可证
        if license_key:
            logger.info(f"查询指定许可证: {license_key}")
            cur = conn.execute('SELECT * FROM licenses WHERE code = ?', (license_key,))
        else:
            logger.info("查询所有许可证...")
            cur = conn.execute('SELECT * FROM licenses')
        
        licenses = cur.fetchall()
        
        if not licenses:
            logger.warning("未找到许可证")
            return
        
        logger.info(f"找到 {len(licenses)} 个许可证")
        
        # 创建Argon2密码哈希器
        ph = argon2.PasswordHasher(
            time_cost=config.KEY_DERIVATION_TIME_COST,
            memory_cost=config.KEY_DERIVATION_MEMORY_COST,
            parallelism=config.KEY_DERIVATION_PARALLELISM,
            hash_len=config.KEY_DERIVATION_HASH_LEN
        )
        
        # 遍历许可证
        fixed_count = 0
        broken_count = 0
        
        for license_data in licenses:
            license_id = license_data['id']
            license_key = license_data['code']
            has_hash = bool(license_data['hash'])
            has_salt = bool(license_data['salt'])
            is_active = bool(license_data['is_active'])
            plan_id = license_data['plan_id']
            
            # 格式化创建和过期时间
            created_at = datetime.fromtimestamp(license_data['created_at']).strftime('%Y-%m-%d %H:%M:%S')
            expires_at = (
                datetime.fromtimestamp(license_data['expires_at']).strftime('%Y-%m-%d %H:%M:%S') 
                if license_data['expires_at'] else '永久'
            )
            
            logger.info(f"许可证 {license_key} (ID: {license_id}):")
            logger.info(f"  计划: {plan_id}")
            logger.info(f"  创建时间: {created_at}")
            logger.info(f"  过期时间: {expires_at}")
            logger.info(f"  状态: {'激活' if is_active else '已撤销'}")
            logger.info(f"  哈希值: {'存在' if has_hash else '缺失'}")
            logger.info(f"  盐值: {'存在' if has_salt else '缺失'}")
            
            # 检查是否损坏
            is_broken = not has_hash
            
            if is_broken:
                broken_count += 1
                logger.warning(f"  状态: 损坏 (缺少哈希值)")
                
                # 如果需要修复
                if fix:
                    try:
                        # 重新计算哈希值
                        master_key = config.MASTER_KEY
                        key_material = f"{license_key}:{master_key}"
                        new_hash = ph.hash(key_material)
                        
                        # 更新哈希值
                        conn.execute(
                            'UPDATE licenses SET hash = ? WHERE id = ?',
                            (new_hash, license_id)
                        )
                        conn.commit()
                        
                        logger.info(f"  修复: 成功 (已更新哈希值)")
                        fixed_count += 1
                    except Exception as e:
                        logger.error(f"  修复失败: {str(e)}")
            
            # 如果需要验证
            if verify and not is_broken:
                try:
                    # 验证哈希值
                    master_key = config.MASTER_KEY
                    key_material = f"{license_key}:{master_key}"
                    stored_hash = license_data['hash']
                    
                    ph.verify(stored_hash, key_material)
                    logger.info(f"  验证: 成功")
                except Exception as e:
                    logger.error(f"  验证失败: {str(e)}")
                    broken_count += 1
                    
                    # 如果需要修复
                    if fix:
                        try:
                            # 重新计算哈希值
                            new_hash = ph.hash(key_material)
                            
                            # 更新哈希值
                            conn.execute(
                                'UPDATE licenses SET hash = ? WHERE id = ?',
                                (new_hash, license_id)
                            )
                            conn.commit()
                            
                            logger.info(f"  修复: 成功 (已更新哈希值)")
                            fixed_count += 1
                        except Exception as e:
                            logger.error(f"  修复失败: {str(e)}")
            
            logger.info("")  # 空行分隔
        
        # 输出统计信息
        logger.info(f"扫描完成: 共 {len(licenses)} 个许可证")
        logger.info(f"损坏许可证: {broken_count} 个")
        if fix:
            logger.info(f"已修复: {fixed_count} 个")
        
    except Exception as e:
        logger.error(f"检查许可证时出错: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="检查并修复数据库中的许可证")
    parser.add_argument("--verify", action="store_true", help="验证许可证有效性")
    parser.add_argument("--fix", action="store_true", help="修复损坏的许可证")
    parser.add_argument("--license", help="指定许可证密钥")
    
    args = parser.parse_args()
    
    # 设置MASTER_KEY环境变量（如果未设置）
    if "LICENSE_MASTER_KEY" not in os.environ:
        os.environ["LICENSE_MASTER_KEY"] = "test_master_key_for_testing_purposes_only"
    
    fix_licenses(args.verify, args.fix, args.license)
