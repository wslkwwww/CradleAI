# AudioCacheManager 使用说明

AudioCacheManager 是一个用于管理TTS语音缓存的单例服务，支持跨会话和重启的持久化存储。

## 功能特性

- **持久化存储**: 音频文件缓存到设备本地存储，重启后仍然可用
- **会话隔离**: 使用 conversationId 前缀管理不同会话的音频文件
- **自动清理**: 提供会话级和全局的音频缓存清理功能
- **状态管理**: 管理音频播放状态，包括加载、播放、完成等状态
- **错误处理**: 完善的错误处理和日志记录

## 架构设计

### 存储结构

```
DocumentDirectory/
├── audio_cache/                    # 音频文件存储目录
│   ├── {conversationId}_{messageId}_{timestamp}.mp3
│   └── ...
└── AsyncStorage
    └── audio_file_map              # 消息ID到文件路径的映射
```

### 文件命名规则

音频文件使用以下命名格式：
```
{conversationId}_{messageId}_{timestamp}.mp3
```

- `conversationId`: 会话ID，用于隔离不同会话的音频
- `messageId`: 消息ID，唯一标识每条消息
- `timestamp`: 时间戳，确保文件名唯一性

## 使用方法

### 1. 获取实例

```typescript
import AudioCacheManager from '@/utils/AudioCacheManager';

const audioCacheManager = AudioCacheManager.getInstance();
```

### 2. 缓存音频文件

```typescript
// 生成语音后缓存到持久存储
const cachedPath = await audioCacheManager.cacheAudioFile(
  messageId,
  conversationId,
  temporaryAudioPath
);
```

### 3. 获取音频实例

```typescript
// 获取或创建音频播放实例
const sound = await audioCacheManager.getAudioSound(messageId);
if (sound) {
  await sound.playAsync();
}
```

### 4. 管理音频状态

```typescript
// 更新音频状态
audioCacheManager.updateAudioState(messageId, {
  isLoading: false,
  hasAudio: true,
  isPlaying: true
});

// 获取音频状态
const state = audioCacheManager.getAudioState(messageId);
```

### 5. 清理缓存

```typescript
// 清理特定会话的音频
await audioCacheManager.clearConversationAudio(conversationId);

// 清理所有音频缓存
await audioCacheManager.clearAllAudio();

// 停止所有正在播放的音频
await audioCacheManager.stopAllAudio();
```

## 在 ChatDialog 中的集成

### 初始化加载

```typescript
// 组件初始化时加载缓存的音频状态
useEffect(() => {
  const loadAudioStates = () => {
    const cachedStates = audioCacheManager.getAllAudioStates();
    setAudioStates(cachedStates);
  };
  loadAudioStates();
}, [audioCacheManager]);
```

### TTS 生成和缓存

```typescript
const handleTTSButtonPress = async (messageId: string, text: string) => {
  const conversationId = selectedCharacter?.id || 'default';
  
  // ... TTS 生成逻辑 ...
  
  if (result?.success && result.data?.audioPath) {
    // 缓存生成的音频文件
    const cachedPath = await audioCacheManager.cacheAudioFile(
      messageId,
      conversationId,
      result.data.audioPath
    );
    
    updateAudioState(messageId, {
      isLoading: false,
      hasAudio: true,
      error: null
    });
  }
};
```

### 音频播放

```typescript
const handlePlayAudio = async (messageId: string) => {
  const sound = await audioCacheManager.getAudioSound(messageId);
  if (!sound) return;
  
  // 停止其他音频
  await audioCacheManager.stopAllAudio();
  
  // 播放当前音频
  await sound.replayAsync();
  updateAudioState(messageId, { isPlaying: true });
};
```

## 在 CharactersContext 中的集成

### 清理会话缓存

```typescript
const clearMessages = async (conversationId: string) => {
  // ... 清理消息逻辑 ...
  
  // 清理该会话的音频缓存
  try {
    const audioCacheManager = AudioCacheManager.getInstance();
    await audioCacheManager.clearConversationAudio(conversationId);
  } catch (error) {
    console.error('Failed to clear audio cache:', error);
  }
};
```

### 删除角色时清理

```typescript
const deleteCharacters = async (ids: string[]) => {
  // ... 删除角色逻辑 ...
  
  // 清理删除角色的音频缓存
  try {
    const audioCacheManager = AudioCacheManager.getInstance();
    for (const id of ids) {
      await audioCacheManager.clearConversationAudio(id);
    }
  } catch (error) {
    console.error('Failed to clear audio cache:', error);
  }
};
```

## 接口说明

### AudioState

```typescript
interface AudioState {
  isLoading: boolean;    // 是否正在加载
  hasAudio: boolean;     // 是否有音频文件
  isPlaying: boolean;    // 是否正在播放
  isComplete: boolean;   // 是否播放完成
  error: string | null;  // 错误信息
}
```

### 主要方法

- `cacheAudioFile(messageId, conversationId, audioPath)`: 缓存音频文件
- `getAudioFilePath(messageId)`: 获取音频文件路径
- `getAudioSound(messageId)`: 获取音频实例
- `updateAudioState(messageId, state)`: 更新音频状态
- `clearConversationAudio(conversationId)`: 清理会话音频
- `clearAllAudio()`: 清理所有音频
- `stopAllAudio()`: 停止所有播放
- `getCacheSize()`: 获取缓存大小

## 性能优化

1. **单例模式**: 确保全局只有一个音频管理实例
2. **懒加载**: 音频实例按需创建
3. **内存管理**: 及时清理不再使用的音频实例
4. **错误恢复**: 文件不存在时自动清理无效映射

## 注意事项

1. 音频文件存储在 `DocumentDirectory/audio_cache/` 目录下
2. 文件映射信息存储在 AsyncStorage 中，key 为 `audio_file_map`
3. 删除会话或角色时会自动清理对应的音频缓存
4. 应用重启后会自动验证音频文件的有效性
5. 建议定期检查缓存大小，避免占用过多存储空间 