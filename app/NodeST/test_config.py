import time

TEST_CONVERSATION_ID = "test_" + str(int(time.time()))

# 测试用的预设JSON
TEST_PRESET_JSON = {
    "prompts": [
        {
            "name": "Main",
            "content": "这是主要设定",
            "identifier": "main",
            "enable": True,
            "role": "user"
        },
        {
            "name": "Enhance Definitions",
            "content": "增强定义内容",
            "identifier": "enhanceDefinitions",
            "injection_position": 1,
            "injection_depth": 3,
            "enable": True,
            "role": "user"
        },
        {
            "name": "Chat History",
            "content": "",
            "identifier": "chatHistory",
            "enable": True,
            "role": "user"
        },
        {
            "name": "Char Description",
            "content": "",
            "identifier": "charDescription",  # 添加描述条目
            "enable": True,
            "role": "user"
        },
        {
            "name": "Char Personality",
            "content": "",
            "identifier": "charPersonality",  # 添加性格条目
            "enable": True,
            "role": "user"
        },
        {
            "name": "Scenario",
            "content": "",
            "identifier": "scenario",  # 添加场景条目
            "enable": True,
            "role": "user"
        },
        {
            "name": "Chat Examples",
            "content": "",
            "identifier": "dialogueExamples",  # 添加对话示例条目
            "enable": True,
            "role": "user"
        }
    ],
    "prompt_order": [{
        "order": [
            {"identifier": "main", "enabled": True},
            {"identifier": "enhanceDefinitions", "enabled": True},
            {"identifier": "chatHistory", "enabled": True},
            {"identifier": "charDescription", "enabled": True},
            {"identifier": "charPersonality", "enabled": True},
            {"identifier": "scenario", "enabled": True},
            {"identifier": "dialogueExamples", "enabled": True}
        ]
    }]
}

# 测试用的角色卡JSON
TEST_ROLE_CARD_JSON = {
    "name": "测试角色",
    "first_mes": "你好，我是测试角色。",
    "description": "这是一个测试角色描述。",
    "personality": "性格活泼开朗。",
    "scenario": "在测试环境中。",
    "mes_example": "这是对话示例。"
}

# 测试用的世界观JSON
TEST_WORLD_BOOK_JSON = {
    "entries": {
        "entry1": {
            "comment": "世界设定1",
            "content": "这是第一条世界设定内容",
            "disable": False,
            "position": 4,
            "constant": True,
            "key": ["测试", "设定"],
            "order": 0,
            "depth": 2
        },
        "entry2": {
            "comment": "世界设定2",
            "content": "这是第二条世界设定内容",
            "disable": False,
            "position": 2,
            "constant": False,
            "key": ["背景"],
            "order": 1,
            "depth": 0
        }
    }
}

# 测试用的作者注释JSON
TEST_AUTHOR_NOTE_JSON = {
    "charname": "测试角色",
    "username": "测试用户",
    "content": "这是作者注释内容",
    "injection_depth": 2
}
