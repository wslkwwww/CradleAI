import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceUtils } from '@/utils/device-utils';
import { API_CONFIG } from '@/constants/api-config';

// 存储键名
const LICENSE_KEY_STORAGE_KEY = 'license_key';
const IS_INITIALIZING_KEY = 'license_service_initializing';

export interface LicenseInfo {
  licenseKey: string;
  deviceId: string;
  planId: string;
  expiryDate: string;
  customerEmail?: string;
  deviceCount?: number;
  isValid: boolean;
}

class LicenseService {
  private licenseKey: string | null = null;
  private licenseInfo: LicenseInfo | null = null;
  private deviceId: string | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * 初始化服务，从存储中加载许可证
   */
  public async initialize(): Promise<void> {
    // 防止重复初始化
    if (this.initialized) return;
    
    // 如果已经在初始化中，等待现有的初始化完成
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // 创建初始化promise并存储它
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      // 检查是否有其他初始化过程在进行中
      const isInitializing = await AsyncStorage.getItem(IS_INITIALIZING_KEY);
      if (isInitializing === 'true') {
        console.log('[LicenseService] 另一个初始化过程正在进行，等待...');
        // 等待一小段时间，让其他初始化完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.initialized = true;
        return;
      }

      // 标记初始化开始
      await AsyncStorage.setItem(IS_INITIALIZING_KEY, 'true');
      
      console.log('[LicenseService] 初始化许可证服务...');
      
      // 加载许可证密钥
      this.licenseKey = await AsyncStorage.getItem(LICENSE_KEY_STORAGE_KEY);
      console.log('[LicenseService] 从存储加载许可证密钥:', this.licenseKey ? '成功' : '未找到');
      
      // 获取设备ID
      this.deviceId = await DeviceUtils.getDeviceId();
      console.log('[LicenseService] 设备ID:', this.deviceId ? this.deviceId.substring(0, 4) + '****' : '未获取');
      
      // 如果有许可证密钥，验证其有效性
      if (this.licenseKey) {
        try {
          console.log('[LicenseService] 尝试验证已存储的许可证...');
          const info = await this._verifyLicenseInternal(this.licenseKey);
          this.licenseInfo = info;
          console.log('[LicenseService] 许可证加载并验证成功');
        } catch (error) {
          console.warn('[LicenseService] 存储的许可证验证失败:', error);
          // 许可证验证失败，但不清除存储的许可证密钥
          // 这里我们仍然保留许可证信息，但标记为无效
          if (this.licenseInfo) {
            this.licenseInfo.isValid = false;
          }
        }
      }
      
      this.initialized = true;
      console.log('[LicenseService] 许可证服务初始化完成');
    } catch (error) {
      console.error('[LicenseService] 初始化许可证服务失败:', error);
      this.initialized = true; // 即使失败也标记为已初始化，避免反复初始化
    } finally {
      // 清除初始化标记
      await AsyncStorage.removeItem(IS_INITIALIZING_KEY);
      this.initializationPromise = null;
    }
  }

  /**
   * 验证许可证密钥 - 公开接口
   */
  public async verifyLicense(licenseKey: string): Promise<LicenseInfo> {
    console.log('[LicenseService] 开始验证新许可证:', licenseKey.substring(0, 4) + '****');
    
    // 确保已初始化
    if (!this.initialized) {
      console.log('[LicenseService] 验证前初始化服务');
      await this.initialize();
    }
    
    // 实际验证过程
    return this._verifyLicenseInternal(licenseKey);
  }

  /**
   * 验证许可证密钥 - 内部实现
   */
  private async _verifyLicenseInternal(licenseKey: string): Promise<LicenseInfo> {
    // 获取设备ID
    if (!this.deviceId) {
      this.deviceId = await DeviceUtils.getDeviceId();
      console.log('[LicenseService] 获取设备ID:', this.deviceId.substring(0, 4) + '****');
    }
    
    // 首先测试与服务器的连接
    console.log('[LicenseService] 测试与授权服务器的连接');
    const connectivityResult = await this.testServerConnectivity();
    console.log('[LicenseService] 服务器连接测试结果:', connectivityResult);
    
    if (!connectivityResult.anySuccess) {
      console.error('[LicenseService] 连接测试失败:', connectivityResult.details);
      throw new Error('无法连接到授权服务器，请检查网络连接后重试');
    }
    
    // 请求数据 - 确保与curl命令使用相同的键名格式
    const requestData = {
      license_key: licenseKey,
      device_id: this.deviceId
    };
    
    console.log('[LicenseService] 将使用设备ID:', this.deviceId);
    
    // 定义所有要尝试的URL (主要 + 备用)
    const urlsToTry = [
      API_CONFIG.LICENSE_API_URL,
      ...(API_CONFIG.LICENSE_API_FALLBACKS || [])
    ];
    
    // 记录所有错误以便报告
    const errors: string[] = [];
    
    // 依次尝试每个URL
    for (const apiUrl of urlsToTry) {
      try {
        console.log(`[LicenseService] 尝试验证授权：${apiUrl}`);
        
        // 增强的fetch请求，包含超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
        
        console.log('[LicenseService] 请求数据:', JSON.stringify(requestData));
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'CradleIntro-App/1.0',
          },
          body: JSON.stringify(requestData),
          signal: controller.signal,
          // 禁用缓存，确保总是发送新请求
          cache: 'no-store',
        }).catch(err => {
          console.error(`[LicenseService] Fetch异常: ${err.message}`);
          throw err;
        });
        
        clearTimeout(timeoutId);
        
        console.log(`[LicenseService] ${apiUrl} 响应状态码:`, response.status);
        
        // 获取响应文本
        const responseText = await response.text();
        console.log(`[LicenseService] ${apiUrl} 响应内容:`, responseText);
        
        if (!response.ok) {
          const errorMsg = `验证失败(${response.status}): ${responseText}`;
          errors.push(errorMsg);
          console.error(`[LicenseService] ${errorMsg}`);
          continue; // 尝试下一个URL
        }
        
        // 尝试解析响应JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          const errorMsg = `响应不是有效的JSON: ${responseText}`;
          errors.push(errorMsg);
          console.error(`[LicenseService] ${errorMsg}`);
          continue; // 尝试下一个URL
        }
        
        if (!data.success) {
          const errorMsg = data.error || '许可证验证失败';
          errors.push(errorMsg);
          console.error(`[LicenseService] ${errorMsg}`);
          continue; // 尝试下一个URL
        }
        
        // 成功响应 - 创建许可证信息对象
        const licenseInfo: LicenseInfo = {
          licenseKey: licenseKey,
          deviceId: this.deviceId!,
          isValid: true,
          planId: data.license_info.plan_id || 'standard',
          expiryDate: data.license_info.expiry_date || 'permanent',
          customerEmail: data.license_info.customer_email,
          deviceCount: data.license_info.device_count || 1
        };
        
        // 保存许可证信息
        this.licenseKey = licenseKey;
        this.licenseInfo = licenseInfo;
        
        // 保存许可证密钥到存储
        await AsyncStorage.setItem(LICENSE_KEY_STORAGE_KEY, licenseKey);
        console.log('[LicenseService] 许可证已保存到存储');
        
        return licenseInfo;
        
      } catch (error) {
        // 记录错误并继续尝试下一个URL
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${apiUrl}: ${errorMsg}`);
        console.error(`[LicenseService] ${apiUrl} 请求失败:`, errorMsg);
      }
    }
    
    // 所有URL都失败了，抛出综合错误
    const finalError = `所有许可证验证尝试均失败: ${errors.join('; ')}`;
    console.error(`[LicenseService] ${finalError}`);
    throw new Error(finalError);
  }

  /**
   * 测试服务器连接性
   */
  private async testServerConnectivity(): Promise<{
    domainConnected: boolean;
    apiEndpointConnected: boolean;
    anySuccess: boolean;
    details: string;
  }> {
    const result = {
      domainConnected: false,
      apiEndpointConnected: false,
      anySuccess: false,
      details: ''
    };
    
    const details: string[] = [];
    
    // 测试基本域名连接
    try {
      console.log(`测试域名连接: https://${API_CONFIG.LICENSE_SERVER_DOMAIN}`);
      const domainController = new AbortController();
      const domainTimeoutId = setTimeout(() => domainController.abort(), 10000);
      
      const domainResponse = await fetch(`https://${API_CONFIG.LICENSE_SERVER_DOMAIN}`, {
        method: 'HEAD',
        signal: domainController.signal,
        cache: 'no-store' as RequestCache,
      });
      
      clearTimeout(domainTimeoutId);
      
      result.domainConnected = domainResponse.ok || domainResponse.status < 500;
      details.push(`域名连接: ${result.domainConnected ? '成功' : '失败'} (${domainResponse.status})`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      details.push(`域名连接失败: ${errorMsg}`);
      console.error('域名连接测试失败:', error);
    }
    
    // 测试API端点连接
    try {
      // 使用健康检查API或者只是对API URL的HEAD请求
      const healthUrl = API_CONFIG.LICENSE_API_URL.replace('/license/verify', '/health');
      console.log(`测试API端点连接: ${healthUrl}`);
      
      const apiController = new AbortController();
      const apiTimeoutId = setTimeout(() => apiController.abort(), 10000);
      
      const apiResponse = await fetch(healthUrl, {
        method: 'GET',
        signal: apiController.signal,
        cache: 'no-store' as RequestCache,
      });
      
      clearTimeout(apiTimeoutId);
      
      result.apiEndpointConnected = apiResponse.ok;
      details.push(`API端点连接: ${result.apiEndpointConnected ? '成功' : '失败'} (${apiResponse.status})`);
      
      if (apiResponse.ok) {
        // 尝试读取健康检查响应
        const healthText = await apiResponse.text();
        details.push(`健康检查响应: ${healthText}`);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      details.push(`API端点连接失败: ${errorMsg}`);
      console.error('API端点连接测试失败:', error);
    }
    
    // 尝试备用URL的简单连接测试
    try {
      // 对第一个备用URL进行简单测试
      if (API_CONFIG.LICENSE_API_FALLBACKS && API_CONFIG.LICENSE_API_FALLBACKS.length > 0) {
        const fallbackUrl = API_CONFIG.LICENSE_API_FALLBACKS[0].replace('/license/verify', '/health');
        console.log(`测试备用API连接: ${fallbackUrl}`);
        
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000);
        
        const fallbackResponse = await fetch(fallbackUrl, { 
          method: 'GET',
          signal: fallbackController.signal,
          cache: 'no-store' as RequestCache,
        });
        
        clearTimeout(fallbackTimeoutId);
        
        const fallbackSuccess = fallbackResponse.ok;
        details.push(`备用API连接: ${fallbackSuccess ? '成功' : '失败'} (${fallbackResponse.status})`);
        
        // 如果任一连接成功，则标记为成功
        if (fallbackSuccess && !result.apiEndpointConnected) {
          result.apiEndpointConnected = true;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      details.push(`备用API连接失败: ${errorMsg}`);
      console.error('备用API连接测试失败:', error);
    }
    
    // 如果任一连接测试成功，则整体标记为成功
    result.anySuccess = result.domainConnected || result.apiEndpointConnected;
    result.details = details.join('; ');
    
    return result;
  }

  /**
   * 获取许可证信息
   */
  public async getLicenseInfo(): Promise<LicenseInfo | null> {
    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.licenseInfo;
  }

  /**
   * 检查是否有有效的许可证
   */
  public async hasValidLicense(): Promise<boolean> {
    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.licenseInfo !== null && this.licenseInfo.isValid;
  }

  /**
   * 获取包含许可证信息的HTTP请求头
   */
  public async getLicenseHeaders(): Promise<Record<string, string>> {
    // 确保已初始化
    if (!this.initialized) {
      console.log('[LicenseService] 获取许可证头前初始化服务');
      await this.initialize();
    }
    
    // 检查许可证和设备ID
    if (!this.licenseKey || !this.deviceId) {
      console.log('[LicenseService] 无法创建许可证头: 许可证密钥或设备ID缺失');
      return {};
    }
    
    // 检查许可证有效性（如果有许可证信息）
    if (this.licenseInfo && !this.licenseInfo.isValid) {
      console.log('[LicenseService] 许可证无效，无法创建有效的许可证头');
      return {};
    }
    
    const headers = {
      'X-License-Key': this.licenseKey,
      'X-Device-ID': this.deviceId
    };
    
    console.log('[LicenseService] 创建许可证头成功');
    return headers;
  }

  /**
   * 清除许可证
   */
  public async clearLicense(): Promise<void> {
    this.licenseKey = null;
    this.licenseInfo = null;
    await AsyncStorage.removeItem(LICENSE_KEY_STORAGE_KEY);
    console.log('[LicenseService] License cleared');
  }
  
  /**
   * 刷新许可证状态
   * 从服务器获取最新的许可证信息
   */
  public async refreshLicenseStatus(): Promise<LicenseInfo | null> {
    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }
    
    // 如果没有许可证密钥，无法刷新
    if (!this.licenseKey) {
      return null;
    }
    
    try {
      // 重新验证许可证
      const info = await this.verifyLicense(this.licenseKey);
      this.licenseInfo = info;
      return info;
    } catch (error) {
      console.error('Failed to refresh license status:', error);
      return null;
    }
  }

  /**
   * 检查服务是否已初始化
   * 公开方法，供外部组件检查初始化状态
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

// 导出单例
export const licenseService = new LicenseService();
