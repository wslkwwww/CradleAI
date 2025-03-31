/**
 * Cloud Service Provider
 * 
 * Handles the cloud service functionality for API communication
 */

import { API_CONFIG } from '@/constants/api-config';
import { CloudServiceConfig } from '@/shared/types';

class CloudServiceProviderClass {
  private enabled: boolean = false;
  private licenseKey: string | null = null;
  private deviceId: string | null = null;
  private cloudEndpoint: string = API_CONFIG.CLOUD_API_URL || 'https://chat.cradleintro.top';
  
  /**
   * Initialize the cloud service with license information
   */
  initialize(config: CloudServiceConfig): void {
    if (!config.licenseKey || !config.deviceId) {
      console.error('[CloudService] Missing required license information');
      throw new Error('缺少有效的许可证信息');
    }
    
    this.licenseKey = config.licenseKey;
    this.deviceId = config.deviceId;
    this.enabled = true;
    
    console.log('[CloudService] 初始化成功，云服务已启用');
    console.log(`[CloudService] 云服务端点: ${this.cloudEndpoint}`);
    console.log(`[CloudService] 许可证密钥: ${this.licenseKey?.substring(0, 4)}****`);
    console.log(`[CloudService] 设备ID: ${this.deviceId?.substring(0, 4)}****`);
  }
  
  /**
   * Disable the cloud service
   */
  disable(): void {
    this.enabled = false;
    console.log('[CloudService] 云服务已禁用');
  }
  
  /**
   * Check if cloud service is enabled and properly configured
   */
  isEnabled(): boolean {
    return this.enabled && !!this.licenseKey && !!this.deviceId;
  }
  
  /**
   * Forward a request to the cloud service
   * @param endpoint The original API endpoint
   * @param requestOptions The original request options
   * @param provider The API provider (openrouter, gemini, etc.)
   */
  async forwardRequest(
    endpoint: string, 
    requestOptions: RequestInit,
    provider: 'openrouter' | 'gemini'
  ): Promise<Response> {
    if (!this.isEnabled()) {
      throw new Error('Cloud service is not enabled or properly configured');
    }
    
    try {
      console.log(`[CloudService] 开始转发 ${provider} 请求到云服务`);
      
      // Mask API keys in the endpoint URL for logging
      const maskedEndpoint = this.maskApiKey(endpoint);
      console.log(`[CloudService] 原始端点: ${maskedEndpoint}`);
      
      // Prepare headers for cloud service
      const headers = new Headers(requestOptions.headers);
      
      // Add license information to headers
      headers.set('X-License-Key', this.licenseKey!);
      headers.set('X-Device-ID', this.deviceId!);
      headers.set('X-Provider', provider);
      
      console.log(`[CloudService] 已添加许可证头信息: X-License-Key=${this.licenseKey!.substring(0, 4)}****, X-Device-ID=${this.deviceId!.substring(0, 4)}****, X-Provider=${provider}`);
      
      // Create the forwarded request options
      const forwardedOptions: RequestInit = {
        ...requestOptions,
        headers
      };
      
      // Fix URL construction to ensure clean endpoint URLs
      // Remove any trailing slashes from the cloud endpoint
      let baseEndpoint = this.cloudEndpoint.replace(/\/+$/, '');
      
      // Ensure the base endpoint doesn't already include /chat
      if (baseEndpoint.endsWith('/chat')) {
        console.log(`[CloudService] 检测到端点已包含 /chat 路径，移除以避免重复`);
        baseEndpoint = baseEndpoint.replace(/\/chat$/, '');
      }
      
      // Create the cloud URL by directly using the endpoint as the "endpoint" parameter
      const cloudUrl = `${baseEndpoint}/chat?endpoint=${endpoint}`;
      
      // Mask API keys in the cloud URL for logging
      const maskedCloudUrl = this.maskApiKey(cloudUrl);
      console.log(`[CloudService] 转发请求URL: ${maskedCloudUrl}`);
      
      // Check for duplicate /chat/chat in the URL
      if (cloudUrl.includes('/chat/chat')) {
        console.error('[CloudService] 警告: 检测到URL包含重复的 /chat/chat 路径段');
      }
      
      console.log(`[CloudService] 请求方法: ${forwardedOptions.method}`);
      
      // 记录请求体大小，但不打印完整内容以避免敏感信息泄露
      if (forwardedOptions.body) {
        let bodySize = 0;
        if (typeof forwardedOptions.body === 'string') {
          bodySize = forwardedOptions.body.length;
          
          // 只打印请求体的前100个字符作为预览
          const bodyPreview = forwardedOptions.body.substring(0, 100) + (forwardedOptions.body.length > 100 ? '...' : '');
          console.log(`[CloudService] 请求体预览: ${bodyPreview}`);
        } else {
          console.log(`[CloudService] 请求体类型: ${typeof forwardedOptions.body}`);
        }
        console.log(`[CloudService] 请求体大小: ${bodySize} 字节`);
      }
      
      // 记录开始发送请求的时间
      const startTime = Date.now();
      console.log(`[CloudService] 开始发送请求: ${new Date(startTime).toISOString()}`);
      
      // Make the request
      const response = await fetch(cloudUrl, forwardedOptions);
      
      // 记录请求完成的时间和耗时
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[CloudService] 请求完成: ${new Date(endTime).toISOString()}, 耗时: ${duration}ms`);
      console.log(`[CloudService] 响应状态: ${response.status} ${response.statusText}`);
      
      // Log response headers
      console.log('[CloudService] 响应头信息:');
      response.headers.forEach((value: string, name: string): void => {
        console.log(`[CloudService] - ${name}: ${value}`);
      });
      
      // Check if the response indicates a license error
      if (response.status === 401 || response.status === 403) {
        console.error(`[CloudService] 许可证验证失败，HTTP状态码: ${response.status}`);
        
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.includes('license')) {
          console.error('[CloudService] 许可证验证失败详情:', errorData.error);
          throw new Error('许可证验证失败，请检查激活码是否有效');
        }
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[CloudService] 请求失败 (${response.status}): ${errorText}`);
        throw new Error(`Cloud service request failed: ${response.status} ${response.statusText}`);
      }
      
      // 检查响应体大小
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        console.log(`[CloudService] 响应体大小: ${contentLength} 字节`);
      }
      
      console.log(`[CloudService] ${provider} 请求转发成功，状态码: ${response.status}`);
      return response;
    } catch (error) {
      // Additional error handling for URL parsing issues
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        console.error('[CloudService] URL格式错误:', error.message);
        console.error('[CloudService] 原始端点:', endpoint);
        throw new Error(`无效的API端点URL格式: ${error.message}`);
      }
      
      console.error('[CloudService] 请求转发失败:', error);
      
      // 增强错误日志，提供更多上下文信息
      if (error instanceof Error) {
        console.error(`[CloudService] 错误类型: ${error.name}, 错误信息: ${error.message}`);
        console.error(`[CloudService] 错误堆栈: ${error.stack}`);
      }
      
      // 尝试判断错误类型，提供更有针对性的日志
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('[CloudService] 网络请求失败，可能是网络连接问题或云服务端点不可用');
      } else if (error instanceof SyntaxError) {
        console.error('[CloudService] JSON解析错误，服务器返回的响应格式不正确');
      }
      
      throw error;
    }
  }
  
  /**
   * Mask API keys in URLs for logging purposes
   * @param url URL that may contain API keys
   * @returns URL with masked API keys
   */
  private maskApiKey(url: string): string {
    // Mask "key=XXX" parameters
    let maskedUrl = url.replace(/(\bkey=)([^&]{4})[^&]*/gi, '$1$2****');
    
    // Mask "Bearer XXX" in the URL if present (shouldn't normally happen, but just in case)
    maskedUrl = maskedUrl.replace(/(\bBearer\s+)([^\s]{4})[^\s]*/gi, '$1$2****');
    
    // Mask API key if it appears in other formats
    maskedUrl = maskedUrl.replace(/([A-Za-z0-9_-]{20,})/g, (match) => {
      // Only mask if it looks like an API key (long alphanumeric string)
      if (match.length >= 20 && /^[A-Za-z0-9_-]+$/.test(match)) {
        return match.substring(0, 4) + '****';
      }
      return match;
    });
    
    return maskedUrl;
  }
  
  /**
   * Get cloud service status information
   */
  getStatus(): { enabled: boolean; licenseInfo?: { key: string; device: string } } {
    if (!this.isEnabled()) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      licenseInfo: {
        key: this.licenseKey!.substring(0, 4) + '****',
        device: this.deviceId!.substring(0, 4) + '****'
      }
    };
  }
}

// Export a singleton instance
export const CloudServiceProvider = new CloudServiceProviderClass();
