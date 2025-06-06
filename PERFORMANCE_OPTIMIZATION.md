# Index页面性能优化方案

## 问题分析

当index页面中存在大量消息时，切换到其他页面（如profile页面）会出现卡顿，影响用户体验。经分析发现以下关键性能问题：

### 1. 状态管理问题
- **过多的独立状态**：index页面包含约30+个useState状态，每个状态更新都会触发重新渲染
- **不必要的计算**：某些useMemo和useCallback在页面不可见时仍在执行
- **消息过滤频繁计算**：filteredMessages在每次render时都会重新计算大量消息

### 2. 后台处理问题
- **定时器未清理**：页面切换时，setTimeout和setInterval继续在后台运行
- **事件监听器泄漏**：某些全局事件监听器没有正确清理
- **异步操作未控制**：AsyncStorage操作在页面不可见时仍在执行

### 3. 内存和渲染问题
- **大量DOM元素**：消息列表即使使用分页，仍保持大量组件在内存中
- **复杂动画**：多个Animated.Value同时运行，消耗CPU资源
- **频繁状态更新**：滚动位置、内存状态等频繁更新

## 优化方案

### 1. 页面可见性管理
```typescript
// 添加页面可见性状态
const [isPageVisible, setIsPageVisible] = useState(true);

// 使用useFocusEffect监听页面焦点
useFocusEffect(
  useCallback(() => {
    setIsPageVisible(true);
    return () => {
      setIsPageVisible(false);
      clearAllTimers(); // 清理所有定时器
    };
  }, [clearAllTimers])
);
```

### 2. 定时器管理优化
```typescript
// 创建安全的定时器管理系统
const timersRef = useRef<Set<any>>(new Set());
const intervalsRef = useRef<Set<any>>(new Set());

const createSafeTimeout = useCallback((callback: () => void, delay: number) => {
  const timer = setTimeout(() => {
    timersRef.current.delete(timer);
    callback();
  }, delay);
  timersRef.current.add(timer);
  return timer;
}, []);

// 页面不可见时清理所有定时器
const clearAllTimers = useCallback(() => {
  timersRef.current.forEach(timer => clearTimeout(timer));
  intervalsRef.current.forEach(interval => clearInterval(interval));
  timersRef.current.clear();
  intervalsRef.current.clear();
}, []);
```

### 3. 计算优化
```typescript
// 优化消息过滤，页面不可见时返回空数组
const filteredMessages = useMemo(() => {
  if (!isPageVisible) return []; // 性能优化：避免不必要计算
  
  return messages.filter(msg => {
    // 过滤逻辑...
  });
}, [messages, autoMessageInputText, isPageVisible]);
```

### 4. 后台服务优化
```typescript
// 添加页面可见性检查到关键函数
const loadUserGroups = useCallback(async () => {
  if (!user || !isPageVisible) return; // 页面不可见时跳过
  // 加载逻辑...
}, [user, disbandedGroups, isPageVisible]);

// 优化定时更新服务
useEffect(() => {
  if (!characterToUse?.id || !isPageVisible) return;
  const interval = createSafeInterval(updateState, 800);
  return () => clearInterval(interval);
}, [characterToUse?.id, isPageVisible, createSafeInterval]);
```

### 5. 应用状态管理
```typescript
// 监听应用状态，后台时清理资源
useEffect(() => {
  const handleAppStateChange = (nextAppState: any) => {
    setAppState(nextAppState);
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('[Performance] App backgrounded - clearing timers');
      clearAllTimers();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription?.remove();
}, [clearAllTimers]);
```

## 性能提升效果

### 预期改善：
1. **页面切换流畅度**：减少50-70%的后台处理负载
2. **内存使用**：降低30-40%的内存占用
3. **CPU使用率**：减少60-80%的不必要计算
4. **电池续航**：降低后台定时器和计算消耗

### 保留的后台功能：
- **自动消息服务**：autoMessageService继续运行
- **自动生图服务**：autoImageService和postChatService保持活跃
- **重要状态同步**：用户数据、消息状态等核心功能不受影响

## 实施建议

### 立即实施：
1. ✅ 添加页面可见性管理
2. ✅ 实现定时器自动清理
3. ✅ 优化关键计算函数
4. ✅ 添加后台状态检查

### 后续优化：
1. 考虑虚拟化长列表（react-native-virtualized-list）
2. 实现消息懒加载和卸载机制
3. 优化图片缓存和内存管理
4. 实现组件级别的性能监控

## 监控和测试

### 性能指标：
- 页面切换延迟（目标：<200ms）
- 内存使用峰值（目标：降低30%）
- CPU使用率（目标：后台<5%）
- 电池消耗（目标：降低20%）

### 测试场景：
1. 大量消息（1000+条）下的页面切换
2. 长时间运行的稳定性测试
3. 多页面快速切换压力测试
4. 后台运行资源消耗测试 