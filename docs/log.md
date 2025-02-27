 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1738930528012
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1740662574493
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1740662618894
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1740662644578
 (NOBRIDGE) LOG  【朋友圈服务】尝试发布测试帖子
 (NOBRIDGE) LOG  【朋友圈服务】选择角色 小李 作为发帖者
 (NOBRIDGE) LOG  【朋友圈服务】角色 小李 创建新朋友圈帖子
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小李 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小李 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小李 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小李 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: newPost，作者ID: 1740662574493，响应者ID: 1740662574493
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 【角色描述】你是一个老师

【角色性格】性格活泼开朗

【当前场景】你正在创建一条新的朋友圈动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false，对自己发的内容通常为false）
- 提供一条你想发布的内容（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: ```json
{
  "action": {
    "like": false,
    "comment": "今天的心情真不错！刚刚看了一部有趣的电影，大家有什么推荐吗？"
  },
  "emotion": {
    "type": "positive",
    "intensity": 0.7
  }
}
```...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) LOG  【朋友圈】找到有效的JSON响应
 (NOBRIDGE) LOG  【朋友圈】成功提取JSON: {"action": {"comment": "今天的心情真不错！刚刚看了一部有趣的电影，大家有什么推荐吗？", "like": false}, "emotion": {"intensity": 0.7, "type": "positive"}}
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740662574493 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"action": {"comment": "今天的心情真不错！刚刚看了一部有趣的电影，大家有什么推荐吗？", "like": false}, "success": true}
 (NOBRIDGE) LOG  【朋友圈服务】成功发布测试帖子: "今天的心情真不错！刚刚看了一部有趣的电影，大家有什么推荐吗？..."
 (NOBRIDGE) LOG  【朋友圈测试】开始朋友圈互动测试，帖子内容: 今天的心情真不错！刚刚看了一部有趣的电影，大家有什么推荐吗？
 (NOBRIDGE) LOG  【朋友圈测试】找到 3 个启用了朋友圈互动的角色
 (NOBRIDGE) LOG  【朋友圈测试】使用真实API Key进行调用
 (NOBRIDGE) LOG  【朋友圈服务】开始测试互动，共有 3 个启用朋友圈的角色
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小李 的测试互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小李 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小李 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小李 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小李 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小李 对帖子的互动
 (NOBRIDGE) LOG  【朋友圈服务】阻止角色 小李 回复自己的帖子
 (NOBRIDGE) LOG  【朋友圈服务】角色 小李 的互动响应: 失败: 不允许回复自己的帖子
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小王 的测试互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小王 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小王 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小王 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小王 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小王 对帖子的互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小王 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小王 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小王 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小王 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】角色 小王 朋友圈初始化成功，开始处理互动
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: replyToPost，作者ID: 1740662574493，响应者ID: 1740662618894
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 【角色描述】你很好学

【角色性格】

【当前场景】你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": t...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: ```json
{
  "action": {
    "like": true,
    "comment": "最近在看《XXX》，感觉还不错，推荐给你！"
  },
  "emotion": {
    "type": "positive",
    "intensity": 0.7
  }
}
```...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) LOG  【朋友圈】找到有效的JSON响应
 (NOBRIDGE) LOG  【朋友圈】成功提取JSON: {"action": {"comment": "最近在看《XXX》，感觉还不错，推荐给你！", "like": true}, "emotion": {"intensity": 0.7, "type": "positive"}}
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740662618894 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"action": {"comment": "最近在看《XXX》，感觉还不错，推荐给你！", "like": true}, "success": true}
 (NOBRIDGE) LOG  【朋友圈服务】角色 小王 的互动响应: 点赞: true, 评论: 最近在看《XXX》，感觉还不错，推荐给你！
 (NOBRIDGE) LOG  【朋友圈服务】角色 小王 点赞了帖子
 (NOBRIDGE) LOG  【朋友圈服务】角色 小王 评论了帖子: "最近在看《XXX》，感觉还不错，推荐给你！"
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小刘 的测试互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小刘 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小刘 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小刘 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小刘 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小刘 对帖子的互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小刘 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小刘 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小刘 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小刘 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】角色 小刘 朋友圈初始化成功，开始处理互动
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: replyToPost，作者ID: 1740662574493，响应者ID: 1740662644578
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 【角色描述】你是义工

【角色性格】你的性格容易激动

【当前场景】你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: ```json
{
  "action": {
    "like": true,
    "comment": "心情好棒！推荐《触不可及》！超级治愈！"
  },
  "emotion": {
    "type": "positive",
    "intensity": 0.8
  }
}
```...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) LOG  【朋友圈】找到有效的JSON响应
 (NOBRIDGE) LOG  【朋友圈】成功提取JSON: {"action": {"comment": "心情好棒！推荐《触不可及》！超级治愈！", "like": true}, "emotion": {"intensity": 0.8, "type": "positive"}}
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740662644578 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"action": {"comment": "心情好棒！推荐《触不可及》！超级治愈！", "like": true}, "success": true}
 (NOBRIDGE) LOG  【朋友圈服务】角色 小刘 的互动响应: 点赞: true, 评论: 心情好棒！推荐《触不可及》！超级治愈！
 (NOBRIDGE) LOG  【朋友圈服务】角色 小刘 点赞了帖子
 (NOBRIDGE) LOG  【朋友圈服务】角色 小刘 评论了帖子: "心情好棒！推荐《触不可及》！超级治愈！"
 (NOBRIDGE) LOG  【朋友圈服务】测试互动完成，成功: 2/3
 (NOBRIDGE) LOG  【朋友圈测试】互动测试结果: {"总结果数": 3, "成功数": 2, "点赞数": 2, "评论数": 2}