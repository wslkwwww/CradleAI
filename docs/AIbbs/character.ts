import { RelationshipMap } from './relationship';
import { MemoryRecord } from './memory-stream-service';

export interface Character {
  // ...existing code...
  
  // 记忆系统集成
  memoryStreamId: string;  // 用于从MemoryStreamService检索记忆
  
  // 认知属性
  cognition: {
    reflectionThreshold: number;  // 触发反思的重要性阈值
    lastReflectionTime: number;   // 上次反思时间
    focusTopics: string[];        // 当前关注的话题
    lastPlanningTime: number;     // 上次规划时间
  };
  
  // ...existing code...
}