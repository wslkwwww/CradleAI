好的，这是根据你的补充信息整理的提示词，更加条理清晰：

**目标：**

为 `index` 页面集成 `GroupDialog` 和 `GroupInput` 组件，并在 Sidebar 中选中群聊时实现界面无缝切换，同时更新 `TopBarWithBackground.tsx` 组件。

**实现步骤：**

1.  **`GroupDialog` 和 `GroupInput` 集成:**
    *   **触发条件：** 在 `Sidebar` 中选中群聊。
    *   **界面切换：**
        *   使用 `GroupDialog` 替代 `ChatDialog`，显示群聊对话界面。
        *   使用 `GroupInput` 替代 `ChatInput`，实现群聊消息输入框。
    *   **无缝切换：**确保界面切换过程流畅，用户体验一致。从 `ChatDialog` 到 `GroupDialog` 和从 `ChatInput` 到 `GroupInput` 的切换应尽可能平滑。

2.  **`TopBarWithBackground.tsx` 无缝切换:**
    *   **触发条件：** 在 `Sidebar` 中选中群聊。
    *   **UI 更新:**
        *   **头像：** 将左上角的私聊头像切换为群聊头像。
        *   **名称：** 将角色名称切换为群聊名称。
        *   **按钮：** 将私聊状态的按钮切换为 "管理" 按钮。
    *   **管理按钮功能：**
        *   新增群聊成员：允许添加新的群聊成员。
        *   移除群聊成员：允许移除已有的群聊成员。

**具体实现说明:**

*   **Sidebar:**  `Sidebar` 组件需要监听群聊选择事件，并触发相应的界面切换和数据更新。
*   **数据传递:**  确保将正确的群聊数据（例如，群聊头像、群聊名称、群组成员列表）传递给 `GroupDialog`和 `TopBarWithBackground.tsx` 组件。
*   **事件处理:**  `GroupInput` 组件需要处理业务层的`sendUserGroupMessage`（用户发送群聊消息）事件,`TopBarWithBackground.tsx` 组件的 "管理" 按钮需要绑定相应的事件处理函数，用于`新增和移除群聊成员`。
*   **组件通信:**  确保各个组件之间能够正确地通信，`Sidebar` 组件通知index页面切换到 `GroupDialog`和 `GroupInput`的显示，以及更新后的`TopBarWithBackground.tsx`的显示。`GroupInput` 组件通知 `GroupDialog` 组件添加新的UserGroupMessage。
*   **消息显示:** 确保`GroupDialog` 能够显示所有的群聊消息，包括`GroupInput` 输入的消息，以及业务层通过API请求生成的角色群聊消息。
*   **动画效果 (可选):**  可以添加一些动画效果，使界面切换更加流畅自然。