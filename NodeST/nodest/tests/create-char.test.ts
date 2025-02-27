import { 
    TEST_CONVERSATION_ID,
    TEST_PRESET_JSON,
    TEST_ROLE_CARD_JSON,
    TEST_WORLD_BOOK_JSON,
    TEST_AUTHOR_NOTE_JSON 
} from './config';
import { ChatManager } from '../managers/chat-manager';
import { CharacterUtils } from '../utils/character-utils';
import { ChatMessage, ChatHistoryEntity } from '../types';

// Remove class and move validateJsonStructure to a helper function
const validateJsonStructure = (
    jsonObj: any, 
    expectedKeys: string[], 
    name: string
): [boolean, string] => {
    const missingKeys = expectedKeys.filter(key => !(key in jsonObj));
    if (missingKeys.length > 0) {
        return [false, `${name} 缺少必要字段: ${missingKeys.join(', ')}`];
    }
    return [true, "验证通过"];
};

describe('NodeST Character Creation Tests', () => {
    const conversation_id = TEST_CONVERSATION_ID;
    const user_message = "你好";

    beforeAll(() => {
        // Setup any necessary test environment
        console.log("\n=== 开始NodeST角色创建测试 ===\n");
    });

    afterAll(() => {
        console.log("\n=== NodeST角色创建测试完成 ===\n");
    });

    describe('JSON Structure Validation', () => {
        it('validates all required JSON structures', () => {
            console.log("测试JSON结构验证...");
            
            const validations: [any, string[], string][] = [
                [TEST_PRESET_JSON, ["prompts", "prompt_order"], "预设JSON"],
                [TEST_ROLE_CARD_JSON, ["name", "first_mes"], "角色卡JSON"],
                [TEST_WORLD_BOOK_JSON, ["entries"], "世界观JSON"],
                [TEST_AUTHOR_NOTE_JSON, ["charname", "username", "content"], "作者注释JSON"]
            ];

            for (const [jsonObj, expectedKeys, name] of validations) {
                const [isValid, message] = validateJsonStructure(jsonObj, expectedKeys, name);
                console.log(`验证 ${name}: ${message}`);
                expect(isValid).toBe(true);
            }
        });
    });

    describe('R Framework Building', () => {
        it('builds R framework successfully', () => {
            console.log("\n测试R框架构建...");
            
            const [rFramework, chatHistory] = CharacterUtils.buildRFramework(
                TEST_PRESET_JSON,
                TEST_ROLE_CARD_JSON,
                TEST_WORLD_BOOK_JSON
            );

            console.log(`- 包含 ${rFramework.length} 个条目`);
            console.log(`- Chat History ${chatHistory ? '已找到' : '未找到'}`);

            expect(rFramework).toBeDefined();
            expect(rFramework.length).toBeGreaterThan(0);
            expect(chatHistory).toBeDefined();
        });
    });

    describe('D Entries Extraction', () => {
        it('extracts D entries correctly', () => {
            console.log("\n测试D类条目提取...");
            
            const dEntries = CharacterUtils.extractDEntries(
                TEST_PRESET_JSON,
                TEST_WORLD_BOOK_JSON,
                TEST_AUTHOR_NOTE_JSON
            );

            console.log(`- 提取到 ${dEntries.length} 个D类条目`);
            
            expect(dEntries).toBeDefined();
            expect(dEntries.length).toBeGreaterThan(0);
            expect(dEntries[0]).toHaveProperty('name');
            expect(dEntries[0]).toHaveProperty('parts');
        });
    });

    describe('Gemini Request Generation', () => {
        it('generates valid Gemini request body', async () => {
            console.log("\n测试Gemini请求体生成...");
            
            const chatManager = new ChatManager("test_key");
            const [rFramework] = CharacterUtils.buildRFramework(
                TEST_PRESET_JSON,
                TEST_ROLE_CARD_JSON,
                TEST_WORLD_BOOK_JSON
            );
            
            let testContents: ChatMessage[] = [];
            
            // 处理每个框架条目
            for (const item of rFramework) {
                if (item.name === "Chat History") {
                    const chatHistory: ChatHistoryEntity = {
                        name: "Chat History",
                        role: "system",
                        parts: [{
                            role: "model",
                            parts: [{ text: TEST_ROLE_CARD_JSON.first_mes }],
                            is_first_mes: true
                        }]
                    };

                    const dEntries = CharacterUtils.extractDEntries(
                        TEST_PRESET_JSON,
                        TEST_WORLD_BOOK_JSON,
                        TEST_AUTHOR_NOTE_JSON
                    );

                    const updatedHistory = await chatManager['insertDEntriesToHistory'](
                        chatHistory,
                        dEntries,
                        user_message
                    );

                    testContents.push(updatedHistory as unknown as ChatMessage);
                } else {
                    testContents.push(item);
                }
            }

            const cleanedContents = chatManager['cleanContentsForGemini'](
                testContents,
                user_message,
                TEST_ROLE_CARD_JSON.name,
                TEST_AUTHOR_NOTE_JSON.username,
                TEST_ROLE_CARD_JSON
            );

            console.log(`- 生成了 ${cleanedContents.length} 个消息的请求体`);
            
            expect(cleanedContents).toBeDefined();
            expect(cleanedContents.length).toBeGreaterThan(0);
            
            // 验证每个消息的结构
            cleanedContents.forEach((content, index) => {
                console.log(`- 验证第 ${index + 1} 个消息...`);
                expect(content).toHaveProperty('role');
                expect(content).toHaveProperty('parts');
                expect(Array.isArray(content.parts)).toBe(true);
            });

            // 输出详细内容以供检查
            console.log("\n请求体结构示例:");
            console.log(JSON.stringify(cleanedContents[0], null, 2));

            // 修改日志输出部分
            console.log("\n=== 完整的Gemini请求体内容 ===");
            cleanedContents.forEach((content, index) => {
                // 使用 console.dir 替代 console.log，并设置选项
                interface PartDetail {
                    partIndex: number;
                    text: string;
                }

                interface MessageDetail {
                    messageIndex: number;
                    role: string;
                    parts: PartDetail[];
                }

                                console.dir({
                                    messageIndex: index + 1,
                                    role: content.role,
                                    parts: content.parts.map((part: { text: string }, partIndex: number): PartDetail => ({
                                        partIndex: partIndex + 1,
                                        text: part.text
                                    }))
                                } as MessageDetail, { depth: null, colors: true });
                
                console.log('------------------------');
            });

            expect(cleanedContents).toBeDefined();
        });
    });
});
