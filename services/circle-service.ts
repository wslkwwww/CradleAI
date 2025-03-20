import { NodeST, CirclePostOptions, CircleResponse } from '../NodeST/nodest';
import { Character, GlobalSettings } from '../shared/types';
import { CirclePost, CircleComment, CircleLike } from '../shared/types/circle-types';
import { RelationshipService } from './relationship-service';
import { applyRelationshipUpdates } from '../utils/relationship-utils';
import { CircleScheduler } from './circle-scheduler';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Add this import

// 创建具有apiKey的单例实例
let nodeST: NodeST | null = null;

export class CircleService {
  // 修改 getNodeST 方法以支持 apiSettings
  private static getNodeST(
    apiKey?: string, 
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): NodeST {
    // Prepare OpenRouter config if needed
    const openRouterConfig = apiSettings?.apiProvider === 'openrouter' && apiSettings.openrouter?.enabled
        ? {
            apiKey: apiSettings.openrouter.apiKey,
            model: apiSettings.openrouter.model
          }
        : undefined;
          
    // Log the configuration
    console.log(`【朋友圈服务】获取NodeST实例，apiKey存在: ${!!apiKey}，provider: ${apiSettings?.apiProvider || 'gemini'}`, 
      openRouterConfig ? {
        hasOpenRouterKey: !!openRouterConfig.apiKey,
        model: openRouterConfig.model
      } : 'no openrouter config'
    );
    
    if (!nodeST) {
      nodeST = new NodeST(apiKey);
      // If initialized with apiKey and we have OpenRouter config, update it immediately
      if (apiKey && openRouterConfig) {
        nodeST.updateApiSettings(apiKey, apiSettings);
      }
    } else if (apiKey) {
      // Update existing instance with API key and settings
      if (apiSettings) {
        nodeST.updateApiSettings(apiKey, apiSettings);
      } else {
        // Only update API key without changing existing OpenRouter config
        nodeST.setApiKey(apiKey);
      }
    }
    
    return nodeST;
  }

  // 更新现有方法，添加 apiSettings 参数
  static async initCharacterCircle(
    character: Character, 
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<boolean> {
    try {
      console.log(`【朋友圈服务】初始化角色 ${character.name} 的朋友圈`);
      
      const instance = this.getNodeST(apiKey, apiSettings);
      return await instance.initCharacterCircle(character);
    } catch (error) {
      console.error(`【朋友圈服务】初始化角色 ${character.name} 的朋友圈失败:`, error);
      return false;
    }
  }

  // 新增：创建朋友圈帖子
  static async createNewPost(
    character: Character,
    content: string,
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<CircleResponse> {
    try {
      console.log(`【朋友圈服务】角色 ${character.name} 创建新朋友圈帖子，API Provider: ${apiSettings?.apiProvider || 'gemini'}`);
      
      // 初始化角色的朋友圈（如果尚未初始化）
      const isInitialized = await this.initCharacterCircle(character, apiKey, apiSettings);
      if (!isInitialized) {
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }
      
      // 创建帖子选项，传入角色对象以确保初始化
      const postOptions: CirclePostOptions = {
        type: 'newPost',
        content: {
          authorId: character.id,
          authorName: character.name,
          text: content,
          context: `这是${character.name}发布的新朋友圈`
        },
        responderId: character.id, // responderId和authorId相同
        responderCharacter: character // 添加角色对象
      };
      
      const response = await this.getNodeST(apiKey, apiSettings).processCircleInteraction(postOptions);
      
      // Log the complete response for debugging
      console.log(`【朋友圈服务】${character.name} 创建帖子的原始响应:`, JSON.stringify(response));
      
      return response;
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
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>,
    postOptions?: CirclePostOptions // Add postOptions parameter
  ): Promise<CircleResponse> {
    try {
      console.log(`【朋友圈服务】处理角色 ${character.name} 对帖子的互动${postOptions?.content?.images?.length ? "（包含图片）" : ""}`);
      
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
      
      // Use the provided postOptions if available, otherwise create a new one
      const options = postOptions || {
        type: 'replyToPost',
        content: {
          authorId: post.characterId,
          authorName: post.characterName,  // Now TypeScript won't complain
          text: post.content,
          context: `这是${post.characterName}发布的一条朋友圈动态。${
            post.comments?.length ? 
            `目前已有${post.comments.length}条评论和${post.likes}个点赞。` : 
            '还没有其他人互动。'
          }`,
          images: post.images // Make sure images from the post are included
        },
        responderId: character.id,
        responderCharacter: character
      };

      // Initialize character for circle interaction if needed
      const isInitialized = await this.initCharacterCircle(character, apiKey, apiSettings);
      if (!isInitialized) {
        console.error(`【朋友圈服务】角色 ${character.name} 朋友圈初始化失败`);
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }

      console.log(`【朋友圈服务】角色 ${character.name} 朋友圈初始化成功，开始处理互动`);
      
      // Process the interaction through NodeST with apiKey and options containing images
      const response = await this.getNodeST(apiKey, apiSettings).processCircleInteraction(options);
      
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

  // Process user comment to a post with apiKey - add isForwarded parameter
  static async processCommentInteraction(
    character: Character,
    post: CirclePost,
    comment: string,
    apiKey?: string,
    replyTo?: { userId: string, userName: string },
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>,
    isForwarded: boolean = false  // Add new parameter to indicate forwarding
  ): Promise<CircleResponse> {
    try {
      // Create context based on the interaction type
      let context = '';
      
      // Check if post has images
      const hasImages = post.images && post.images.length > 0;
      const imageInfo = hasImages ? 
        `（包含${post.images!.length}张图片）` : 
        '';
      
      // Determine if replyTo is the user
      const isReplyToUser = replyTo?.userId === 'user-1';
      
      // Use customUserName for the user if available, otherwise use userName
      const userDisplayName = isReplyToUser && character.customUserName ? 
        character.customUserName : 
        (replyTo?.userName || '用户');
      
      if (isForwarded) {
        // Enhanced special context for forwarded posts with image indication
        context = `用户转发了${post.characterName}的朋友圈给你${imageInfo}: "${post.content}"`;
        
        // Add additional context for images
        if (hasImages) {
          context += `\n请特别关注图片内容，优先对图片作出回应。`;
        }
      } else if (replyTo) {
        // Enhanced: Reply to comment with better context including original post content
        if (replyTo.userId === character.id) {
          // User is replying to this character's comment
          context = `在${post.characterName}发布的"${post.content}"帖子下，${userDisplayName}回复了你的评论: "${comment}"`;
        } else if (replyTo.userId === post.characterId) {
          // User is replying to post author's comment
          context = `在${post.characterName}发布的"${post.content}"帖子下，${userDisplayName}回复了帖子作者的评论: "${comment}"`;
        } else if (isReplyToUser) {
          // User is being replied to - make it clear this is the user
          context = `在${post.characterName}发布的"${post.content}"帖子下，${userDisplayName}（用户本人）发表了评论: "${comment}"，请回复这条评论`;
        } else {
          // User is replying to another comment
          context = `在${post.characterName}发布的"${post.content}"帖子下，${userDisplayName}回复了${replyTo.userName}的评论: "${comment}"`;
        }
      } else {
        // Regular reply to post with image indication
        context = `回复${post.characterName}的朋友圈${imageInfo}: ${post.content}`;
      }
      
      // Check interaction frequency if this is a character responding to another character
      if (replyTo && replyTo.userId !== 'user-1' && character.id !== post.characterId) {
        if (!this.checkInteractionLimits(character, replyTo.userId, 'comment')) {
          console.log(`【朋友圈服务】角色 ${character.name} 已达到互动频率限制，跳过回复`);
          return {
            success: false,
            error: `已达到互动频率限制`
          };
        }
        
        // Update interaction stats if we proceed
        this.updateInteractionStats(character, replyTo.userId, 'comment');
      }
      
      // Create comment options with responderId
      const commentOptions: CirclePostOptions = {
        type: replyTo ? 'replyToComment' : (isForwarded ? 'forwardedPost' : 'replyToPost'),
        content: {
          authorId: post.characterId,
          authorName: post.characterName,
          text: comment,
          context: context,
          images: post.images // Include any images from the post
        },
        responderId: character.id,
        responderCharacter: character
      };

      // Initialize character for circle interaction if needed
      const isInitialized = await this.initCharacterCircle(character, apiKey, apiSettings);
      if (!isInitialized) {
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }

      // Process the interaction through NodeST with apiKey
      return await this.getNodeST(apiKey, apiSettings).processCircleInteraction(commentOptions);
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
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
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
          authorName: post.characterName,
          text: comment.content,       // 评论内容
          context: context             // 自定义上下文
        },
        responderId: character.id,      // 当前回复者ID
        responderCharacter: character   // 添加角色对象
      };
      
      // 初始化角色的朋友圈
      const isInitialized = await this.initCharacterCircle(character, apiKey, apiSettings);
      if (!isInitialized) {
        return {
          success: false,
          error: `初始化角色 ${character.name} 的朋友圈失败`
        };
      }
      
      // 处理互动
      const response = await this.getNodeST(apiKey, apiSettings).processCircleInteraction(commentOptions);
      
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
  ): { updatedPost: CirclePost, updatedTargetCharacter?: Character } {
    if (!response.success || !response.action) {
      return { updatedPost: post };
    }

    const updatedPost = { ...post };
    let updatedTargetCharacter: Character | undefined;
    
    // Get the target character (post author)
    const postAuthorCharacter = this.findCharacterById(post.characterId);
    
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
      
      // Update relationship data if author character is found
      if (postAuthorCharacter) {
        updatedTargetCharacter = RelationshipService.processPostInteraction(
          postAuthorCharacter,
          character.id,
          character.name,
          'like',
          '',
          post.id,
          post.content
        );
      }
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
      
      // Update relationship data if author character is found
      if (postAuthorCharacter && !updatedTargetCharacter) {
        updatedTargetCharacter = RelationshipService.processPostInteraction(
          postAuthorCharacter,
          character.id,
          character.name,
          'comment',
          response.action.comment,
          post.id,
          post.content
        );
      } else if (postAuthorCharacter && updatedTargetCharacter) {
        // If we already have an updated target character (from like), update it again
        updatedTargetCharacter = RelationshipService.processPostInteraction(
          updatedTargetCharacter,
          character.id,
          character.name,
          'comment',
          response.action.comment,
          post.id,
          post.content
        );
      }
    }
    
    return { updatedPost, updatedTargetCharacter };
  }

  // Helper to find a character by ID
  private static findCharacterById(characterId: string): Character | undefined {
    // We need to access characters from the context
    // This is just a placeholder implementation
    // In a real app, we would get this from the context or a parameter
    type CircleStats = {
      repliedToCharacters: Record<string, number>;
      repliedToPostsCount: number;
      repliedToCommentsCount: Record<string, number>;
    };

    interface CharacterWithCircle extends Character {
      circleStats?: CircleStats;
      circleInteraction?: boolean;
      circleInteractionFrequency?: 'low' | 'medium' | 'high';
    }

    type CircleCharacterArray = CharacterWithCircle[];

    const characters: CircleCharacterArray = []; // Replace with actual character access
    return characters.find(c => c.id === characterId);
  }
  
  // Process test interaction for all enabled characters with relationship updates
  static async processTestInteraction(
    testPost: CirclePost,
    enabledCharacters: Character[],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<{
    updatedPost: CirclePost,
    results: Array<{characterId: string, success: boolean, response?: CircleResponse}>,
    updatedCharacters: Character[]
  }> {
    console.log(`【朋友圈服务】开始测试互动，共有 ${enabledCharacters.length} 个启用朋友圈的角色`);
    
    // Make a copy of the test post to avoid mutating the original
    let updatedPost = { ...testPost };
    const results: Array<{characterId: string, success: boolean, response?: CircleResponse}> = [];
    let updatedCharacters: Character[] = [];

    // Process interactions for each enabled character
    for (const character of enabledCharacters) {
      try {
        console.log(`【朋友圈服务】处理角色 ${character.name} 的测试互动`);
        
        // Initialize and process interaction with apiKey
        await this.initCharacterCircle(character, apiKey, apiSettings);
        const response = await this.processCircleInteraction(character, testPost, apiKey, apiSettings);
        
        console.log(`【朋友圈服务】角色 ${character.name} 的互动响应:`, 
          response.success ? 
            `点赞: ${response.action?.like}, 评论: ${response.action?.comment || '无'}` : 
            `失败: ${response.error}`
        );
        
        // Update post with character's response
        if (response.success) {
          const { updatedPost: newPost, updatedTargetCharacter } = this.updatePostWithResponse(updatedPost, character, response);
          updatedPost = newPost;
          
          // If there's an updated target character, add it to our list
          if (updatedTargetCharacter) {
            updatedCharacters.push(updatedTargetCharacter);
          }
          
          // Apply relationship updates if present
          if (response.relationshipUpdates && response.relationshipUpdates.length > 0) {
            const updatedCharacter = this.applyRelationshipUpdates(character, response);
            updatedCharacters.push(updatedCharacter);
          }
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
    return { updatedPost, results, updatedCharacters };
  }
  
  // 新增：发布测试帖子
  static async publishTestPost(
    characters: Character[],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
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
      
      // Log API settings to debug
      console.log(`【朋友圈服务】发布测试帖子使用的API配置:`, {
        provider: apiSettings?.apiProvider || 'gemini',
        hasOpenRouter: apiSettings?.apiProvider === 'openrouter' && apiSettings?.openrouter?.enabled,
        openRouterModel: apiSettings?.openrouter?.model
      });
      
      // 生成测试内容模板
      const postTemplates = [
        `今天的心情真不错！刚刚${author.name === '厨师' ? '做了一道新菜' : '看了一部有趣的电影'}，大家有什么推荐吗？`,
        `突然想到一个问题，${author.name === '医生' ? '如果人类能活200岁会怎样' : '如果可以拥有一种超能力，你们会选择什么'}？`,
        `分享一下${author.name === '老师' ? '今天教课的心得' : '我最近的一些想法'}，希望能给大家一些启发。`,
        `${author.name === '作家' ? '正在写一个新故事' : '遇到了一个有趣的人'}，让我感到很有灵感，想听听大家的经历。`
      ];
      
      // 随机选择一个模板作为提示词
      const promptTemplate = postTemplates[Math.floor(Math.random() * postTemplates.length)];
      
      // 创建朋友圈帖子 - 确保正确传递apiSettings
      const response = await this.createNewPost(author, promptTemplate, apiKey, apiSettings);
      
      if (!response.success) {
        console.log(`【朋友圈服务】发布测试帖子失败: ${response.error}`);
        return { post: null, author: null };
      }
      
      // 检查AI是否生成了帖子内容
      let postContent = promptTemplate;
      
      // 优先使用AI生成的帖子内容
      if (response.action?.comment) {
        // AI返回的comment字段包含了生成的帖子内容
        postContent = response.action.comment;
        console.log(`【朋友圈服务】使用AI生成的帖子内容:`, postContent.substring(0, 30) + '...');
      } else if (response.post) {
        // 有些模型可能会使用post字段返回内容
        postContent = response.post;
        console.log(`【朋友圈服务】使用AI生成的帖子内容(from post字段):`, postContent.substring(0, 30) + '...');
      } else {
        console.log(`【朋友圈服务】AI未返回帖子内容，使用提示模板作为内容`);
      }
      
      // 构建帖子对象
      const newPost: CirclePost = {
        id: `post-${Date.now()}`,
        characterId: author.id,
        characterName: author.name,
        characterAvatar: author.avatar as string,
        content: postContent,
        createdAt: new Date().toISOString(),
        comments: [],
        likes: 0,
        likedBy: [],
        hasLiked: false,
      };
      
      console.log(`【朋友圈服务】成功发布测试帖子: "${postContent.substring(0, 30)}..."`);
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

  // Apply relationship updates from response
  static applyRelationshipUpdates(character: Character, response: CircleResponse): Character {
    if (!response.relationshipUpdates || response.relationshipUpdates.length === 0) {
      return character;
    }
    
    let updatedCharacter = character;
    
    for (const update of response.relationshipUpdates) {
      // Fix: Use correct method from RelationshipService for updating relationships
      updatedCharacter = RelationshipService.processRelationshipUpdate(
        updatedCharacter,
        update.targetId,
        update.strengthDelta,
        update.newType as any
      );
    }
    
    return updatedCharacter;
  }

  // Add method for user posts - adding more detailed implementation
  // Modify the createUserPost method to accept characters as a parameter


  /**
   * Delete a post and update related data
   */
  static async deletePost(
    postId: string,
    posts: CirclePost[],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<{ success: boolean, updatedPosts: CirclePost[] }> {
    try {
      console.log(`【朋友圈服务】删除帖子 ID: ${postId}`);
      
      // Find the post to delete
      const postToDelete = posts.find(p => p.id === postId);
      if (!postToDelete) {
        console.error(`【朋友圈服务】未找到要删除的帖子 ID: ${postId}`);
        return { success: false, updatedPosts: posts };
      }
      
      // Remove the post from the posts array
      const updatedPosts = posts.filter(p => p.id !== postId);
      
      // If there are images in the post, we should attempt to clean them up
      // This is platform specific and might need to be handled elsewhere
      if (postToDelete.images && postToDelete.images.length > 0) {
        console.log(`【朋友圈服务】帖子包含 ${postToDelete.images.length} 张图片，清理可能需要在应用层处理`);
      }
      
      // If this is a user post, we don't need to update character data
      if (postToDelete.characterId === 'user-1') {
        console.log(`【朋友圈服务】删除的是用户帖子，无需更新角色数据`);
        return { success: true, updatedPosts };
      }
      
      // If this is a character post, update the NodeST instance
      try {
        // We can notify the NodeST instance about deleted post if needed
        // This is a placeholder for any cleanup needed in the NodeST instance
        const instance = this.getNodeST(apiKey, apiSettings);
        
        console.log(`【朋友圈服务】成功删除帖子 ID: ${postId}`);
        return { success: true, updatedPosts };
      } catch (error) {
        console.error(`【朋友圈服务】删除帖子时更新NodeST失败:`, error);
        // Still return success and updated posts since the deletion was successful
        // even if the NodeST update failed
        return { success: true, updatedPosts };
      }
    } catch (error) {
      console.error(`【朋友圈服务】删除帖子失败:`, error);
      return { success: false, updatedPosts: posts };
    }
  }

  /**
   * Load posts from AsyncStorage
   */
  static async loadSavedPosts(): Promise<CirclePost[]> {
    try {
      console.log(`【朋友圈服务】从存储加载帖子`);
      const storedPosts = await AsyncStorage.getItem('circle_posts');
      
      if (storedPosts) {
        const posts = JSON.parse(storedPosts) as CirclePost[];
        console.log(`【朋友圈服务】成功从存储加载 ${posts.length} 条帖子`);
        return posts;
      } else {
        console.log(`【朋友圈服务】存储中没有帖子`);
        return [];
      }
    } catch (error) {
      console.error(`【朋友圈服务】从存储加载帖子失败:`, error);
      return [];
    }
  }

  /**
   * Save posts to AsyncStorage
   */
  static async savePosts(posts: CirclePost[]): Promise<boolean> {
    try {
      console.log(`【朋友圈服务】保存 ${posts.length} 条帖子到存储`);
      await AsyncStorage.setItem('circle_posts', JSON.stringify(posts));
      return true;
    } catch (error) {
      console.error(`【朋友圈服务】保存帖子到存储失败:`, error);
      return false;
    }
  }

  /**
   * Process character responses to a post, with image handling support
   */
  static async processPostResponses(
    post: CirclePost, 
    characters: Character[],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<{
    updatedPost: CirclePost,
    responses: Array<{characterId: string, success: boolean, response?: CircleResponse}>
  }> {
    // Copy the post to avoid mutating the original
    const updatedPost = { ...post };
    const responses: Array<{characterId: string, success: boolean, response?: CircleResponse}> = [];
    
    // Get characters with circle interaction enabled
    const interactingCharacters = characters.filter(c => c.circleInteraction);
    console.log(`【朋友圈服务】找到 ${interactingCharacters.length} 个启用了朋友圈互动的角色`);
    
    if (interactingCharacters.length === 0) {
      return { updatedPost, responses };
    }
    
    // Get the Circle Scheduler instance to manage API rate limits
    const scheduler = CircleScheduler.getInstance();
    
    // Process each character's response
    for (const character of interactingCharacters) {
      try {
        // Skip if character should not interact with this post
        // For example, a character shouldn't respond to their own post
        if (character.id === post.characterId) {
          console.log(`【朋友圈服务】跳过角色 ${character.name} 对自己帖子的回应`);
          continue;
        }
        
        console.log(`【朋友圈服务】通过调度器处理角色 ${character.name} 对帖子的回应`);
        
        // Initialize character if needed
        await this.initCharacterCircle(character, apiKey, apiSettings);
        
        // Schedule the interaction with image processing
        const response = await scheduler.scheduleInteraction(
          character,
          post,
          apiKey,
          apiSettings,
          post.images
        );
        
        // Record response
        responses.push({
          characterId: character.id,
          success: response.success,
          response
        });
        
        // Update post with character's response
        if (response.success) {
          if (response.action?.like) {
            // Add like
            const newLike: CircleLike = {
              userId: character.id,
              userName: character.name,
              userAvatar: character.avatar as string,
              isCharacter: true,
              createdAt: new Date().toISOString()
            };
            
            updatedPost.likes = (updatedPost.likes || 0) + 1;
            (updatedPost.likedBy = updatedPost.likedBy || []).push(newLike);
          }
          
          if (response.action?.comment) {
            // Add comment
            const newComment: CircleComment = {
              id: `${Date.now()}-${character.id}`,
              userId: character.id,
              userName: character.name,
              userAvatar: character.avatar as string,
              content: response.action.comment,
              createdAt: new Date().toISOString(),
              type: 'character'
            };
            
            (updatedPost.comments = updatedPost.comments || []).push(newComment);
          }
        }
      } catch (error) {
        console.error(`【朋友圈服务】处理角色 ${character.name} 的回应时出错:`, error);
        responses.push({
          characterId: character.id,
          success: false
        });
      }
    }
    
    return { updatedPost, responses };
  }

  /**
   * Enhanced method to handle post refresh and update
   */
  static async refreshPosts(
    characters: Character[],
    savedPosts: CirclePost[],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<CirclePost[]> {
    try {
      console.log(`【朋友圈服务】刷新帖子，当前有 ${savedPosts.length} 条已保存的帖子`);
      
      // 1. Look for new character posts that aren't in the saved posts
      const allCharacterPosts: CirclePost[] = [];
      
      for (const character of characters) {
        if (character.circlePosts && Array.isArray(character.circlePosts)) {
          character.circlePosts.forEach(post => {
            if (post && post.id && !savedPosts.some(p => p.id === post.id)) {
              allCharacterPosts.push({
                ...post,
                characterAvatar: character.avatar || post.characterAvatar
              });
            }
          });
        }
      }
      
      if (allCharacterPosts.length > 0) {
        console.log(`【朋友圈服务】发现 ${allCharacterPosts.length} 条新的角色帖子`);
      }
      
      // 2. Merge with saved posts and sort
      const mergedPosts = [...savedPosts, ...allCharacterPosts].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // 3. Update post avatars with fresh character data
      const updatedPosts = mergedPosts.map(post => {
        // Update avatar for character posts
        if (post.characterId !== 'user-1') {
          const character = characters.find(c => c.id === post.characterId);
          if (character) {
            post.characterAvatar = character.avatar || post.characterAvatar;
          }
        }
        
        // Update avatars in likes and comments
        if (post.likedBy) {
          post.likedBy = post.likedBy.map(like => {
            if (like.isCharacter) {
              const character = characters.find(c => c.id === like.userId);
              if (character) {
                return { 
                  ...like, 
                  userAvatar: character.avatar || like.userAvatar 
                };
              }
            }
            return like;
          });
        }
        
        if (post.comments) {
          post.comments = post.comments.map(comment => {
            if (comment.type === 'character') {
              const character = characters.find(c => c.id === comment.userId);
              if (character) {
                return { 
                  ...comment, 
                  userAvatar: character.avatar || comment.userAvatar 
                };
              }
            }
            return comment;
          });
        }
        
        return post;
      });
      
      // 4. Save the merged and updated posts
      await this.savePosts(updatedPosts);
      
      return updatedPosts;
    } catch (error) {
      console.error(`【朋友圈服务】刷新帖子失败:`, error);
      return savedPosts; // Return original posts on error
    }
  }

  /**
   * Enhanced user post method with better image handling
   */
  static async createUserPost(
    userNickname: string,
    userAvatar: string | null,
    content: string,
    images: string[] = [],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>,
    charactersList?: Character[]
  ): Promise<{
    post: CirclePost,
    responses: Array<{characterId: string, success: boolean, response?: CircleResponse}>
  }> {
    try {
      console.log(`【朋友圈服务】用户 ${userNickname} 创建新朋友圈帖子${images.length ? `，包含 ${images.length} 张图片` : ''}`);
      
      // Create a post object for the user
      const newPost: CirclePost = {
        id: `user-post-${Date.now()}`,
        characterId: 'user-1',
        characterName: userNickname,
        characterAvatar: userAvatar,
        content,
        images,
        createdAt: new Date().toISOString(),
        comments: [],
        likes: 0,
        likedBy: [],
        hasLiked: false
      };
      
      // Save the post immediately for better UX
      try {
        const savedPosts = await this.loadSavedPosts();
        await this.savePosts([newPost, ...savedPosts]);
        console.log(`【朋友圈服务】已保存用户帖子到存储`);
      } catch (saveError) {
        console.error(`【朋友圈服务】保存用户帖子到存储失败:`, saveError);
        // Continue even if save fails
      }
      
      // Process character responses in background
      const { updatedPost, responses } = await this.processPostResponses(
        newPost,
        charactersList || [],
        apiKey,
        apiSettings
      );
      
      // Update storage with the post including character responses
      try {
        const allSavedPosts = await this.loadSavedPosts();
        const updatedSavedPosts = allSavedPosts.map(p => 
          p.id === updatedPost.id ? updatedPost : p
        );
        await this.savePosts(updatedSavedPosts);
        console.log(`【朋友圈服务】已更新带有角色响应的用户帖子`);
      } catch (updateError) {
        console.error(`【朋友圈服务】更新带有角色响应的用户帖子到存储失败:`, updateError);
      }
      
      return { post: updatedPost, responses };
    } catch (error) {
      console.error(`【朋友圈服务】创建用户帖子失败:`, error);
      return {
        post: {
          id: `user-post-${Date.now()}`,
          characterId: 'user-1',
          characterName: userNickname,
          characterAvatar: userAvatar,
          content,
          images,
          createdAt: new Date().toISOString(),
          comments: [],
          likes: 0,
          likedBy: [],
          hasLiked: false
        },
        responses: []
      };
    }
  }
  
  /**
   * Test multiple posts for interaction and get relationship updates
   */
  static async runBatchInteractionTest(
    characters: Character[],
    postCount: number = 3,
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<{
    posts: CirclePost[],
    updates: Array<{characterId: string, changes: any}>
  }> {
    try {
      console.log(`【朋友圈服务】开始批量互动测试，生成 ${postCount} 条测试帖子，API Provider: ${apiSettings?.apiProvider || 'gemini'}`);
      
      const testPosts: CirclePost[] = [];
      const characterUpdates: Array<{characterId: string, changes: any}> = [];
      
      // Generate test posts
      for (let i = 0; i < postCount; i++) {
        // Ensure apiSettings are correctly passed to publishTestPost
        const { post, author } = await this.publishTestPost(characters, apiKey, apiSettings);
        if (post && author) {
          testPosts.push(post);
          
          // Process interactions for this post - ensure apiSettings are passed here too
          const { updatedPost, updatedCharacters } = await this.processTestInteraction(
            post,
            characters.filter(c => c.id !== author.id && c.circleInteraction),
            apiKey,
            apiSettings
          );
          
          // Record character updates
          updatedCharacters.forEach(updatedChar => {
            characterUpdates.push({
              characterId: updatedChar.id,
              changes: {
                relationshipMap: updatedChar.relationshipMap,
                messageBox: updatedChar.messageBox,
                relationshipActions: updatedChar.relationshipActions
              }
            });
          });
          
          // Save the test post
          const savedPosts = await this.loadSavedPosts();
          await this.savePosts([updatedPost, ...savedPosts]);
        }
      }
      
      console.log(`【朋友圈服务】批量互动测试完成，生成了 ${testPosts.length} 条帖子，${characterUpdates.length} 个角色更新`);
      
      return {
        posts: testPosts,
        updates: characterUpdates
      };
    } catch (error) {
      console.error(`【朋友圈服务】批量互动测试失败:`, error);
      return { posts: [], updates: [] };
    }
  }
}

// Fix for the "characters" variable with implicit any type
export const processTestInteraction = (
  currentCharacter: Character,
  targetCharacterId: string,
  interactionType: string,
  content?: string
): { characters: Character[], success: boolean, message: string } => {
  // Placeholder implementation since we're not using this function
  // Create a basic return value to satisfy TypeScript
  return {
    characters: [],
    success: false,
    message: `未找到ID为${targetCharacterId}的角色`
  };
};