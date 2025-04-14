import { CircleService } from './circle-service';
import { Character, GlobalSettings } from '../shared/types';
import { CirclePost, CircleResponse } from '../shared/types/circle-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleCirclePostNotification } from './notification-service';

// Single instance for queue management
let instance: CircleScheduler | null = null;

export class CircleScheduler {
  // Queue for creating posts
  private postQueue: Array<{
    character: Character;
    apiKey?: string;
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    priority: number;
  }> = [];

  // Queue for interactions
  private interactionQueue: Array<{
    character: Character;
    post: CirclePost;
    apiKey?: string;
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    images?: string[];
    priority: number;
  }> = [];

  // Processing state
  private isProcessing: boolean = false;
  private processingInterval: number = 3000; // 3 seconds between requests

  // Last processed timestamp
  private lastScheduleCheck: number = 0;
  private scheduledPostsCache: Record<string, string[]> = {};
  private lastProcessedTimes: Record<string, string> = {};

  // Map to track update callbacks by postId
  private updateCallbacks: Map<string, UpdateCallback[]> = new Map();

  private constructor() {
    console.log('【CircleScheduler】创建调度器实例');
    // Load scheduled times on startup
    this.loadScheduledTimes();
    
    // Start the scheduled post checking loop
    this.startScheduledPostsCheck();
  }

  // Get the singleton instance
  static getInstance(): CircleScheduler {
    if (!instance) {
      instance = new CircleScheduler();
    }
    return instance;
  }

  // Add a method to register callbacks
  public registerUpdateCallback(postId: string, callback: UpdateCallback): void {
    if (!this.updateCallbacks.has(postId)) {
      this.updateCallbacks.set(postId, []);
    }
    this.updateCallbacks.get(postId)!.push(callback);
  }

  // Add a method to unregister callbacks
  public unregisterUpdateCallback(postId: string, callback: UpdateCallback): void {
    if (this.updateCallbacks.has(postId)) {
      const callbacks = this.updateCallbacks.get(postId)!;
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.updateCallbacks.delete(postId);
      }
    }
  }

  // Load scheduled times from AsyncStorage
  private async loadScheduledTimes(): Promise<void> {
    try {
      const storedTimes = await AsyncStorage.getItem('character_scheduled_times');
      const lastProcessed = await AsyncStorage.getItem('last_processed_times');
      
      if (storedTimes) {
        this.scheduledPostsCache = JSON.parse(storedTimes);
        console.log(`【CircleScheduler】加载了${Object.keys(this.scheduledPostsCache).length}个角色的发布时间设置`);
      }
      
      if (lastProcessed) {
        this.lastProcessedTimes = JSON.parse(lastProcessed);
      }
    } catch (error) {
      console.error('【CircleScheduler】加载定时发布设置失败:', error);
    }
  }

  // Save the last processed time for a character-time pair
  private async saveLastProcessedTime(characterId: string, timeString: string): Promise<void> {
    try {
      // Update in-memory cache
      this.lastProcessedTimes[`${characterId}_${timeString}`] = this.getTodayDateString();
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('last_processed_times', JSON.stringify(this.lastProcessedTimes));
    } catch (error) {
      console.error('【CircleScheduler】保存处理时间记录失败:', error);
    }
  }

  // Check if a specific time for a character was already processed today
  private isTimeProcessedToday(characterId: string, timeString: string): boolean {
    const key = `${characterId}_${timeString}`;
    const lastProcessed = this.lastProcessedTimes[key];
    const today = this.getTodayDateString();
    
    return lastProcessed === today;
  }

  // Get today's date as string in format YYYY-MM-DD
  private getTodayDateString(): string {
    const date = new Date();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }

  // Start the periodic check for scheduled posts
  private startScheduledPostsCheck(): void {
    // Initial check
    this.checkForScheduledPosts();
    
    // Set up recurring checks
    setInterval(() => this.checkForScheduledPosts(), 60000); // Check every minute
  }

  // Check if any posts should be scheduled based on current time
  private async checkForScheduledPosts(): Promise<void> {
    try {
      // Don't check too frequently
      const now = Date.now();
      if (now - this.lastScheduleCheck < 55000) { // Minimum 55 seconds between checks
        return;
      }
      this.lastScheduleCheck = now;
      
      // Reload the scheduled times in case they were updated
      await this.loadScheduledTimes();
      
      // Get current time as HH:MM
      const date = new Date();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      
      console.log(`【CircleScheduler】检查定时发布任务，当前时间: ${currentTime}`);
      
      // Check each character's scheduled times
      for (const [characterId, times] of Object.entries(this.scheduledPostsCache)) {
        for (const timeString of times) {
          // Check if this exact time matches (or is within 1 minute) and wasn't already processed today
          if (this.isTimeMatching(currentTime, timeString) && !this.isTimeProcessedToday(characterId, timeString)) {
            console.log(`【CircleScheduler】检测到角色 ${characterId} 的定时发布时间: ${timeString}`);
            
            // Get characters list
            const charactersString = await AsyncStorage.getItem('characters');
            if (!charactersString) continue;
            
            const characters: Character[] = JSON.parse(charactersString);
            const character = characters.find(c => c.id === characterId);
            
            if (character && character.circleInteraction) {
              console.log(`【CircleScheduler】为角色 ${character.name} 安排发布定时朋友圈`);
              
              // Get API settings from AsyncStorage
              const settingsString = await AsyncStorage.getItem('user_settings');
              let apiKey = '';
              let apiSettings = undefined;
              
              if (settingsString) {
                const settings = JSON.parse(settingsString);
                apiKey = settings?.chat?.characterApiKey || '';
                apiSettings = {
                  apiProvider: settings?.chat?.apiProvider || 'gemini',
                  openrouter: settings?.chat?.apiProvider === 'openrouter' && settings?.chat?.openrouter
                    ? {
                        enabled: true,
                        apiKey: settings?.chat?.openrouter.apiKey,
                        model: settings?.chat?.openrouter.model
                      }
                    : undefined
                };
              }
              
              // Add to queue with high priority
              this.schedulePost(character, apiKey, apiSettings, true);
              
              // Mark this time as processed for today
              await this.saveLastProcessedTime(characterId, timeString);
            }
          }
        }
      }
    } catch (error) {
      console.error('【CircleScheduler】检查定时发布失败:', error);
    }
  }

  // Check if current time matches scheduled time (within 1 minute tolerance)
  private isTimeMatching(currentTime: string, scheduledTime: string): boolean {
    const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
    const [scheduledHours, scheduledMinutes] = scheduledTime.split(':').map(Number);
    
    // Direct match
    if (currentHours === scheduledHours && currentMinutes === scheduledMinutes) {
      return true;
    }
    
    // Within 1 minute tolerance (to prevent missing due to the exact minute)
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const scheduledTotalMinutes = scheduledHours * 60 + scheduledMinutes;
    const diff = Math.abs(currentTotalMinutes - scheduledTotalMinutes);
    
    return diff === 1; // 1 minute tolerance
  }

  // Schedule a post
  public async schedulePost(
    character: Character,
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>,
    isScheduled: boolean = false // New parameter to track if this is a scheduled post
  ): Promise<{ success: boolean; error?: string; post?: string }> {
    return new Promise((resolve) => {
      // Add to queue with appropriate priority
      this.postQueue.push({
        character,
        apiKey,
        apiSettings,
        priority: isScheduled ? 2 : 1 // Scheduled posts get higher priority
      });
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueues();
      }
      
      // Always resolve immediately - we're just queuing
      resolve({ success: true });
    });
  }

  // Schedule an interaction
  public async scheduleInteraction(
    character: Character,
    post: CirclePost,
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>,
    images?: string[]
  ): Promise<CircleResponse> {
    return new Promise((resolve) => {
      // Add to queue
      this.interactionQueue.push({
        character,
        post,
        apiKey,
        apiSettings,
        images,
        priority: 0 // Default priority for regular interactions
      });
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueues();
      }
      
      // Resolve with temporary response - actual response will be processed when queue is processed
      resolve({
        success: true,
        action: {
          like: false,
          comment: undefined
        },
        error: 'Interaction queued for processing'
      });
    });
  }

  // Schedule user post interaction with higher priority
// Schedule user post interaction with higher priority
public async scheduleUserPostInteraction(
  character: Character,
  userPost: CirclePost,
  apiKey?: string,
  apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>,
  images?: string[]
): Promise<CircleResponse> {
  return new Promise((resolve) => {
    // Add to queue with higher priority
    this.interactionQueue.push({
      character,
      post: userPost,
      apiKey,
      apiSettings,
      images,
      priority: 3 // Highest priority for user posts
    });
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueues();
    }
    
    // Resolve with temporary response
    resolve({
      success: true,
      action: {
        like: false,
        comment: undefined
      },
      error: 'User post interaction queued for priority processing'
    });
  });
}
  // Process the queues
  private async processQueues(): Promise<void> {
    // If already processing, don't start a new process
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      while (this.postQueue.length > 0 || this.interactionQueue.length > 0) {
        // Delay between processing items to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, this.processingInterval));
        
        // Prioritize interactions by user posts - highest priority (3)
        const userPostInteraction = this.interactionQueue.find(item => item.priority === 3);
        if (userPostInteraction) {
          console.log('【CircleScheduler】处理用户帖子互动（最高优先级）');
          this.interactionQueue = this.interactionQueue.filter(item => item !== userPostInteraction);
          await this.processInteraction(userPostInteraction);
          continue;
        }
        
        // Next prioritize scheduled posts - priority 2
        const scheduledPost = this.postQueue.find(item => item.priority === 2);
        if (scheduledPost) {
          console.log('【CircleScheduler】处理已排期的角色定时发布（高优先级）');
          this.postQueue = this.postQueue.filter(item => item !== scheduledPost);
          await this.processPost(scheduledPost, true); // Pass true to indicate scheduled post
          continue;
        }
        
        // Then regular posts - priority 1
        if (this.postQueue.length > 0) {
          console.log('【CircleScheduler】处理常规帖子发布请求');
          const post = this.postQueue.shift();
          if (post) {
            await this.processPost(post);
          }
          continue;
        }
        
        // Finally, regular interactions - priority 0
        if (this.interactionQueue.length > 0) {
          console.log('【CircleScheduler】处理常规互动请求');
          const interaction = this.interactionQueue.shift();
          if (interaction) {
            await this.processInteraction(interaction);
          }
        }
      }
    } catch (error) {
      console.error('【CircleScheduler】处理队列时出错:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a post request
  private async processPost(
    item: {
      character: Character;
      apiKey?: string;
      apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
    },
    isScheduled: boolean = false
  ): Promise<void> {
    try {
      console.log(`【CircleScheduler】处理${isScheduled ? '定时' : ''}帖子请求，角色: ${item.character.name}`);
      
      // Create a new post
      const response = await CircleService.createNewPost(
        item.character,
        isScheduled ? this.getScheduledPostPrompt(item.character) : this.getRandomPostPrompt(item.character),
        item.apiKey,
        item.apiSettings
      );
      
      if (response.success) {
        console.log(`【CircleScheduler】角色 ${item.character.name} 成功发布了${isScheduled ? '定时' : ''}朋友圈`);
        
        // Extract post content from response
        let postContent = '';
        if (response.post) {
          postContent = response.post;
        } else if (response.action?.comment) {
          postContent = response.action.comment;
        }
        
        // If this is a scheduled post, send notification
        if (isScheduled && postContent) {
          await scheduleCirclePostNotification(
            item.character.name,
            item.character.id,
            postContent
          );
        }
      } else {
        console.error(`【CircleScheduler】角色 ${item.character.name} 发布${isScheduled ? '定时' : ''}朋友圈失败:`, response.error);
      }
    } catch (error) {
      console.error(`【CircleScheduler】处理帖子时出错:`, error);
    }
  }

  // Process an interaction request
  private async processInteraction(
    item: {
      character: Character;
      post: CirclePost;
      apiKey?: string;
      apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
      images?: string[];
    }
  ): Promise<void> {
    try {
      console.log(`【CircleScheduler】处理互动请求，角色: ${item.character.name}，帖子作者: ${item.post.characterName}`);
      
      // Process interaction
      const response = await CircleService.processCircleInteraction(
        item.character,
        item.post,
        item.apiKey,
        item.apiSettings
      );
      
      if (response.success) {
        console.log(`【CircleScheduler】角色 ${item.character.name} 成功与 ${item.post.characterName} 的帖子互动`);
        
        // Call any registered callbacks for this post
        if (this.updateCallbacks.has(item.post.id)) {
          this.updateCallbacks.get(item.post.id)!.forEach(callback => {
            try {
              // Get the updated post from the response
              const { updatedPost } = CircleService.updatePostWithResponse(item.post, item.character, response);
              callback(updatedPost);
            } catch (callbackError) {
              console.error(`【CircleScheduler】调用更新回调失败:`, callbackError);
            }
          });
        }
      } else {
        console.error(`【CircleScheduler】角色 ${item.character.name} 互动失败:`, response.error);
      }
    } catch (error) {
      console.error(`【CircleScheduler】处理互动时出错:`, error);
    }
  }

  // Generate a prompt for scheduled posts
  private getScheduledPostPrompt(character: Character): string {
    // Generate a prompt appropriate for the character
    const timeOfDay = this.getTimeOfDay();
    const characterSpecificPrompts: Record<string, string[]> = {
      default: [
        `分享一下我在${timeOfDay}的近况和想法`,
        `最近发生了一些有趣的事情，想和大家分享`,
        `${timeOfDay}好！简单分享一下我的感受`,
        `今天是怎样的一天呢？我来说说我的${timeOfDay}`,
      ]
    };
    
    // Get specific prompts for this character type if available
    const prompts = characterSpecificPrompts[character.id] || characterSpecificPrompts.default;
    
    // Choose a random prompt
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  // Get the current time of day description
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return "上午";
    } else if (hour >= 12 && hour < 14) {
      return "中午";
    } else if (hour >= 14 && hour < 18) {
      return "下午";
    } else if (hour >= 18 && hour < 22) {
      return "傍晚";
    } else {
      return "晚上";
    }
  }

  // Generate a random post prompt
  private getRandomPostPrompt(character: Character): string {
    const generalPrompts = [
      "分享一个最近的想法或心情",
      "今天发生了什么有趣的事情",
      "有什么想和朋友们分享的吗？",
      "随意聊聊近况",
      "谈谈最近的感受"
    ];
    
    return generalPrompts[Math.floor(Math.random() * generalPrompts.length)];
  }
}

// Add a type for update callbacks
type UpdateCallback = (post: CirclePost) => void;
