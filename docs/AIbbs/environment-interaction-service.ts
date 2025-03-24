import { Character } from './character';
import { MemoryStreamService } from './memory-stream-service';

export interface ForumLocation {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  type: 'section' | 'thread' | 'area';
  properties?: {
    activeUsers?: number;
    postCount?: number;
    lastActivityTime?: number;
    topics?: string[];
    status?: string;
  };
}

export interface ForumObject {
  id: string;
  name: string;
  type: string;
  locationId: string;
  properties?: Record<string, any>;
  status?: string;
}

export interface EnvironmentState {
  locations: ForumLocation[];
  objects: ForumObject[];
  visibleAgents: {id: string, name: string, status: string}[];
}

export class EnvironmentInteractionService {
  private locationCache: Map<string, ForumLocation> = new Map();
  private objectCache: Map<string, ForumObject> = new Map();
  
  constructor(private memoryStreamService: MemoryStreamService) {}
  
  // 感知角色周围的环境
  async perceiveEnvironment(
    character: Character, 
    environmentState: EnvironmentState
  ): Promise<void> {
    // 更新缓存
    this.updateCaches(environmentState);
    
    // 处理位置感知
    await this.perceiveLocation(character, environmentState);
    
    // 处理对象感知
    await this.perceiveObjects(character, environmentState);
    
    // 处理其他角色感知
    await this.perceiveAgents(character, environmentState);
  }
  
  // 选择合适的位置执行活动
  async selectLocationForActivity(
    character: Character,
    activity: string
  ): Promise<ForumLocation> {
    // 检索角色已知的所有位置
    const knownLocations = await this.retrieveKnownLocations(character);
    
    // 将位置格式化为自然语言描述
    const locationDescriptions = knownLocations.map(loc => 
      `${loc.name}: ${loc.description} (${loc.type}${loc.properties?.status ? `, status: ${loc.properties.status}` : ''})`
    ).join('\n');
    
    // 获取角色摘要
    const characterSummary = await this.getCharacterBasicInfo(character);
    
    // 询问语言模型
    const prompt = `
    ${characterSummary}
    
    ${character.name} is planning to ${activity}.
    
    Known forum locations:
    ${locationDescriptions}
    
    Which location would be most appropriate for ${character.name} to ${activity}?
    Answer with just the name of the location.
    `;
    
    const response = await callLanguageModel(prompt);
    
    // 查找匹配的位置
    const selectedLocationName = response.trim();
    const selectedLocation = knownLocations.find(loc => 
      loc.name.toLowerCase() === selectedLocationName.toLowerCase()
    );
    
    // 如果没有找到匹配的位置，返回默认位置
    return selectedLocation || knownLocations[0];
  }
  
  // 处理与对象的互动
  async interactWithObject(
    character: Character,
    objectId: string,
    interaction: string
  ): Promise<{success: boolean, result: string, newObjectState?: string}> {
    const object = this.objectCache.get(objectId);
    
    if (!object) {
      return {
        success: false,
        result: "Object not found"
      };
    }
    
    // 记录观察
    await this.memoryStreamService.addMemory(
      character.memoryStreamId,
      `${character.name} is ${interaction} with ${object.name}`,
      'observation',
      {
        location: object.locationId,
        objectId: object.id
      }
    );
    
    // 根据互动类型确定对象的新状态
    const prompt = `
    Object: ${object.name} (${object.type})
    Current state: ${object.status || 'normal'}
    Interaction: ${character.name} is ${interaction} with the ${object.name}
    
    What should be the new state of the ${object.name} after this interaction?
    Answer with just the new state in a single word or short phrase.
    `;
    
    const newState = await callLanguageModel(prompt);
    
    return {
      success: true,
      result: `${character.name} successfully ${interaction} with ${object.name}`,
      newObjectState: newState.trim()
    };
  }
  
  // 更新缓存
  private updateCaches(environmentState: EnvironmentState): void {
    for (const location of environmentState.locations) {
      this.locationCache.set(location.id, location);
    }
    
    for (const object of environmentState.objects) {
      this.objectCache.set(object.id, object);
    }
  }
  
  // 感知位置
  private async perceiveLocation(
    character: Character,
    environmentState: EnvironmentState
  ): Promise<void> {
    const currentLocation = environmentState.locations.find(loc => 
      // 这里需要实际逻辑来确定角色当前位置
      loc.properties?.activeUsers && loc.properties.activeUsers > 0
    );
    
    if (!currentLocation) return;
    
    // 添加位置观察到记忆
    await this.memoryStreamService.addMemory(
      character.memoryStreamId,
      `${character.name} is at ${currentLocation.name}`,
      'observation',
      {
        location: currentLocation.id,
        locationType: currentLocation.type
      }
    );
    
    // 如果位置有特殊状态，也记录下来
    if (currentLocation.properties?.status) {
      await this.memoryStreamService.addMemory(
        character.memoryStreamId,
        `${currentLocation.name} is currently ${currentLocation.properties.status}`,
        'observation',
        {
          location: currentLocation.id,
          locationType: currentLocation.type
        }
      );
    }
  }
  
  // 感知对象
  private async perceiveObjects(
    character: Character,
    environmentState: EnvironmentState
  ): Promise<void> {
    // 获取当前位置的对象
    const currentLocation = environmentState.locations.find(loc => 
      // 同样需要实际逻辑来确定角色当前位置
      loc.properties?.activeUsers && loc.properties.activeUsers > 0
    );
    
    if (!currentLocation) return;
    
    const objectsInLocation = environmentState.objects.filter(obj => 
      obj.locationId === currentLocation.id
    );
    
    // 优先记录状态不正常的对象
    for (const object of objectsInLocation) {
      if (object.status && object.status !== 'normal') {
        await this.memoryStreamService.addMemory(
          character.memoryStreamId,
          `${object.name} at ${currentLocation.name} is ${object.status}`,
          'observation',
          {
            location: currentLocation.id,
            objectId: object.id
          }
        );
      }
    }
    
    // 如果对象不多，记录所有对象
    if (objectsInLocation.length <= 3) {
      for (const object of objectsInLocation) {
        if (!object.status || object.status === 'normal') {
          await this.memoryStreamService.addMemory(
            character.memoryStreamId,
            `There is a ${object.name} at ${currentLocation.name}`,
            'observation',
            {
              location: currentLocation.id,
              objectId: object.id
            }
          );
        }
      }
    } 
    // 否则只记录对象概览
    else {
      const objectTypes = [...new Set(objectsInLocation.map(obj => obj.type))];
      
      await this.memoryStreamService.addMemory(
        character.memoryStreamId,
        `There are ${objectsInLocation.length} objects at ${currentLocation.name}, including ${objectTypes.join(', ')}`,
        'observation',
        {
          location: currentLocation.id
        }
      );
    }
  }
  
  // 感知其他角色
  private async perceiveAgents(
    character: Character,
    environmentState: EnvironmentState
  ): Promise<void> {
    // 过滤出当前位置的其他角色
    const otherAgents = environmentState.visibleAgents.filter(agent => 
      agent.id !== character.id
    );
    
    if (otherAgents.length === 0) return;
    
    // 获取当前位置
    const currentLocation = environmentState.locations.find(loc => 
      loc.properties?.activeUsers && loc.properties.activeUsers > 0
    );
    
    if (!currentLocation) return;
    
    // 如果其他角色数量不多，记录每个角色
    if (otherAgents.length <= 3) {
      for (const agent of otherAgents) {
        await this.memoryStreamService.addMemory(
          character.memoryStreamId,
          `${agent.name} is at ${currentLocation.name} and is ${agent.status}`,
          'observation',
          {
            location: currentLocation.id,
            involvedAgentIds: [agent.id]
          }
        );
      }
    } 
    // 否则只记录概览
    else {
      await this.memoryStreamService.addMemory(
        character.memoryStreamId,
        `There are ${otherAgents.length} people at ${currentLocation.name}, including ${otherAgents.slice(0, 3).map(a => a.name).join(', ')} and others`,
        'observation',
        {
          location: currentLocation.id,
          involvedAgentIds: otherAgents.map(a => a.id)
        }
      );
    }
  }
  
  // 检索角色已知的位置
  private async retrieveKnownLocations(character: Character): Promise<ForumLocation[]> {
    // 从记忆中检索角色已知的位置信息
    const locationMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "locations places areas",
      {
        limit: 50
      }
    );
    
    // 从记忆中提取位置ID
    const locationIds = new Set<string>();
    
    for (const memory of locationMemories) {
      if (memory.metadata?.location) {
        locationIds.add(memory.metadata.location);
      }
    }
    
    // 从缓存中获取完整的位置对象
    const knownLocations: ForumLocation[] = [];
    
    for (const id of locationIds) {
      const location = this.locationCache.get(id);
      if (location) {
        knownLocations.push(location);
      }
    }
    
    // 如果没有找到任何位置，返回所有缓存的位置
    // 这是一个后备方案，实际应用中可能需要更复杂的处理
    if (knownLocations.length === 0) {
      return Array.from(this.locationCache.values());
    }
    
    return knownLocations;
  }
  
  // 获取角色基本信息
  private async getCharacterBasicInfo(character: Character): Promise<string> {
    // 检索关于角色自身的高优先级记忆
    const selfMemories = await this.memoryStreamService.retrieveMemories(
      character.memoryStreamId,
      "self identity personality preferences",
      {
        importanceWeight: 2.0,
        limit: 10
      }
    );
    
    // 如果没有找到足够的记忆，返回基本描述
    if (selfMemories.length < 3) {
      return `${character.name} is a user of the forum platform.`;
    }
    
    // 生成摘要
    const memoryContent = selfMemories.map(m => m.content).join('\n');
    
    const prompt = `
    Based on these memories:
    ${memoryContent}
    
    Write a brief 2-3 sentence description of ${character.name}, focusing on their personality and preferences.
    `;
    
    return await callLanguageModel(prompt);
  }
  
  // 确定两个位置是否相邻
  isAdjacentLocation(location1Id: string, location2Id: string): boolean {
    const location1 = this.locationCache.get(location1Id);
    const location2 = this.locationCache.get(location2Id);
    
    if (!location1 || !location2) return false;
    
    // 检查是否有父子关系
    if (location1.parentId === location2.id || location2.parentId === location1.id) {
      return true;
    }
    
    // 检查是否有相同的父节点
    if (location1.parentId && location1.parentId === location2.parentId) {
      return true;
    }
    
    // 这里可以添加更复杂的邻接关系检查逻辑
    
    return false;
  }
  
  // 获取从一个位置到另一个位置的路径
  findPath(startLocationId: string, endLocationId: string): string[] {
    // 如果是相同的位置，返回空路径
    if (startLocationId === endLocationId) {
      return [];
    }
    
    // 如果是相邻位置，直接返回包含目标位置的路径
    if (this.isAdjacentLocation(startLocationId, endLocationId)) {
      return [endLocationId];
    }
    
    // 这里可以实现更复杂的路径查找算法，如广度优先搜索
    // 简化版本：通过共同的父节点查找路径
    const startLocation = this.locationCache.get(startLocationId);
    const endLocation = this.locationCache.get(endLocationId);
    
    if (!startLocation || !endLocation) {
      return [];
    }
    
    // 如果目标位置是起始位置的父节点
    if (startLocation.parentId === endLocationId) {
      return [endLocationId];
    }
    
    // 如果起始位置是目标位置的父节点
    if (endLocation.parentId === startLocationId) {
      return [endLocationId];
    }
    
    // 如果有共同的父节点，则路径是 起点 -> 共同父节点 -> 终点
    if (startLocation.parentId && 
        endLocation.parentId && 
        startLocation.parentId === endLocation.parentId) {
      return [startLocation.parentId, endLocationId];
    }
    
    // 默认情况下，我们可能需要一个全局的导航图
    // 这里简单返回一个空路径，表示无法找到路径
    return [];
  }
  
  // 描述位置的环境
  async describeLocationEnvironment(locationId: string): Promise<string> {
    const location = this.locationCache.get(locationId);
    if (!location) return "Unknown location";
    
    // 获取位置中的对象
    const objectsInLocation = Array.from(this.objectCache.values())
      .filter(obj => obj.locationId === locationId);
    
    // 构建环境描述提示
    const prompt = `
    Location: ${location.name}
    Type: ${location.type}
    Description: ${location.description}
    Status: ${location.properties?.status || 'normal'}
    
    Objects present:
    ${objectsInLocation.map(obj => `- ${obj.name} (${obj.type}): ${obj.status || 'normal'}`).join('\n')}
    
    Describe this environment in 2-3 sentences, focusing on the ambiance and what someone would notice when entering.
    `;
    
    return await callLanguageModel(prompt);
  }
}
