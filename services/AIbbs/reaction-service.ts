import { Character } from './character';
import { MemoryStreamService } from './memory-stream-service';
import { PlanningService } from './planning-service';
import { CharacterCognitionService } from './character-cognition-service';

export interface ReactionContext {
  observer: Character;
  observation: string;
  location: string;
  timestamp: number;
  involvedAgents?: Character[];
}

export interface ReactionResult {
  shouldReact: boolean;
  reaction?: string;
  dialogueContent?: string;
  planChange?: boolean;
}

export class ReactionService {
  constructor(
    private memoryStreamService: MemoryStreamService,
    private characterCognitionService: CharacterCognitionService,
    private planningService: PlanningService
  ) {}
  
  // 处理角色对观察的反应
  async processReaction(context: ReactionContext): Promise<ReactionResult> {
    const { observer, observation, timestamp } = context;
    
    // 检索与观察相关的记忆
    const relevantMemories = await this.retrieveRelevantContextMemories(
      observer, 
      observation
    );
    
    // 获取角色摘要
    const characterSummary = await this.characterCognitionService.getCharacterSummary(observer);
    
    // 生成反应
    const reactionPrompt = `
    ${characterSummary}
    
    It is ${new Date(timestamp).toLocaleString()}.
    ${observer.name}'s status: ${observer.name} is at ${context.location}.
    Observation: ${observation}
    
    Summary of relevant context from ${observer.name}'s memory:
    ${relevantMemories}
    
    Should ${observer.name} react to the observation, and if so, what would be an appropriate reaction?
    Answer in this format:
    React: [Yes/No]
    Reaction: [Description of how the character would react]
    Dialogue: [If the reaction involves speaking, what would the character say]
    `;
    
    const reactionResponse = await callLanguageModel(reactionPrompt);
    
    // 解析反应结果
    return this.parseReactionResponse(reactionResponse);
  }
  
  // 检索与观察相关的上下文记忆
  private async retrieveRelevantContextMemories(
    character: Character,
    observation: string
  ): Promise<string> {
    // 提取观察中可能涉及的实体
    const entities = await this.extractEntitiesFromObservation(observation);
    
    // 构建记忆检索查询
    let memoryQueries = [];
    
    // 为每个实体添加查询
    for (const entity of entities) {
      memoryQueries.push(`${character.name}'s relationship with ${entity}`);
      memoryQueries.push(`What ${character.name} knows about ${entity}`);
    }
    
    // 添加与观察本身相关的查询
    memoryQueries.push(observation);
    
    // 收集所有查询的结果
    const allRelevantMemories = [];
    
    for (const query of memoryQueries) {
      const memories = await this.memoryStreamService.retrieveMemories(
        character.memoryStreamId,
        query,
        {
          limit: 5,
          relevanceWeight: 2.0
        }
      );
      
      allRelevantMemories.push(...memories);
    }
    
    // 去重并按重要性排序
    const uniqueMemories = [...new Map(allRelevantMemories.map(m => 
      [m.id, m])).values()].sort((a, b) => b.importance - a.importance);
    
    // 如果没有找到相关记忆，返回基本信息
    if (uniqueMemories.length === 0) {
      return "No specific memories related to this observation.";
    }
    
    // 为记忆生成摘要
    const memoryContent = uniqueMemories.map(m => m.content).join("\n");
    
    const summaryPrompt = `
    Summarize these relevant memories in 1-3 concise sentences:
    
    ${memoryContent}
    `;
    
    return await callLanguageModel(summaryPrompt);
  }
  
  // 从观察中提取实体
  private async extractEntitiesFromObservation(observation: string): Promise<string[]> {
    const prompt = `
    Extract the key entities (people, objects, concepts) mentioned in this observation:
    "${observation}"
    
    Return only a comma-separated list of entities, with no additional text.
    `;
    
    const response = await callLanguageModel(prompt);
    return response.split(',').map(entity => entity.trim());
  }
  
  // 解析反应响应
  private parseReactionResponse(response: string): ReactionResult {
    const reactMatch = response.match(/React:\s*(Yes|No)/i);
    const shouldReact = reactMatch ? reactMatch[1].toLowerCase() === 'yes' : false;
    
    const reactionMatch = response.match(/Reaction:\s*(.*?)(?=\n|Dialogue:|$)/is);
    const reaction = reactionMatch ? reactionMatch[1].trim() : undefined;
    
    const dialogueMatch = response.match(/Dialogue:\s*(.*?)(?=\n|$)/is);
    const dialogueContent = dialogueMatch ? dialogueMatch[1].trim() : undefined;
    
    return {
      shouldReact,
      reaction,
      dialogueContent,
      planChange: shouldReact // 假设反应通常会导致计划变更
    };
  }
  
  // 生成对话内容
  async generateDialogue(
    speaker: Character,
    listener: Character,
    context: string,
    previousExchange?: string
  ): Promise<string> {
    // 获取角色摘要
    const speakerSummary = await this.characterCognitionService.getCharacterSummary(speaker);
    
    // 检索与听者相关的记忆
    const relevantMemories = await this.memoryStreamService.retrieveMemories(
      speaker.memoryStreamId,
      `memories about ${listener.name}`,
      {
        limit: 8,
        relevanceWeight: 2.0
      }
    );
    
    const memoryContent = relevantMemories.map(m => m.content).join("\n");
    
    // 构建对话提示
    const dialoguePrompt = `
    ${speakerSummary}
    
    ${speaker.name} is speaking to ${listener.name}.
    
    Context: ${context}
    
    What ${speaker.name} knows about ${listener.name}:
    ${memoryContent}
    
    ${previousExchange ? `Previous exchange:\n${previousExchange}\n\n` : ''}
    
    How would ${speaker.name} respond? Write only ${speaker.name}'s dialogue without any other text.
    `;
    
    return await callLanguageModel(dialoguePrompt);
  }
}
