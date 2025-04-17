import { Character, GlobalSettings } from '../../shared/types';
import { Group, GroupMessage } from './group-types';
import { GroupService } from './group-service';

/**
 * 群聊调度器 - 负责管理角色回复的调度和速率限制
 */
export class GroupScheduler {
  private static instance: GroupScheduler;
  private queue: Array<ScheduleItem> = [];
  private isProcessing: boolean = false;
  private processingInterval: number = 5000; // 默认5秒处理一个回复

  // 使用单例模式
  public static getInstance(): GroupScheduler {
    if (!GroupScheduler.instance) {
      GroupScheduler.instance = new GroupScheduler();
    }
    return GroupScheduler.instance;
  }

  /**
   * 调度群组角色的回复
   */
  public scheduleGroupResponses(
    group: Group,
    message: GroupMessage,
    characters: Character[],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): void {
    console.log(`【群聊调度器】调度群组 ${group.groupName} 的 ${characters.length} 个角色的回复`);

    // 检查角色数组是否有效
    if (!characters || characters.length === 0) {
      console.warn(`【群聊调度器】没有角色可以回复，检查是否正确加载了群组成员`);
      console.log(`【群聊调度器】群组成员ID列表: ${group.groupMemberIds.join(', ')}`);
      return;
    }

    // 记录角色信息以便调试
    console.log(`【群聊调度器】角色列表: ${characters.map(c => `${c.name}(${c.id})`).join(', ')}`);

    // 复制一份角色列表，以避免修改原数组
    const charactersToProcess = [...characters];

    // 打乱角色顺序，以随机化回复顺序
    this.shuffleArray(charactersToProcess);

    // 创建每个角色的调度项
    for (let i = 0; i < charactersToProcess.length; i++) {
      // 初始化当前角色和当前角色之前的所有回复
      const currentCharacter = charactersToProcess[i];
      const previousResponses: GroupMessage[] = [];

      this.queue.push({
        group,
        character: currentCharacter,
        originalMessage: message,
        referenceMessages: previousResponses,
        type: 'normal',
        apiKey,
        apiSettings,
        position: i // 记录位置，用于决定可以引用哪些之前的回复
      });

      console.log(`【群聊调度器】已添加角色 ${currentCharacter.name} 到回复队列，位置 ${i + 1}/${charactersToProcess.length}`);
    }

    // 如果当前没有处理队列，则开始处理
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * 调度被@提及的角色回复
   */
  public scheduleMentionedResponses(
    group: Group,
    message: GroupMessage,
    mentionedCharacters: Character[],
    groupMessages: GroupMessage[],
    apiKey?: string,
    apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>
  ): void {
    console.log(`【群聊调度器】调度被@提及的 ${mentionedCharacters.length} 个角色的回复`);

    // 为被@提及的每个角色创建调度项
    mentionedCharacters.forEach((character) => {
      this.queue.push({
        group,
        character,
        originalMessage: message,
        referenceMessages: groupMessages,
        type: 'mention',
        apiKey,
        apiSettings,
        priority: 1 // 优先级高于普通回复
      });
      
      console.log(`【群聊调度器】已添加被@提及的角色 ${character.name} 到回复队列`);
    });

    // 如果当前没有处理队列，则开始处理
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      console.log(`【群聊调度器】队列处理完成`);
      return;
    }

    this.isProcessing = true;

    // 按优先级排序队列
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // 获取队列中的第一项
    const item = this.queue.shift();

    if (!item) {
      this.isProcessing = false;
      return;
    }

    try {
      console.log(`【群聊调度器】处理角色 ${item.character.name} 的回复，类型: ${item.type}`);

      // 获取最新的群组消息
      const groupMessages = await GroupService.getGroupMessages(item.group.groupId);

      // 如果是第一个角色，直接回复原始消息
      // 如果是其他角色，还需要参考之前角色的回复
      const processedMessages = this.processReferenceMessages(
        groupMessages, 
        item.originalMessage, 
        item.position || 0,
        item.referMessageLimit || 5
      );

      // 调用服务处理回复
      await GroupService.replyToGroupMessage(
        item.group.groupId,
        item.character,
        item.originalMessage,
        processedMessages,
        item.apiKey,
        item.apiSettings
      );

      console.log(`【群聊调度器】角色 ${item.character.name} 的回复已处理`);
    } catch (error) {
      console.error(`【群聊调度器】处理角色 ${item.character.name} 的回复失败:`, error);
    }

    // 设置延时处理下一项
    setTimeout(() => this.processQueue(), this.processingInterval);
  }

  /**
   * 处理参考消息列表
   * 角色可以看到原始消息和之前回复的消息，但数量有限制
   */
  private processReferenceMessages(
    allMessages: GroupMessage[],
    originalMessage: GroupMessage,
    position: number,
    referMessageLimit: number
  ): GroupMessage[] {
    // 过滤出原始消息之后的回复消息
    const responseMessages = allMessages.filter(
      msg => 
        new Date(msg.messageCreatedAt).getTime() > new Date(originalMessage.messageCreatedAt).getTime() &&
        msg.replyToMessageId === originalMessage.messageId
    );

    // 如果当前角色是第一个回复者，直接返回原始消息
    if (position === 0 || responseMessages.length === 0) {
      return [originalMessage];
    }

    // 对于后续角色，他们可以看到之前的回复，但数量有限制
    const availableReplies = responseMessages
      .sort((a, b) => new Date(a.messageCreatedAt).getTime() - new Date(b.messageCreatedAt).getTime())
      .slice(0, Math.min(position, referMessageLimit));

    // 返回原始消息和之前的回复
    return [originalMessage, ...availableReplies];
  }

  /**
   * 打乱数组顺序
   */
  private shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

/**
 * 调度项接口定义
 */
interface ScheduleItem {
  group: Group;
  character: Character;
  originalMessage: GroupMessage;
  referenceMessages: GroupMessage[];
  type: 'normal' | 'mention';
  apiKey?: string;
  apiSettings?: Pick<GlobalSettings['chat'], 'apiProvider' | 'openrouter'>;
  priority?: number;
  position?: number;
  referMessageLimit?: number;
}
