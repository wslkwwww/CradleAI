/////////////业务逻辑修复

-openrouter：
 fix：openrouter测试失败，反馈为API响应格式错误。（openrouter-adapter.ts日志）

-角色关系系统与openrouter的集成与错误修复
 fix： (NOBRIDGE) ERROR  Error: crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported
 
-审查其他的潜在错误


-摇篮系统
  -摇篮角色生成后未消失
  -摇篮角色的数据结构和create_char需要填充的结构不匹配


/////////////UI修复

-角色卡页面：
 fix：角色关系
 feat：角色卡页面的卡片展示，支持不同大小的视图，现在的试图是小的视图。大的视图，让角色的背景图片占满卡片，方便观赏。
 
 

-
 (NOBRIDGE) LOG  [摇篮系统] 删除摇篮角色: 1740917160663
 (NOBRIDGE) LOG  [摇篮系统] 保存摇篮角色列表，数量: 4
 (NOBRIDGE) LOG  [摇篮系统] 摇篮角色删除成功
 (NOBRIDGE) LOG  [摇篮系统] 成功生成角色: 莉莉丝
 (NOBRIDGE) LOG  [Index] Character ID from params: 1741182145452
 (NOBRIDGE) LOG  [Index] Character exists in characters array: true
 (NOBRIDGE) LOG  [Index] Selected conversation set to: 1741182145452
 (NOBRIDGE) LOG  [Index] Loaded messages count: 0
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1738930528012
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1741182145452
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1741166137964
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1741182145452
 (NOBRIDGE) LOG  [摇篮系统] 开始从摇篮生成正式角色 1740917160663
 (NOBRIDGE) ERROR  [摇篮系统] 未找到目标摇篮角色
 (NOBRIDGE) ERROR  Failed to generate character: [Error: 未找到目标摇篮角色]
 (NOBRIDGE) LOG  定时检查：没有需要处理的投喂数据