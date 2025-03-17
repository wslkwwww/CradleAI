import { Character } from './character';
import { MemoryStreamService } from './memory-stream-service';
import { ReflectionService } from './reflection-service';

export class CharacterCognitionService {
  constructor(
    private memoryStreamService: MemoryStreamService,
    private reflectionService: ReflectionService
  ) {}
  
  // 处理新观察并更新角色认知
  async processNewObservation(
    character: Character, 
    observation: string,
    metadata?: any
  ): Promise<void> {
    // 添加观察到记忆流
    await this.memoryStreamService.addMemory(
      character.memoryStreamId,
      observation,
      'observation',
      metadata
    );
    
    // 检查是否需要生成反思
    if (await this.reflectionService.shouldGenerateReflection(character)) {
      await this.reflectionService.generateReflection(character);
    }
    
    // 更新角色关注的话题
    await this.updateFocusTopics(character);
  }
  
  // 获取角色自我概念的摘要
  async getCharacterSummary(character: Character): Promise<string> {
    // 检索重要的反思
    const reflections = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "self concept personality identity",
      {
        filterTypes: ['reflection'],
        importanceWeight: 2.0,
        limit: 10
      }
    );
    
    // 检索重要的观察
    const observations = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "important events experiences",
      {
        filterTypes: ['observation'],
        importanceWeight: 2.0,
        limit: 10
      }
    );
    
    // 将记忆合并为一个列表
    const memories = [...reflections, ...observations]
      .sort((a, b) => b.importance - a.importance)
      .map(m => m.content)
      .slice(0, 15);
    
    // 创建角色摘要
    const prompt = `
    Create a concise summary of ${character.name} based on these important memories and reflections:
    
    ${memories.join('\n')}
    
    Summary should include:
    1. Key personality traits
    2. Current interests and goals
    3. Important relationships
    4. Recent significant experiences
    
    Write in third person, about 3-4 paragraphs.
    `;
    
    return await callLanguageModel(prompt);
  }
  
  // 更新角色当前关注的话题
  private async updateFocusTopics(character: Character): Promise<void> {
    // 获取最近的记忆
    const recentMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "recent interests",
      {
        recencyWeight: 3.0,
        limit: 20
      }
    );
    
    const memoryContent = recentMemories.map(m => m.content).join('\n');
    
    // 提取当前关注的话题
    const prompt = `
    Based on these recent memories of ${character.name}:
    
    ${memoryContent}
    
    What are 3-5 topics or themes that ${character.name} is currently most interested in or focused on?
    List each topic as a single word or short phrase, one per line.
    `;
    
    const response = await callLanguageModel(prompt);
    
    // 解析响应
    character.cognition.focusTopics = response
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }
}
