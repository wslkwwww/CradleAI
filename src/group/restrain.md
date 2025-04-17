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