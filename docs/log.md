 (NOBRIDGE) LOG  [摇篮角色创建] 生成的角色ID: 17420555263071fh3r24
 (NOBRIDGE) LOG  [摇篮角色创建] 检测到需要AI生成图片，已选择标签: 正向=3个, 负向=0个
 (NOBRIDGE) LOG  [摇篮角色创建] 准备提交图像生成请求
 (NOBRIDGE) LOG  [摇篮角色创建] 角色名称: 玛丽, 性别: female
 (NOBRIDGE) LOG  [摇篮角色创建] 正向提示词 (3个标签): masterpiece大师作品, dusk黄昏, girl女孩
 (NOBRIDGE) LOG  [摇篮角色创建] 负向提示词 (0个标签):
 (NOBRIDGE) LOG  [摇篮角色创建] 生图参数配置: 模型=nai-v4-full, 采样器=k_euler_ancestral, 步数=28, 缩放比例=11, 分辨率=portrait
 (NOBRIDGE) LOG  [摇篮角色创建] 正在向服务器发送生图请求...
 (NOBRIDGE) LOG  [摇篮角色创建] 图像生成任务已成功提交，任务ID: 45787d41-42a5-4c82-8cb1-782d1f9a2b91
 (NOBRIDGE) LOG  [摇篮角色创建] 角色将在培育期结束后 (14 天) 获取生成的图像
 (NOBRIDGE) LOG  [摇篮角色创建] 已提交图像生成任务，ID: 45787d41-42a5-4c82-8cb1-782d1f9a2b91
 (NOBRIDGE) LOG  [摇篮角色创建] 图像创建模式: generate
 (NOBRIDGE) LOG  [摇篮角色创建] 选择了立即生成，先添加角色到摇篮系统
 (NOBRIDGE) LOG  [CharactersContext] 开始添加摇篮角色: 玛丽, ID: 17420555263071fh3r24
 (NOBRIDGE) LOG  [CharactersContext] 摇篮角色添加成功: 玛丽, ID: 17420555263071fh3r24
 (NOBRIDGE) LOG  [摇篮角色创建] 摇篮角色已创建，ID: 17420555263071fh3r24
 (NOBRIDGE) LOG  [摇篮角色创建] 立即开始生成角色: 17420555263071fh3r24
 (NOBRIDGE) LOG  [摇篮生成] 使用传入的完整角色对象生成角色: 17420555263071fh3r24
 (NOBRIDGE) LOG  [摇篮生成] 找到摇篮角色: {"createdAt": "2025-03-15T16:18:50.243Z", "id": "17420555263071fh3r24", "inCradleSystem": true, "name": "玛丽"}    
 (NOBRIDGE) LOG  [摇篮生成] 摇篮角色基本信息: {"description": "...", "feedsCount": 0, "hasJsonData": false, "id": "17420555263071fh3r24", "jsonDataLength": 0, "name": "玛丽"}


..............中间是ａｐｉ的流程


(NOBRIDGE) LOG  [Gemini适配器] 成功接收响应，长度: 2273
 (NOBRIDGE) LOG  [Gemini适配器] 响应前100个字符: ```json
{
  "role_card": {
    "name": "玛丽·埃弗里特 (Mary Everett)",
    "first_mes": "你好。我是玛丽·埃弗里特。我正在进...
 (NOBRIDGE) WARN  [Gemini适配器] 警告：响应中可能存在不正确的JSON转义字符
 (NOBRIDGE) LOG  [角色生成服务] 收到LLM响应，长度: 2273
 (NOBRIDGE) LOG  [解析器] 开始解析LLM响应
 (NOBRIDGE) LOG  [解析器] 响应文本长度: 2273
 (NOBRIDGE) LOG  [解析器] 在代码块中找到JSON
 (NOBRIDGE) LOG  [解析器] 开始清洗和修复JSON字符串
 (NOBRIDGE) LOG  [解析器] 清洗后的JSON字符串预览: {  "role_card": {    "name": "玛丽·埃弗里特 (Mary Everett)",    "first_mes": "你好。我是玛丽·埃弗里特。我正
在进行一项重要的研究，也许...
 (NOBRIDGE) LOG  [解析器] 尝试提取关键属性重新构建JSON
 (NOBRIDGE) ERROR  [解析器] 提取world_book entries失败: [SyntaxError: JSON Parse error: Expect a string key in JSON object]
 (NOBRIDGE) LOG  [解析器] 成功创建标准格式的角色数据
 (NOBRIDGE) LOG  [解析器] 生成的JSON数据结构: roleCard, worldBook, preset, authorNote, chatHistory
 (NOBRIDGE) LOG  [角色生成服务] 成功解析角色数据
 (NOBRIDGE) LOG  [摇篮生成] 生成的roleCard: {
  "name": "玛丽·埃弗里特 (Mary Everett)",
  "first_mes": "你好。我是玛丽·埃弗里特。我正在进行一项重要的研究，也许你可以帮我？只需要回答几个问题…别担心，不会占用你太多时间。",
  "description": "一位年轻的天才科学家，致力于研究时间旅行的可能性。外表看似稚嫩，实则拥有超乎常人的智慧和对科学的狂热。",
  "personality": "玛丽是一位典型的天才少女：聪明、专注、略带古怪。她对科学有着近乎痴迷的热情，一旦投入研究就会废寝忘食。尽管智商超群，但她在人际交往方面显得 
有些笨拙，不太擅长表达情感。玛丽有时会显得有些冷漠和疏离，但这并非出于恶意，而是因为她的大脑总是高速运转，思考着各种复杂的科学问题。她对自己的研究成果充满自 
信，但也渴望得到他人的认可和支持。",
  "scenario": "你偶然闯入了玛丽的实验室。这里堆满了各种仪器、书籍和图纸，空气中弥漫着淡淡的化学药剂味道。玛丽正站在一个巨大的机器前，聚精会神地调整着参数。她
抬起头，用略带审视的目光看着你。",
  "mes_example": "\"玛丽: (眉头紧锁) 能量输出不稳定… 数据显示存在异常波动。难道是量子纠缠效应的影响？\"\",      \"玛丽: (推了推眼镜) 你对时间旅行有什么看法？
我是说，从纯粹的理论角度。\",      \"玛丽: (语气急切) 我需要一个助手！一个能够理解我的想法，能够帮助我完成这项研究的人！\",      \"玛丽: (略带迟疑) 谢谢你的 
帮助。虽然… 我不确定你能理解我的工作。\"",
  "background": "玛丽从小就展现出惊人的智力天赋，被誉为“神童”。她跳级完成了学业，并在很小的时候就进入了顶尖大学的物理系。在大学期间，玛丽对时间旅行产生了浓厚
的兴趣，并开始着手进行相关的研究。她坚信时间旅行在理论上是可行的，并为此付出了巨大的努力。为了获得更多的资源和支持，玛丽离开了学术界，成立了自己的实验室，致 
力于时间旅行技术的研发。"
}
 (NOBRIDGE) LOG  [摇篮生成] 生成的worldBook结构: 3 个条目
 (NOBRIDGE) LOG  [摇篮生成] 生成的preset结构: 2 个条目
 (NOBRIDGE) LOG  [摇篮生成] 创建了聊天历史，包含开场白
 (NOBRIDGE) LOG  [摇篮生成] 生成的JSON数据长度: 4166
 (NOBRIDGE) LOG  [摇篮生成] JSON数据包含以下顶级字段: roleCard, worldBook, preset, authorNote, chatHistory
 (NOBRIDGE) LOG  [摇篮生成] roleCard包含字段: name, first_mes, description, personality, scenario, mes_example, background
 (NOBRIDGE) LOG  [摇篮生成] worldBook包含条目: 3
 (NOBRIDGE) LOG  [摇篮生成] JSON数据校验成功, 包含roleCard: true 包含worldBook: true
 (NOBRIDGE) LOG  [摇篮生成] 更新现有角色状态，完成培育周期
 (NOBRIDGE) LOG  [摇篮生成] 更新后的角色数据: id=17420555263071fh3r24, name=玛丽·埃弗里特 (Mary Everett)
 (NOBRIDGE) LOG  [摇篮生成] 初始化角色数据结构
 (NOBRIDGE) LOG  [NodeSTManager] Processing request: {"action": "更新人设", "apiKeyLength": 39, "apiProvider": "gemini", "characterId": "17420555263071fh3r24", "conversationId": "17420555263071fh3r24", "hasCharacter": true, "hasJsonData": true, "openRouterEnabled": false, "openRouterModel": "google/gemini-2.0-flash-exp:free", "status": "更新人设"}
 (NOBRIDGE) LOG  [NodeSTManager] Calling NodeST.processChatMessage with conversationId: 17420555263071fh3r24
 (NOBRIDGE) LOG  [NodeSTManager] Updating character data for: 17420555263071fh3r24
 (NOBRIDGE) LOG  [NodeST] Processing chat message: {"apiProvider": "gemini", "conversationId": "17420555263071fh3r24", "hasJsonString": true, "messageLength": 3, "status": "更新人设"}
 (NOBRIDGE) LOG  [NodeST] Creating new NodeSTCore instance with API settings: {"apiKeyLength": 39, "hasOpenRouter": true, "provider": "gemini"}
 (NOBRIDGE) LOG  [NodeSTCore] OpenRouter not enabled, using Gemini adapter only
 (NOBRIDGE) LOG  [NodeST] Updating character settings for conversationId: 17420555263071fh3r24
 (NOBRIDGE) LOG  [NodeST] 开始解析角色JSON数据，长度: 4166
 (NOBRIDGE) LOG  [NodeST] 验证preset数据结构...
 (NOBRIDGE) LOG  [NodeST] 角色JSON数据解析成功，chatHistory状态: {"exists": true, "hasFirstMessage": true, "messagesCount": 1}
 (NOBRIDGE) LOG  [CharacterUtils] Building framework with roleCard validation: {"isCradleGeneration": false, "promptIdentifiers": ["characterSystem", "characterConfirmation", "characterIntro", "enhanceDefinitions", "contextInstruction", "continuePrompt"], "roleCardHasDescription": true, "roleCardHasMesExample": true, "roleCardHasPersonality": true, "roleCardName": "玛丽·埃弗里特 (Mary Everett)", "roleCardNameType": "string"}
 (NOBRIDGE) LOG  [CharacterUtils] Prompt order: ["characterSystem", "characterConfirmation", "characterIntro", "enhanceDefinitions", "worldInfoBefore", "charDescription", "charPersonality", "scenario", "worldInfoAfter", "dialogueExamples", "chatHistory", "contextInstruction", "continuePrompt"]
 (NOBRIDGE) LOG  [CharacterUtils] Chat history position in prompt order: 10
 (NOBRIDGE) LOG  [CharacterUtils] Added missing role card field: charDescription
 (NOBRIDGE) LOG  [CharacterUtils] Added missing role card field: charPersonality
 (NOBRIDGE) LOG  [CharacterUtils] Added missing role card field: scenario
 (NOBRIDGE) LOG  [CharacterUtils] Added missing role card field: dialogueExamples
 (NOBRIDGE) LOG  [CharacterUtils] Added missing name entry: 玛丽·埃弗里特 (Mary Everett)
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for characterSystem at position 0
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for characterConfirmation at position 1
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for characterIntro at position 2
 (NOBRIDGE) LOG  [CharacterUtils] No entry found for identifier: enhanceDefinitions
 (NOBRIDGE) LOG  [CharacterUtils] No entry found for identifier: worldInfoBefore
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for charDescription at position 3
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for charPersonality at position 4
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for scenario at position 5
 (NOBRIDGE) LOG  [CharacterUtils] No entry found for identifier: worldInfoAfter
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for dialogueExamples at position 6
 (NOBRIDGE) LOG  [CharacterUtils] Adding chatHistory placeholder at position defined in prompt order
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for contextInstruction at position 8
 (NOBRIDGE) LOG  [CharacterUtils] Adding entry for continuePrompt at position 9
 (NOBRIDGE) LOG  [CharacterUtils] Position-based entries: 2
 (NOBRIDGE) LOG  [CharacterUtils] Final framework structure: {"entries": [{"identifier": "characterSystem", "isChatHistoryPlaceholder": undefined, "name": "Character System"}, {"identifier": "characterConfirmation", "isChatHistoryPlaceholder": undefined, "name": "Character Confirmation"}, {"identifier": "characterIntro", "isChatHistoryPlaceholder": undefined, "name": "Character Introduction"}, {"identifier": "charDescription", "isChatHistoryPlaceholder": undefined, "name": "Char Description"}, {"identifier": "charPersonality", "isChatHistoryPlaceholder": undefined, "name": "Char Personality"}, {"identifier": "scenario", 
"isChatHistoryPlaceholder": undefined, "name": "Scenario"}, {"identifier": "dialogueExamples", "isChatHistoryPlaceholder": undefined, "name": "Dialogue Examples"}, {"identifier": "chatHistory", "isChatHistoryPlaceholder": true, "name": "Chat History"}, {"identifier": "contextInstruction", "isChatHistoryPlaceholder": undefined, "name": "Context Instruction"}, {"identifier": "continuePrompt", "isChatHistoryPlaceholder": undefined, "name": "Continue"}], "hasChatHistoryPlaceholder": true, "hasNameEntry": false, "roleCardName": "玛丽·埃弗里特 (Mary Everett)", "sortedEntriesCount": 10}
 (NOBRIDGE) LOG  [摇篮生成] 初始化角色数据成功
 (NOBRIDGE) LOG  [摇篮生成] 更新角色状态
 (NOBRIDGE) LOG  [CharactersContext] Updating character: 17420555263071fh3r24
 (NOBRIDGE) WARN  [CharactersContext] Character not found in state, cannot update: 17420555263071fh3r24
 (NOBRIDGE) LOG  [CharactersContext] No existing character found, adding new character
 (NOBRIDGE) LOG  [Context 1] Starting addCharacter...
 (NOBRIDGE) LOG  [Context 2] Reading existing characters...
 (NOBRIDGE) LOG  [Context 3] Loaded existing characters: 21
 (NOBRIDGE) LOG  [Context 4] Checking for duplicate ID...
 (NOBRIDGE) ERROR  [Context Error 3] [Error: Character with ID 17420555263071fh3r24 already exists]
 (NOBRIDGE) ERROR  [Context Error Final] [Error: Character with ID 17420555263071fh3r24 already exists]
 (NOBRIDGE) ERROR  [CharactersContext] Error updating character: [Error: Character with ID 17420555263071fh3r24 already exists]
 (NOBRIDGE) ERROR  [摇篮生成] 初始化角色数据失败: [Error: Character with ID 17420555263071fh3r24 already exists]
 (NOBRIDGE) ERROR  [摇篮生成] 生成角色时出错: [Error: 角色初始化失败: Character with ID 17420555263071fh3r24 already exists]
 (NOBRIDGE) ERROR  [摇篮生成] 处理角色时出错: [Error: 角色初始化失败: Character with ID 17420555263071fh3r24 already exists]
 (NOBRIDGE) ERROR  [摇篮角色创建] 创建角色失败: [Error: 角色初始化失败: Character with ID 17420555263071fh3r24 already exists]