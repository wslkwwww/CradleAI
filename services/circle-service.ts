import AsyncStorage from '@react-native-async-storage/async-storage';
import { NodeST, CirclePostOptions, CircleResponse } from '../NodeST/nodest';
import { Character, GlobalSettings } from '../shared/types';
import { CirclePost, CircleComment, CircleLike } from '../shared/types/circle-types';
import { RelationshipService } from './relationship-service';
import { applyRelationshipUpdates } from '../utils/relationship-utils';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { useUser } from '@/constants/UserContext';
import { getUserSettings } from '@/constants/UserContext'; // Add this import

// 创建具有apiKey的单例实例
let nodeST: NodeST | null = null;

export class CircleService {
  /**
   * Improved method to get API settings using both AsyncStorage and direct context access
   */
  private static async getApiSettings(character: Character, apiKey?: string): Promise<{ 
    key: string, 
    settings: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'> 
  }> {
    let key = apiKey || '';
    
    try {
      // First try to access settings directly from UserContext - similar to ChatInput.tsx
      const userSettings = await getUserSettings();
      
      if (userSettings?.chat) {
        console.log('[CircleService] Found user settings from UserContext');
        
        // Use provided API key or fallback to settings
        if (!key && userSettings.chat.characterApiKey) {
          key = userSettings.chat.characterApiKey;
        }
        
        // If character has explicit API provider settings, prioritize those
        if (character.apiProvider === 'openrouter' && character.openrouter?.enabled) {
          console.log(`[CircleService] Using character-specific OpenRouter settings for ${character.name}`);
          return {
            key,
            settings: {
              apiProvider: 'openrouter',
              openrouter: character.openrouter
            }
          };
        }
        
        // Otherwise use global settings from UserContext
        console.log(`[CircleService] Using global API provider from UserContext: ${userSettings.chat.apiProvider}`);
        return {
          key,
          settings: {
            apiProvider: userSettings.chat.apiProvider,
            openrouter: userSettings.chat.openrouter
          }
        };
      }
      
      // If UserContext doesn't have settings, try AsyncStorage as fallback
      console.log('[CircleService] No settings in UserContext, trying AsyncStorage');
      const storageKeys = ['user', 'userSettings', '@user'];
      let userData = null;
      
      // Try each possible storage key
      for (const storageKey of storageKeys) {
        const settingsStr = await AsyncStorage.getItem(storageKey);
        if (settingsStr) {
          try {
            const parsedData = JSON.parse(settingsStr);
            if (parsedData?.settings?.chat) {
              userData = parsedData;
              console.log(`[CircleService] Found user settings in storage key: ${storageKey}`);
              break;
            }
          } catch (e) {
            console.log(`[CircleService] Failed to parse settings from ${storageKey}`);
          }
        }
      }
      
      // Process settings from AsyncStorage if found
      if (userData?.settings?.chat) {
        // Ensure we have a key
        if (!key && userData.settings.chat.characterApiKey) {
          key = userData.settings.chat.characterApiKey;
        }
        
        // If character has explicit API provider settings, use those
        if (character.apiProvider === 'openrouter' && character.openrouter?.enabled) {
          console.log(`[CircleService] Using character-specific OpenRouter settings for ${character.name}`);
          return {
            key,
            settings: {
              apiProvider: 'openrouter',
              openrouter: {
                ...character.openrouter
              }
            }
          };
        }
        
        // Otherwise use global settings
        const globalApiProvider = userData.settings.chat.apiProvider;
        console.log(`[CircleService] Using global API provider: ${globalApiProvider}`);
        
        // Create settings object based on provider
        if (globalApiProvider === 'openrouter') {
          const globalOpenRouterSettings = userData.settings.chat.openrouter;
          console.log(`[CircleService] OpenRouter enabled: ${globalOpenRouterSettings?.enabled}`);
          
          if (globalOpenRouterSettings?.enabled) {
            console.log(`[CircleService] Using OpenRouter model: ${globalOpenRouterSettings.model}`);
            console.log(`[CircleService] OpenRouter API key present: ${Boolean(globalOpenRouterSettings.apiKey)}`);
            
            return {
              key,
              settings: {
                apiProvider: 'openrouter',
                openrouter: globalOpenRouterSettings
              }
            };
          }
        }
        
        // Default to using global settings whatever they are
        return {
          key,
          settings: {
            apiProvider: globalApiProvider,
            openrouter: userData.settings.chat.openrouter
          }
        };
      }
    } catch (error) {
      console.error(`[CircleService] Error getting API settings:`, error);
    }
    
    // Default to character settings or basic settings
    console.log(`[CircleService] Using character-specific or default settings`);
    return {
      key,
      settings: {
        apiProvider: character.apiProvider || 'gemini',
        openrouter: character.openrouter
      }
    };
  }

  // Initialize a character for circle interactions
  static async initCharacterCircle(character: Character, apiKey?: string): Promise<boolean> {
    try {
      console.log(`[CircleService] Initializing circle for ${character.name}`);
      
      // Get API settings
      const { key, settings } = await this.getApiSettings(character, apiKey);
      
      // Pass API settings to NodeSTManager
      return await NodeSTManager.initCharacterCircle(character, key, settings);
    } catch (error) {
      console.error(`[CircleService] Circle init error for ${character.name}:`, error);
      return false;
    }
  }

  // Create new circle post
  static async createNewPost(
    character: Character,
    content: string,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      console.log(`[CircleService] Creating new post for ${character.name}`);
      
      // Initialize circle if needed
      const isInitialized = await this.initCharacterCircle(character, apiKey);
      if (!isInitialized) {
        return {
          success: false,
          error: `Failed to initialize circle for ${character.name}`
        };
      }
      
      // Get API settings
      const { key, settings } = await this.getApiSettings(character, apiKey);
      
      // Process using NodeSTManager
      return await NodeSTManager.processCircleInteraction({
        characterId: character.id,
        type: 'newPost',
        postContent: content,
        context: `This is a new post by ${character.name}`,
        apiKey: key,
        apiSettings: settings
      });
    } catch (error) {
      console.error(`[CircleService] Error creating post for ${character.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Process circle interaction
  static async processCircleInteraction(
    character: Character, 
    post: CirclePost,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      console.log(`[CircleService] Processing interaction for ${character.name} with post by ${post.characterName}`);
      
      // Check interaction limits
      if (!this.checkInteractionLimits(character, post.characterId, 'post')) {
        console.log(`[CircleService] Interaction limit reached for ${character.name}`);
        return {
          success: false,
          error: `Interaction limit reached`
        };
      }
      
      // Prevent self-interaction
      if (character.id === post.characterId) {
        console.log(`[CircleService] Preventing self-interaction for ${character.name}`);
        return {
          success: false,
          error: `Cannot interact with own post`
        };
      }
      
      // Initialize circle if needed
      const isInitialized = await this.initCharacterCircle(character, apiKey);
      if (!isInitialized) {
        return {
          success: false,
          error: `Failed to initialize circle for ${character.name}`
        };
      }
      
      // Get API settings
      const { key, settings } = await this.getApiSettings(character, apiKey);
      
      // Process using NodeSTManager
      const response = await NodeSTManager.processCircleInteraction({
        characterId: character.id,
        postAuthorId: post.characterId,
        postContent: post.content,
        type: 'replyToPost',
        apiKey: key,
        apiSettings: settings
      });
      
      // Update interaction stats if successful
      if (response.success) {
        this.updateInteractionStats(character, post.characterId, 'post');
      }
      
      return response;
    } catch (error) {
      console.error(`[CircleService] Interaction error for ${character.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Reply to comment
  static async replyToComment(
    character: Character,
    post: CirclePost,
    comment: CircleComment,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      console.log(`[CircleService] Processing comment reply for ${character.name}`);
      
      // Check interaction limits
      if (!this.checkInteractionLimits(character, comment.id, 'comment')) {
        console.log(`[CircleService] Comment limit reached for ${character.name}`);
        return {
          success: false,
          error: `Comment interaction limit reached`
        };
      }

      // Determine if character is post author
      const isPostAuthor = character.id === post.characterId;
      
      // Prevent self-reply unless post author
      if (character.id === comment.userId && !isPostAuthor) {
        console.log(`[CircleService] Preventing self-reply for ${character.name}`);
        return {
          success: false,
          error: `Cannot reply to own comment`
        };
      }
      
      // Determine appropriate context
      let context = '';
      if (isPostAuthor) {
        context = `You are the author of the post "${post.content}", ${comment.userName} commented on your post: "${comment.content}"`;
      } else {
        context = `In ${post.characterName}'s post "${post.content}", ${comment.userName} commented: "${comment.content}"`;
      }
      
      // Initialize circle if needed
      const isInitialized = await this.initCharacterCircle(character, apiKey);
      if (!isInitialized) {
        return {
          success: false,
          error: `Failed to initialize circle for ${character.name}`
        };
      }
      
      // Get API settings
      const { key, settings } = await this.getApiSettings(character, apiKey);
      
      // Process using NodeSTManager
      const response = await NodeSTManager.processCircleInteraction({
        characterId: character.id,
        postAuthorId: post.characterId,
        postContent: post.content,
        commentContent: comment.content,
        commentAuthor: comment.userName,
        context: context,
        type: 'replyToComment',
        apiKey: key,
        apiSettings: settings
      });
      
      // Update interaction stats if successful
      if (response.success) {
        this.updateInteractionStats(character, comment.id, 'comment');
      }
      
      return response;
    } catch (error) {
      console.error(`[CircleService] Comment reply error for ${character.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Process comment interaction initiated by a user
  static async processCommentInteraction(
    character: Character,
    post: CirclePost,
    comment: string,
    apiKey?: string,
    replyTo?: { userId: string, userName: string }
  ): Promise<CircleResponse> {
    try {
      console.log(`[CircleService] Processing user comment interaction for ${character.name}`);
      
      // Determine context based on interaction type
      const context = replyTo ? 
        `Reply to ${replyTo.userName}'s comment: ${comment}` : 
        `Reply to ${post.characterName}'s post: ${post.content}`;
      
      // Get API settings
      const { key, settings } = await this.getApiSettings(character, apiKey);
      
      // Process using NodeSTManager
      return await NodeSTManager.processCircleInteraction({
        characterId: character.id,
        postAuthorId: post.characterId,
        postContent: post.content,
        commentContent: comment,
        commentAuthor: replyTo?.userName,
        context: context,
        type: replyTo ? 'replyToComment' : 'replyToPost',
        apiKey: key,
        apiSettings: settings
      });
    } catch (error) {
      console.error(`[CircleService] User comment error for ${character.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Process test interaction for multiple characters
  static async processTestInteraction(
    testPost: CirclePost,
    enabledCharacters: Character[],
    apiKey?: string
  ): Promise<{
    updatedPost: CirclePost,
    results: Array<{characterId: string, success: boolean, response?: CircleResponse}>,
    updatedCharacters: Character[]
  }> {
    console.log(`[CircleService] Starting test interaction with ${enabledCharacters.length} characters`);
    
    let updatedPost = { ...testPost };
    const results: Array<{characterId: string, success: boolean, response?: CircleResponse}> = [];
    let updatedCharacters: Character[] = [];

    // Process each character's interaction
    for (const character of enabledCharacters) {
      try {
        console.log(`[CircleService] Processing test for ${character.name}`);
        
        // Initialize and process with API settings
        await this.initCharacterCircle(character, apiKey);
        
        // Get API settings
        const { key, settings } = await this.getApiSettings(character, apiKey);
        
        // Process using NodeSTManager with API settings
        const response = await NodeSTManager.processCircleInteraction({
          characterId: character.id,
          postAuthorId: testPost.characterId,
          postContent: testPost.content,
          type: 'replyToPost',
          apiKey: key,
          apiSettings: settings
        });
        
        if (response.success) {
          // Update post with response
          const { updatedPost: newPost, updatedTargetCharacter } = this.updatePostWithResponse(
            updatedPost,
            character,
            response
          );
          
          updatedPost = newPost;
          
          // Add updated character if available
          if (updatedTargetCharacter) {
            updatedCharacters.push(updatedTargetCharacter);
          }
          
          // Apply relationship updates if any
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
        console.error(`[CircleService] Test error for ${character.name}:`, error);
        results.push({
          characterId: character.id,
          success: false
        });
      }
    }

    return { updatedPost, results, updatedCharacters };
  }

  // Publish test post
  static async publishTestPost(
    characters: Character[],
    apiKey?: string
  ): Promise<{post: CirclePost | null, author: Character | null}> {
    try {
      // Filter enabled characters
      const enabledCharacters = characters.filter(c => c.circleInteraction);
      if (enabledCharacters.length === 0) {
        return { post: null, author: null };
      }
      
      // Select random author
      const author = enabledCharacters[Math.floor(Math.random() * enabledCharacters.length)];
      
      // Generate post content
      const templates = [
        `今天的心情真不错！刚刚${author.name === '厨师' ? '做了一道新菜' : '看了一部有趣的电影'}，大家有什么推荐吗？`,
        `突然想到一个问题，${author.name === '医生' ? '如果人类能活200岁会怎样' : '如果可以拥有一种超能力，你们会选择什么'}？`,
        `分享一下${author.name === '老师' ? '今天教课的心得' : '我最近的一些想法'}，希望能给大家一些启发。`,
        `${author.name === '作家' ? '正在写一个新故事' : '遇到了一个有趣的人'}，让我感到很有灵感，想听听大家的经历。`
      ];
      
      const content = templates[Math.floor(Math.random() * templates.length)];
      
      // Create post with API settings
      const { key, settings } = await this.getApiSettings(author, apiKey);
      
      const response = await NodeSTManager.processCircleInteraction({
        characterId: author.id,
        type: 'newPost',
        postContent: content,
        context: `This is a new post by ${author.name}`,
        apiKey: key,
        apiSettings: settings
      });
      
      if (!response.success) {
        return { post: null, author: null };
      }
      
      // Create post object
      const post: CirclePost = {
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
      
      return { post, author };
    } catch (error) {
      console.error(`[CircleService] Test post error:`, error);
      return { post: null, author: null };
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
}

// Fix for the "characters" variable with implicit any type
export const processTestInteraction = (
  currentCharacter: Character,
  targetCharacterId: string,
  interactionType: string,
  content?: string
): { characters: Character[], success: boolean, message: string } => {
  // Retrieve all characters from storage
  let characters: Character[] = getAllCharacters();
  
  // Find target character
  const targetCharacter = characters.find(char => char.id === targetCharacterId);
  if (!targetCharacter) {
    return {
      characters,
      success: false,
      message: `未找到ID为${targetCharacterId}的角色`
    };
  }

  // Basic functionality for test interactions
  return {
    characters,
    success: true,
    message: "处理完成"
  };
};

// Fix for getAllCharacters implementation
export const getAllCharacters = (): Character[] => {
  // This would typically fetch from storage or context
  // For now returning empty array as a placeholder
  return [];
};