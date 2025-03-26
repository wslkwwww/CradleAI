import multiprocessing

# 绑定地址和端口 - 使用5001端口避免与Nginx冲突
bind = "127.0.0.1:5001"

# 工作进程数 - 通常设置为 CPU 核心数的 2-4 倍
workers = multiprocessing.cpu_count() * 2 + 1

# 工作模式
worker_class = "gthread"
threads = 2

# 超时设置
timeout = 60
keepalive = 5

# 日志设置
accesslog = "/www/wwwlogs/gunicorn_access.log"
errorlog = "/www/wwwlogs/gunicorn_error.log"
loglevel = "info"

# 进程名称
proc_name = "license_api"
