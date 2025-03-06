/////////////业务逻辑修复



-explore页面
 -转发问题

```
  (NOBRIDGE) LOG  【朋友圈服务】初始化角色 温棠 的朋友圈
 (NOBRIDGE) LOG  【朋友圈服务】获取NodeST实例，apiKey存在: true，provider: gemini no openrouter config
 (NOBRIDGE) LOG  【NodeST】设置API Key: AIzaS...
 (NOBRIDGE) LOG  【CircleManager】更新API Key和配置 {"hasGeminiKey": true, "hasOpenRouterKey": false, "openRouterModel": undefined}
 (NOBRIDGE) LOG  【CircleManager】已初始化/更新 Gemini 适配器
 (NOBRIDGE) LOG  【NodeST】初始化角色朋友圈: 1741193734137, apiKey存在: true
 (NOBRIDGE) LOG  【CircleManager】初始化角色朋友圈: 1741193734137, apiKey存在: true
 (NOBRIDGE) LOG  【朋友圈服务】获取NodeST实例，apiKey存在: true，provider: gemini no openrouter config
 (NOBRIDGE) LOG  【NodeST】设置API Key: AIzaS...
 (NOBRIDGE) LOG  【CircleManager】更新API Key和配置 {"hasGeminiKey": true, "hasOpenRouterKey": false, "openRouterModel": undefined}
 (NOBRIDGE) LOG  【CircleManager】已初始化/更新 Gemini 适配器
 (NOBRIDGE) LOG  【NodeST】处理朋友圈互动: replyToPost, apiKey存在: true
 (NOBRIDGE) LOG  【朋友圈】处理互动，类型: replyToPost，作者ID: 1740662644578，响应者ID: 1741193734137
 (NOBRIDGE) ERROR  【朋友圈】未找到角色框架，响应者ID: 1741193734137
 (NOBRIDGE) ERROR  【朋友圈】处理朋友圈互动失败: [Error: 朋友圈框架未初始化]
 (NOBRIDGE) ERROR  Failed to get character response: 朋友圈框架未初始化
 (NOBRIDGE) LOG  定时检查：没有需要处理的投喂数据
```
 -切换头像报错： (NOBRIDGE) ERROR  Warning: Encountered two children with the same key, `.$action-action-1741160579305-kje06i2m`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.






-角色关系系统

 -角色对行动的接受和拒绝逻辑，应该允许用户干预/角色自行判断的双重逻辑。


-角色创建和更新的问题

 -让create_char页面UI和character-detail界面UI统一，

    -页面中的detailsidebar应该允许上下滑动，因为文本内容可能很长

    -在文本框输入后放弃更改，不应该直接退出页面，而只是回到页面中。

     -预设内容的排序方式无效，请更换排序方式，例如点击上下箭头来排序条目，注意保持UI的美观

 -character-detail页面保存角色后，更新的信息没有生效，包括头像。并且character-detail没有将更新人设的请求传入NodeSTmanager中，需要解决。另外，确认character-detail和NodeSTmanager正确交互，正确传递信息给index中的updateCharacter方法。

 -本需求是一个修改需求，无需创建新的文件。




-摇篮系统

  -摇篮系统集成openrouter的跟踪和debug
  -摇篮角色生成后，虽然日志显示删除了摇篮角色，但是角色未从列表中消失
  -摇篮角色的数据结构和create_char需要填充的结构不匹配
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

////////////////////////其他

-chatdialog页面允许html改变字体颜色。

-允许酒馆UI美化的兼容

-副ai！！！！！！！！！！！副AI功能用pbs构建，定期触发，插入聊天作为D类条目，作为第一个agent集市的agnet。

-上下文建剪裁功能
transforms: ["middle-out"]

-图转文



/////////////UI修复

-摇篮系统顶部栏和其他页面的统一
-



