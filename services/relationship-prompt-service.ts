import { Character } from '@/shared/types';
import { Relationship, RelationshipType } from '@/shared/types/relationship-types';
import { ApiServiceProvider } from './api-service-provider';
import { ApiSettings } from '@/shared/types/api-types';
import { PromptBuilderService, DEntry, RFrameworkEntry } from '@/NodeST/nodest/services/prompt-builder-service';

/**
 * 关系提示词服务
 * 专门为角色关系场景构建优化的提示词
 */
export class RelationshipPromptService {
  /**
   * 生成关系描述
   * 使用AI生成更自然的关系描述
   */
  static async generateRelationshipDescription(
    sourceCharacter: Character, 
    targetCharacter: Character,
    relationship: Relationship,
    apiKey?: string,
    apiSettings?: ApiSettings
  ): Promise<string> {
    if (!apiKey) {
      return this.getDefaultRelationshipDescription(relationship);
    }

    try {
      console.log(`【关系提示词服务】为 ${sourceCharacter.name} 和 ${targetCharacter.name} 生成关系描述`);
      
      // 构建R框架
      const rFramework: RFrameworkEntry[] = [
        PromptBuilderService.createRFrameworkEntry({
          name: "Source Character",
          content: `你是${sourceCharacter.name}，${sourceCharacter.description || '一个虚拟角色'}。`,
          identifier: "sourceChar"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Target Character",
          content: `${targetCharacter.name}是${targetCharacter.description || '一个虚拟角色'}。`,
          identifier: "targetChar"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Relationship Context",
          content: `你与${targetCharacter.name}的关系类型是"${relationship.type}"，关系强度为${relationship.strength}（范围从-100到100），你们已有${relationship.interactions}次互动。`,
          identifier: "relationContext"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Task",
          content: `请以${sourceCharacter.name}的第一人称，写一段简短的描述，表达你对${targetCharacter.name}的真实感受和印象。描述应该与你们的关系类型和强度一致。`,
          identifier: "task"
        })
      ];
      
      // 构建D类条目
      const dEntries: DEntry[] = [];
      
      // 如果有历史对话记录，添加为上下文
      if (sourceCharacter.messages?.some(m => m.metadata?.targetId === targetCharacter.id)) {
        const relevantMessages = sourceCharacter.messages
          .filter(m => m.metadata?.targetId === targetCharacter.id)
          .slice(-5);
          
        const messageText = relevantMessages.map(m => 
          `${m.sender === 'bot' ? sourceCharacter.name : targetCharacter.name}: ${m.text}`
        ).join('\n');
        
        dEntries.push(PromptBuilderService.createDEntry({
          name: "Recent Interactions",
          content: `你和${targetCharacter.name}最近的对话:\n${messageText}`,
          depth: 1
        }));
      }
      
      // 根据关系类型添加特定指导
      dEntries.push(PromptBuilderService.createDEntry({
        name: "Relationship Guidance",
        content: this.getRelationshipTypeGuidance(relationship.type, relationship.strength),
        depth: 0
      }));
      
      // 构建提示词
      const messages = PromptBuilderService.buildPrompt({
        rFramework,
        dEntries,
        userMessage: `请描述你(${sourceCharacter.name})对${targetCharacter.name}的感受和印象。保持简短，1-2句话，第一人称。`
      });
      
      const prompt = PromptBuilderService.messagesToText(messages);
      
      // 使用当前设置的API服务生成内容
      const response = await ApiServiceProvider.generateContent(
        [{role: 'user', parts: [{text: prompt}]}],
        apiKey,
        apiSettings
      );
      
      // 后处理响应
      let description = response.trim();
      
      // 如果响应太长，截断
      if (description.length > 120) {
        description = description.substring(0, 120) + '...';
      }
      
      // 确保描述是第一人称
      if (!description.includes('我') && !description.includes('你')) {
        description = `我觉得${description}`;
      }
      
      return description;
    } catch (error) {
      console.error('【关系提示词服务】生成关系描述失败:', error);
      return this.getDefaultRelationshipDescription(relationship);
    }
  }
  
  /**
   * 获取默认关系描述
   * 当API调用失败时使用
   */
  private static getDefaultRelationshipDescription(relationship: Relationship): string {
    const strengthAbs = Math.abs(relationship.strength);
    const isPositive = relationship.strength >= 0;
    
    switch (relationship.type) {
      case 'enemy':
        return '我对这个人有强烈的敌意，我们之间的冲突很难调和。';
      case 'rival':
        return '我们之间存在竞争关系，但这种竞争有时也推动我们进步。';
      case 'stranger':
        return '我们几乎不了解对方，只是偶尔见过面。';
      case 'acquaintance':
        return '我们认识，但并不十分熟悉。';
      case 'colleague':
        return '我们是合作伙伴，有着共同的工作目标。';
      case 'friend':
        return '我们是朋友，偶尔一起聊天和分享经历。';
      case 'close_friend':
        return '我们是很好的朋友，彼此了解和支持。';
      case 'best_friend':
        return '这是我最好的朋友之一，我们之间有着深厚的信任和理解。';
      case 'family':
        return '我们有着家人般的亲密关系，无论发生什么都会互相支持。';
      case 'crush':
        return '我对他/她有些特别的感觉，但还没有表达出来。';
      case 'lover':
        return '我们之间有着浪漫的感情，彼此珍视这段关系。';
      case 'partner':
        return '我们是伴侣，共同面对生活中的挑战和喜悦。';
      case 'ex':
        return '我们曾经很亲密，但现在已经分开了。';
      case 'mentor':
        return '我把自己的知识和经验传授给对方，看到他/她的成长让我感到欣慰。';
      case 'student':
        return '我从他/她那里学到了很多，很感谢有这样一位指导者。';
      case 'admirer':
        return '我很欣赏他/她的才能和特质。';
      case 'idol':
        return '他/她是我仰望的对象，我希望有朝一日能达到他/她的水平。';
      default:
        return isPositive ? 
          '我们的关系还不错。' : 
          '我们的关系有些紧张。';
    }
  }
  
  /**
   * 获取关系类型指导
   * 为不同类型的关系提供特定的提示指导
   */
  private static getRelationshipTypeGuidance(type: RelationshipType, strength: number): string {
    const strengthAbs = Math.abs(strength);
    const intensity = strengthAbs < 30 ? '轻微的' : 
                      strengthAbs < 70 ? '中等的' : 
                      '强烈的';
    
    switch (type) {
      case 'enemy':
        return `表达${intensity}敌意，但避免过度仇恨或暴力倾向。语气可以冷淡、警惕或充满怨恨。`;
      case 'rival':
        return `表达竞争感和较劲心态，但也可以暗示一定程度的尊重。语气应该充满挑战性和竞争意识。`;
      case 'stranger':
        return `表达陌生感和距离感，缺乏了解但可能有初步印象。语气应该中立、客观、略带好奇或谨慎。`;
      case 'acquaintance':
        return `表达初步了解但不深入，有基本印象但缺乏情感连接。语气应该友好但保持距离。`;
      case 'colleague':
        return `表达专业关系和工作上的互动，重点在合作而非个人情感。语气应该专业、尊重但不过分亲密。`;
      case 'friend':
        return `表达友谊和互相欣赏，有共同经历但仍在发展中。语气应该友好、温暖、支持性的。`;
      case 'close_friend':
        return `表达深厚友谊、信任和理解，愿意分享私人想法。语气应该亲近、坦诚、关心。`;
      case 'best_friend':
        return `表达极度信任和亲密，无条件支持和深刻理解。语气应该非常亲近、幽默、有内部笑话的感觉。`;
      case 'family':
        return `表达家人般的亲密和无条件支持，即使有摩擦也不改变基础关系。语气应该亲密、直接、有时带有善意的唠叨。`;
      case 'crush':
        return `表达暗恋、好感但尚未表白的感觉，可能有些害羞或紧张。语气应该含蓄、略带羞涩或憧憬。`;
      case 'lover':
        return `表达浪漫爱情和亲密感，情感丰富且深刻。语气应该温柔、浪漫、充满感情。`;
      case 'partner':
        return `表达稳定且深厚的伴侣关系，包含共同成长和面对挑战。语气应该亲密、支持、有默契。`;
      case 'ex':
        return `表达过去的亲密和现在的距离，可能有未解决的感情或已经和平分手。语气应该复杂、略带怀旧或遗憾。`;
      case 'mentor':
        return `表达指导和引领的角色，对学生成长的自豪感。语气应该支持、鼓励、有教育意味。`;
      case 'student':
        return `表达学习和成长，对导师的尊重和感激。语气应该尊敬、好学、有时带有崇拜。`;
      case 'admirer':
        return `表达欣赏和敬佩，但不一定有个人关系。语气应该赞赏、肯定、略带崇拜。`;
      case 'idol':
        return `表达对方是自己的榜样，有强烈的仰慕和追随意愿。语气应该崇拜、向往、有抬高对方的倾向。`;
      default:
        return `表达与关系强度(${strength})相符的情感，保持语气的自然和符合角色性格。`;
    }
  }
  
  /**
   * 生成关系互动回应
   * 根据两个角色的关系生成特定场景下的互动回应
   */
  static async generateInteractionResponse(
    sourceCharacter: Character,
    targetCharacter: Character,
    context: {
      scenario: 'gift' | 'invitation' | 'challenge' | 'support' | 'confession' | 'meeting',
      detail?: string
    },
    apiKey?: string,
    apiSettings?: ApiSettings
  ): Promise<string> {
    if (!apiKey) {
      return this.getDefaultInteractionResponse(sourceCharacter, targetCharacter, context);
    }
    
    try {
      console.log(`【关系提示词服务】生成互动回应：${sourceCharacter.name} -> ${targetCharacter.name}, 场景=${context.scenario}`);
      
      // 获取关系数据
      const relationship = sourceCharacter.relationshipMap?.relationships[targetCharacter.id];
      if (!relationship) {
        return this.getDefaultInteractionResponse(sourceCharacter, targetCharacter, context);
      }
      
      // 构建R框架
      const rFramework: RFrameworkEntry[] = [
        PromptBuilderService.createRFrameworkEntry({
          name: "Source Character",
          content: `你是${sourceCharacter.name}，${sourceCharacter.description || '一个虚拟角色'}。`,
          identifier: "sourceChar"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Target Character",
          content: `${targetCharacter.name}是${targetCharacter.description || '一个虚拟角色'}。`,
          identifier: "targetChar"
        }),
        PromptBuilderService.createRFrameworkEntry({
          name: "Relationship Context",
          content: `你与${targetCharacter.name}的关系类型是"${relationship.type}"，关系强度为${relationship.strength}（范围从-100到100），你们已有${relationship.interactions}次互动。`,
          identifier: "relationContext"
        })
      ];
      
      // 构建D类条目
      const dEntries: DEntry[] = [];
      
      // 添加关系描述
      if (relationship.description) {
        dEntries.push(PromptBuilderService.createDEntry({
          name: "Relationship Description",
          content: `你对${targetCharacter.name}的印象: "${relationship.description}"`,
          depth: 1
        }));
      }
      
      // 添加情境指导
      dEntries.push(PromptBuilderService.createDEntry({
        name: "Scenario Guidance",
        content: this.getScenarioGuidance(context.scenario, relationship.type),
        depth: 0
      }));
      
      // 构建用户消息，基于具体情境
      let userMessage = '';
      switch (context.scenario) {
        case 'gift':
          userMessage = `${targetCharacter.name}送了你一件礼物${context.detail ? `：${context.detail}` : ''}。请以第一人称回应这个礼物，表达你的感受。`;
          break;
        case 'invitation':
          userMessage = `${targetCharacter.name}邀请你${context.detail ? context.detail : '参加一个活动'}。请以第一人称回应这个邀请，表达你的感受和决定。`;
          break;
        case 'challenge':
          userMessage = `${targetCharacter.name}向你发起了挑战${context.detail ? `：${context.detail}` : ''}。请以第一人称回应这个挑战，表达你的态度。`;
          break;
        case 'support':
          userMessage = `${targetCharacter.name}在你需要帮助的时候给予了支持${context.detail ? `：${context.detail}` : ''}。请以第一人称表达你的感谢和感受。`;
          break;
        case 'confession':
          userMessage = `${targetCharacter.name}向你表达了爱意或特别的感情。请以第一人称回应这个表白，表达你的真实感受。`;
          break;
        case 'meeting':
          userMessage = `你偶然遇到了${targetCharacter.name}${context.detail ? `在${context.detail}` : ''}。请以第一人称描述你的反应和你们的简短对话。`;
          break;
        default:
          userMessage = `${targetCharacter.name}与你互动。请以第一人称回应，表达你的感受。`;
      }
      
      // 构建提示词
      const messages = PromptBuilderService.buildPrompt({
        rFramework,
        dEntries,
        userMessage
      });
      
      const prompt = PromptBuilderService.messagesToText(messages);
      
      // 使用当前设置的API服务生成内容
      const response = await ApiServiceProvider.generateContent(
        [{role: 'user', parts: [{text: prompt}]}],
        apiKey,
        apiSettings
      );
      
      // 简单处理响应
      let finalResponse = response.trim();
      
      // 确保响应是第一人称
      if (!finalResponse.includes('我') && !finalResponse.includes('你')) {
        finalResponse = `我${finalResponse}`;
      }
      
      return finalResponse;
      
    } catch (error) {
      console.error('【关系提示词服务】生成互动回应失败:', error);
      return this.getDefaultInteractionResponse(sourceCharacter, targetCharacter, context);
    }
  }
  
  /**
   * 获取默认互动回应
   * 当API调用失败时使用
   */
  private static getDefaultInteractionResponse(
    sourceCharacter: Character,
    targetCharacter: Character,
    context: {
      scenario: 'gift' | 'invitation' | 'challenge' | 'support' | 'confession' | 'meeting',
      detail?: string
    }
  ): string {
    // 获取关系数据，如果没有则假设是陌生人
    const relationship = sourceCharacter.relationshipMap?.relationships[targetCharacter.id];
    const relType = relationship?.type || 'stranger';
    const relStrength = relationship?.strength || 0;
    const isPositive = relStrength >= 0;
    
    // 根据关系类型和情境返回默认回应
    switch (context.scenario) {
      case 'gift':
        if (isPositive) {
          return `谢谢你的礼物，${targetCharacter.name}。这真是太贴心了。`;
        } else {
          return `我没想到你会给我礼物，${targetCharacter.name}。我不知道该说什么。`;
        }
      case 'invitation':
        if (isPositive) {
          return `好的，我很乐意接受你的邀请，${targetCharacter.name}。期待与你共度时光。`;
        } else {
          return `抱歉，${targetCharacter.name}，我这段时间恐怕没有空。`;
        }
      case 'challenge':
        if (isPositive) {
          return `我接受你的挑战，${targetCharacter.name}！这会很有趣。`;
        } else {
          return `我对这种挑战不感兴趣，${targetCharacter.name}。`;
        }
      case 'support':
        if (isPositive) {
          return `谢谢你的帮助，${targetCharacter.name}。你的支持对我来说意义重大。`;
        } else {
          return `我没想到你会帮我，${targetCharacter.name}。谢谢。`;
        }
      case 'confession':
        if (relType === 'lover' || relType === 'crush' || relType === 'partner') {
          return `我也有同样的感受，${targetCharacter.name}。你对我来说很特别。`;
        } else if (isPositive) {
          return `我很感动，${targetCharacter.name}。我需要一些时间来思考我的感受。`;
        } else {
          return `抱歉，${targetCharacter.name}，我不认为我有同样的感觉。`;
        }
      case 'meeting':
        if (isPositive) {
          return `嘿，${targetCharacter.name}！好巧在这里遇到你。最近怎么样？`;
        } else {
          return `${targetCharacter.name}。没想到会在这里见到你。`;
        }
      default:
        if (isPositive) {
          return `很高兴与你交流，${targetCharacter.name}。`;
        } else {
          return `${targetCharacter.name}。`;
        }
    }
  }
  
  /**
   * 获取情境指导
   * 为不同的互动情境提供特定的提示指导
   */
  private static getScenarioGuidance(scenario: string, relationType: RelationshipType): string {
    switch (scenario) {
      case 'gift':
        return `这是一个收到礼物的场景。根据你们的关系(${relationType})，表达适当的感谢和情感反应。
          - 如果是正面关系：表达真诚的感谢、惊喜或感动
          - 如果是负面关系：表达疑惑、怀疑或有保留的感谢
          - 如果是中立关系：表达礼貌的感谢但不过分热情`;
          
      case 'invitation':
        return `这是一个收到邀请的场景。根据你们的关系(${relationType})，表达你的决定和感受。
          - 如果是亲密关系：可以热情接受并表达期待
          - 如果是敌对关系：可以礼貌拒绝或表达怀疑
          - 如果是普通关系：可以根据自己的兴趣程度决定`;
          
      case 'challenge':
        return `这是一个被挑战的场景。根据你们的关系(${relationType})，表达你面对挑战的态度。
          - 如果是竞争关系：表达接受挑战的决心和自信
          - 如果是友好关系：可以幽默地接受或表达这会很有趣
          - 如果是敌对关系：可以冷淡接受或直接拒绝`;
          
      case 'support':
        return `这是一个接受帮助的场景。根据你们的关系(${relationType})，表达你的感谢和感受。
          - 如果是亲密关系：表达深刻的感谢和情感联系
          - 如果是意外的支持：可以表达惊讶和重新评估
          - 如果是敌对关系：可以表达谨慎的感谢和轻微的怀疑`;
          
      case 'confession':
        return `这是一个情感告白的场景。根据你们的关系(${relationType})，表达你的真实感受。
          - 如果已有浪漫关系：可以表达更深的感情和确认
          - 如果有好感但未确认：可以表达惊喜和正面回应
          - 如果没有这方面感情：委婉但明确地表达你的真实感受`;
          
      case 'meeting':
        return `这是一个偶遇的场景。根据你们的关系(${relationType})，描述你的反应和简短对话。
          - 如果是亲密关系：表达惊喜和喜悦
          - 如果是尴尬关系：可以描述短暂的寒暄和借口离开
          - 如果是敌对关系：可以表达冷淡或警惕的态度`;
          
      default:
        return `根据你们的关系(${relationType})，用自然的方式回应这个互动，保持角色性格的一致性。考虑你们之间的历史互动，以及当前的情境。`;
    }
  }
}
