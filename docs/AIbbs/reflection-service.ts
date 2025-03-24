import { MemoryStreamService, MemoryRecord } from './memory-stream-service';
import { Character } from './character';

export class ReflectionService {
  constructor(private memoryStreamService: MemoryStreamService) {}
  
  // 检查是否需要触发反思
  async shouldGenerateReflection(character: Character): Promise<boolean> {
    if (!character.cognition) return false;
    
    // 获取自上次反思以来的观察记忆
    const recentMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "recent observations",
      {
        filterTypes: ['observation'],
        recencyWeight: 2.0,
        limit: 100
      }
    );
    
    // 计算重要性总和
    const importanceSum = recentMemories.reduce((sum, memory) => sum + memory.importance, 0);
    
    // 检查是否超过阈值
    return importanceSum >= character.cognition.reflectionThreshold;
  }
  
  // 生成反思
  async generateReflection(character: Character): Promise<MemoryRecord[]> {
    // 获取最近的记忆
    const recentMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "recent memories",
      {
        recencyWeight: 2.0,
        limit: 100
      }
    );
    
    // 生成反思问题
    const reflectionQuestions = await this.generateReflectionQuestions(
      character,
      recentMemories
    );
    
    const reflections: MemoryRecord[] = [];
    
    // 为每个问题生成反思
    for (const question of reflectionQuestions) {
      // 检索与问题相关的记忆
      const relevantMemories = await this.memoryStreamService.retrieveMemories(
        character.memoryStreamId,
        question,
        {
          relevanceWeight: 2.0,
          limit: 15
        }
      );
      
      // 生成反思内容
      const reflection = await this.createReflectionContent(
        character,
        question,
        relevantMemories
      );
      
      // 保存反思到记忆流
      const reflectionRecord = await this.memoryStreamService.addMemory(
        character.memoryStreamId,
        reflection.content,
        'reflection',
        {
          topics: reflection.topics,
          relatedMemoryIds: relevantMemories.map(m => m.id)
        }
      );
      
      reflections.push(reflectionRecord);
    }
    
    // 更新角色的最后反思时间
    character.cognition.lastReflectionTime = Date.now();
    
    return reflections;
  }
  
  // 生成反思问题
  private async generateReflectionQuestions(
    character: Character,
    memories: MemoryRecord[]
  ): Promise<string[]> {
    // 准备提供给语言模型的记忆内容
    const memoryContent = memories.map(m => m.content).join("\n");
    
    const prompt = `
    Given only the information below about ${character.name}, what are 3 most salient high-level questions 
    we can answer about ${character.name}'s recent experiences, relationships, or interests?
    
    Recent memories:
    ${memoryContent}
    
    Provide exactly 3 questions, each on a new line. Questions should be insightful and promote deeper understanding.
    `;
    
    const response = await callLanguageModel(prompt);
    
    // 解析响应中的问题
    return response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.endsWith('?'))
      .slice(0, 3);
  }
  
  // 创建反思内容
  private async createReflectionContent(
    character: Character,
    question: string,
    relevantMemories: MemoryRecord[]
  ): Promise<{content: string, topics: string[]}> {
    // 准备记忆内容，包括编号以便引用
    const numberedMemories = relevantMemories.map((m, i) => 
      `${i+1}. ${m.content}`
    ).join('\n');
    
    const prompt = `
    Statements about ${character.name}:
    ${numberedMemories}
    
    Based on the above statements, please answer this question: "${question}"
    
    Provide 3-5 high-level insights you can infer from the above statements, citing the statement numbers as evidence.
    Format each insight as: "Insight (because of X, Y, Z)" where X, Y, Z are statement numbers.
    `;
    
    const response = await callLanguageModel(prompt);
    
    // 提取主要话题
    const topicsPrompt = `
    Based on this reflection:
    "${response}"
    
    List 3-5 key topics or themes mentioned in this reflection, as single words or short phrases.
    `;
    
    const topicsResponse = await callLanguageModel(topicsPrompt);
    const topics = topicsResponse
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    
    return {
      content: `Reflection on "${question}": ${response}`,
      topics
    };
  }
}
