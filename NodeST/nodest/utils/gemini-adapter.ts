import { ChatMessage } from '@/shared/types';

// Define interfaces for image handling
interface ImagePart {
    inlineData?: {
        data: string;
        mimeType: string;
    };
    fileData?: {
        mimeType: string;
        fileUri: string;
    };
}

interface ContentPart {
    text?: string;
    inlineData?: {
        data: string;
        mimeType: string;
    };
    fileData?: {
        mimeType: string;
        fileUri: string;
    };
}

interface GeneratedContent {
    text?: string;
    images?: string[]; // Base64 encoded images
}

interface ImageInput {
    // Base64 encoded image data
    data?: string;
    // MIME type of the image (e.g., "image/jpeg", "image/png")
mimeType?: string;
    // URL to fetch the image from
    url?: string;
}

export class GeminiAdapter {
    private readonly BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    private readonly apiKey: string;
    private readonly model = "gemini-2.0-flash-exp";  // Updated to use a more powerful model for characters
    private readonly headers = {
        "Content-Type": "application/json"
    };
    private conversationHistory: ChatMessage[] = [];

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("API key cannot be empty");
        }
        this.apiKey = apiKey;
    }

    async generateContent(contents: ChatMessage[]): Promise<string> {
        const url = `${this.BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`;
        
        const data = {
            contents,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,  // Increased token limit for character generation
            }
        };

        try {
            console.log(`[Gemini适配器] 发送请求到API: ${this.model}`);
            console.log(`[Gemini适配器] 请求包含 ${contents.length} 条消息`);
            
            // Enhanced logging for each message in the request
            contents.forEach((msg, index) => {
                const previewText = msg.parts?.[0]?.text || "";
                console.log(`[Gemini适配器] 消息 #${index + 1} (${msg.role}): ${previewText.substring(0, 100)}...`);
                
                // Special handling for messages that might contain VNDB data, appearance tags, or traits
                if (previewText.includes("VNDB") || 
                    previewText.includes("角色参考") || 
                    previewText.includes("外观参考") || 
                    previewText.includes("标签") || 
                    previewText.includes("特征")) {
                    
                    // Log a more complete version of important data
                    const importantDataPreview = previewText.substring(0, 300);
                    console.log(`[Gemini适配器] 重要数据预览 #${index + 1}: ${importantDataPreview}...`);
                    
                    // Check for specific sections and log them
                    if (previewText.includes("正向标签")) {
                        const positiveTagsMatch = previewText.match(/正向标签[：:]\s*([\s\S]*?)(?=负向标签|$)/);
                        if (positiveTagsMatch && positiveTagsMatch[1]) {
                            console.log(`[Gemini适配器] 正向标签: ${positiveTagsMatch[1].trim()}`);
                        }
                    }
                    
                    if (previewText.includes("负向标签")) {
                        const negativeTagsMatch = previewText.match(/负向标签[：:]\s*([\s\S]*?)(?=\n\n|$)/);
                        if (negativeTagsMatch && negativeTagsMatch[1]) {
                            console.log(`[Gemini适配器] 负向标签: ${negativeTagsMatch[1].trim()}`);
                        }
                    }
                    
                    if (previewText.includes("特征")) {
                        const traitsMatch = previewText.match(/特征[：:]\s*([\s\S]*?)(?=\n\n|$)/);
                        if (traitsMatch && traitsMatch[1]) {
                            console.log(`[Gemini适配器] 角色特征: ${traitsMatch[1].trim()}`);
                        }
                    }
                    
                    if (previewText.includes("性别")) {
                        const genderMatch = previewText.match(/[角色|用户]性别[：:]\s*([\s\S]*?)(?=\n\n|$)/);
                        if (genderMatch && genderMatch[1]) {
                            console.log(`[Gemini适配器] 性别信息: ${genderMatch[1].trim()}`);
                        }
                    }
                }
            });

            // Log messages before sending to API
            console.log('[GeminiAdapter] Sending request to Gemini API:');
            console.log(JSON.stringify(contents, null, 2));
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Gemini适配器] API响应错误 (${response.status}): ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }

            const result = await response.json();
            
            if (result.candidates?.[0]?.content) {
                const responseText = result.candidates[0].content.parts?.[0]?.text || "";
                if (responseText) {
                    console.log(`[Gemini适配器] 成功接收响应，长度: ${responseText.length}`);
                    console.log(`[Gemini适配器] 响应前100个字符: ${responseText.substring(0, 100)}...`);
                    
                    // Log potential JSON formatting issues
                    if (responseText.includes('"') && responseText.includes('\\')) {
                        console.warn('[Gemini适配器] 警告：响应中可能存在不正确的JSON转义字符');
                    }
                    
                    this.conversationHistory.push({
                        role: "assistant",
                        parts: [{ text: responseText }]
                    });
                } else {
                    console.warn(`[Gemini适配器] 接收到空响应`);
                }
                return responseText;
            }
            console.error(`[Gemini适配器] 无效的响应格式: ${JSON.stringify(result)}`);
            return "";

        } catch (error) {
            console.error("[Gemini适配器] 生成内容时出错:", error);
            throw error;
        }
    }

    /**
     * 生成包含文本和/或图片的内容
     * @param prompt 文本提示
     * @param options 生成选项
     * @returns 生成的内容（文本和图片）
     */
    async generateMultiModalContent(prompt: string, options: { 
        includeImageOutput?: boolean;
        temperature?: number;
        images?: ImageInput[]; // Support both base64 encoded images and URLs
    } = {}): Promise<GeneratedContent> {
        // 始终使用gemini-2.0-flash-exp，因为它是唯一支持图像生成的模型
        const modelToUse = "gemini-2.0-flash-exp";
        
        const url = `${this.BASE_URL}/models/${modelToUse}:generateContent?key=${this.apiKey}`;
        
        // 准备请求内容
        const contents: { role: string; parts: ContentPart[] }[] = [{
            role: "user",
            parts: [{ text: prompt }]
        }];

        // 如果提供了图片，需要处理并添加到请求中
        if (options.images && options.images.length > 0) {
            try {
                // 将文本部分移除，我们将在新数组中重新添加
                contents[0].parts = [];
                
                // 添加文本提示作为第一部分
                if (prompt) {
                    contents[0].parts.push({ text: prompt });
                }
                
                // 处理每一个图像输入（可能是URL或Base64数据）
                for (const img of options.images) {
                    // 通过URL获取图像的情况
                    if (img.url) {
                        const imageData = await this.fetchImageAsBase64(img.url);
                        contents[0].parts.push({
                            inlineData: {
                                data: imageData.data,
                                mimeType: imageData.mimeType || 'image/jpeg'
                            }
                        });
                    } 
                    // 直接提供Base64数据的情况
                    else if (img.data && img.mimeType) {
                        contents[0].parts.push({
                            inlineData: {
                                data: img.data,
                                mimeType: img.mimeType
                            }
                        });
                    }
                }
                
                console.log(`[Gemini适配器] 已处理 ${contents[0].parts.length - 1} 张图片`);
            } catch (error) {
                console.error("[Gemini适配器] 处理图片输入时出错:", error);
                throw new Error("处理图片输入失败: " + (error instanceof Error ? error.message : String(error)));
            }
        }

        // 准备请求数据
        const data: any = {
            contents,
            generationConfig: {
                temperature: options.temperature || 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            }
        };

        // 如果需要图片输出，添加正确的参数配置
        if (options.includeImageOutput) {
            // 根据文档使用正确的responseModalities参数
            data.generationConfig.responseModalities = ['TEXT', 'IMAGE'];
            console.log(`[Gemini适配器] 已配置图像生成选项，使用模型: ${modelToUse}`);
            console.log(`[Gemini适配器] 响应模态: ${JSON.stringify(data.generationConfig.responseModalities)}`);
        }

        try {
            console.log(`[Gemini适配器] 发送多模态请求到API: ${modelToUse}`);
            console.log(`[Gemini适配器] 请求是否包含图片输出: ${options.includeImageOutput ? '是' : '否'}`);
            console.log(`[Gemini适配器] 请求数据:`, JSON.stringify(data, null, 2));
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Gemini适配器] 多模态API响应错误 (${response.status}): ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }

            const result = await response.json();
            
            // 解析响应
            if (result.candidates?.[0]?.content) {
                const parts = result.candidates[0].content.parts || [];
                const generatedContent: GeneratedContent = {};
                const images: string[] = [];
                
                // 处理每个部分（可能是文本或图片）
                parts.forEach((part: any) => {
                    if (part.text) {
                        generatedContent.text = (generatedContent.text || '') + part.text;
                    }
                    if (part.inlineData) {
                        // 这是一个Base64编码的图片
                        images.push(part.inlineData.data);
                    }
                });
                
                if (images.length > 0) {
                    generatedContent.images = images;
                }
                
                console.log(`[Gemini适配器] 成功接收多模态响应`);
                if (generatedContent.text) {
                    console.log(`[Gemini适配器] 响应包含文本，长度: ${generatedContent.text.length}`);
                }
                if (generatedContent.images) {
                    console.log(`[Gemini适配器] 响应包含 ${generatedContent.images.length} 个图片`);
                }
                
                return generatedContent;
            }
            
            console.error(`[Gemini适配器] 无效的多模态响应格式: ${JSON.stringify(result)}`);
            return {};
            
        } catch (error) {
            console.error("[Gemini适配器] 生成多模态内容时出错:", error);
            throw error;
        }
    }

    /**
     * 从URL获取图像并转换为Base64格式
     * @param imageUrl 图像URL
     * @returns 图像的Base64编码和MIME类型
     */
    // 修改：公开此方法以便其他类可以使用
    async fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
        try {
            console.log(`[Gemini适配器] 正在从URL获取图片: ${imageUrl}`);
            
            const response = await fetch(imageUrl);
            
            if (!response.ok) {
                throw new Error(`获取图片失败: ${response.status} ${response.statusText}`);
            }
            
            // 获取内容类型（MIME类型）
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            
            // 获取图像数据并转换为Base64
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            
            // 转换为Base64字符串
            let binaryString = '';
            for (let i = 0; i < bytes.length; i++) {
                binaryString += String.fromCharCode(bytes[i]);
            }
            const base64Data = btoa(binaryString);
            
            // 修正: 不打印完整的base64字符串，只记录其长度和前10个字符
            const previewLength = 10;
            const base64Preview = base64Data.substring(0, previewLength) + '...';
            console.log(`[Gemini适配器] 成功获取并编码图片，MIME类型: ${contentType}, 大小: ${base64Data.length}字节, 预览: ${base64Preview}`);
            
            return {
                data: base64Data,
                mimeType: contentType
            };
        } catch (error) {
            console.error(`[Gemini适配器] 从URL获取图片失败:`, error);
            throw error;
        }
    }

    /**
     * 从本地文件创建Base64图像数据
     * @param fileUri 本地文件URI
     * @returns Promise<{data: string, mimeType: string}>
     */
    async getImageDataFromLocalFile(fileUri: string): Promise<{ data: string; mimeType: string }> {
        try {
            // 注意：这个方法需要根据不同平台实现
            // 在React Native中，可能会使用react-native-fs或expo-file-system
            // 为了保持适配器的通用性，这里我们返回一个未实现的错误
            // 实际实现应该在调用此方法的组件中完成
            throw new Error("从本地文件获取图像数据的方法需要在特定平台上实现");
        } catch (error) {
            console.error(`[Gemini适配器] 从本地文件获取图片失败:`, error);
            throw error;
        }
    }

    /**
     * 生成图片
     * @param prompt 图片生成提示
     * @param options 生成选项
     * @returns 生成的Base64编码图片数组
     */
    async generateImage(prompt: string, options: {
        temperature?: number;
        referenceImages?: ImageInput[];
    } = {}): Promise<string[]> {
        console.log(`[Gemini适配器] 请求生成图片，提示: ${prompt.substring(0, 50)}...`);
        
        try {
            // 使用正确的模型和API端点
            const enhancedPrompt = `我需要一张基于以下描述的图片(请务必生成图像): ${prompt}`;
            
            console.log(`[Gemini适配器] 使用gemini-2.0-flash-exp模型生成图片`);
            
            // 直接使用多模态API生成图片
            const result = await this.generateMultiModalContent(enhancedPrompt, {
                includeImageOutput: true,
                temperature: options.temperature || 0.7,
            });
            
            if (result.images && result.images.length > 0) {
                console.log(`[Gemini适配器] 成功生成 ${result.images.length} 张图片`);
                return result.images;
            } else {
                console.log(`[Gemini适配器] 未能生成图片，尝试使用更明确的提示`);
                
                // 如果第一次尝试失败，使用更具体的提示再试一次
                const secondAttemptPrompt = 
                    `Generate an image of the following (please output an image in your response): ${prompt}`;
                
                const result2 = await this.generateMultiModalContent(secondAttemptPrompt, {
                    includeImageOutput: true,
                    temperature: options.temperature || 0.9, // 略微提高创造性
                });
                
                return result2.images || [];
            }
        } catch (error) {
            console.error("[Gemini适配器] 图像生成失败:", error);
            return [];
        }
    }

    /**
     * 分析图片内容
     * @param image 图片输入（URL或Base64数据）
     * @param prompt 询问图片的提示
     * @returns 分析结果文本
     */
    async analyzeImage(image: ImageInput, prompt: string): Promise<string> {
        // 增强图像分析提示词，以获得更全面的描述
        const enhancedPrompt = prompt || `请详细描述这张图片的内容。包括：
1. 图片中的主要人物/物体
2. 场景和环境
3. 颜色和氛围
4. 任何特殊或显著的细节
5. 图片可能传递的情感或意图

请提供全面但简洁的描述，控制在150字以内。`;

        // 确保我们有正确的图像数据格式
        let processedImage: ImageInput;
        
        if (image.url) {
            // 如果提供了URL，先获取图像数据
            try {
                const imageData = await this.fetchImageAsBase64(image.url);
                processedImage = imageData;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`无法处理图像URL: ${errorMessage}`);
            }
        } else {
            // 如果已经提供了Base64数据，直接使用
            processedImage = image;
        }
        
        // 修改：预览提示词的前50个字符而不是完整打印
        const promptPreview = enhancedPrompt.substring(0, 50) + (enhancedPrompt.length > 50 ? '...' : '');
        console.log(`[Gemini适配器] 使用增强提示词分析图片: "${promptPreview}"`);
        
        const result = await this.generateMultiModalContent(enhancedPrompt, {
            images: [processedImage]
        });
        
        return result.text || '';
    }

    getChatHistory(): Array<{ role: string; text: string }> {
        return this.conversationHistory.map(msg => ({
            role: msg.role,
            text: msg.parts[0]?.text || ""
        }));
    }

    /**
     * 编辑图片
     * @param image 原始图片（URL或Base64数据）
     * @param editPrompt 编辑指令
     * @returns 编辑后的图片（Base64编码）
     */


    /**
     * 图片编辑 - 为了正确执行图像编辑操作，我们需要专门的方法
     * @param image 原始图片
     * @param prompt 编辑指令
     * @param options 编辑选项
     * @returns 编辑后的图片数据
     */
    async editImage(
        image: ImageInput, 
        prompt: string,
        options: {
            temperature?: number;
        } = {}
    ): Promise<string | null> {
        console.log(`[Gemini适配器] 请求编辑图片，提示: ${prompt}`);
        
        try {
            // 处理图像输入
            let processedImage: {data: string; mimeType: string};
            
            if (image.url) {
                // 如果是URL，获取并转换为Base64
                processedImage = await this.fetchImageAsBase64(image.url);
            } else if (image.data && image.mimeType) {
                // 如果直接提供了Base64数据
                processedImage = {
                    data: image.data,
                    mimeType: image.mimeType
                };
            } else {
                throw new Error("编辑图片需要有效的图像数据");
            }
            
            // 构建强调编辑操作的提示词
            const editPrompt = `请将这张图片${prompt}。输出编辑后的图片，保持原图的基本元素和构成。`;
            
            // 使用多模态API发送图像和编辑指令
            const result = await this.generateMultiModalContent(editPrompt, {
                includeImageOutput: true, // 需要返回图像
                temperature: options.temperature || 0.7,
                images: [{ 
                    data: processedImage.data,
                    mimeType: processedImage.mimeType
                }]
            });
            
            // 检查是否有图像输出
            if (result.images && result.images.length > 0) {
                console.log(`[Gemini适配器] 图像编辑成功`);
                return result.images[0];
            }
            
            // 如果没有返回图像，尝试用更明确的英文提示
            console.log(`[Gemini适配器] 第一次尝试未获得图像输出，尝试使用英文提示`);
            
            const englishPrompt = `Edit this image to ${prompt}. Return the edited image maintaining the basic elements and composition of the original.`;
            
            const secondAttempt = await this.generateMultiModalContent(englishPrompt, {
                includeImageOutput: true,
                temperature: options.temperature || 0.8, // 稍微提高温度
                images: [{ 
                    data: processedImage.data,
                    mimeType: processedImage.mimeType
                }]
            });
            
            if (secondAttempt.images && secondAttempt.images.length > 0) {
                console.log(`[Gemini适配器] 第二次尝试图像编辑成功`);
                return secondAttempt.images[0];
            }
            
            console.log(`[Gemini适配器] 图像编辑失败，未收到图像响应`);
            return null;
        } catch (error) {
            console.error("[Gemini适配器] 编辑图片失败:", error);
            throw error;
        }
    }
}
