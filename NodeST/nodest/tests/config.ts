import { RoleCardJson, PresetJson, WorldBookJson, AuthorNoteJson } from '../types';

export const TEST_CONVERSATION_ID = `test_${Date.now()}`;

export const TEST_PRESET_JSON: PresetJson = {
    prompts: [
        {
            name: "Main",
            content: "这是主要设定",
            identifier: "main",
            enable: true,
            role: "user"
        },
        {
            name: "Enhance Definitions",
            content: "增强定义内容",
            identifier: "enhanceDefinitions",
            injection_position: 1,
            injection_depth: 3,
            enable: true,
            role: "user"
        },
        {
            name: "Chat History",
            content: "",
            identifier: "chatHistory",
            enable: true,
            role: "user"
        },
        {
            name: "Char Description",
            content: "",
            identifier: "charDescription",
            enable: true,
            role: "user"
        },
        {
            name: "Char Personality",
            content: "",
            identifier: "charPersonality",
            enable: true,
            role: "user"
        },
        {
            name: "Scenario",
            content: "",
            identifier: "scenario",
            enable: true,
            role: "user"
        },
        {
            name: "Chat Examples",
            content: "",
            identifier: "dialogueExamples",
            enable: true,
            role: "user"
        }
    ],
    prompt_order: [{
        order: [
            { identifier: "main", enabled: true },
            { identifier: "enhanceDefinitions", enabled: true },
            { identifier: "chatHistory", enabled: true },
            { identifier: "charDescription", enabled: true },
            { identifier: "charPersonality", enabled: true },
            { identifier: "scenario", enabled: true },
            { identifier: "dialogueExamples", enabled: true }
        ]
    }]
};

export const TEST_ROLE_CARD_JSON: RoleCardJson = {
    name: "测试角色",
    first_mes: "你好，我是测试角色。",
    description: "这是一个测试角色描述。",
    personality: "性格活泼开朗。",
    scenario: "在测试环境中。",
    mes_example: "这是对话示例。"
};

export const TEST_WORLD_BOOK_JSON: WorldBookJson = {
    entries: {
        entry1: {
            comment: "世界设定1",
            content: "这是第一条世界设定内容",
            disable: false,
            position: 4,
            constant: true,
            key: ["测试", "设定"],
            order: 0,
            depth: 2
        },
        entry2: {
            comment: "世界设定2",
            content: "这是第二条世界设定内容",
            disable: false,
            position: 2,
            constant: false,
            key: ["背景"],
            order: 1,
            depth: 0
        }
    }
};

export const TEST_AUTHOR_NOTE_JSON: AuthorNoteJson = {
    charname: "测试角色",
    username: "测试用户",
    content: "这是作者注释内容",
    injection_depth: 2
};
