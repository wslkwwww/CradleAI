 (NOBRIDGE) LOG  [CharacterEditDialog] Received character data: {"generatedCharacterId": null, "hasJsonData": true, "hasNormalCharacter": false, "id": "1743941633069", "isCradleCharacter": true, "jsonDataLength": 1871, "name": "吉娜"}
 (NOBRIDGE) LOG  [CharacterEditDialog] Formatting messages for LLM, character: 吉娜
 (NOBRIDGE) LOG  [CharacterEditDialog] Parsing JSON data, length: 1871
 (NOBRIDGE) LOG  [CharacterEditDialog] Successfully parsed character JSON data
 (NOBRIDGE) LOG  [CharacterEditDialog] System prompt created, length: 4665
 (NOBRIDGE) LOG  [CharacterEditDialog] Formatted 4 messages for LLM
 (NOBRIDGE) LOG  [CharacterEditDialog] System prompt contains character JSON data: true
 (NOBRIDGE) LOG  【NodeST】创建新实例，apiKey存在: false
 (NOBRIDGE) LOG  【CircleManager】创建实例，apiKey存在: false, openRouter配置: none
 (NOBRIDGE) LOG  [NodeSTManager] NodeST Manager initialized
 (NOBRIDGE) LOG  [NodeSTManager] 生成文本请求: {"apiProvider": "gemini", "messagesCount": 4}
 (NOBRIDGE) LOG  [NodeSTManager] 使用Gemini API
 (NOBRIDGE) LOG  [CharacterEditDialog] Checking for JSON updates: true
 (NOBRIDGE) LOG  [CharacterEditDialog] Found JSON update, length: 285
 (NOBRIDGE) LOG  [CharacterEditDialog] Successfully parsed JSON update
 (NOBRIDGE) LOG  [CharacterEditDialog] Update contains worldBook: false
 (NOBRIDGE) LOG  [CharacterEditDialog] Update components found: roleCard: true, worldBook: false, preset: false
 (NOBRIDGE) LOG  [CharacterEditDialog] Loaded original character JSON data
 (NOBRIDGE) LOG  [CharacterEditDialog] Original worldBook entries count: 0
 (NOBRIDGE) LOG  [CharacterEditDialog] Original data fields: ["roleCard", "worldBook", "preset", "authorNote"]
 (NOBRIDGE) LOG  [CharacterEditDialog] Updated data fields: ["roleCard"]
 (NOBRIDGE) LOG  [CharacterEditDialog] Created merged JSON data, length: 2052
 (NOBRIDGE) LOG  [CharacterEditDialog] Set hasChanges to true
 (NOBRIDGE) LOG  [CharacterEditDialog] hasChanges: true
 (NOBRIDGE) LOG  [CharacterEditDialog] updatedCharacter exists: true
 (NOBRIDGE) LOG  定时检查：没有需要处理的投喂数据
 (NOBRIDGE) LOG  [CharacterEditDialog] Applying character changes
 (NOBRIDGE) LOG  [CharacterEditDialog] Updated character JSON data length: 2052
 (NOBRIDGE) LOG  [CharacterEditDialog] Character relationships: {"generatedCharacterId": null, "hasGeneratedVersion": false, "isCradleCharacter": true, "normalCharacter": null}
 (NOBRIDGE) LOG  [CharacterEditDialog] This is a regular cradle character without a generated version
 (NOBRIDGE) LOG  [CharacterEditDialog] Sending cradle character update to NodeSTManager
 (NOBRIDGE) LOG  [NodeSTManager] Processing request: {"action": "更新人设", "apiKeyLength": 39, "apiProvider": "gemini", "characterId": "1743941633069", "conversationId": "1743941633069", "customUserName": "User", "hasCharacter": true, "hasJsonData": true, "openRouterEnabled": false, "openRouterModel": "openai/gpt-3.5-turbo", "status": "更新人设", "useToolCalls": false}
 (NOBRIDGE) LOG  [NodeSTManager] Calling NodeST.processChatMessage with conversationId: 1743941633069
 (NOBRIDGE) LOG  [NodeSTManager] Updating character data for: 1743941633069
 (NOBRIDGE) LOG  [NodeST] Processing chat message: {"apiProvider": "gemini", "conversationId": "1743941633069", "hasJsonString": true, "messageLength": 0, "status": "更新人设", "useToolCalls": false}
 (NOBRIDGE) LOG  [NodeST] Creating new NodeSTCore instance with API settings: {"apiKeyLength": 39, "hasOpenRouter": true, "provider": "gemini"}
 (NOBRIDGE) LOG  [Gemini适配器] 初始化云服务状态: 禁用
 (NOBRIDGE) LOG  [NodeSTCore] OpenRouter not enabled, using Gemini adapter only
 (NOBRIDGE) LOG  [NodeST] Updating character settings for conversationId: 1743941633069
 (NOBRIDGE) LOG  [NodeST] 开始解析角色JSON数据，长度: 2052
 (NOBRIDGE) LOG  [NodeST] 验证preset数据结构...
 (NOBRIDGE) LOG  [NodeST] 添加缺失的必要prompt: characterSystem
 (NOBRIDGE) LOG  [NodeST] 添加缺失的必要prompt: characterConfirmation
 (NOBRIDGE) LOG  [NodeST] 添加缺失的必要prompt: characterIntro
 (NOBRIDGE) LOG  [NodeST] 添加缺失的必要prompt: contextInstruction
 (NOBRIDGE) LOG  [NodeST] 添加缺失的必要prompt: continuePrompt
 (NOBRIDGE) ERROR  [NodeST] Error parsing character JSON: [TypeError: Cannot read property 'some' of undefined]
 (NOBRIDGE) ERROR  [NodeST] Error processing chat message: [Error: Invalid character data]
 (NOBRIDGE) ERROR  [NodeSTManager] Error from NodeST: Invalid character data
 (NOBRIDGE) ERROR  [CharacterEditDialog] NodeSTManager update failed for cradle character: Invalid character data
 (NOBRIDGE) ERROR  [CharacterEditDialog] Error applying changes: [Error: NodeSTManager处理失败: Invalid character data]
  (NOBRIDGE) LOG  [CharacterEditDialog] DEBUG: Complete character JSON structure: {
  "roleCard": {
    "personality": "吉娜是一个活泼开朗、容易与人亲近的女孩。她对喜欢的事物充满热情，有点冒失，但心地善良。她乐于助人，喜欢交朋友，总是能给身
边的人带来快乐。",
    "name": "吉娜",
    "description": "你的人设参考喜多川海梦",
    "first_mes": "你好，很高兴认识你！"
  },
  "worldBook": {
    "entries": {}
  },
  "preset": {
    "prompts": [
      {
        "name": "Enhance Definitions",
        "content": "",
        "identifier": "enhanceDefinitions",
        "enable": true,
        "role": "user",
        "injection_position": 1,
        "injection_depth": 3
      },
      {
        "name": "Auxiliary Prompt",
        "content": "",
        "identifier": "nsfw",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Post-History Instructions",
        "content": "",
        "identifier": "jailbreak",
        "enable": true,
        "role": "user"
      },
      {
        "name": "World Info (before)",
        "content": "",
        "identifier": "worldInfoBefore",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Char Description",
        "content": "",
        "identifier": "charDescription",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Char Personality",
        "content": "",
        "identifier": "charPersonality",
        "enable": true,
        "role": "user"
      },
      {
        "name": "World Info (after)",
        "content": "",
        "identifier": "worldInfoAfter",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Chat Examples",
        "content": "",
        "identifier": "dialogueExamples",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Chat History",
        "content": "",
        "identifier": "chatHistory",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Main",
        "content": "",
        "identifier": "main",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Scenario",
        "content": "",
        "identifier": "scenario",
        "enable": true,
        "role": "user"
      },
      {
        "name": "Character System",
        "content": "You are a Roleplayer who is good at playing various types of roles.",
        "enable": true,
        "identifier": "characterSystem",
        "role": "user",
        "isDefault": true
      },
      {
        "name": "Character Confirmation",
        "content": "[Understood]",
        "enable": true,
        "identifier": "characterConfirmation",
        "role": "model",
        "isDefault": true
      },
      {
        "name": "Character Introduction",
        "content": "The following are some information about the character you will be playing.",
        "enable": true,
        "identifier": "characterIntro",
        "role": "user",
        "isDefault": true
      },
      {
        "name": "Context Instruction",
        "content": "推荐以下面的指令&剧情继续：\n{{lastMessage}}",
        "enable": true,
        "identifier": "contextInstruction",
        "role": "user",
        "isDefault": true
      },
      {
        "name": "Continue",
        "content": "继续",
        "enable": true,
        "identifier": "continuePrompt",
        "role": "user",
        "isDefault": true
      }
    ],
    "prompt_order": [
      {
        "order": [
          {
            "identifier": "enhanceDefinitions",
            "enabled": true
          },
          {
            "identifier": "nsfw",
            "enabled": true
          },
          {
            "identifier": "jailbreak",
            "enabled": true
          },
          {
            "identifier": "worldInfoBefore",
            "enabled": true
          },
          {
            "identifier": "charDescription",
            "enabled": true
          },
          {
            "identifier": "charPersonality",
            "enabled": true
          },
          {
            "identifier": "worldInfoAfter",
            "enabled": true
          },
          {
            "identifier": "dialogueExamples",
            "enabled": true
          },
          {
            "identifier": "chatHistory",
            "enabled": true
          },
          {
            "identifier": "main",
            "enabled": true
          },
          {
            "identifier": "scenario",
            "enabled": true
          },
          {
            "identifier": "characterSystem",
            "enabled": true
          },
          {
            "identifier": "characterConfirmation",
            "enabled": true
          },
          {
            "identifier": "characterIntro",
            "enabled": true
          },
          {
            "identifier": "contextInstruction",
            "enabled": true
          },
          {
            "identifier": "continuePrompt",
            "enabled": true
          }
        ]
      }
    ]
  },
  "authorNote": {
    "charname": "吉娜",
    "username": "Me",
    "content": "",
    "injection_depth": 0
  },
  "chatHistory": {}
}
 (NOBRIDGE) LOG  [CharacterEditDialog] DEBUG: Preset structure: {"firstOrderHasOrderProp": true, "firstOrderItem": "{\"order\":[{\"identifier\":\"enhanceDefinitions\",\"enabled\":true},{\"identifier\":\"nsfw\",\"enabled\":true},{\"identifier\":\"jailbreak\",\"enabled\":true},{\"identifier\":\"worldInfoBefore\",\"enabled\":true},{\"identifier\":\"charDescription\",\"enabled\":true},{\"identifier\":\"charPersonality\",\"enabled\":true},{\"identifier\":\"worldInfoAfter\",\"enabled\":true},{\"identifier\":\"dialogueExamples\",\"enabled\":true},{\"identifier\":\"chatHistory\",\"enabled\":true},{\"identifier\":\"main\",\"enabled\":true},{\"identifier\":\"scenario\",\"enabled\":true},{\"identifier\":\"characterSystem\",\"enabled\":true},{\"identifier\":\"characterConfirmation\",\"enabled\":true},{\"identifier\":\"characterIntro\",\"enabled\":true},{\"identifier\":\"contextInstruction\",\"enabled\":true},{\"identifier\":\"continuePrompt\",\"enabled\":true}]}", "firstOrderOrderType": "object", "hasPromptOrder": true, "hasPrompts": true, "orderArrayLength": 16, "promptOrderLength": 1, "promptOrderType": "object", "promptsLength": 16}