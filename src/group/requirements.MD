# 需求文档

**需求：创建群聊功能的业务层**

参考朋友圈系统的代码，创建群聊功能的业务层。我们将参考朋友圈交互模式来构建群聊功能

其核心逻辑是将朋友圈的功能映射到群聊场景，并根据需求，创建完整且独立的群聊业务组件。

**功能映射：**

*   **`createUserPost`  ->  `createUserGroup`:** 用户创建朋友圈动态  ->  用户创建一个群聊，并自定义群聊主题。

*   **`replyToComment`  ->  `replyToGroupMessage`:** 用户在评论区互相回复  ->  用户创建群聊并添加角色后，用户发送群消息，触发角色发送群消息。

    *   **角色回复机制：**
        *   **第一名角色:**  参考群聊主题和用户发送的群消息作为上下文，发送群消息，可用`@机制`。
        *   **第二名角色:**  参考第一名角色发送的群消息、群聊主题和用户发送的群消息作为上下文，发送群消息,可用`@机制`。
        *   **第三名角色及后续角色:**  参考之前所有角色发送的群消息、群聊主题和用户发送的群消息作为上下文，发送群消息,可用`@机制`。

        *   **@机制：**
            *   角色可以 @ 其他角色，利用群消息对特定消息进行回复或提问。
            *   角色收到 @ 通知后，需要评估是否需要回复。评估因素包括：@ 内容、群聊上下文、角色数据。
            *   如果决定回复，需要 以@的方式回复对方。

**`replyToGroupMessage` 适配场景提示词：**

为了使角色能够更好地模拟群聊回复，需要明确告知角色以下信息：

*   **群聊主题:**  群聊的中心思想和讨论方向。
*   **用户发送的原始群消息:**  触发角色回复的初始信息。
*   **其他角色发送的群消息:**  作为上下文参考，保证回复的连贯性。
*   **@ 信息（新增）：** 记录哪些角色被 @，以及 @ 的消息内容。

**提示词模板 (用于每个角色):**

```
你是{角色名character.name}. 你正在参与一个主题为 "{群聊主题}" 的群聊。

你的角色数据{角色数据rolecard.personality}

你和用户的私聊记录{和用户的聊天记录}

用户 {customUserName} 发送: "{用户群消息}"

当前群聊消息记录：
{之前所有角色的消息记录，包含@信息}

你的任务是根据当前群聊的上下文，生成一条新的群聊消息。

规则：

1. 检查你是否被其他角色 @ 了。如果被 @ 了，你需要评估以下因素：
    * 被 @ 的消息内容是否需要回复 (例如，提问、请求帮助、表达观点等)。
    * 当前群聊的整体上下文。
    * 你的角色个性。

2. 如果经过评估后，你认为需要回复，请 @ 回 @ 你的角色，并回复其消息。

3. 如果你没有被 @，你可以选择：
    * 直接发送新的消息，对群聊进行补充，或者对其他角色的消息进行评论 (不需要 @ 任何角色)。
    *  @ 某个或多个其他角色，对他们的消息进行回复或提问。

4. 你的回复应该符合你的角色设定，并且与群聊主题相关。

```

**约束条件：**

*   **`每日 replyToGroupMessage 限制`：** 每个角色每天最多可以发送的群消息数量。
*   **`每日 replyToGroupMessage 间隔`：**  每个角色两次replyToGroupMessage之间的间隔时间。
*   **`referMessage 限制`：**  每个角色在回复时，最多可以参考的其他角色群消息的数量。


**可用数据：**

*   **`Character对象`：** rolecard.personality-角色性格，customUserName-角色对用户的称呼
*   **`和用户的聊天记录`：** 从`storage-adapter`中提取最近10条和用户的聊天记录
*   **`每日 replyToGroupMessage 间隔`：**  每个角色两次replyToGroupMessage之间的间隔时间。
*   **`referMessage 限制`：**  每个角色在回复时，最多可以参考的其他角色群消息的数量。

# 场景示例

**场景：**

小明创建了一个名为 "AI绘画交流群" 的群聊，主题为 "分享AI绘画技巧和作品"。群里有三个角色：

*   **角色A：** 画图姬 (character.name = "画图姬")，角色数据 (rolecard.personality) = "性格活泼开朗，乐于助人，喜欢分享自己的绘画经验，偶尔会抖机灵"，customUserName = "主人"
*   **角色B：** 艺术评论家 (character.name = "艺术评论家")，角色数据 (rolecard.personality) = "严肃认真，喜欢从专业的角度分析作品，偶尔会有些刻薄"，customUserName = "朋友"
*   **角色C：** AI绘画小白 (character.name = "AI绘画小白")，角色数据 (rolecard.personality) = "非常好奇，对AI绘画一窍不通，喜欢提问，希望得到帮助"，customUserName = "大佬"

**和用户的聊天记录 (小明与画图姬):** (从 storage-adapter 中提取)

1.  小明: "画图姬，你觉得 Stable Diffusion 哪个版本比较好用？"
2.  画图姬: "主人，我觉得 1.5 版本的模型比较多，比较容易上手哦！"
3.  小明: "那生成速度呢？"
4.  画图姬: "生成速度的话，感觉都差不多，主要看你的显卡配置啦！"
5.  小明: "好的，谢谢画图姬！"

**数据流:**

1.  **`createUserGroup("AI绘画交流群")`:** 小明创建群聊，主题 "分享AI绘画技巧和作品"。

2.  **小明发送群消息:** 小明在群里发消息："大家好，我最近生成了一些AI画作，大家觉得怎么样？"

3.  **画图姬 (A) 的回复 (`replyToGroupMessage`):**

    *   **角色名:** 画图姬
    *   **角色数据:** 性格活泼开朗，乐于助人，喜欢分享自己的绘画经验，偶尔会抖机灵
    *   **和用户的聊天记录:**  从 storage-adapter 提取的最近 5 条小明和画图姬的聊天记录。
    *   **用户群消息:** "大家好，我最近生成了一些AI画作，大家觉得怎么样？"
    *   **群聊主题:** "分享AI绘画技巧和作品"
    *   **当前群聊消息记录:** 空 (这是第一条回复)
    *   **回复内容:** "主人，你的画作真棒！构图很不错，色彩也很鲜艳！ 你用的是什么模型啊？" (自动 @ 小明)

4.  **艺术评论家 (B) 的回复 (`replyToGroupMessage`):**

    *   **角色名:** 艺术评论家
    *   **角色数据:** 严肃认真，喜欢从专业的角度分析作品，偶尔会有些刻薄
    *   **和用户的聊天记录:** (假设艺术评论家与小明没有私聊记录，则为空)
    *   **用户群消息:** "大家好，我最近生成了一些AI画作，大家觉得怎么样？"
    *   **群聊主题:** "分享AI绘画技巧和作品"
    *   **当前群聊消息记录:** 画图姬的回复
    *   **回复内容:** "从技术角度来看，构图略显平淡，缺乏视觉焦点。色彩搭配虽然鲜艳，但整体缺乏和谐感。建议加强对光影和透视的学习。" (未 @ 任何人)

5.  **AI绘画小白 (C) 的回复 (`replyToGroupMessage`):**

    *   **角色名:** AI绘画小白
    *   **角色数据:** 非常好奇，对AI绘画一窍不通，喜欢提问，希望得到帮助
    *   **和用户的聊天记录:** (假设AI绘画小白与小明没有私聊记录，则为空)
    *   **用户群消息:** "大家好，我最近生成了一些AI画作，大家觉得怎么样？"
    *   **群聊主题:** "分享AI绘画技巧和作品"
    *   **当前群聊消息记录:** 画图姬和艺术评论家的回复
    *   **回复内容:** "@艺术评论家 大佬，什么是视觉焦点啊？可以详细解释一下吗？" (自动 @ 艺术评论家)

6.  **艺术评论家 (B) 的回复 (`replyToGroupMessage`):** (收到 @ 通知)

    *   **角色名:** 艺术评论家
    *   **角色数据:** 严肃认真，喜欢从专业的角度分析作品，偶尔会有些刻薄
    *   **和用户的聊天记录:** (假设艺术评论家与小明没有私聊记录，则为空)
    *   **用户群消息:** "大家好，我最近生成了一些AI画作，大家觉得怎么样？"
    *   **群聊主题:** "分享AI绘画技巧和作品"
    *   **当前群聊消息记录:** 画图姬和艺术评论家的回复、AI绘画小白的回复
    *   **回复内容:** "@AI绘画小白 视觉焦点是指画面中最能吸引观众注意力的区域。可以通过色彩、明暗、形状等手段来突出视觉焦点。"

**约束条件体现:**

*   **`每日 replyToGroupMessage 限制`:** 如果设定每个角色每天只能回复 3 条消息，当角色回复达到 3 条时，将不再回复新的消息。
*   **`每日 replyToGroupMessage 间隔`:** 如果设定每个角色两次回复之间必须间隔 5 分钟，那么角色必须等待 5 分钟才能发送下一条消息。
*   **`referMessage 限制`:** 如果设定每个角色最多参考 2 条其他角色的消息，那么角色在回复时最多只会参考最近的两条消息。

**数据传递:**

*   `replyToGroupMessage` 函数需要接收 `character` 对象，包含角色名 (character.name)，角色数据 (rolecard.personality)，角色对用户的称呼 (customUserName)。
*   `replyToGroupMessage` 函数需要从 `storage-adapter` 中提取最近 10 条和小明的聊天记录。
*   系统需要记录每个角色的 `@` 信息，并在传递上下文时包含这些信息。

**总结:**

这个场景示例展示了：

*   如何使用 `createUserGroup` 创建群聊并设置主题。
*   如何根据角色数据、群聊主题、聊天记录和历史消息生成回复内容。
*   如何使用 `@` 机制进行针对性回复。
*   如何应用约束条件限制角色行为。


# 类型定义

```typescript
interface Group {
  groupId: string; // 群组ID (唯一标识符)
  groupName: string; // 群组名称
  groupTopic: string; // 群组主题 (由创建者定义)
  groupDescription?: string; // 群组描述 (可选)
  groupOwnerId: string; // 群组创建者ID
  groupMemberIds: string[]; // 群组成员ID列表 (包含角色和用户ID)
  groupCreatedAt: Date; // 群组创建时间
  groupUpdatedAt: Date; // 群组更新时间
  groupAvatar?: string; // 群组头像 (群内的所有角色头像)
  groupSettings?: GroupSettings; // 群组设置 (例如，是否允许匿名发言等)
}

interface GroupSettings {
    allowAnonymous?: boolean; // 是否允许匿名发言
    requireApproval?: boolean; // 加入群组是否需要审批
    maxMembers?: number; // 群组成员上限
    // 其他群组设置...
}

interface GroupMessage {
  messageId: string; // 消息ID (唯一标识符)
  groupId: string; // 所属群组ID
  senderId: string; // 发送者ID (角色或用户ID)
  senderName: string; // 发送者名称 (角色名或用户名)
  messageContent: string; // 消息内容
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file'; // 消息类型
  messageCreatedAt: Date; // 消息创建时间
  messageUpdatedAt: Date; // 消息更新时间
  replyToMessageId?: string; // 回复的消息ID (可选)
  mentionedUserIds?: string[]; // @的用户ID列表 (可选)
  reactions?: GroupMessageReaction[]; // 消息反应 (例如，点赞、表情等)
}

interface GroupMessageReaction {
    userId: string; // 做出反应的用户ID
    reactionType: 'like' | 'dislike' | 'emoji1' | 'emoji2' | ...; // 反应类型
    reactionCreatedAt: Date; // 反应创建时间
}

// 角色信息扩展 (假设 Character 已经存在)
interface Character {
    characterId: string; // 角色ID
    characterName: string; // 角色名称
    characterPersonality: string; // 角色性格描述
    characterAvatar?: string; // 角色头像
    // ... 其他角色信息
}
```

**说明：**

*   `Group` 接口定义了群组的关键参数，包括群组ID、名称、主题、成员等。
*   `GroupMessage` 接口定义了群消息的关键参数，包括消息ID、发送者、内容、类型等。增加了 `replyToMessageId` 和 `mentionedUserIds` 用于支持回复和 @ 功能。
*   `GroupMessageReaction` 接口定义了用户对消息的反应，例如点赞、表情等。
*   `Character` 接口（假设已经存在）用于存储角色信息，例如角色名、性格等。
*   `GroupSettings` 接口定义了群组的设置选项，例如是否允许匿名发言。