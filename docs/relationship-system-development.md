````markdown
# 角色关系系统开发方案

## 目录
1. [系统概览](#系统概览)
2. [关系图谱构建](#关系图谱构建)
3. [阶层/团体构建](#阶层团体构建)
4. [关系影响行为](#关系影响行为)
5. [圈子/群组呈现](#圈子群组呈现)
6. [开发路线图](#开发路线图)

## 系统概览

角色关系系统将在现有朋友圈互动功能的基础上，构建一个动态的角色关系网络，实现更深层次、更符合人格特性的角色互动。该系统将包含横向关系图谱（角色之间的直接关系）和纵向阶层体系（角色在群体中的地位），并通过这些关系影响角色的社交行为。

### 核心目标

1. 建立动态关系图谱，根据互动自动更新角色关系
2. 实现角色阶层和社交团体的构建与维护
3. 让角色关系直接影响其社交行为和内容生成
4. 在UI层面以群组形式呈现角色关系网络

### 与现有系统的集成点

现有朋友圈系统已经实现了：
- 角色发布帖子
- 角色对帖子的点赞/评论
- 角色对评论的回复
- 互动频率控制

关系系统将在这些基础上进行扩展，主要修改点包括：
- 添加关系数据结构到角色模型
- 增强CircleService，支持关系处理
- 修改互动生成逻辑，考虑关系因素
- 扩展UI展示，支持关系与群组

## 关系图谱构建

### 数据结构设计

首先需要在角色模型中添加关系相关的数据结构：

```typescript
// 关系类型枚举
enum RelationshipType {
  FRIEND = 'friend',           // 朋友
  CLOSE_FRIEND = 'closeFriend', // 亲密朋友
  FAMILY = 'family',           // 家人
  COLLEAGUE = 'colleague',     // 同事
  ACQUAINTANCE = 'acquaintance', // 熟人
  RIVAL = 'rival',             // 竞争对手
  ENEMY = 'enemy',             // 敌人
  ADMIRER = 'admirer',         // 崇拜者
  MENTOR = 'mentor',           // 导师
  STUDENT = 'student',         // 学生
  LOVER = 'lover',             // 恋人
  UNKNOWN = 'unknown'          // 未知关系
}

// 关系强度范围：-100 (极度敌对) 到 100 (极度亲密)
// -100 ~ -60: 敌对
// -60 ~ -20: 不友好
// -20 ~ 20: 中立
// 20 ~ 60: 友好
// 60 ~ 100: 亲密

// 单向关系数据结构
interface Relationship {
  targetId: string;            // 目标角色ID
  type: RelationshipType;      // 关系类型
  strength: number;            // 关系强度 (-100 到 100)
  context: string;             // 关系上下文/历史
  interactions: number;        // 互动次数
  lastInteraction: number;     // 上次互动时间戳
}

// 扩展角色模型
interface Character {
  // ...现有属性
  relationships: Relationship[]; // 角色关系数组
  relationshipStats: {
    averageStrength: number;   // 平均关系强度
    strongestRelationship: {   // 最强关系
      targetId: string;
      strength: number;
    };
    weakestRelationship: {     // 最弱关系
      targetId: string; 
      strength: number;
    };
  }
}
```

### 关系初始化逻辑

在系统初次启动或添加新角色时，需要初始化角色关系：

1. **基于角色设定的初始化**：根据角色描述、性格特点和背景故事，自动生成初始关系

```typescript
/**
 * 初始化角色关系
 * @param character 需要初始化关系的角色
 * @param allCharacters 系统中所有角色
 */
async function initializeRelationships(character: Character, allCharacters: Character[]): Promise<Character> {
  // 排除自己
  const otherCharacters = allCharacters.filter(c => c.id !== character.id);
  
  // 确保relationships属性存在
  if (!character.relationships) {
    character.relationships = [];
  }
  
  // 对于每个其他角色，生成初始关系
  for (const other of otherCharacters) {
    // 检查是否已存在关系
    if (character.relationships.some(r => r.targetId === other.id)) {
      continue; // 跳过已有关系的角色
    }
    
    // 使用LLM分析两个角色的关系
    const initialRelationship = await analyzeInitialRelationship(character, other);
    character.relationships.push(initialRelationship);
    
    // 更新关系统计
    updateRelationshipStats(character);
  }
  
  return character;
}

/**
 * 使用LLM分析两个角色之间的初始关系
 */
async function analyzeInitialRelationship(character: Character, other: Character): Promise<Relationship> {
  // 构建提示模板
  const prompt = `
  分析以下两个角色之间的可能关系:
  
  角色1: ${character.name}
  描述: ${character.description}
  性格: ${character.personality || '未指定'}
  
  角色2: ${other.name}
  描述: ${other.description}
  性格: ${other.personality || '未指定'}
  
  请返回以下JSON格式的结果:
  {
    "type": "关系类型(friend/closeFriend/family/colleague/acquaintance/rival/enemy/admirer/mentor/student/lover/unknown)",
    "strength": "关系强度(-100到100之间的整数, -100表示极度敌对, 100表示极度亲密)",
    "context": "简要描述他们关系的上下文和历史"
  }
  `;
  
  // 调用LLM获取关系分析结果
  // ...调用LLM的代码...
  
  // 解析并返回结果
  return {
    targetId: other.id,
    type: RelationshipType.UNKNOWN, // 默认值，将被LLM结果替换
    strength: 0,                    // 默认值，将被LLM结果替换
    context: '',                    // 默认值，将被LLM结果替换
    interactions: 0,
    lastInteraction: Date.now()
  };
}
```

### 关系更新机制

角色关系应当基于互动动态更新，每次互动后都需要评估对关系的影响：

```typescript
/**
 * 根据互动更新角色关系
 * @param character 当前角色
 * @param targetId 目标角色ID
 * @param interactionType 互动类型
 * @param content 互动内容
 * @param sentiment 情感分析结果 (-1到1)
 */
async function updateRelationshipAfterInteraction(
  character: Character,
  targetId: string,
  interactionType: 'post' | 'comment' | 'like',
  content: string,
  sentiment: number
): Promise<Character> {
  // 查找现有关系
  const relationshipIndex = character.relationships.findIndex(r => r.targetId === targetId);
  
  // 如果没有现有关系，创建新关系
  if (relationshipIndex === -1) {
    const targetCharacter = await getCharacterById(targetId);
    if (!targetCharacter) return character;
    
    const newRelationship = await analyzeInitialRelationship(character, targetCharacter);
    character.relationships.push(newRelationship);
    return updateRelationshipAfterInteraction(character, targetId, interactionType, content, sentiment);
  }
  
  // 获取当前关系
  const relationship = character.relationships[relationshipIndex];
  
  // 根据互动类型和情感分析调整关系强度
  let strengthDelta = 0;
  
  // 基础变化值
  switch (interactionType) {
    case 'like':
      strengthDelta = 1; // 点赞是轻度正向互动
      break;
    case 'comment':
      strengthDelta = 3; // 评论是中度互动
      break;
    case 'post':
      strengthDelta = 2; // 回应帖子是中度互动
      break;
  }
  
  // 情感乘数 (-1 到 1) * 2 + 1 = (0 到 3)
  // 负面情感：强度变化 * 0 = 0 或负值
  // 中性情感：强度变化 * 1 = 原值
  // 正面情感：强度变化 * 3 = 3倍提升
  const sentimentMultiplier = sentiment * 2 + 1;
  
  // 计算最终强度变化
  strengthDelta = strengthDelta * sentimentMultiplier;
  
  // 特殊关系类型处理
  if (relationship.type === RelationshipType.RIVAL) {
    // 对手关系下，正面互动缓慢改善，负面互动快速恶化
    if (strengthDelta > 0) strengthDelta *= 0.5;
    else strengthDelta *= 1.5;
  } else if (relationship.type === RelationshipType.ADMIRER) {
    // 崇拜者关系，正面互动效果增强
    if (strengthDelta > 0) strengthDelta *= 1.5;
  }
  
  // 更新关系强度，确保在-100到100之间
  relationship.strength = Math.max(-100, Math.min(100, relationship.strength + strengthDelta));
  
  // 更新互动统计
  relationship.interactions++;
  relationship.lastInteraction = Date.now();
  
  // 根据新强度值更新关系类型
  relationship.type = determineRelationshipType(relationship.strength, relationship.type);
  
  // 更新关系上下文
  relationship.context = await updateRelationshipContext(
    relationship.context,
    interactionType,
    content,
    sentiment
  );
  
  // 更新角色的关系
  character.relationships[relationshipIndex] = relationship;
  
  // 更新关系统计
  updateRelationshipStats(character);
  
  return character;
}

/**
 * 根据关系强度确定关系类型
 */
function determineRelationshipType(strength: number, currentType: RelationshipType): RelationshipType {
  // 如果是特殊关系类型，保持不变
  if ([RelationshipType.FAMILY, RelationshipType.MENTOR, RelationshipType.STUDENT, RelationshipType.LOVER].includes(currentType)) {
    return currentType;
  }
  
  // 根据强度确定类型
  if (strength <= -60) return RelationshipType.ENEMY;
  if (strength <= -20) return RelationshipType.RIVAL;
  if (strength <= 20) return RelationshipType.ACQUAINTANCE;
  if (strength <= 60) return RelationshipType.FRIEND;
  return RelationshipType.CLOSE_FRIEND;
}

/**
 * 更新关系统计
 */
function updateRelationshipStats(character: Character): void {
  if (!character.relationships || character.relationships.length === 0) {
    character.relationshipStats = {
      averageStrength: 0,
      strongestRelationship: { targetId: '', strength: 0 },
      weakestRelationship: { targetId: '', strength: 0 }
    };
    return;
  }
  
  // 计算平均强度
  const totalStrength = character.relationships.reduce((sum, r) => sum + r.strength, 0);
  const averageStrength = totalStrength / character.relationships.length;
  
  // 找出最强和最弱关系
  const strongest = character.relationships.reduce(
    (prev, curr) => prev.strength > curr.strength ? prev : curr
  );
  
  const weakest = character.relationships.reduce(
    (prev, curr) => prev.strength < curr.strength ? prev : curr
  );
  
  character.relationshipStats = {
    averageStrength,
    strongestRelationship: { targetId: strongest.targetId, strength: strongest.strength },
    weakestRelationship: { targetId: weakest.targetId, strength: weakest.strength }
  };
}
```

### 情感分析集成

为了准确更新关系，我们需要对互动内容进行情感分析：

```typescript
/**
 * 分析内容的情感倾向
 * @param content 内容文本
 * @returns 情感得分 (-1到1)，-1为极度负面，1为极度正面
 */
async function analyzeSentiment(content: string): Promise<number> {
  // 调用LLM或情感分析API
  const prompt = `
  请分析以下文本的情感倾向:
  "${content}"
  
  只返回一个-1到1之间的数字，其中:
  -1表示极度负面
  0表示中性
  1表示极度正面
  `;
  
  // 调用API获取结果
  // ...调用API的代码...
  
  // 解析并返回情感得分
  return 0; // 默认返回中性，将被API结果替换
}

/**
 * 更新关系上下文
 */
async function updateRelationshipContext(
  currentContext: string,
  interactionType: 'post' | 'comment' | 'like',
  content: string,
  sentiment: number
): Promise<string> {
  // 构建互动描述
  let interactionDescription = '';
  
  switch (interactionType) {
    case 'like':
      interactionDescription = '点赞了一条内容';
      break;
    case 'comment':
      interactionDescription = `发表评论: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;
      break;
    case 'post':
      interactionDescription = `回应了帖子: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;
      break;
  }
  
  // 情感描述
  let sentimentDescription = '';
  if (sentiment <= -0.7) sentimentDescription = '，态度非常消极';
  else if (sentiment <= -0.3) sentimentDescription = '，态度消极';
  else if (sentiment <= 0.3) sentimentDescription = '，态度中立';
  else if (sentiment <= 0.7) sentimentDescription = '，态度积极';
  else sentimentDescription = '，态度非常积极';
  
  // 生成新的互动记录
  const timeStr = new Date().toISOString().split('T')[0];
  const newInteraction = `${timeStr}: ${interactionDescription}${sentimentDescription}。`;
  
  // 如果上下文为空，直接返回新互动
  if (!currentContext || currentContext.trim() === '') {
    return newInteraction;
  }
  
  // 最多保留5条互动记录
  const contextLines = currentContext.split('\n');
  contextLines.push(newInteraction);
  
  if (contextLines.length > 5) {
    contextLines.shift(); // 移除最旧的记录
  }
  
  return contextLines.join('\n');
}
```

### CircleService 扩展

我们需要扩展现有的 CircleService 类，添加关系处理功能：

```typescript
export class CircleService {
  // ...现有代码...
  
  /**
   * 分析互动内容并更新角色关系
   */
  static async processRelationshipUpdate(
    character: Character,
    targetCharacter: Character,
    interactionType: 'post' | 'comment' | 'like',
    content: string
  ): Promise<Character> {
    try {
      // 分析内容情感
      const sentiment = await analyzeSentiment(content);
      
      // 更新关系
      const updatedCharacter = await updateRelationshipAfterInteraction(
        character,
        targetCharacter.id,
        interactionType,
        content,
        sentiment
      );
      
      console.log(`【关系系统】角色 ${character.name} 与 ${targetCharacter.name} 的关系更新，当前强度: ${
        updatedCharacter.relationships.find(r => r.targetId === targetCharacter.id)?.strength
      }`);
      
      return updatedCharacter;
    } catch (error) {
      console.error(`【关系系统】更新关系失败:`, error);
      return character;
    }
  }
  
  /**
   * 获取与特定角色的关系
   */
  static getRelationshipWith(character: Character, targetId: string): Relationship | null {
    if (!character.relationships) return null;
    return character.relationships.find(r => r.targetId === targetId) || null;
  }
  
  /**
   * 获取关系描述
   */
  static getRelationshipDescription(relationship: Relationship | null): string {
    if (!relationship) return '无关系';
    
    let strengthDesc = '';
    if (relationship.strength <= -60) strengthDesc = '极度敌对';
    else if (relationship.strength <= -20) strengthDesc = '不友好';
    else if (relationship.strength <= 20) strengthDesc = '中立';
    else if (relationship.strength <= 60) strengthDesc = '友好';
    else strengthDesc = '亲密';
    
    const typeDesc = {
      [RelationshipType.FRIEND]: '朋友',
      [RelationshipType.CLOSE_FRIEND]: '亲密朋友',
      [RelationshipType.FAMILY]: '家人',
      [RelationshipType.COLLEAGUE]: '同事',
      [RelationshipType.ACQUAINTANCE]: '熟人',
      [RelationshipType.RIVAL]: '竞争对手',
      [RelationshipType.ENEMY]: '敌人',
      [RelationshipType.ADMIRER]: '崇拜者',
      [RelationshipType.MENTOR]: '导师',
      [RelationshipType.STUDENT]: '学生',
      [RelationshipType.LOVER]: '恋人',
      [RelationshipType.UNKNOWN]: '未知关系'
    }[relationship.type];
    
    return `${typeDesc}（${strengthDesc}）`;
  }
  
  /**
   * 修改现有的processCircleInteraction方法，整合关系影响
   */
  static async processCircleInteraction(
    character: Character, 
    post: CirclePost,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      // ...现有代码...
      
      // 获取与发帖人的关系
      const targetCharacter = characters.find(c => c.id === post.characterId);
      if (!targetCharacter) {
        throw new Error(`找不到ID为 ${post.characterId} 的角色`);
      }
      
      const relationship = this.getRelationshipWith(character, targetCharacter.id);
      
      // 将关系信息添加到互动上下文中
      let relationshipContext = '';
      if (relationship) {
        relationshipContext = `你与${targetCharacter.name}的关系是: ${this.getRelationshipDescription(relationship)}。
你们之前的互动: ${relationship.context || '无记录'}`;
      }
      
      // 修改postOptions，添加关系上下文
      const postOptions: CirclePostOptions = {
        // ...现有postOptions代码...
        content: {
          // ...现有content代码...
          context: `${postOptions.content.context}\n\n${relationshipContext}`
        }
      };
      
      // 获取互动响应
      const response = await this.getNodeST(apiKey).processCircleInteraction(postOptions);
      
      // 如果互动成功，更新关系
      if (response.success) {
        // 提取互动内容
        let interactionContent = post.content;
        if (response.action?.comment) {
          interactionContent = response.action.comment;
        }
        
        // 确定互动类型
        const interactionType = response.action?.comment ? 'comment' : (response.action?.like ? 'like' : 'post');
        
        // 更新关系
        const updatedCharacter = await this.processRelationshipUpdate(
          character,
          targetCharacter,
          interactionType,
          interactionContent
        );
        
        // 保存更新后的角色
        await updateCharacter(updatedCharacter);
      }
      
      return response;
    } catch (error) {
      console.error(`【朋友圈服务】角色 ${character.name} 的朋友圈互动处理失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '朋友圈互动处理过程中发生未知错误'
      };
    }
  }
  
  // 类似地修改其他互动方法，如replyToComment，processCommentInteraction等
}
```

### 可视化关系图谱

为了直观展示角色关系网络，我们可以提供关系可视化功能：

```typescript
/**
 * 生成关系图谱数据，用于可视化
 */
function generateRelationshipGraph(characters: Character[]): {
  nodes: Array<{id: string, name: string, avatar: string}>,
  links: Array<{source: string, target: string, strength: number, type: string}>
} {
  const nodes = characters.map(c => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar || ''
  }));
  
  const links: Array<{source: string, target: string, strength: number, type: string}> = [];
  
  // 收集所有关系连接
  characters.forEach(character => {
    if (!character.relationships) return;
    
    character.relationships.forEach(rel => {
      // 只添加强度不为0的关系
      if (rel.strength !== 0) {
        links.push({
          source: character.id,
          target: rel.targetId,
          strength: rel.strength,
          type: rel.type
        });
      }
    });
  });
  
  return { nodes, links };
}
```

### 关系图谱初始化核心流程

总结一下角色关系图谱构建的核心流程：

1. **系统启动时**:
   - 检查每个角色是否已有关系数据
   - 对没有关系数据的角色，执行初始化

2. **新角色添加时**:
   - 分析新角色与已有角色的潜在关系
   - 创建初始关系数据

3. **角色互动时**:
   - 分析互动内容的情感倾向
   - 基于互动类型和情感分析更新关系强度
   - 更新关系类型和上下文
   - 保存更新后的关系数据

4. **关系展示**:
   - 生成关系图数据
   - 在UI中可视化展示

这个框架为角色关系图谱的构建提供了坚实的基础。在下一部分，我们将探讨阶层和团体构建的实现方案。


#################################################################################################

## 阶层/团体构建

在构建完角色之间的横向关系图谱后，我们需要实现纵向的阶层体系和社交团体结构。这部分将定义角色在社会群体中的地位、身份和所属圈子，进一步丰富角色间的互动模式。

### 数据结构设计

首先需要定义阶层和团体的核心数据结构：

```typescript
// 阶层等级枚举
enum HierarchyLevel {
  LEADER = 'leader',           // 领导者
  SENIOR = 'senior',           // 资深成员
  REGULAR = 'regular',         // 普通成员
  JUNIOR = 'junior',           // 初级成员
  OUTSIDER = 'outsider'        // 圈外人
}

// 团体类型
enum GroupType {
  PROFESSIONAL = 'professional', // 专业/工作团体
  SOCIAL = 'social',           // 社交团体
  INTEREST = 'interest',       // 兴趣团体
  FAMILY = 'family',           // 家庭团体
  EDUCATION = 'education',     // 教育团体
  POLITICAL = 'political',     // 政治团体
  RELIGIOUS = 'religious',     // 宗教团体
  OTHER = 'other'              // 其他类型
}

// 团体结构
interface Group {
  id: string;                  // 团体唯一ID
  name: string;                // 团体名称
  description: string;         // 团体描述
  type: GroupType;             // 团体类型
  avatar?: string;             // 团体头像
  tags: string[];              // 团体标签
  createdAt: number;           // 创建时间戳
  rules?: string[];            // 团体规则
  visibility: 'public' | 'private'; // 可见性
  members: GroupMembership[];  // 成员列表
  posts?: string[];            // 团体相关帖子ID
}

// 团体成员关系
interface GroupMembership {
  characterId: string;         // 角色ID
  joinedAt: number;            // 加入时间戳
  level: HierarchyLevel;       // 成员阶层
  contributions: number;       // 贡献度
  roleTitle?: string;          // 自定义角色头衔
  permissions: string[];       // 权限列表
}

// 扩展角色模型，添加团体相关属性
interface Character {
  // ...现有属性
  // 关系图谱相关属性
  relationships: Relationship[];
  relationshipStats: {
    averageStrength: number;
    strongestRelationship: { targetId: string; strength: number };
    weakestRelationship: { targetId: string; strength: number };
  };
  
  // 阶层相关新增属性
  groups: string[];                  // 所属团体ID列表
  defaultHierarchyLevel: HierarchyLevel; // 默认阶层等级
  socialInfluence: number;           // 社会影响力 (0-100)
  personalityTraits: string[];       // 影响阶层地位的性格特质
  leadershipTendency: number;        // 领导倾向 (0-100)
  conformityTendency: number;        // 从众倾向 (0-100)
}
```

### 自动团体检测与生成

系统将检测角色间的关系模式，自动形成有意义的社交团体：

```typescript
/**
 * 基于角色关系分析并生成可能的社交团体
 * @param characters 系统中所有角色
 */
async function detectAndCreateGroups(characters: Character[]): Promise<Group[]> {
  const potentialGroups: Group[] = [];
  
  // 1. 基于现有关系强度检测紧密社交圈
  const socialGroups = await detectSocialGroups(characters);
  potentialGroups.push(...socialGroups);
  
  // 2. 基于角色背景信息检测专业/工作团体
  const professionalGroups = await detectProfessionalGroups(characters);
  potentialGroups.push(...professionalGroups);
  
  // 3. 基于兴趣爱好检测兴趣团体
  const interestGroups = await detectInterestGroups(characters);
  potentialGroups.push(...interestGroups);
  
  // 4. 检查并合并相似团体，避免冗余
  const mergedGroups = mergeOverlappingGroups(potentialGroups);
  
  // 5. 为每个团体分配适当的阶层结构
  const finalGroups = assignHierarchyLevels(mergedGroups, characters);
  
  console.log(`【团体系统】自动检测到 ${finalGroups.length} 个可能的社交团体`);
  return finalGroups;
}

/**
 * 检测紧密社交圈
 */
async function detectSocialGroups(characters: Character[]): Promise<Group[]> {
  const groups: Group[] = [];
  
  // 构建关系强度矩阵
  const relationMatrix = buildRelationshipMatrix(characters);
  
  // 使用社区检测算法找出紧密关系团体
  // 这里可以使用多种算法，如Louvain方法、Girvan-Newman算法等
  const communities = detectCommunities(relationMatrix, characters);
  
  // 为每个检测到的社区创建团体
  for (const community of communities) {
    if (community.members.length < 3) {
      // 忽略过小的团体
      continue;
    }
    
    // 使用LLM生成团体名称和描述
    const { name, description, type } = await generateGroupDetails(community.members, characters);
    
    const group: Group = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      description,
      type: type as GroupType || GroupType.SOCIAL,
      tags: [],
      createdAt: Date.now(),
      visibility: 'public',
      members: community.members.map(memberId => {
        const character = characters.find(c => c.id === memberId);
        return {
          characterId: memberId,
          joinedAt: Date.now(),
          // 临时分配阶层，后续会基于角色特性进行调整
          level: HierarchyLevel.REGULAR,
          contributions: 0,
          permissions: ['post', 'comment']
        };
      })
    };
    
    groups.push(group);
  }
  
  return groups;
}

/**
 * 构建角色关系强度矩阵
 */
function buildRelationshipMatrix(characters: Character[]): number[][] {
  const n = characters.length;
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // 填充矩阵
  for (let i = 0; i < n; i++) {
    const char1 = characters[i];
    if (!char1.relationships) continue;
    
    for (let j = 0; j < n; j++) {
      if (i === j) {
        // 对角线设为0（自己与自己）
        matrix[i][j] = 0;
        continue;
      }
      
      const char2 = characters[j];
      // 查找角色1到角色2的关系
      const relationship = char1.relationships.find(r => r.targetId === char2.id);
      
      if (relationship) {
        // 将关系强度从 -100~100 映射到 0~1
        const normStrength = (relationship.strength + 100) / 200;
        matrix[i][j] = normStrength;
      }
    }
  }
  
  return matrix;
}

/**
 * 使用LLM生成团体的名称、描述和类型
 */
async function generateGroupDetails(
  memberIds: string[], 
  characters: Character[]
): Promise<{ name: string; description: string; type: string }> {
  // 获取成员角色信息
  const members = memberIds.map(id => characters.find(c => c.id === id))
    .filter(Boolean) as Character[];
  
  // 提取角色信息
  const memberInfo = members.map(m => ({
    name: m.name,
    description: m.description?.substring(0, 200) || '',
    traits: m.personalityTraits || []
  }));
  
  // LLM提示模板
  const prompt = `
  我需要为一个由以下角色组成的社交团体创建名称和描述：
  
  ${memberInfo.map((m, i) => `成员${i+1}: ${m.name}
  简介: ${m.description}
  特质: ${m.traits.join(', ')}
  `).join('\n')}
  
  请分析这些角色之间可能的共同点，并以JSON格式返回一个适当的团体名称、描述和类型：
  {
    "name": "团体名称（简短有特色）",
    "description": "团体描述（100字以内）",
    "type": "团体类型(professional/social/interest/family/education/political/religious/other)"
  }
  `;
  
  // 调用LLM获取结果
  // ...调用LLM的代码...
  
  // 默认返回值，实际应该由LLM生成
  return {
    name: `${members[0]?.name || '未命名'}的圈子`,
    description: '一个由志同道合的朋友组成的社交圈',
    type: GroupType.SOCIAL
  };
}

/**
 * 基于角色职业背景检测专业团体
 */
async function detectProfessionalGroups(characters: Character[]): Promise<Group[]> {
  // 按职业或专业领域聚类
  const professionClusters = new Map<string, Character[]>();
  
  for (const character of characters) {
    // 提取角色职业信息（示例实现）
    const profession = extractProfessionFromDescription(character);
    
    if (profession) {
      if (!professionClusters.has(profession)) {
        professionClusters.set(profession, []);
      }
      professionClusters.get(profession)?.push(character);
    }
  }
  
  const groups: Group[] = [];
  
  // 为每个专业聚类创建团体
  for (const [profession, members] of professionClusters.entries()) {
    if (members.length < 2) continue; // 至少需要2人才形成团体
    
    const group: Group = {
      id: `prof-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: `${profession}专业圈`,
      description: `由从事${profession}相关工作的角色组成的专业团体`,
      type: GroupType.PROFESSIONAL,
      tags: [profession, '专业', '工作'],
      createdAt: Date.now(),
      visibility: 'public',
      members: members.map(character => ({
        characterId: character.id,
        joinedAt: Date.now(),
        level: HierarchyLevel.REGULAR,
        contributions: 0,
        permissions: ['post', 'comment']
      }))
    };
    
    groups.push(group);
  }
  
  return groups;
}

/**
 * 从角色描述中提取职业信息
 */
function extractProfessionFromDescription(character: Character): string | null {
  // 这是一个简化的实现，实际应用中可能需要更复杂的NLP方法
  // 常见职业关键词列表
  const professions = [
    '医生', '护士', '教师', '工程师', '律师', '会计', '艺术家', '作家',
    '程序员', '设计师', '研究员', '学生', '教授', '记者', '厨师', '商人'
  ];
  
  const description = character.description || '';
  
  for (const profession of professions) {
    if (description.includes(profession)) {
      return profession;
    }
  }
  
  // 如果没有找到匹配的职业，返回null
  return null;
}

/**
 * 合并重叠度高的团体
 */
function mergeOverlappingGroups(groups: Group[]): Group[] {
  if (groups.length <= 1) return groups;
  
  const result: Group[] = [...groups];
  let merged = true;
  
  while (merged) {
    merged = false;
    
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        // 计算两个团体成员的重叠度
        const overlapRatio = calculateOverlap(result[i], result[j]);
        
        // 如果重叠度超过阈值，合并团体
        if (overlapRatio > 0.7) {
          result[i] = mergeGroups(result[i], result[j]);
          result.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }
  
  return result;
}

/**
 * 计算两个团体成员的重叠度
 */
function calculateOverlap(group1: Group, group2: Group): number {
  const members1 = new Set(group1.members.map(m => m.characterId));
  const members2 = new Set(group2.members.map(m => m.characterId));
  
  // 计算交集大小
  const intersection = new Set([...members1].filter(x => members2.has(x)));
  
  // 计算并集大小
  const union = new Set([...members1, ...members2]);
  
  // 计算Jaccard相似度
  return intersection.size / union.size;
}

/**
 * 合并两个团体
 */
function mergeGroups(group1: Group, group2: Group): Group {
  // 合并成员列表，确保没有重复
  const memberMap = new Map<string, GroupMembership>();
  
  [...group1.members, ...group2.members].forEach(member => {
    if (!memberMap.has(member.characterId) || memberMap.get(member.characterId)!.joinedAt > member.joinedAt) {
      memberMap.set(member.characterId, member);
    }
  });
  
  // 合并帖子
  const posts = [...(group1.posts || []), ...(group2.posts || [])];
  
  return {
    ...group1,
    name: group1.name, // 保留第一个团体的名称
    description: `${group1.description} & ${group2.description}`,
    tags: [...new Set([...group1.tags, ...group2.tags])], // 合并去重
    members: Array.from(memberMap.values()),
    posts: [...new Set(posts)] // 去重
  };
}

/**
 * 基于角色特性分配团体阶层
 */
function assignHierarchyLevels(groups: Group[], characters: Character[]): Group[] {
  return groups.map(group => {
    // 获取所有成员角色
    const members = group.members
      .map(m => characters.find(c => c.id === m.characterId))
      .filter(Boolean) as Character[];
    
    // 计算每个成员的影响力得分
    const memberScores = members.map(character => {
      // 组合多种因素计算影响力得分
      const leadershipScore = character.leadershipTendency || 50;
      const socialScore = character.socialInfluence || 50;
      const relationshipScore = calculateRelationshipScore(character, members);
      
      // 最终得分是各因素的加权平均
      return {
        characterId: character.id,
        score: leadershipScore * 0.4 + socialScore * 0.3 + relationshipScore * 0.3
      };
    });
    
    // 按得分排序
    memberScores.sort((a, b) => b.score - a.score);
    
    // 根据排名分配阶层
    const totalMembers = memberScores.length;
    const updatedMembers = group.members.map(member => {
      const scoreObj = memberScores.find(m => m.characterId === member.characterId);
      if (!scoreObj) return member;
      
      const rank = memberScores.findIndex(m => m.characterId === member.characterId);
      const percentile = rank / totalMembers;
      
      // 基于百分比分配阶层
      let level: HierarchyLevel;
      if (rank === 0) {
        level = HierarchyLevel.LEADER;
      } else if (percentile < 0.2) {
        level = HierarchyLevel.SENIOR;
      } else if (percentile < 0.7) {
        level = HierarchyLevel.REGULAR;
      } else {
        level = HierarchyLevel.JUNIOR;
      }
      
      return {
        ...member,
        level,
        // 推导出基于阶层的权限
        permissions: getPermissionsByLevel(level)
      };
    });
    
    return {
      ...group,
      members: updatedMembers
    };
  });
}

/**
 * 计算一个角色相对于团体其他成员的关系得分
 */
function calculateRelationshipScore(character: Character, groupMembers: Character[]): number {
  if (!character.relationships || character.relationships.length === 0) {
    return 50; // 默认中等得分
  }
  
  // 计算该角色对团体其他成员的平均关系强度
  let totalStrength = 0;
  let count = 0;
  
  for (const member of groupMembers) {
    if (member.id === character.id) continue; // 跳过自己
    
    const relationship = character.relationships.find(r => r.targetId === member.id);
    if (relationship) {
      totalStrength += relationship.strength;
      count++;
    }
  }
  
  // 如果没有直接关系，返回默认值
  if (count === 0) return 50;
  
  // 计算平均关系强度，并从 -100~100 映射到 0~100
  const avgStrength = totalStrength / count;
  return (avgStrength + 100) / 2;
}

/**
 * 根据阶层等级获取权限列表
 */
function getPermissionsByLevel(level: HierarchyLevel): string[] {
  switch (level) {
    case HierarchyLevel.LEADER:
      return ['post', 'comment', 'delete', 'pin', 'invite', 'remove', 'change_rules', 'change_visibility'];
    case HierarchyLevel.SENIOR:
      return ['post', 'comment', 'delete_own', 'pin_suggestion', 'invite'];
    case HierarchyLevel.REGULAR:
      return ['post', 'comment', 'delete_own'];
    case HierarchyLevel.JUNIOR:
      return ['post', 'comment'];
    case HierarchyLevel.OUTSIDER:
      return ['view'];
    default:
      return ['view'];
  }
}

/**
 * 检测角色的兴趣团体
 */
async function detectInterestGroups(characters: Character[]): Promise<Group[]> {
  // 这个方法类似于detectProfessionalGroups，但是基于兴趣爱好进行聚类
  // 实现思路类似，不再重复编写
  return [];
}

/**
 * 社区检测算法实现（简化版）
 */
function detectCommunities(matrix: number[][], characters: Character[]): Array<{members: string[]}> {
  // 这里应该实现社区检测算法，例如：
  // - Louvain方法
  // - Girvan-Newman算法
  // - 谱聚类
  // 为简化起见，这里使用一个非常基础的方法
  
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  const communities: Array<{members: string[]}> = [];
  
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    
    // 为每个未访问节点寻找社区
    const community: string[] = [characters[i].id];
    visited[i] = true;
    
    // 寻找强关联的角色
    for (let j = 0; j < n; j++) {
      if (i === j || visited[j]) continue;
      
      // 如果关系强度超过阈值，加入社区
      if (matrix[i][j] > 0.7 || matrix[j][i] > 0.7) {
        community.push(characters[j].id);
        visited[j] = true;
      }
    }
    
    if (community.length > 1) {
      communities.push({ members: community });
    }
  }
  
  return communities;
}
```

### 扩展 CircleService 支持团体功能

为了支持团体相关功能，我们需要扩展 CircleService 类：

```typescript
export class CircleService {
  // ...现有代码...
  
  /**
   * 初始化角色的团体
   */
  static async initializeGroups(characters: Character[]): Promise<Group[]> {
    try {
      // 检测现有的团体记录
      let groups = await loadGroups();
      
      if (!groups || groups.length === 0) {
        console.log('【团体系统】未检测到现有团体，开始自动生成团体');
        
        // 自动检测和创建团体
        groups = await detectAndCreateGroups(characters);
        
        // 保存团体数据
        await saveGroups(groups);
        
        console.log(`【团体系统】成功创建 ${groups.length} 个团体`);
      } else {
        console.log(`【团体系统】加载了 ${groups.length} 个现有团体`);
      }
      
      // 将团体信息添加到角色数据中
      await updateCharactersWithGroups(characters, groups);
      
      return groups;
    } catch (error) {
      console.error('【团体系统】初始化团体失败:', error);
      return [];
    }
  }
  
  /**
   * 获取角色所属的所有团体
   */
  static getCharacterGroups(character: Character, allGroups: Group[]): Group[] {
    if (!character.groups || character.groups.length === 0) {
      return [];
    }
    
    return allGroups.filter(group => 
      character.groups.includes(group.id)
    );
  }
  
  /**
   * 获取角色在特定团体中的成员信息
   */
  static getGroupMembership(groupId: string, characterId: string, allGroups: Group[]): GroupMembership | null {
    const group = allGroups.find(g => g.id === groupId);
    if (!group) return null;
    
    return group.members.find(m => m.characterId === characterId) || null;
  }
  
  /**
   * 创建新团体
   */
  static async createGroup(
    name: string,
    description: string,
    type: GroupType,
    founderCharacter: Character,
    initialMembers: Character[] = []
  ): Promise<Group> {
    const group: Group = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      description,
      type,
      tags: [],
      createdAt: Date.now(),
      visibility: 'public',
      members: [
        // 创建者默认为领导者
        {
          characterId: founderCharacter.id,
          joinedAt: Date.now(),
          level: HierarchyLevel.LEADER,
          contributions: 10, // 创建者初始贡献值更高
          permissions: getPermissionsByLevel(HierarchyLevel.LEADER)
        },
        // 添加初始成员
        ...initialMembers.map(character => ({
          characterId: character.id,
          joinedAt: Date.now(),
          level: HierarchyLevel.REGULAR,
          contributions: 0,
          permissions: getPermissionsByLevel(HierarchyLevel.REGULAR)
        }))
      ]
    };
    
    // 保存新团体
    await saveGroup(group);
    
    // 更新成员角色的团体信息
    const allMembers = [founderCharacter, ...initialMembers];
    for (const character of allMembers) {
      if (!character.groups) {
        character.groups = [];
      }
      if (!character.groups.includes(group.id)) {
        character.groups.push(group.id);
        await updateCharacter(character);
      }
    }
    
    return group;
  }
  
  /**
   * 处理团体中的帖子发布
   */
  static async processGroupPost(
    character: Character,
    group: Group,
    content: string,
    apiKey?: string
  ): Promise<CircleResponse> {
    try {
      // 检查角色是否是团体成员
      const membership = this.getGroupMembership(group.id, character.id, [group]);
      if (!membership) {
        return {
          success: false,
          error: '非团体成员不能发布帖子'
        };
      }
      
      // 检查是否有发布权限
      if (!membership.permissions.includes('post')) {
        return {
          success: false,
          error: '没有发布帖子的权限'
        };
      }
      
      // 构建发布选项，包含团体上下文
      const postOptions: CirclePostOptions = {
        type: 'newPost',
        content: {
          authorId: character.id,
          text: content,
          context: `这是${character.name}在"${group.name}"团体中发布的内容。团体简介: ${group.description}。你在该团体中的角色是${this.getHierarchyLevelDescription(membership.level)}`
        },
        responderId: character.id
      };
      
      // 处理发布
      const response = await this.getNodeST(apiKey).processCircleInteraction(postOptions);
      
      // 如果发布成功，更新团体帖子列表
      if (response.success) {
        // 创建帖子记录
        const post: CirclePost = {
          id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          characterId: character.id,
          characterName: character.name,
          characterAvatar: character.avatar as string,
          content: content,
          createdAt: new Date().toISOString(),
          groupId: group.id,
          comments: [],
          likes: 0,
          likedBy: [],
          hasLiked: false,
        };
        
        // 更新团体帖子列表
        if (!group.posts) {
          group.posts = [];
        }
        group.posts.push(post.id);
        await saveGroup(group);
        
        // 更新角色的帖子列表
        if (!character.circlePosts) {
          character.circlePosts = [];
        }
        character.circlePosts.push(post);
        await updateCharacter(character);
      }
      
      return response;
    } catch (error) {
      console.error(`【团体系统】处理团体帖子失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理团体帖子过程中发生未知错误'
      };
    }
  }
  
  /**
   * 获取团体中的帖子
   */
  static async getGroupPosts(group: Group, characters: Character[]): Promise<CirclePost[]> {
    try {
      const posts: CirclePost[] = [];
      
      // 如果团体没有帖子，返回空数组
      if (!group.posts || group.posts.length === 0) {
        return posts;
      }
      
      // 从所有角色的circlePosts中查找匹配的帖子
      for (const character of characters) {
        if (!character.circlePosts) continue;
        
        for (const post of character.circlePosts) {
          if (post.groupId === group.id) {
            posts.push(post);
          }
        }
      }
      
      // 按时间排序，最新的在前
      posts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      return posts;
    } catch (error) {
      console.error(`【团体系统】获取团体帖子失败:`, error);
      return [];
    }
  }
  
  /**
   * 获取阶层等级描述
   */
  static getHierarchyLevelDescription(level: HierarchyLevel): string {
    switch (level) {
      case HierarchyLevel.LEADER:
        return '领导者';
      case HierarchyLevel.SENIOR:
        return '资深成员';
      case HierarchyLevel.REGULAR:
        return '普通成员';
      case HierarchyLevel.JUNIOR:
        return '初级成员';
      case HierarchyLevel.OUTSIDER:
        return '圈外人';
      default:
        return '未知';
    }
  }
  