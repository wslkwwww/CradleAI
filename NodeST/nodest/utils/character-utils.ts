import { 
    PresetJson, 
    RoleCardJson, 
    WorldBookJson, 
    AuthorNoteJson, 
    ChatMessage, 
    ChatHistoryEntity 
} from '../../../shared/types';

export class CharacterUtils {
    static buildRFramework(
        presetJson: PresetJson,
        roleCardJson: RoleCardJson,
        worldBookJson: WorldBookJson
    ): [ChatMessage[], ChatHistoryEntity | null] {
        const rEntries: ChatMessage[] = [];
        let chatHistory: ChatHistoryEntity | null = null;

        // 获取prompt order
        const promptOrder = presetJson.prompt_order[0]?.order
            .filter(item => item.enabled)
            .map(item => item.identifier) || [];

        // 处理prompts数组
        const prompts = presetJson.prompts.filter(item => {
            return item.enable !== false && item.injection_position !== 1;
        });

        // Debug 日志来确认内容是否正确构建
        console.log('[CharacterUtils] Building framework:', {
            hasDescription: !!roleCardJson.description,
            hasPersonality: !!roleCardJson.personality,
            hasMesExample: !!roleCardJson.mes_example,
            promptCount: presetJson.prompts.length
        });

        for (const item of prompts) {
            if (item.name === "Chat History") {
                chatHistory = {
                    name: "Chat History",
                    role: "system",
                    parts: [],
                    identifier: item.identifier
                };

                // 移除：不在这里添加开场白，而是由 SessionManager 处理
                // if (roleCardJson.first_mes) {
                //     chatHistory.parts.push({
                //         role: "model",
                //         parts: [{ text: roleCardJson.first_mes }],
                //         is_first_mes: true
                //     });
                // }

                continue; // 跳过将 chatHistory 添加到 rEntries
            }

            // 重要修改：创建新的框架条目时，强制使用角色卡中的最新内容
            const rEntry: ChatMessage = {
                name: item.name,
                role: "user",
                parts: [{ text: "" }],
                identifier: item.identifier
            };

            // 强制使用角色卡中的最新内容
            const content = (() => {
                switch (item.identifier) {
                    case "charDescription":
                        return roleCardJson.description || "";
                    case "charPersonality":
                        return roleCardJson.personality || "";
                    case "scenario":
                        return roleCardJson.scenario || "";
                    case "dialogueExamples":
                        return roleCardJson.mes_example || "";
                    case "name":
                        return roleCardJson.name || "";
                    case "first_mes":
                        return roleCardJson.first_mes || "";
                    default:
                        // 只有在找不到对应的角色卡内容时，才使用preset中的原始内容
                        return item.content || "";
                }
            })();

            rEntry.parts[0].text = content;

            // 添加调试日志
            // console.log('[CharacterUtils] Updating framework entry:', {
            //     name: item.name,
            //     identifier: item.identifier,
            //     contentSource: content === item.content ? 'preset' : 'roleCard',
            //     contentLength: content.length,
            //     contentPreview: content.substring(0, 50)
            // });

            rEntries.push(rEntry);
        }

        // 按promptOrder排序
        const sortedEntries = promptOrder
            .map(id => {
                // 确保 chatHistory 不会在这里被添加
                if (id === chatHistory?.identifier) {
                    return null;
                }
                const entry = rEntries.find(entry => entry.identifier === id);
                if (entry) {
                    console.log(`[CharacterUtils] Mapping entry for identifier ${id}:`, {
                        name: entry.name,
                        role: entry.role
                    });
                }
                return entry;
            })
            .filter((entry): entry is ChatMessage => entry !== null);

        // 处理position-based条目
        const positionBasedEntries: ChatMessage[] = Object.entries(worldBookJson.entries)
            .filter(([_, entry]) => !entry.disable && (entry.position === 0 || entry.position === 1))
            .map(([_, entry]) => ({
                name: entry.comment,
                role: "user",
                parts: [{ text: entry.content }],
                position: entry.position,
                insertion_order: entry.order
            }))
            .sort((a, b) => (a.insertion_order || 0) - (b.insertion_order || 0));

        // 在Char Description前后插入条目
        const charDescIndex = sortedEntries.findIndex(entry => entry.name === "Char Description");
        if (charDescIndex !== -1) {
            const beforeEntries = positionBasedEntries.filter(e => e.position === 0);
            const afterEntries = positionBasedEntries.filter(e => e.position === 1);

            // 在角色描述前插入 position=0 的条目
            for (const entry of beforeEntries.reverse()) {
                sortedEntries.splice(charDescIndex, 0, entry);
            }

            // 在角色描述后插入 position=1 的条目
            let insertIndex = charDescIndex + 1;
            for (const entry of afterEntries) {
                sortedEntries.splice(insertIndex, 0, entry);
                insertIndex++;
            }
        }

        // 最后再处理 chatHistory 的插入
        if (chatHistory) {
            const chatHistoryIndex = promptOrder.findIndex(id => id === chatHistory.identifier);
            if (chatHistoryIndex !== -1) {
                // 在正确的位置插入 chatHistory
                sortedEntries.splice(chatHistoryIndex, 0, chatHistory as unknown as ChatMessage);
                
                console.log('[CharacterUtils] Inserted chat history at index:', {
                    index: chatHistoryIndex,
                    totalEntries: sortedEntries.length
                });
            }
        }

        // 添加框架结构树日志
        console.log('[CharacterUtils] Framework structure tree:', {
            framework: {
                total_entries: sortedEntries.length,
                structure: sortedEntries.map(entry => ({
                    name: entry.name,
                    role: entry.role,
                    type: entry.identifier ? 'preset' : 
                          entry.position !== undefined ? 'world_book' : 
                          'unknown',
                    position: entry.position,
                    identifier: entry.identifier,
                    content_preview: entry.parts?.[0]?.text?.substring(0, 30),
                    is_first_mes: entry.is_first_mes,
                    depth: entry.injection_depth
                }))
            }
        });

        return [sortedEntries, chatHistory];
    }

    static extractDEntries(
        presetJson: PresetJson,
        worldBookJson: WorldBookJson,
        authorNoteJson?: AuthorNoteJson
    ): ChatMessage[] {
        const dEntries: ChatMessage[] = [];

        // 从prompt_order提取enabled状态
        const enabledIdentifiers = new Set(
            presetJson.prompt_order[0]?.order
                .filter(item => item.enabled)
                .map(item => item.identifier)
        );

        // 处理preset中的injection_position=1的条目
        for (const item of presetJson.prompts) {
            if (item.injection_position === 1 && enabledIdentifiers.has(item.identifier)) {
                dEntries.push({
                    name: item.name,
                    parts: [{ text: item.content }],
                    role: item.role || "user",
                    injection_depth: item.injection_depth || 0,
                    identifier: item.identifier,
                    is_d_entry: true,
                    position: 4, // 强制设为position=4，这样会被作为D类条目处理
                    constant: true // preset中的条目默认constant=true
                });
            }
        }

        // 添加作者注释
        if (authorNoteJson) {
            dEntries.push({
                name: "Author Note",
                parts: [{ text: authorNoteJson.content }],
                role: authorNoteJson.role || "user",
                injection_depth: authorNoteJson.injection_depth,
                is_d_entry: true,
                is_first_mes: false
            });
        }

        // 处理世界书中的D类条目
        for (const [_, entry] of Object.entries(worldBookJson.entries)) {
            if (!entry.disable && [2, 3, 4].includes(entry.position)) {
                if ([2, 3].includes(entry.position) && !authorNoteJson) {
                    continue;
                }

                dEntries.push({
                    name: entry.comment,
                    parts: [{ text: entry.content }],
                    role: "user",
                    is_d_entry: true,
                    position: entry.position,
                    key: entry.key,
                    constant: entry.constant,
                    injection_depth: entry.depth
                });
            }
        }

        // 添加D类条目结构树日志
        console.log('[CharacterUtils] D-entries structure tree:', {
            total_entries: dEntries.length,
            by_type: {
                preset_injection_entries: dEntries.filter(d => d.identifier).map(d => ({
                    name: d.name,
                    depth: d.injection_depth,
                    role: d.role,
                    from: 'preset_injection_position_1'
                })),
                world_book_entries: dEntries.filter(d => d.position && !d.identifier).map(d => ({
                    name: d.name,
                    depth: d.injection_depth,
                    position: d.position,
                    constant: d.constant,
                    has_keys: !!d.key?.length
                }))
            }
        });

        return dEntries;
    }
}
