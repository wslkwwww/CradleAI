/////////////业务逻辑修复

-explore页面

 -确认explore页面运行关系测试，调用的api是openrouterapi
 -确认关系行动发生后，详情能够显示在关系页面
 -朋友圈转发功能错误日志：
 
```
    (NOBRIDGE) ERROR  【朋友圈】未找到角色框架，响应者ID: 1741076300286
    (NOBRIDGE) ERROR  【朋友圈】处理朋友圈互动失败: [Error: 朋友圈框架未初始化]
    (NOBRIDGE) ERROR  Failed to get character response: 朋友圈框架未初始化
```


-角色关系系统
 -确认在调用openrouter api的情况下关系测试和行动生成能够正常发生
 -确认在调用openrouter api的情况下消息盒子能够正确更新
 -角色关系图谱功能应该在index页面的侧边栏中设置开启
 -确认存在详细的中文日志，能够追溯调用openrouter api的情况下，关系系统的工作情况
 -修改原character.tsx页面的关系图谱按钮交互，使得进入后可以直接选中一位角色，查看/编辑其关系图谱的内容，关系图谱用画布的形式呈现；详情通过点击画布来进行更改，使用character-relationship-system.md文档中已经定义的组件。
 -原Character.tsx页面的角色卡片展示，支持不同大小的视图，现在的试图是小的视图。大的视图，让角色的背景图片占满卡片，方便观赏。

-上下文
transforms: ["middle-out"]

-模型健康监控

-图转文









-聊天页面
 -发送聊天消息后，会切换到其他的角色去。

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