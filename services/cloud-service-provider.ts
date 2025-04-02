/**
 * Cloud Service Provider
 * 
 * Handles the cloud service functionality for API communication with CradleAI
 */

import { API_CONFIG } from '@/constants/api-config';
import { CloudServiceConfig } from '@/shared/types';
import { licenseService } from '@/services/license-service';
import { updateCloudServiceStatus, addCloudServiceStatusListener } from '@/utils/settings-helper';

class CloudServiceProviderClass {
  private enabled: boolean = false;
  private licenseKey: string | null = null;
  private deviceId: string | null = null;
  private preferredModel: string = 'openai/gpt-3.5-turbo'; // Default model
  private cloudEndpoint: string = API_CONFIG.CLOUD_API_URL || 'https://chat.cradleintro.top';
  private initializationInProgress: boolean = false;
  
  constructor() {
    // Listen for tracker updates and synchronize the state
    addCloudServiceStatusListener((enabled) => {
      if (enabled && !this.isEnabled()) {
        console.log('[CloudServiceProvider] Tracker显示云服务已启用，尝试初始化');
        this.initializeFromTracker();
      } else if (!enabled && this.isEnabled()) {
        console.log('[CloudServiceProvider] Tracker显示云服务已禁用，禁用服务');
        this.disable();
      }
    });
    
    // Automatically check for existing license and initialize on startup
    this.autoInitializeOnStartup();
  }
  
  /**
   * Automatically initialize the cloud service if a valid license exists
   */
  private async autoInitializeOnStartup(): Promise<void> {
    try {
      // Check if we should initialize based on stored settings
      const { getUserSettingsGlobally } = require('@/utils/settings-helper');
      const settings = getUserSettingsGlobally();
      
      if (settings?.chat?.useCloudService === true) {
        console.log('[CloudServiceProvider] 应用启动时检测到云服务已启用，尝试自动初始化');
        this.initializeFromTracker();
      }
    } catch (error) {
      console.error('[CloudServiceProvider] 自动初始化失败:', error);
    }
  }

  /**
   * Initialize the cloud service with license information
   */
  async initialize(config: CloudServiceConfig): Promise<void> {
    if (!config.licenseKey || !config.deviceId) {
      console.error('[CloudService] Missing required license information');
      throw new Error('缺少有效的许可证信息');
    }
    
    // Validate license with license service
    try {
      const isValid = await this.validateLicense(config.licenseKey, config.deviceId);
      if (!isValid) {
        console.error('[CloudService] License validation failed');
        throw new Error('许可证验证失败，请检查激活码是否有效');
      }
    } catch (error) {
      console.error('[CloudService] License validation error:', error);
      throw new Error('许可证验证过程中发生错误: ' + (error instanceof Error ? error.message : String(error)));
    }
    
    this.licenseKey = config.licenseKey;
    this.deviceId = config.deviceId;
    this.enabled = true;
    
    // Set preferred model if provided
    if (config.preferredModel) {
      this.preferredModel = config.preferredModel;
      console.log(`[CloudService] 设置首选模型: ${this.preferredModel}`);
    }
    
    console.log('[CloudService] 初始化成功，云服务已启用');
    console.log(`[CloudService] 云服务端点: ${this.cloudEndpoint}`);
    console.log(`[CloudService] 许可证密钥: ${this.licenseKey?.substring(0, 4)}****`);
    console.log(`[CloudService] 设备ID: ${this.deviceId?.substring(0, 4)}****`);
    console.log(`[CloudService] 默认模型: ${this.preferredModel}`);
  }

  /**
   * Initialize the cloud service using the tracker state.
   */
  private async initializeFromTracker(): Promise<void> {
    // Prevent multiple simultaneous initialization attempts
    if (this.initializationInProgress) {
      console.log('[CloudServiceProvider] 初始化已在进行中，跳过重复请求');
      return;
    }
    
    this.initializationInProgress = true;
    
    try {
      const licenseInfo = await licenseService.getLicenseInfo();
      if (licenseInfo?.isValid) {
        await this.initialize({
          enabled: true,
          licenseKey: licenseInfo.licenseKey!,
          deviceId: licenseInfo.deviceId!,
          preferredModel: this.preferredModel,
        });
        console.log('[CloudServiceProvider] 成功从Tracker初始化云服务');
        
        // Update tracker status to match actual state
        updateCloudServiceStatus(true);
      } else {
        console.warn('[CloudServiceProvider] 无法从Tracker初始化云服务: 许可证无效');
        // Make sure tracker status matches actual state
        updateCloudServiceStatus(false);
      }
    } catch (error) {
      console.error('[CloudServiceProvider] 从Tracker初始化云服务失败:', error);
      // Make sure tracker status matches actual state
      updateCloudServiceStatus(false);
    } finally {
      this.initializationInProgress = false;
    }
  }
  
  /**
   * Validates the license with license service
   */
  private async validateLicense(licenseKey: string, deviceId: string): Promise<boolean> {
    try {
      // Use the license service to validate
      const licenseInfo = await licenseService.getLicenseInfo();
      
      if (!licenseInfo) {
        console.error('[CloudService] No license information found');
        return false;
      }
      
      if (!licenseInfo.isValid) {
        console.error('[CloudService] License is invalid');
        return false;
      }
      
      // Verify that the provided license key matches the one in the license service
      if (licenseInfo.licenseKey !== licenseKey) {
        console.error('[CloudService] License key mismatch');
        return false;
      }
      
      // Verify that the provided device ID matches the one in the license service
      if (licenseInfo.deviceId !== deviceId) {
        console.error('[CloudService] Device ID mismatch');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[CloudService] License validation error:', error);
      throw error;
    }
  }
  
  /**
   * Disable the cloud service and update the tracker.
   */
  disable(): void {
    this.enabled = false;
    console.log('[CloudServiceProvider] 云服务已禁用');
    updateCloudServiceStatus(false);
  }

  /**
   * Enable the cloud service and update the tracker.
   */
  async enable(config: CloudServiceConfig): Promise<void> {
    await this.initialize(config);
    updateCloudServiceStatus(true);
  }
  
  /**
   * Check if cloud service is enabled and properly configured
   */
  isEnabled(): boolean {
    return this.enabled && !!this.licenseKey && !!this.deviceId;
  }
  
  /**
   * Set preferred model for chat completions
   */
  setPreferredModel(modelId: string): void {
    if (modelId && modelId.trim()) {
      this.preferredModel = modelId.trim();
      console.log(`[CloudService] 更新首选模型: ${this.preferredModel}`);
    }
  }
  
  /**
   * Get current preferred model
   */
  getPreferredModel(): string {
    return this.preferredModel;
  }
  
  /**
   * Generate a chat completion using CradleAI
   * @param messages The messages array
   * @param options Additional options for the request
   */
  async generateChatCompletion(
    messages: Array<{role: string, content: string | Array<{type?: string, text?: string, image_url?: string}>}>,
    options: {
      model?: string,
      temperature?: number,
      max_tokens?: number,
      top_p?: number,
      frequency_penalty?: number,
      presence_penalty?: number,
      [key: string]: any
    } = {}
  ): Promise<Response> {
    if (!this.isEnabled()) {
      throw new Error('Cloud service is not enabled or properly configured');
    }
    
    try {
      console.log('[CloudService] 开始发送聊天请求到 CradleAI');
      
      // Use provided model or fall back to preferred model
      const modelToUse = options.model || this.preferredModel;
      
      // Standardize the message format for CradleAI - ensure content is always a string
      const standardizedMessages = messages.map(msg => {
        // If content is already a string, return as is
        if (typeof msg.content === 'string') {
          return { role: msg.role, content: msg.content };
        }
        
        // If content is an array, convert to string
        if (Array.isArray(msg.content)) {
          const textContent = msg.content
            .filter(part => part.text || (part.type === 'text'))
            .map(part => part.text || '')
            .join(' ');
          
          return { role: msg.role, content: textContent || '(No text content)' };
        }
        
        // Fallback
        return { role: msg.role, content: String(msg.content || '') };
      });
      
      // Construct the CradleAI compliant request body
      const requestBody = {
        model: modelToUse,
        messages: standardizedMessages,
        max_tokens: options.max_tokens || 800,
        temperature: options.temperature || 0.7,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty
      };
      
      console.log(`[CloudService] 请求模型: ${requestBody.model}`);
      console.log(`[CloudService] 消息数量: ${requestBody.messages.length}`);
      console.log(`[CloudService] 参数设置: temperature=${requestBody.temperature}, max_tokens=${requestBody.max_tokens}`);
      
      // Prepare headers for cloud service - no API key needed here
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-License-Key': this.licenseKey!,
        'X-Device-ID': this.deviceId!
      });
      
      // Add user agent information
      headers.set('User-Agent', 'CradleAI-Client/1.0');
      
      // Add referrer if available
      if (typeof window !== 'undefined' && window.location?.origin) {
        headers.set('Referer', window.location.origin);
      }
      
      // Prepare the request options
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        cache: 'no-store' // Ensure we always get a fresh response
      };
      
      // Use the correct endpoint URL
      const endpoint = this.cloudEndpoint.trim().replace(/\/+$/, '');
      const apiUrl = `${endpoint}/api/chat/completion`;
      
      console.log(`[CloudService] 发送请求到: ${apiUrl}`);
      
      // Record start time for performance measurement
      const startTime = Date.now();
      
      // Make the request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch(apiUrl, {
        ...requestOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Record end time and calculate duration
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[CloudService] 请求完成，耗时: ${duration}ms, 状态码: ${response.status}`);
      
      // Check for license validation errors
      if (response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        console.error(`[CloudService] 许可证验证失败: ${errorText}`);
        throw new Error('许可证验证失败，请检查激活码是否有效');
      }
      
      // Check for other errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CloudService] 请求失败 (${response.status}): ${errorText}`);
        throw new Error(`CradleAI 请求失败: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      // Enhance error handling
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('[CloudService] 请求超时');
          throw new Error('请求超时，请检查网络连接或稍后重试');
        }
        
        // Network errors
        if (error.message.includes('fetch') || error.message.includes('network')) {
          console.error('[CloudService] 网络错误:', error);
          throw new Error('网络连接失败，请检查您的互联网连接');
        }
      }
      
      console.error('[CloudService] 请求失败:', error);
      throw error;
    }
  }
  
  /**
   * Forward a request through the cloud service
   * @param originalUrl The original API URL
   * @param options Request options
   * @param apiType Type of API being called (e.g., 'gemini', 'openai')
   */
  async forwardRequest(
    originalUrl: string,
    options: RequestInit,
    apiType: 'gemini' | 'openai' | 'openrouter' | 'zhipu' = 'openai'
  ): Promise<Response> {
    if (!this.isEnabled()) {
      throw new Error('Cloud service is not enabled or properly configured');
    }
    
    try {
      console.log(`[CloudService] 开始通过云服务转发 ${apiType} API 请求`);
      
      // Extract URL information
      const urlObj = new URL(originalUrl);
      const pathName = urlObj.pathname;
      const searchParams = urlObj.search;
      
      // Mask API keys in query params for logging
      const maskedSearch = searchParams.replace(/(\bkey=)([^&]{4})[^&]*/gi, '$1$2****');
      console.log(`[CloudService] 原始路径: ${pathName}${maskedSearch}`);
      
      // Prepare request body with forwarding information
      let requestBody: any;
      
      if (options.body) {
        try {
          // Parse the original request body
          requestBody = JSON.parse(options.body as string);
        } catch (e) {
          // If not JSON, use as-is
          requestBody = options.body;
        }
      } else {
        requestBody = {};
      }
      
      // Create a wrapper that includes the forwarding metadata
      const forwardWrapper = {
        forward_to: apiType,
        original_url: originalUrl,
        original_path: pathName,
        original_params: Object.fromEntries(urlObj.searchParams.entries()),
        payload: requestBody
      };
      
      // Prepare headers for cloud service
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-License-Key': this.licenseKey!,
        'X-Device-ID': this.deviceId!,
        'X-Forward-API': apiType
      });
      
      // Add user agent information
      headers.set('User-Agent', 'CradleAI-Client/1.0');
      
      // Copy over important headers from the original request
      if (options.headers) {
        const originalHeaders = new Headers(options.headers);
        type HeadersMapping = {
          readonly [key: string]: string;
          readonly 'content-type': string;
          readonly 'accept': string;
          readonly 'x-license-key': string;
          readonly 'x-device-id': string;
          readonly 'user-agent': string;
        };

        const excludedHeaders: Array<keyof HeadersMapping> = ['content-type', 'accept', 'x-license-key', 'x-device-id', 'user-agent'];

        originalHeaders.forEach((value: string, key: string) => {
          // Skip content-type and other headers we've already set
          if (!excludedHeaders.includes(key.toLowerCase() as keyof HeadersMapping)) {
            headers.set(`X-Original-${key}`, value);
          }
        });
      }
      
      // Prepare the request options
      const requestOptions: RequestInit = {
        method: 'POST', // Always use POST for forwarding
        headers: headers,
        body: JSON.stringify(forwardWrapper),
        cache: 'no-store' // Ensure we always get a fresh response
      };
      
      // Ensure the cloud endpoint URL is properly formatted
      let endpoint = this.cloudEndpoint.trim().replace(/\/+$/, '');
      const apiUrl = `${endpoint}/api/forward`;
      
      console.log(`[CloudService] 发送请求到: ${apiUrl}`);
      
      // Record start time for performance measurement
      const startTime = Date.now();
      
      // Make the request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch(apiUrl, {
        ...requestOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Record end time and calculate duration
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[CloudService] 请求完成，耗时: ${duration}ms, 状态码: ${response.status}`);
      
      // Check for license validation errors
      if (response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        console.error(`[CloudService] 许可证验证失败: ${errorText}`);
        throw new Error('许可证验证失败，请检查激活码是否有效');
      }
      
      // Check for other errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CloudService] 请求失败 (${response.status}): ${errorText}`);
        throw new Error(`CradleAI 请求失败: ${response.status} ${response.statusText}`);
      }
      
      // Return the response as-is for the caller to handle
      return response;
    } catch (error) {
      // Enhance error handling
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('[CloudService] 请求超时');
          throw new Error('请求超时，请检查网络连接或稍后重试');
        }
        
        // Network errors
        if (error.message.includes('fetch') || error.message.includes('network')) {
          console.error('[CloudService] 网络错误:', error);
          throw new Error('网络连接失败，请检查您的互联网连接');
        }
      }
      
      console.error('[CloudService] 请求转发失败:', error);
      throw error;
    }
  }
  
  /**
   * List available models from CradleAI
   */
  async listModels(): Promise<any> {
    if (!this.isEnabled()) {
      throw new Error('Cloud service is not enabled or properly configured');
    }
    
    try {
      console.log('[CloudService] 获取可用模型列表');
      
      // Prepare headers for cloud service
      const headers = new Headers({
        'Accept': 'application/json',
        'X-License-Key': this.licenseKey!,
        'X-Device-ID': this.deviceId!
      });
      
      // Ensure the cloud endpoint URL is properly formatted
      let endpoint = this.cloudEndpoint.trim().replace(/\/+$/, '');
      const apiUrl = `${endpoint}/api/models`;
      
      console.log(`[CloudService] 发送请求到: ${apiUrl}`);
      
      // Make the request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers,
        cache: 'no-store' // Ensure we always get a fresh response
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CloudService] 获取模型列表失败 (${response.status}): ${errorText}`);
        throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`);
      }
      
      const modelsData = await response.json();
      console.log(`[CloudService] 成功获取模型列表，共 ${modelsData.data?.length || 0} 个模型`);
      
      return modelsData;
    } catch (error) {
      console.error('[CloudService] 获取模型列表失败:', error);
      throw error;
    }
  }
  
  /**
   * Get cloud service status information
   */
  getStatus(): { 
    enabled: boolean; 
    licenseInfo?: { key: string; device: string };
    model?: string;
  } {
    if (!this.isEnabled()) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      licenseInfo: {
        key: this.licenseKey!.substring(0, 4) + '****',
        device: this.deviceId!.substring(0, 4) + '****'
      },
      model: this.preferredModel
    };
  }
}

// Export a singleton instance
export const CloudServiceProvider = new CloudServiceProviderClass();
