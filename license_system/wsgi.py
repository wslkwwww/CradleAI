# WSGI启动脚本
import sys
import os
from pathlib import Path

# 确保当前目录在Python路径中
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

# 配置环境变量
os.environ.setdefault('PYTHONPATH', str(current_dir))

# 确保日志目录存在
log_dir = current_dir / 'logs'
os.makedirs(log_dir, exist_ok=True)

# 初始化数据库
try:
    from db import db_utils
    db_utils.init_db()
    print("数据库初始化成功")
except Exception as e:
    print(f"数据库初始化失败: {e}")

# 为了解决相对导入问题，直接导入app模块
import server.app

# 导出应用实例
application = server.app.app

# 直接运行时使用
if __name__ == "__main__":
    server.app.app.run(host='0.0.0.0', port=5000)
