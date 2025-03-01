(NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1738930528012
 (NOBRIDGE) LOG  [Index] Saving selectedConversationId to AsyncStorage: 1740821349159
 (NOBRIDGE) LOG  【朋友圈服务】尝试发布测试帖子
 (NOBRIDGE) LOG  【朋友圈服务】选择角色 小刘 作为发帖者
 (NOBRIDGE) LOG  【朋友圈服务】角色 小刘 创建新朋友圈帖子
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小刘 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小刘 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小刘 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小刘 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: newPost，作者ID: 1740662644578，响应者ID: 1740662644578
 (NOBRIDGE) LOG  [PromptBuilderService] Inserting 3 D-entries with base message: 【内容】遇到了一个有趣的人，让我感到很有灵感，想听听大 
家的经...
 (NOBRIDGE) LOG  [PromptBuilderService] Base message found at index 0 of 1
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries available at depths: 1
 (NOBRIDGE) LOG  [PromptBuilderService] Final history structure: 1 total entries
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries inserted: 0
 (NOBRIDGE) LOG  [PromptBuilderService] 构建完成：R框架条目数=4，D类条目数=3，历史消息数=0
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 你是义工

你的性格容易激动

你正在创建一条新的朋友圈动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false，对自己发的内容通常为false）
- 提供一条你想发布的内容（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
   ...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: ```json
{
  "action": {
    "like": false,
    "comment": "今天去社区给孤寡老人送温暖，看到他们脸上洋溢的笑容，我真是太激动了！能帮到别人，感觉真好！希望以后能多参加这样的活动！💪
💪💪"
  },
  "emotion": {
    "type": "positive",
    "intensity": 0.9
  }
}
```...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) LOG  【朋友圈】成功提取JSON: {"action": {"comment": "今天去社区给孤寡老人送温暖，看到他们脸上洋溢的笑容，我真是太激动了！能 
帮到别人，感觉真好！希望以后能多参加这样的活动！💪💪💪", "like": false}, "emotion": {"intensity": 0.9, "type": "positive"}}
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740662644578 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"action": {"comment": "今天去社区给孤寡老人送温暖，看到他们脸上洋溢的笑容，我真是太激动 
了！能帮到别人，感觉真好！希望以后能多参加这样的活动！💪💪💪", "like": false}, "success": true}
 (NOBRIDGE) LOG  【朋友圈服务】成功发布测试帖子: "遇到了一个有趣的人，让我感到很有灵感，想听听大家的经历。..."
 (NOBRIDGE) LOG  【朋友圈测试】开始朋友圈互动测试，帖子内容: 遇到了一个有趣的人，让我感到很有灵感，想听听大家的经历。
 (NOBRIDGE) LOG  【朋友圈测试】找到 5 个启用了朋友圈互动的角色
 (NOBRIDGE) LOG  【朋友圈测试】使用真实API Key进行调用
 (NOBRIDGE) LOG  【朋友圈服务】开始测试互动，共有 5 个启用朋友圈的角色
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小李 的测试互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小李 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小李 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小李 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小李 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小李 对帖子的互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小李 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小李 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小李 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小李 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】角色 小李 朋友圈初始化成功，开始处理互动
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: replyToPost，作者ID: 1740662644578，响应者ID: 1740662574493
 (NOBRIDGE) LOG  [PromptBuilderService] Inserting 1 D-entries with base message: 【内容】遇到了一个有趣的人，让我感到很有灵感，想听听大 
家的经...
 (NOBRIDGE) LOG  [PromptBuilderService] Base message found at index 0 of 1
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries available at depths: 1
 (NOBRIDGE) LOG  [PromptBuilderService] Final history structure: 1 total entries
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries inserted: 0
 (NOBRIDGE) LOG  [PromptBuilderService] 构建完成：R框架条目数=4，D类条目数=1，历史消息数=0
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 你是一个老师

性格活泼开朗

你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: 好的，明白！请给我看朋友圈动态的内容，我将根据我的角色性格，以JSON格式回复。
...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) ERROR  【朋友圈】未找到JSON格式内容
 (NOBRIDGE) ERROR  【朋友圈】解析响应失败: [Error: 未能从AI回复中提取有效数据]
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740662574493 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"error": "未能从AI回复中提取有效数据", "success": false}
 (NOBRIDGE) LOG  【朋友圈服务】角色 小李 的互动响应: 失败: 未能从AI回复中提取有效数据
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
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: replyToPost，作者ID: 1740662644578，响应者ID: 1740662618894
 (NOBRIDGE) LOG  [PromptBuilderService] Inserting 1 D-entries with base message: 【内容】遇到了一个有趣的人，让我感到很有灵感，想听听大 
家的经...
 (NOBRIDGE) LOG  [PromptBuilderService] Base message found at index 0 of 1
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries available at depths: 1
 (NOBRIDGE) LOG  [PromptBuilderService] Final history structure: 1 total entries
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries inserted: 0
 (NOBRIDGE) LOG  [PromptBuilderService] 构建完成：R框架条目数=4，D类条目数=1，历史消息数=0
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 你很好学

你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comm...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: 好的，我理解了。请给我一条朋友圈动态，我会根据我的“好学”角色生成JSON格式的回复。     
...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) ERROR  【朋友圈】未找到JSON格式内容
 (NOBRIDGE) ERROR  【朋友圈】解析响应失败: [Error: 未能从AI回复中提取有效数据]
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740662618894 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"error": "未能从AI回复中提取有效数据", "success": false}
 (NOBRIDGE) LOG  【朋友圈服务】角色 小王 的互动响应: 失败: 未能从AI回复中提取有效数据
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小刘 的测试互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小刘 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小刘 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小刘 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小刘 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小刘 对帖子的互动
 (NOBRIDGE) LOG  【朋友圈服务】阻止角色 小刘 回复自己的帖子
 (NOBRIDGE) LOG  【朋友圈服务】角色 小刘 的互动响应: 失败: 不允许回复自己的帖子
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小丽 的测试互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小丽 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小丽 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小丽 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小丽 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小丽 对帖子的互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小丽 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小丽 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小丽 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小丽 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】角色 小丽 朋友圈初始化成功，开始处理互动
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: replyToPost，作者ID: 1740662644578，响应者ID: 1740819287241
 (NOBRIDGE) LOG  [PromptBuilderService] Inserting 3 D-entries with base message: 【内容】遇到了一个有趣的人，让我感到很有灵感，想听听大 
家的经...
 (NOBRIDGE) LOG  [PromptBuilderService] Base message found at index 0 of 1
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries available at depths: 1
 (NOBRIDGE) LOG  [PromptBuilderService] Final history structure: 1 total entries
 (NOBRIDGE) LOG  [PromptBuilderService] D-entries inserted: 0
 (NOBRIDGE) LOG  [PromptBuilderService] 构建完成：R框架条目数=4，D类条目数=3，历史消息数=0
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 你很好学

你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comm...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: 好的，明白了。请给我看朋友圈的动态内容，我将根据我的角色性格给出JSON格式的回复。     
...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) ERROR  【朋友圈】未找到JSON格式内容
 (NOBRIDGE) ERROR  【朋友圈】解析响应失败: [Error: 未能从AI回复中提取有效数据]
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740819287241 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"error": "未能从AI回复中提取有效数据", "success": false}
 (NOBRIDGE) LOG  【朋友圈服务】角色 小丽 的互动响应: 失败: 未能从AI回复中提取有效数据
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小那 的测试互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小那 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小那 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小那 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小那 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】处理角色 小那 对帖子的互动
 (NOBRIDGE) LOG  【朋友圈服务】初始化角色 小那 的朋友圈
 (NOBRIDGE) LOG  【朋友圈】开始初始化角色 小那 的朋友圈框架
 (NOBRIDGE) LOG  【朋友圈】成功加载角色 小那 的角色卡
 (NOBRIDGE) LOG  【朋友圈】成功为角色 小那 初始化朋友圈框架
 (NOBRIDGE) LOG  【朋友圈服务】角色 小那 朋友圈初始化成功，开始处理互动
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: replyToPost，作者ID: 1740662644578，响应者ID: 1740821349159
 (NOBRIDGE) LOG  [PromptBuilderService] 构建完成：R框架条目数=4，D类条目数=0，历史消息数=0
 (NOBRIDGE) LOG  【朋友圈】发送到LLM的完整提示: 你很严谨

你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comm...
 (NOBRIDGE) LOG  【朋友圈】调用Gemini API...
 (NOBRIDGE) LOG  【朋友圈】Gemini API返回原始响应: 好的，明白了。请给我看朋友圈动态内容。我将根据内容和我的严谨性格生成JSON格式的回复。 
...
 (NOBRIDGE) LOG  【朋友圈】开始解析响应
 (NOBRIDGE) ERROR  【朋友圈】未找到JSON格式内容
 (NOBRIDGE) ERROR  【朋友圈】解析响应失败: [Error: 未能从AI回复中提取有效数据]
 (NOBRIDGE) LOG  【朋友圈】更新了角色 1740821349159 的朋友圈记忆
 (NOBRIDGE) LOG  【朋友圈】成功处理互动，结果: {"error": "未能从AI回复中提取有效数据", "success": false}
 (NOBRIDGE) LOG  【朋友圈服务】角色 小那 的互动响应: 失败: 未能从AI回复中提取有效数据
 (NOBRIDGE) LOG  【朋友圈服务】测试互动完成，成功: 0/5
 (NOBRIDGE) LOG  【朋友圈测试】互动测试结果: {"总结果数": 5, "成功数": 0, "点赞数": 0, "评论数": 0}