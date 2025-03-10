"""
请求速率限制和人类行为模拟模块

该模块管理向NovelAI API发送请求的速率、时间分布和行为模式，
确保请求符合人类使用模式，避免被反机器人系统检测。
"""

import time
import random
import logging
import datetime
import threading
import pytz
import os
import json
from collections import deque
from config import (
    RATE_LIMIT_DAILY,
    RATE_LIMIT_MIN_INTERVAL,
    RATE_LIMIT_MAX_INTERVAL,
    RATE_LIMIT_ERROR_COOLDOWN_MIN,
    RATE_LIMIT_ERROR_COOLDOWN_MAX,
    RATE_LIMIT_MAX_RETRIES
)

# 配置日志
logger = logging.getLogger('text2image.rate_limiter')

class RateLimiter:
    """请求速率限制器，模拟人类使用行为"""
    
    def __init__(self, 
                 daily_limit=RATE_LIMIT_DAILY, 
                 min_interval=RATE_LIMIT_MIN_INTERVAL, 
                 max_interval=RATE_LIMIT_MAX_INTERVAL,
                 error_cooldown_min=RATE_LIMIT_ERROR_COOLDOWN_MIN,
                 error_cooldown_max=RATE_LIMIT_ERROR_COOLDOWN_MAX,
                 max_retries=RATE_LIMIT_MAX_RETRIES,
                 cache_file=None):
        """初始化速率限制器
        
        Args:
            daily_limit: 每日最大请求次数
            min_interval: 两次请求之间的最小间隔（秒）
            max_interval: 两次请求之间的最大间隔（秒）
            error_cooldown_min: 错误后最小冷却时间（秒）
            error_cooldown_max: 错误后最大冷却时间（秒）
            max_retries: 最大重试次数
            cache_file: 用于存储请求历史记录的文件路径
        """
        self.daily_limit = daily_limit
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.error_cooldown_min = error_cooldown_min
        self.error_cooldown_max = error_cooldown_max
        self.max_retries = max_retries
        
        # 存储请求时间的队列
        self.request_times = deque(maxlen=daily_limit)
        self.last_request_time = 0
        
        # 用于线程安全
        self.lock = threading.RLock()
        
        # 请求统计
        self.daily_stats = {}
        self.current_day = self._get_sg_date()
        
        # 缓存文件路径
        self.cache_file = cache_file or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'cache', 
            'rate_limiter_stats.json'
        )
        
        # 载入历史数据
        self._load_stats()
        
        # 启动定时清理过期统计数据的线程
        self._start_cleaner_thread()
        
        logger.info(f"速率限制器初始化完成。每日限制: {daily_limit}次, 间隔: {min_interval}-{max_interval}秒")
    
    def _get_sg_date(self):
        """获取新加坡时间的当前日期字符串"""
        sg_tz = pytz.timezone('Asia/Singapore')
        sg_time = datetime.datetime.now(sg_tz)
        return sg_time.strftime('%Y-%m-%d')
    
    def _get_sg_hour(self):
        """获取新加坡时间的当前小时"""
        sg_tz = pytz.timezone('Asia/Singapore')
        sg_time = datetime.datetime.now(sg_tz)
        return sg_time.hour
    
    def _load_stats(self):
        """从文件加载统计数据"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r') as f:
                    data = json.load(f)
                    self.daily_stats = data.get('daily_stats', {})
                    
                    # 加载今日请求时间
                    today = self._get_sg_date()
                    if today in self.daily_stats:
                        self.request_times = deque(self.daily_stats[today].get('request_times', []), 
                                                  maxlen=self.daily_limit)
                    
                    logger.info(f"已从 {self.cache_file} 加载历史统计数据")
        except Exception as e:
            logger.error(f"加载请求统计数据失败: {e}")
            self.daily_stats = {}
    
    def _save_stats(self):
        """保存统计数据到文件"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
            
            # 更新当前日期的请求次数
            today = self._get_sg_date()
            if today not in self.daily_stats:
                self.daily_stats[today] = {'count': 0, 'request_times': []}
            
            self.daily_stats[today]['count'] = len(self.request_times)
            self.daily_stats[today]['request_times'] = list(self.request_times)
            
            with open(self.cache_file, 'w') as f:
                json.dump({'daily_stats': self.daily_stats}, f)
                
            logger.debug(f"已保存请求统计数据到 {self.cache_file}")
        except Exception as e:
            logger.error(f"保存请求统计数据失败: {e}")
    
    def _start_cleaner_thread(self):
        """启动清理过期统计数据的线程"""
        def cleaner():
            while True:
                try:
                    # 每天凌晨检查一次
                    time.sleep(3600 * 6)  # 每6小时
                    
                    with self.lock:
                        # 检查当前日期
                        current_date = self._get_sg_date()
                        if current_date != self.current_day:
                            logger.info(f"日期已变更: {self.current_day} -> {current_date}")
                            self.current_day = current_date
                            
                        # 删除30天前的数据
                        cutoff_date = (datetime.datetime.now() - datetime.timedelta(days=30)).strftime('%Y-%m-%d')
                        keys_to_remove = [k for k in self.daily_stats.keys() if k < cutoff_date]
                        for key in keys_to_remove:
                            del self.daily_stats[key]
                        
                        if keys_to_remove:
                            logger.info(f"已清理 {len(keys_to_remove)} 天的过期统计数据")
                            self._save_stats()
                        
                except Exception as e:
                    logger.error(f"清理统计数据时出错: {e}")
        
        thread = threading.Thread(target=cleaner, daemon=True)
        thread.start()
    
    def _check_rate_limit(self):
        """检查是否达到速率限制"""
        with self.lock:
            # 检查当前日期，如果是新的一天，清空请求记录
            current_date = self._get_sg_date()
            if current_date != self.current_day:
                logger.info(f"日期已变更: {self.current_day} -> {current_date}")
                self.current_day = current_date
                self.request_times.clear()
            
            # 检查今天的请求次数是否达到限制
            return len(self.request_times) >= self.daily_limit
    
    def _should_throttle_by_time_window(self, is_test_request=False):
        """根据时间窗口判断是否应该限制请求
        
        Args:
            is_test_request: 是否为测试请求(测试请求不受时间窗口限制)
            
        Returns:
            tuple: (是否应该限制, 原因)
        """
        # 测试请求不受时间窗口限制
        if is_test_request:
            return False, "测试请求"
        
        # 获取新加坡时间的小时
        hour = self._get_sg_hour()
        
        # 定义允许请求的时间窗口(新加坡时间)
        # 早上 6:00-9:00, 中午 12:00-14:00, 晚上 19:00-23:00
        allowed_windows = [
            (6, 9),    # 早上
            (12, 14),  # 中午
            (19, 23),  # 晚上
        ]
        
        # 检查当前时间是否在允许的窗口内
        in_allowed_window = any(start <= hour < end for start, end in allowed_windows)
        
        if not in_allowed_window:
            window_str = ", ".join([f"{start}:00-{end}:00" for start, end in allowed_windows])
            return True, f"当前时间 {hour}:XX 不在允许的时间窗口 ({window_str}) 内"
        
        return False, None
    
    def _get_next_interval(self, is_error=False):
        """获取下一次请求的等待间隔
        
        Args:
            is_error: 是否因为错误而等待
            
        Returns:
            float: 等待时间(秒)
        """
        if is_error:
            return random.uniform(self.error_cooldown_min, self.error_cooldown_max)
        else:
            # 加入轻微的随机化，模拟人类行为
            base_interval = random.uniform(self.min_interval, self.max_interval)
            # 有10%的概率增加一些额外等待时间（浏览页面、思考等）
            if random.random() < 0.1:
                extra_time = random.uniform(5, 20)
                logger.debug(f"增加额外等待时间 {extra_time:.1f} 秒")
                base_interval += extra_time
            return base_interval
    
    def wait_if_needed(self, is_test_request=False):
        """如果需要，等待适当的时间再发送请求
        
        Args:
            is_test_request: 是否为测试请求(测试请求不受时间窗口限制)
            
        Returns:
            bool: 是否允许发送请求
        """
        with self.lock:
            # 检查是否达到每日限制
            if self._check_rate_limit():
                logger.warning(f"已达到每日请求限制 ({self.daily_limit}次)")
                return False
            
            # 检查时间窗口限制
            should_throttle, reason = self._should_throttle_by_time_window(is_test_request)
            if should_throttle:
                logger.warning(f"请求被时间窗口限制: {reason}")
                return False
            
            # 计算需要等待的时间
            now = time.time()
            elapsed = now - self.last_request_time
            
            # 获取下一次请求的等待间隔
            next_interval = self._get_next_interval()
            
            if elapsed < next_interval:
                wait_time = next_interval - elapsed
                logger.info(f"等待 {wait_time:.2f} 秒后发送请求")
                time.sleep(wait_time)
            
            # 更新最后请求时间
            self.last_request_time = time.time()
            
            # 记录请求时间
            self.request_times.append(time.time())
            
            # 保存统计数据
            self._save_stats()
            
            return True
    
    def wait_after_error(self):
        """请求错误后的等待"""
        wait_time = self._get_next_interval(is_error=True)
        logger.info(f"请求失败，等待 {wait_time:.2f} 秒后重试")
        time.sleep(wait_time)
    
    def get_user_agent(self):
        """获取模拟真实浏览器的User-Agent
        
        Returns:
            str: User-Agent字符串
        """
        # 可以扩展为随机从多个常见User-Agent中选择
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
    
    def get_request_count(self):
        """获取今日已发送的请求数量
        
        Returns:
            int: 请求数量
        """
        with self.lock:
            return len(self.request_times)
    
    def get_remaining_quota(self):
        """获取今日剩余的请求配额
        
        Returns:
            int: 剩余配额
        """
        with self.lock:
            return max(0, self.daily_limit - len(self.request_times))

# 创建全局实例
rate_limiter = RateLimiter(
    daily_limit=RATE_LIMIT_DAILY,
    min_interval=RATE_LIMIT_MIN_INTERVAL,
    max_interval=RATE_LIMIT_MAX_INTERVAL,
    error_cooldown_min=RATE_LIMIT_ERROR_COOLDOWN_MIN,
    error_cooldown_max=RATE_LIMIT_ERROR_COOLDOWN_MAX,
    max_retries=RATE_LIMIT_MAX_RETRIES
)
