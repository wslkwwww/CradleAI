import { Character, GlobalSettings } from '../shared/types';
import { CirclePost } from '../shared/types/circle-types';
import { CircleService } from './circle-service';

/**
 * CircleScheduler manages timing of character post creation and interactions
 * to prevent API rate limit issues
 */
export class CircleScheduler {
  private static instance: CircleScheduler;
  private isProcessing = false;
  private postQueue: Array<{
    character: Character;
    apiKey?: string;
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private interactionQueue: Array<{
    character: Character;
    post: CirclePost;
    apiKey?: string;
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private processingInterval = 3000; // 3 seconds between operations
  private lastProcessTime = 0;

  private constructor() {
    // Private constructor to enforce singleton
  }

  public static getInstance(): CircleScheduler {
    if (!CircleScheduler.instance) {
      CircleScheduler.instance = new CircleScheduler();
    }
    return CircleScheduler.instance;
  }

  /**
   * Schedule a character to create a post
   */
  public schedulePost(
    character: Character,
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<{post: CirclePost, author: Character}> {
    return new Promise((resolve, reject) => {
      console.log(`【朋友圈调度器】将角色 ${character.name} 的发帖请求添加到队列`);
      
      // Add to queue
      this.postQueue.push({
        character,
        apiKey,
        apiSettings,
        resolve,
        reject
      });
      
      // Start processing if not already
      if (!this.isProcessing) {
        this.processQueues();
      }
    });
  }

  /**
   * Schedule a character to interact with a post
   */
  public scheduleInteraction(
    character: Character,
    post: CirclePost,
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`【朋友圈调度器】将角色 ${character.name} 对帖子 ${post.id} 的互动添加到队列`);
      
      // Add to queue
      this.interactionQueue.push({
        character,
        post,
        apiKey,
        apiSettings,
        resolve,
        reject
      });
      
      // Start processing if not already
      if (!this.isProcessing) {
        this.processQueues();
      }
    });
  }

  /**
   * Schedule a character to interact with a user post
   * This is a specialized version that prioritizes user post interactions
   */
  public scheduleUserPostInteraction(
    character: Character,
    userPost: CirclePost,
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`【朋友圈调度器】将角色 ${character.name} 对用户帖子的互动添加到队列（优先级高）`);
      
      // Add to the front of the queue to prioritize user posts
      this.interactionQueue.unshift({
        character,
        post: userPost,
        apiKey,
        apiSettings,
        resolve,
        reject
      });
      
      // Start processing if not already
      if (!this.isProcessing) {
        this.processQueues();
      }
    });
  }

  /**
   * Process queues with rate limiting
   */
  private async processQueues(): Promise<void> {
    // Set processing flag
    this.isProcessing = true;
    
    while (this.postQueue.length > 0 || this.interactionQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastProcess = now - this.lastProcessTime;
      
      // If we need to wait, do so
      if (timeSinceLastProcess < this.processingInterval) {
        const waitTime = this.processingInterval - timeSinceLastProcess;
        console.log(`【朋友圈调度器】速率限制：等待 ${waitTime}ms 后处理下一个请求`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Prioritize user post interactions first (they're placed at the front of the queue)
      // Then process character post requests, and finally normal interactions
      if (this.interactionQueue.length > 0) {
        // Check if this is a user post interaction (user posts have characterId starting with 'user-')
        const userPostInteraction = this.interactionQueue.find(
          item => item.post.characterId.startsWith('user-')
        );
        
        if (userPostInteraction) {
          // Remove from queue
          this.interactionQueue = this.interactionQueue.filter(item => item !== userPostInteraction);
          
          try {
            console.log(`【朋友圈调度器】优先处理角色 ${userPostInteraction.character.name} 对用户帖子的互动请求`);
            const result = await CircleService.processCircleInteraction(
              userPostInteraction.character,
              userPostInteraction.post,
              userPostInteraction.apiKey,
              userPostInteraction.apiSettings
            );
            
            userPostInteraction.resolve(result);
          } catch (error) {
            console.error(`【朋友圈调度器】处理对用户帖子的互动请求失败:`, error);
            userPostInteraction.reject(error);
          }
        } else if (this.postQueue.length > 0) {
          // Process character post creation next
          const postRequest = this.postQueue.shift();
          if (postRequest) {
            try {
              console.log(`【朋友圈调度器】处理角色 ${postRequest.character.name} 的发帖请求`);
              const result = await CircleService.createNewPost(
                postRequest.character,
                this.generatePostContent(postRequest.character),
                postRequest.apiKey,
                postRequest.apiSettings
              );
              
              // Construct a post object for the result
              if (result.success && result.action?.comment) {
                const post: CirclePost = {
                  id: `post-${Date.now()}-${postRequest.character.id}`,
                  characterId: postRequest.character.id,
                  characterName: postRequest.character.name,
                  characterAvatar: postRequest.character.avatar as string,
                  content: result.action.comment,
                  createdAt: new Date().toISOString(),
                  comments: [],
                  likes: 0,
                  likedBy: [],
                  hasLiked: false
                };
                
                postRequest.resolve({
                  post,
                  author: postRequest.character
                });
              } else {
                throw new Error(result.error || "Failed to create post");
              }
            } catch (error) {
              console.error(`【朋友圈调度器】处理发帖请求失败:`, error);
              postRequest.reject(error);
            }
          }
        } else {
          // Process regular interaction
          const interactionRequest = this.interactionQueue.shift();
          if (interactionRequest) {
            try {
              console.log(`【朋友圈调度器】处理角色 ${interactionRequest.character.name} 的普通互动请求`);
              const result = await CircleService.processCircleInteraction(
                interactionRequest.character,
                interactionRequest.post,
                interactionRequest.apiKey,
                interactionRequest.apiSettings
              );
              
              interactionRequest.resolve(result);
            } catch (error) {
              console.error(`【朋友圈调度器】处理互动请求失败:`, error);
              interactionRequest.reject(error);
            }
          }
        }
      } else if (this.postQueue.length > 0) {
        // If no interactions, process a post
        const request = this.postQueue.shift();
        if (request) {
          try {
            console.log(`【朋友圈调度器】处理角色 ${request.character.name} 的发帖请求`);
            const result = await CircleService.createNewPost(
              request.character,
              this.generatePostContent(request.character),
              request.apiKey,
              request.apiSettings
            );
            
            // Construct a post object for the result
            if (result.success && result.action?.comment) {
              const post: CirclePost = {
                id: `post-${Date.now()}-${request.character.id}`,
                characterId: request.character.id,
                characterName: request.character.name,
                characterAvatar: request.character.avatar as string,
                content: result.action.comment,
                createdAt: new Date().toISOString(),
                comments: [],
                likes: 0,
                likedBy: [],
                hasLiked: false
              };
              
              request.resolve({
                post,
                author: request.character
              });
            } else {
              throw new Error(result.error || "Failed to create post");
            }
          } catch (error) {
            console.error(`【朋友圈调度器】处理发帖请求失败:`, error);
            request.reject(error);
          }
        }
      }
      
      // Update last process time
      this.lastProcessTime = Date.now();
    }
    
    // Clear processing flag
    this.isProcessing = false;
  }

  /**
   * Generate a post content based on character
   */
  private generatePostContent(character: Character): string {
    const templates = [
      `今天的心情很不错，${character.name === '老师' ? '和学生们度过了愉快的一天' : '希望大家也有美好的一天'}。`,
      `${character.name === '厨师' ? '今天尝试了一个新菜谱，味道超赞！' : '今天发现了一家不错的餐厅，推荐给大家。'}`,
      `${character.name === '作家' ? '写作的过程总是充满挑战和乐趣' : '读了一本很棒的书，让我思考良多'}。`,
      `${character.name === '医生' ? '提醒大家最近天气变化大，注意保暖' : '健康真的很重要，希望大家都能保持良好的生活习惯'}。`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }
}
