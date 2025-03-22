/**
 * 调试助手工具
 * 提供各种诊断和日志函数
 */

/**
 * 检查初始状态 - 验证API配置
 * @param settings 聊天设置
 */
export function checkInitialState(settings: any): void {
  try {
    // 检查是否存在必要的设置字段
    const hasApiProvider = !!settings.apiProvider;
    const isOpenRouter = settings.apiProvider === 'openrouter';
    const isGemini = settings.apiProvider === 'gemini';
    
    const hasOpenRouterKey = isOpenRouter && !!settings.openrouter?.apiKey;
    const hasGeminiKey = isGemini && !!settings.characterApiKey;
    
    const hasApiKey = hasOpenRouterKey || hasGeminiKey;
    
    // 总结配置状态
    const configStatus = {
      hasApiProvider,
      provider: settings.apiProvider,
      hasApiKey,
      openRouterEnabled: isOpenRouter,
      hasOpenRouterKey,
      hasGeminiKey,
    };
    
    if (hasApiProvider && hasApiKey) {
      console.log('[Mem0初始化] 配置检查通过，所有必要字段已提供');
    } else {
      const missingFields = [];
      if (!hasApiProvider) missingFields.push('apiProvider');
      if (!hasApiKey) missingFields.push('apiKey');
      
      console.warn(`[Mem0初始化] 配置检查失败，缺少字段: ${missingFields.join(', ')}`);
      console.warn('[Mem0初始化] 配置状态:', configStatus);
    }
  } catch (error) {
    console.error('[Mem0初始化] 配置检查出错:', error);
  }
}

/**
 * 记录API配置
 * @param settings 聊天设置
 */
export function logApiConfig(settings: any): void {
  try {
    const apiProvider = settings.apiProvider || 'unknown';
    
    // 确定正确的API密钥和模型
    const apiKey = apiProvider === 'openrouter' 
      ? settings.openrouter?.apiKey 
      : settings.characterApiKey;
      
    const model = apiProvider === 'openrouter'
      ? settings.openrouter?.model || 'openai/gpt-3.5-turbo'
      : 'gemini-2.0-flash-exp';
    
    // 打印配置信息
    console.log('-------------------- Mem0 API 配置 --------------------');
    console.log(`API提供商: ${apiProvider}`);
    console.log(`LLM模型: ${model}`);
    console.log(`API密钥长度: ${apiKey?.length || 0} 字符`);
    console.log('-------------------------------------------------------');
  } catch (error) {
    console.error('[Mem0] 记录API配置时出错:', error);
  }
}

/**
 * 记录API错误
 * @param error 错误对象
 * @param context 错误上下文
 */
export function logApiError(error: any, context: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[Mem0] ${context}: ${errorMessage}`);
  
  // 针对特定类型的错误提供诊断信息
  if (errorMessage.includes('API key')) {
    console.error('[Mem0] 诊断: API密钥问题，请检查API密钥是否正确设置');
  } else if (errorMessage.includes('429') || errorMessage.includes('rate_limit')) {
    console.error('[Mem0] 诊断: 达到API速率限制，请稍后再试');
  } else if (errorMessage.includes('401') || errorMessage.includes('auth')) {
    console.error('[Mem0] 诊断: 认证失败，请检查API密钥是否有效');
  }
}
