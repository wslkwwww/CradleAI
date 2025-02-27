import { NodeST, CirclePostOptions, CircleResponse } from '@/NodeST/nodest';
import { Character, CirclePost, CircleComment, CircleLike } from '@/shared/types';
import { useUser } from '@/constants/UserContext';

// 创建具有apiKey的单例实例
let nodeST: NodeST | null = null;

export class CircleService {
  // 确保具有API Key的NodeST实例
  private static getNodeST(apiKey?: string): NodeST {
    if (!nodeST) {
      nodeST = new NodeST(apiKey);
    } else if (apiKey) {
      nodeST.setApiKey(apiKey);
    }
    return nodeST;
  }

  // Initialize a character for circle interactions
  static async initCharacterCircle(character: Character, apiKey?: string): Promise<boolean> {
    try {
      console.log(`【朋友圈服务】初始化角色 ${character.name} 的朋友圈`);
      return await this.getNodeST(apiKey).initCharacterCircle(character);
    } catch (error) {
      console.error(`【朋友圈服务】初始化角色 ${character.name} 的朋友圈失败:`, error);
      return false;
    }
  }

  // 新增：创建朋友圈帖子
  static async createNewPost(
    character: Character,
    content: string,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      console.log(`【朋友圈服务】角色 ${character.name} 创建新朋友圈帖子`);
      
      // 初始化角色的朋友圈（如果尚未初始化）
      const isInitialized = await this.initCharacterCircle(character, apiKey);
      if (!isInitialized) {
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }
      
      // 创建帖子选项
      const postOptions: CirclePostOptions = {
        type: 'newPost',
        content: {
          authorId: character.id,
          text: content,
          context: `这是${character.name}发布的新朋友圈`
        },
        responderId: character.id // responderId和authorId相同
      };
      
      return await this.getNodeST(apiKey).processCircleInteraction(postOptions);
    } catch (error) {
      console.error(`【朋友圈服务】创建朋友圈帖子失败 ${character.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建朋友圈帖子失败'
      };
    }
  }

  // Process interaction with a post
  static async processCircleInteraction(
    character: Character, 
    post: CirclePost,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      console.log(`【朋友圈服务】处理角色 ${character.name} 对帖子的互动`);
      
      // 检查互动频率限制
      if (!this.checkInteractionLimits(character, post.characterId, 'post')) {
        console.log(`【朋友圈服务】角色 ${character.name} 已达到互动频率限制，跳过对 ${post.characterName} 帖子的回复`);
        return {
          success: false,
          error: `已达到互动频率限制`
        };
      }

      // 阻止角色回复自己的帖子
      if (character.id === post.characterId) {
        console.log(`【朋友圈服务】阻止角色 ${character.name} 回复自己的帖子`);
        return {
          success: false,
          error: `不允许回复自己的帖子`
        };
      }
      
      // 创建带responderId的postOptions
      const postOptions: CirclePostOptions = {
        type: 'replyToPost',
        content: {
          authorId: post.characterId,
          text: post.content,
          context: `这是一条${post.characterName}发布的朋友圈动态`
        },
        responderId: character.id  // 添加responderId
      };

      // Initialize character for circle interaction if needed
      const isInitialized = await this.initCharacterCircle(character, apiKey);
      if (!isInitialized) {
        console.error(`【朋友圈服务】角色 ${character.name} 朋友圈初始化失败`);
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }

      console.log(`【朋友圈服务】角色 ${character.name} 朋友圈初始化成功，开始处理互动`);
      
      // Process the interaction through NodeST with apiKey
      const response = await this.getNodeST(apiKey).processCircleInteraction(postOptions);
      
      // 如果互动成功，更新角色互动统计
      if (response.success) {
        this.updateInteractionStats(character, post.characterId, 'post');
      }
      
      return response;
    } catch (error) {
      console.error(`【朋友圈服务】角色 ${character.name} 的朋友圈互动处理失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '朋友圈互动处理过程中发生未知错误'
      };
    }
  }

  // Process user comment to a post with apiKey
  static async processCommentInteraction(
    character: Character,
    post: CirclePost,
    comment: string,
    apiKey?: string,
    replyTo?: { userId: string, userName: string }
  ): Promise<CircleResponse> {
    try {
      // Create comment options with responderId
      const commentOptions: CirclePostOptions = {
        type: replyTo ? 'replyToComment' : 'replyToPost',
        content: {
          authorId: post.characterId,
          text: comment,
          context: replyTo ? 
            `回复${replyTo.userName}的评论: ${comment}` : 
            `回复${post.characterName}的朋友圈: ${post.content}`
        },
        responderId: character.id
      };

      // Initialize character for circle interaction if needed
      const isInitialized = await this.initCharacterCircle(character, apiKey);
      if (!isInitialized) {
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }

      // Process the interaction through NodeST with apiKey
      return await this.getNodeST(apiKey).processCircleInteraction(commentOptions);
    } catch (error) {
      console.error(`【朋友圈服务】评论互动处理失败 ${character.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '评论互动处理过程中发生未知错误'
      };
    }
  }
  
  // 新增：处理对评论的回复
  static async replyToComment(
    character: Character,
    post: CirclePost,
    comment: CircleComment,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      console.log(`【朋友圈服务】处理角色 ${character.name} 对评论的回复`);
      
      // 检查互动频率限制 - 对评论的回复
      if (!this.checkInteractionLimits(character, comment.id, 'comment')) {
        console.log(`【朋友圈服务】角色 ${character.name} 已达到对评论的互动频率限制，跳过回复`);
        return {
          success: false,
          error: `已达到互动频率限制`
        };
      }
      
      // 阻止角色回复自己的评论（除非是帖子作者回复他人对自己帖子的评论）
      const isPostAuthor = character.id === post.characterId;
      if (character.id === comment.userId && !isPostAuthor) {
        console.log(`【朋友圈服务】阻止角色 ${character.name} 回复自己的评论`);
        return {
          success: false,
          error: `不允许回复自己的评论`
        };
      }
      
      // 确定适当的上下文和提示
      let context = '';
      if (isPostAuthor) {
        // 帖子作者回复评论
        context = `你是帖子"${post.content}"的作者，${comment.userName}评论了你的帖子: "${comment.content}"，请回复这条评论`;
      } else {
        // 其他角色回复评论
        context = `在${post.characterName}的帖子"${post.content}"下，${comment.userName}发表了评论: "${comment.content}"，请回复这条评论`;
      }
      
      const commentOptions: CirclePostOptions = {
        type: 'replyToComment',
        content: {
          authorId: post.characterId,  // 原帖作者ID
          text: comment.content,       // 评论内容
          context: context             // 自定义上下文
        },
        responderId: character.id      // 当前回复者ID
      };
      
      // 初始化角色的朋友圈
      const isInitialized = await this.initCharacterCircle(character, apiKey);
      if (!isInitialized) {
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }
      
      // 处理互动
      const response = await this.getNodeST(apiKey).processCircleInteraction(commentOptions);
      
      // 如果互动成功，更新角色互动统计
      if (response.success) {
        this.updateInteractionStats(character, comment.id, 'comment');
      }
      
      return response;
    } catch (error) {
      console.error(`【朋友圈服务】回复评论失败 ${character.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '回复评论失败'
      };
    }
  }

  // Update a post with character's response (like/comment)
  static updatePostWithResponse(
    post: CirclePost, 
    character: Character, 
    response: CircleResponse
  ): CirclePost {
    if (!response.success || !response.action) {
      return post;
    }

    const updatedPost = { ...post };
    
    // Handle like action
    if (response.action.like) {
      console.log(`【朋友圈服务】角色 ${character.name} 点赞了帖子`);
      
      const newLike: CircleLike = {
        userId: character.id,
        userName: character.name,
        userAvatar: character.avatar as string,
        isCharacter: true,
        createdAt: new Date().toISOString()
      };
      
      updatedPost.likes = (updatedPost.likes || 0) + 1;
      updatedPost.likedBy = [...(updatedPost.likedBy || []), newLike];
    }
    
    // Handle comment action
    if (response.action.comment) {
      console.log(`【朋友圈服务】角色 ${character.name} 评论了帖子: "${response.action.comment}"`);
      
      const newComment: CircleComment = {
        id: `${Date.now()}-${character.id}`,
        userId: character.id,
        userName: character.name,
        userAvatar: character.avatar as string,
        content: response.action.comment,
        createdAt: new Date().toISOString(),
        type: 'character'
      };
      
      updatedPost.comments = [...(updatedPost.comments || []), newComment];
    }
    
    return updatedPost;
  }

  // Process test interaction for all enabled characters
  static async processTestInteraction(
    testPost: CirclePost,
    enabledCharacters: Character[],
    apiKey?: string
  ): Promise<{
    updatedPost: CirclePost,
    results: Array<{characterId: string, success: boolean, response?: CircleResponse}>
  }> {
    console.log(`【朋友圈服务】开始测试互动，共有 ${enabledCharacters.length} 个启用朋友圈的角色`);
    
    // Make a copy of the test post to avoid mutating the original
    let updatedPost = { ...testPost };
    const results: Array<{characterId: string, success: boolean, response?: CircleResponse}> = [];

    // Process interactions for each enabled character
    for (const character of enabledCharacters) {
      try {
        console.log(`【朋友圈服务】处理角色 ${character.name} 的测试互动`);
        
        // Initialize and process interaction with apiKey
        await this.initCharacterCircle(character, apiKey);
        const response = await this.processCircleInteraction(character, testPost, apiKey);
        
        console.log(`【朋友圈服务】角色 ${character.name} 的互动响应:`, 
          response.success ? 
            `点赞: ${response.action?.like}, 评论: ${response.action?.comment || '无'}` : 
            `失败: ${response.error}`
        );
        
        // Update post with character's response
        if (response.success) {
          updatedPost = this.updatePostWithResponse(updatedPost, character, response);
        }
        
        // Record result
        results.push({
          characterId: character.id,
          success: response.success,
          response: response
        });
      } catch (error) {
        console.error(`【朋友圈服务】测试角色 ${character.name} 时出错:`, error);
        results.push({
          characterId: character.id,
          success: false
        });
      }
    }

    console.log(`【朋友圈服务】测试互动完成，成功: ${results.filter(r => r.success).length}/${results.length}`);
    return { updatedPost, results };
  }
  
  // 新增：发布测试帖子
  static async publishTestPost(
    characters: Character[],
    apiKey?: string
  ): Promise<{post: CirclePost | null, author: Character | null}> {
    try {
      console.log(`【朋友圈服务】尝试发布测试帖子`);
      
      // 筛选启用了朋友圈的角色
      const enabledCharacters = characters.filter(c => c.circleInteraction);
      if (enabledCharacters.length === 0) {
        console.log(`【朋友圈服务】没有启用朋友圈的角色，无法发布测试帖子`);
        return { post: null, author: null };
      }
      
      // 随机选择一个角色作为发帖者
      const author = enabledCharacters[Math.floor(Math.random() * enabledCharacters.length)];
      console.log(`【朋友圈服务】选择角色 ${author.name} 作为发帖者`);
      
      // 生成测试内容模板
      const postTemplates = [
        `今天的心情真不错！刚刚${author.name === '厨师' ? '做了一道新菜' : '看了一部有趣的电影'}，大家有什么推荐吗？`,
        `突然想到一个问题，${author.name === '医生' ? '如果人类能活200岁会怎样' : '如果可以拥有一种超能力，你们会选择什么'}？`,
        `分享一下${author.name === '老师' ? '今天教课的心得' : '我最近的一些想法'}，希望能给大家一些启发。`,
        `${author.name === '作家' ? '正在写一个新故事' : '遇到了一个有趣的人'}，让我感到很有灵感，想听听大家的经历。`
      ];
      
      // 随机选择一个模板并生成内容
      const content = postTemplates[Math.floor(Math.random() * postTemplates.length)];
      
      // 创建朋友圈帖子
      const response = await this.createNewPost(author, content, apiKey);
      
      if (!response.success) {
        console.log(`【朋友圈服务】发布测试帖子失败: ${response.error}`);
        return { post: null, author: null };
      }
      
      // 构建帖子对象
      const newPost: CirclePost = {
        id: `post-${Date.now()}`,
        characterId: author.id,
        characterName: author.name,
        characterAvatar: author.avatar as string,
        content: content,
        createdAt: new Date().toISOString(),
        comments: [],
        likes: 0,
        likedBy: [],
        hasLiked: false,
      };
      
      console.log(`【朋友圈服务】成功发布测试帖子: "${content.substring(0, 30)}..."`);
      return { post: newPost, author };
    } catch (error) {
      console.error(`【朋友圈服务】发布测试帖子失败:`, error);
      return { post: null, author: null };
    }
  }
  
  // 新增：检查互动频率限制
  private static checkInteractionLimits(
    character: Character, 
    targetId: string,
    type: 'post' | 'comment'
  ): boolean {
    // 如果没有设置互动频率，默认为中等
    const frequency = character.circleInteractionFrequency || 'medium';
    
    // 如果没有互动统计，初始化它
    if (!character.circleStats) {
      character.circleStats = {
        repliedToCharacters: {},
        repliedToPostsCount: 0,
        repliedToCommentsCount: {}
      };
      return true; // 首次互动，允许
    }
    
    if (type === 'post') {
      // 检查对特定角色的回复次数
      const repliesCount = character.circleStats.repliedToCharacters[targetId] || 0;
      const maxRepliesPerCharacter = frequency === 'low' ? 1 : (frequency === 'medium' ? 3 : 5);
      
      // 检查不同角色帖子的回复总数
      const maxDifferentCharacters = frequency === 'low' ? 5 : (frequency === 'medium' ? 5 : 7);
      
      // 如果已经回复过此角色的帖子次数达到上限
      if (repliesCount >= maxRepliesPerCharacter) {
        return false;
      }
      
      // 如果不同角色帖子的回复总数达到上限，且这是新角色
      if (character.circleStats.repliedToPostsCount >= maxDifferentCharacters && 
          !character.circleStats.repliedToCharacters[targetId]) {
        return false;
      }
      
      return true;
    } else if (type === 'comment') {
      // 检查对评论的回复次数
      const repliesCount = character.circleStats.repliedToCommentsCount[targetId] || 0;
      const maxRepliesPerComment = frequency === 'low' ? 1 : (frequency === 'medium' ? 3 : 5);
      
      // 如果已经回复过此评论的次数达到上限
      if (repliesCount >= maxRepliesPerComment) {
        return false;
      }
      
      return true;
    }
    
    return true;
  }
  
  // 新增：更新互动统计
  private static updateInteractionStats(
    character: Character,
    targetId: string,
    type: 'post' | 'comment'
  ): void {
    // 确保统计对象存在
    if (!character.circleStats) {
      character.circleStats = {
        repliedToCharacters: {},
        repliedToPostsCount: 0,
        repliedToCommentsCount: {}
      };
    }
    
    if (type === 'post') {
      // 更新对特定角色的回复次数
      character.circleStats.repliedToCharacters[targetId] = 
        (character.circleStats.repliedToCharacters[targetId] || 0) + 1;
      
      // 如果是首次回复此角色，增加不同角色帖子的回复总数
      if (character.circleStats.repliedToCharacters[targetId] === 1) {
        character.circleStats.repliedToPostsCount += 1;
      }
    } else if (type === 'comment') {
      // 更新对特定评论的回复次数
      character.circleStats.repliedToCommentsCount[targetId] = 
        (character.circleStats.repliedToCommentsCount[targetId] || 0) + 1;
    }
  }
}