import { Character } from './character';
import { MemoryStreamService } from './memory-stream-service';
import { CharacterCognitionService } from './character-cognition-service';

export interface Plan {
  id: string;
  description: string;
  startTime: number;
  endTime: number;
  location?: string;
  subPlans?: Plan[];
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;  // 1-10
}

export class PlanningService {
  constructor(
    private memoryStreamService: MemoryStreamService,
    private characterCognitionService: CharacterCognitionService
  ) {}
  
  // 生成角色的高层次计划(如每日计划)
  async generateDailyPlan(character: Character, date: Date): Promise<Plan[]> {
    // 获取角色摘要
    const characterSummary = await this.characterCognitionService.getCharacterSummary(character);
    
    // 获取前一天的计划和活动
    const previousDayPlans = await this.getPreviousDayActivities(character);
    
    // 准备日期字符串
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long', 
      month: 'long', 
      day: 'numeric'
    });
    
    // 生成高层次计划
    const prompt = `
    ${characterSummary}
    
    Previous day activities:
    ${previousDayPlans}
    
    Today is ${dateStr}. Create a daily plan for ${character.name} with 5-8 major activities or goals.
    
    Each activity should include:
    1. A brief description of the activity
    2. Approximate start time
    3. Estimated duration
    4. Priority level (1-10, where 10 is highest)
    5. Location (if applicable)
    
    Format each activity as:
    - [Start time] - [Activity description] (Duration: X hours, Priority: Y, Location: Z)
    
    The plan should consider:
    - ${character.name}'s personality and interests
    - Current forum discussions and trends
    - Relationships that need maintenance
    - Any ongoing projects or commitments
    `;
    
    const response = await callLanguageModel(prompt);
    
    // 解析响应为计划对象
    const plans = this.parsePlansFromResponse(response, date);
    
    // 存储计划到记忆流
    for (const plan of plans) {
      await this.memoryStreamService.addMemory(
        character.memoryStreamId,
        `Daily plan: ${plan.description} from ${new Date(plan.startTime).toLocaleTimeString()} to ${new Date(plan.endTime).toLocaleTimeString()}`,
        'plan',
        {
          planId: plan.id,
          startTime: plan.startTime,
          endTime: plan.endTime,
          location: plan.location,
          priority: plan.priority
        }
      );
    }
    
    // 更新角色的最后规划时间
    character.cognition.lastPlanningTime = Date.now();
    
    return plans;
  }
  
  // 将高层次计划分解为具体活动
  async decomposeIntoBehaviors(character: Character, plan: Plan): Promise<Plan[]> {
    // 获取角色摘要
    const characterSummary = await this.characterCognitionService.getCharacterSummary(character);
    
    // 计划的时间范围
    const startTime = new Date(plan.startTime);
    const endTime = new Date(plan.endTime);
    const durationMinutes = (plan.endTime - plan.startTime) / (60 * 1000);
    
    // 获取与计划相关的记忆
    const relevantMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      plan.description,
      {
        limit: 10,
        relevanceWeight: 2.0
      }
    );
    
    const relevantMemoryContent = relevantMemories
      .map(m => m.content)
      .join('\n');
    
    // 生成具体行为
    const prompt = `
    ${characterSummary}
    
    Current plan: ${plan.description}
    Location: ${plan.location || 'Not specified'}
    Time frame: ${startTime.toLocaleTimeString()} to ${endTime.toLocaleTimeString()} (${durationMinutes} minutes)
    
    Relevant context:
    ${relevantMemoryContent}
    
    Break down this plan into 3-7 specific behaviors or actions that ${character.name} would take to execute this plan.
    Each behavior should be 5-15 minutes in duration and be concrete and specific.
    
    Format each behavior as:
    - [Minutes from start] - [Specific behavior description] (Duration: X minutes)
    
    For example:
    - 0 - Enter the forum's tech discussion board and scan recent posts (Duration: 10 minutes)
    - 10 - Read top 3 posts about AI technologies and take mental notes (Duration: 15 minutes)
    `;
    
    const response = await callLanguageModel(prompt);
    
    // 解析响应为子计划
    return this.parseSubPlansFromResponse(response, plan);
  }
  
  // 检查和更新计划
  async checkAndUpdatePlans(character: Character, currentTime: number): Promise<void> {
    // 获取当前活动的计划
    const activePlans = await this.getActivePlans(character, currentTime);
    
    if (activePlans.length === 0) {
      // 如果没有活动计划，考虑生成新计划
      const today = new Date(currentTime);
      if (character.cognition.lastPlanningTime < today.setHours(0, 0, 0, 0)) {
        await this.generateDailyPlan(character, new Date(currentTime));
      }
      return;
    }
    
    // 检查当前正在执行的计划
    const currentPlan = activePlans[0];
    
    // 如果计划没有子计划，分解它
    if (!currentPlan.subPlans || currentPlan.subPlans.length === 0) {
      currentPlan.subPlans = await this.decomposeIntoBehaviors(character, currentPlan);
    }
    
    // 更新计划状态
    if (currentTime >= currentPlan.endTime) {
      currentPlan.status = 'completed';
      
      await this.memoryStreamService.addMemory(
        character.memoryStreamId,
        `Completed plan: ${currentPlan.description}`,
        'observation',
        { planId: currentPlan.id }
      );
    } else {
      currentPlan.status = 'in_progress';
    }
  }
  
  // 获取前一天的活动摘要
  private async getPreviousDayActivities(character: Character): Promise<string> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfDay = new Date(yesterday);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(yesterday);
    endOfDay.setHours(23, 59, 59, 999);
    
    // 检索前一天的所有记忆
    const allMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "yesterday's activities",
      {
        limit: 50,
        importanceWeight: 1.5
      }
    );
    
    // 过滤出前一天的记忆
    const yesterdayMemories = allMemories.filter(memory => 
      memory.creationTimestamp >= startOfDay.getTime() && 
      memory.creationTimestamp <= endOfDay.getTime()
    );
    
    if (yesterdayMemories.length === 0) {
      return "No record of yesterday's activities.";
    }
    
    // 生成摘要
    const prompt = `
    Summarize these activities from yesterday in 5-8 bullet points:
    
    ${yesterdayMemories.map(m => m.content).join('\n')}
    `;
    
    return await callLanguageModel(prompt);
  }
  
  // 获取当前活动的计划
  private async getActivePlans(character: Character, currentTime: number): Promise<Plan[]> {
    // 检索计划类型的记忆
    const planMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "current plans",
      {
        filterTypes: ['plan'],
        limit: 20,
        recencyWeight: 2.0
      }
    );
    
    // 解析记忆中的计划数据
    const plans: Plan[] = [];
    
    for (const memory of planMemories) {
      if (memory.metadata?.planId && 
          memory.metadata?.startTime && 
          memory.metadata?.endTime) {
        
        const plan: Plan = {
          id: memory.metadata.planId as string,
          description: memory.content.replace('Daily plan: ', '').split(' from ')[0],
          startTime: memory.metadata.startTime as number,
          endTime: memory.metadata.endTime as number,
          location: memory.metadata.location as string,
          status: memory.metadata.status as any || 'pending',
          priority: memory.metadata.priority as number || 5,
          subPlans: []
        };
        
        plans.push(plan);
      }
    }
    
    // 过滤出当前时间活跃的计划
    return plans.filter(plan => 
      plan.startTime <= currentTime && 
      plan.endTime > currentTime &&
      plan.status !== 'cancelled'
    ).sort((a, b) => b.priority - a.priority);
  }
  
  // 解析语言模型响应为计划对象
  private parsePlansFromResponse(response: string, date: Date): Plan[] {
    const plans: Plan[] = [];
    const lines = response.split('\n').filter(line => line.trim().length > 0);
    
    for (const line of lines) {
      const match = line.match(/- (\d{1,2}:\d{2}(?: [AP]M)?) - (.*?) \(Duration: (\d+) hours?, Priority: (\d+)(?:, Location: (.*?))?\)/i);
      
      if (match) {
        const [_, timeStr, description, durationStr, priorityStr, location] = match;
        
        const startTime = this.parseTimeString(timeStr, date);
        const durationHours = parseInt(durationStr);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + durationHours);
        
        const plan: Plan = {
          id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          description,
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          location,
          status: 'pending',
          priority: parseInt(priorityStr),
          subPlans: []
        };
        
        plans.push(plan);
      }
    }
    
    return plans;
  }
  
  // 解析子计划
  private parseSubPlansFromResponse(response: string, parentPlan: Plan): Plan[] {
    const subPlans: Plan[] = [];
    const lines = response.split('\n').filter(line => line.trim().length > 0);
    const parentStartTime = parentPlan.startTime;
    
    for (const line of lines) {
      const match = line.match(/- (\d+) - (.*?) \(Duration: (\d+) minutes\)/i);
      
      if (match) {
        const [_, minutesFromStartStr, description, durationStr] = match;
        
        const minutesFromStart = parseInt(minutesFromStartStr);
        const durationMinutes = parseInt(durationStr);
        
        const startTime = new Date(parentStartTime);
        startTime.setMinutes(startTime.getMinutes() + minutesFromStart);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);
        
        const subPlan: Plan = {
          id: `subplan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          description,
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          location: parentPlan.location,
          status: 'pending',
          priority: parentPlan.priority,
        };
        
        subPlans.push(subPlan);
      }
    }
    
    return subPlans;
  }
  
  // 辅助方法：解析时间字符串为Date对象
  private parseTimeString(timeStr: string, date: Date): Date {
    const result = new Date(date);
    
    // 处理12小时制和24小时制
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      // 12小时制
      const [hourStr, minuteStr] = timeStr.split(':');
      let hour = parseInt(hourStr);
      
      const isPM = timeStr.includes('PM');
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
      
      const minute = parseInt(minuteStr);
      
      result.setHours(hour, minute);
    } else {
      // 24小时制
      const [hourStr, minuteStr] = timeStr.split(':');
      result.setHours(parseInt(hourStr), parseInt(minuteStr));
    }
    
    return result;
  }
}
