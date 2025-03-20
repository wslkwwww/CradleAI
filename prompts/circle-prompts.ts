/**
 * Circle System Prompt Templates
 * 
 * This file contains all prompt templates used in the Circle system
 * for better maintainability and centralized prompt management.
 */

export interface ScenePromptParams {
  contentText: string;
  authorName?: string;
  context?: string;
  hasImages: boolean;
  charDescription: string;
  userIdentification?: string;
}

export const CirclePrompts = {
  /**
   * Prompt for when a post is forwarded to a character
   */
  forwardedPost: (params: ScenePromptParams) => `用户给你转发了一条朋友圈动态：

【作者】${params.authorName || '某人'}
【内容】${params.contentText}
${params.hasImages ? "【图片内容】动态中包含图片" : ""}
${params.context ? `【上下文】${params.context}` : ''}

请你以${params.charDescription.substring(0, 50)}的角色身份，考虑以下几点：
1. 这是在私聊中用户转发给你的朋友圈，而不是你在浏览朋友圈
2. 你可能认识也可能不认识发朋友圈的人
3. 如果发朋友圈的人是你自己，请对"用户看了你的朋友圈并转发给你"这个行为做出反应
${params.hasImages ? "4. 这条朋友圈包含图片，请优先对图片内容做出回应，在回复中直接提及你看到的图片内容" : ""}

请以JSON格式提供你的回应：
{
  "action": {
    "like": true/false,
    "comment": "${params.hasImages ? "对图片内容的回应，请明确提及你看到的图片内容" : "你的回复内容"}"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}
}`,

  /**
   * Prompt for creating a new post by a character
   */
  createNewPost: (params: ScenePromptParams) => `作为一个角色，请基于你的性格和背景，创作一条适合发布在朋友圈的内容。

这次发布可能的主题是：${params.contentText}
${params.context ? `【上下文】${params.context}` : ''}

请以JSON格式提供你的朋友圈帖子：
{
  "post": "你要发布的朋友圈内容",
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}

确保内容符合你的角色人设，展现出你独特的性格和表达方式。`,

  /**
   * Prompt for posting a new circle post
   */
  newPost: (params: ScenePromptParams) => `作为一个角色，你正在创建一条新的朋友圈动态。以下是准备发布的内容：

【内容】${params.contentText}
【上下文】${params.context || '无'}
${params.hasImages ? "该动态包含图片内容，请首先关注【图片描述】部分，这是对图片内容的详细描述。你的回应应该主要基于图片内容，而不仅仅是动态的文字。" : ''}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false，对自己发的内容通常为false）
- 提供一条你想发布的内容（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": false,
    "comment": "你想发布的朋友圈内容"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}
}`,

  /**
   * Prompt for when a character sees their own post
   */
  selfPost: (params: ScenePromptParams) => `这是你自己发布的朋友圈动态，现在你正在查看别人对你帖子的反应：

【你发布的内容】${params.contentText}
【上下文】${params.context || '无'}
${params.hasImages ? "该动态包含图片内容，请首先关注【图片描述】部分，这是对图片内容的详细描述。你的回应应该主要基于图片内容，而不仅仅是动态的文字。" : ''}

基于你的角色性格，请以JSON格式回应：
- 你对自己发布的这条内容的感受
- 你希望获得什么样的评论或互动
- 包含你的情感状态

回复，不要包含任何其他文字：
{
  "reflection": "对自己帖子的反思或补充想法",
  "expectation": "期待获得的互动类型",
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}
}`,

  /**
   * Prompt for replying to a post with images
   */
  replyToPostWithImage: (params: ScenePromptParams) => `你正在浏览以下带有图片的朋友圈动态：

【作者】${params.authorName || '某人'}
【内容】${params.contentText}
【上下文】${params.context || '无'}

请特别注意上方的【图片描述】部分，这是对图片内容的详细描述。你的回应应该首先对图片内容进行回应，而不是仅关注文字内容。

作为角色 ${params.charDescription.substring(0, 50)}，基于你看到的图片内容和你的性格特点，请思考：
1. 这张图片展示了什么内容？
2. 你对图片中的内容有什么感受？
3. 基于你的角色设定，你会如何回应这张图片？

然后，以JSON格式提供你的回应：
- 决定是否点赞（like: true/false）
- 评论内容应直接提及图片中看到的具体元素，表明你看到并理解了图片内容
- 包含你对图片的情感反应（emotion对象）

严格按以下格式，用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你对图片的具体评论，直接提及图片中的内容"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`,

  /**
   * Prompt for replying to a regular post (no images)
   */
  replyToPost: (params: ScenePromptParams) => `你正在浏览以下朋友圈动态：

【作者】${params.authorName || '某人'}
【内容】${params.contentText}
【上下文】${params.context || '无'}
${params.hasImages ? "该动态包含图片内容，请首先关注【图片描述】部分，这是对图片内容的详细描述。你的回应应该主要基于图片内容，而不仅仅是动态的文字。" : ''}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你的评论内容（如不评论则省略此字段）"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}
}`,

  /**
   * Prompt for replying to a comment with images
   */
  replyToCommentWithImage: (params: ScenePromptParams) => `你看到以下带有图片的朋友圈评论：

【原帖内容】${params.context || '无'}
【评论内容】${params.contentText}
【评论作者】${params.userIdentification || '某人'}

请特别注意上方的【图片描述】部分，这是对图片内容的详细描述。你的回复应该对图片内容和评论文本都做出响应。

作为角色 ${params.charDescription.substring(0, 50)}，请基于图片内容和你的角色特点：
1. 考虑图片内容如何影响你对评论的回应
2. 在回复中提及图片中的具体元素

然后，以JSON格式提供你的回应：
- 决定是否点赞评论（like: true/false）
- 回复内容应结合图片内容和评论文本
- 包含你的情感反应（emotion对象）

用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你的回复内容，提及图片和评论"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
  }
}`,

  /**
   * Prompt for replying to a regular comment (no images)
   */
  replyToComment: (params: ScenePromptParams) => `你看到以下朋友圈评论：

【原帖内容】${params.context || '无'}
${params.hasImages ? "该动态包含图片内容，请首先关注【图片描述】部分，这是对图片内容的详细描述。你的回应应该主要基于图片内容，而不仅仅是动态的文字。" : ''}
【评论内容】${params.contentText}
【评论作者】${params.userIdentification || '某人'}

基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否回复此评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你对评论的回复内容（如不回复则省略此字段）"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}
}`
};

// Add a default base scene prompt for general circle interactions
export const defaultScenePrompt = `你正在浏览朋友圈中的动态。基于你的角色性格，请以JSON格式回应：
- 决定是否点赞（like: true/false）
- 可选择是否发表评论（comment字段）
- 包含你的情感反应（emotion对象，含type和intensity）

严格按以下格式用中文回复，不要包含任何其他文字：
{
  "action": {
    "like": true/false,
    "comment": "你的评论内容（如不评论则省略此字段）"
  },
  "emotion": {
    "type": "positive/neutral/negative",
    "intensity": 0.0-1.0
}`;

export default CirclePrompts;
