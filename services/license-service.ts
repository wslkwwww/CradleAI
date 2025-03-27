import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceUtils } from '@/utils/device-utils';
import { API_CONFIG } from '@/constants/api-config';

// 存储键名
const LICENSE_KEY_STORAGE_KEY = 'license_key';

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

  /**
   * 初始化服务，从存储中加载许可证
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载许可证密钥
      this.licenseKey = await AsyncStorage.getItem(LICENSE_KEY_STORAGE_KEY);
      
      // 获取设备ID
      this.deviceId = await DeviceUtils.getDeviceId();
      
      // 如果有许可证密钥，验证其有效性
      if (this.licenseKey) {
        try {
          const info = await this.verifyLicense(this.licenseKey);
          this.licenseInfo = info;
          console.log('License loaded and verified');
        } catch (error) {
          console.warn('Stored license failed verification:', error);
          this.licenseKey = null;
          this.licenseInfo = null;
          // 不删除存储的许可证密钥，让用户手动处理无效的许可证
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize license service:', error);
      throw error;
    }
  }

  /**
   * 验证许可证密钥
   */
  public async verifyLicense(licenseKey: string): Promise<LicenseInfo> {
    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }
    
    // 获取设备ID
    if (!this.deviceId) {
      this.deviceId = await DeviceUtils.getDeviceId();
    }
    
    // 首先测试与服务器的连接
    const connectivityResult = await this.testServerConnectivity();
    console.log('服务器连接测试结果:', connectivityResult);
    
    if (!connectivityResult.anySuccess) {
      throw new Error('无法连接到授权服务器，请检查网络连接后重试');
    }
    
    // 请求数据 - 确保与curl命令使用相同的键名格式
    const requestData = {
      license_key: licenseKey,
      device_id: this.deviceId
    };
    
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
        console.log(`尝试验证授权：${apiUrl}`);
        
        // 增强的fetch请求，包含超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
        
        console.log('Request payload:', JSON.stringify(requestData));
        
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
        });
        
        clearTimeout(timeoutId);
        
        console.log(`${apiUrl} 响应状态码:`, response.status);
        
        // 获取响应文本
        const responseText = await response.text();
        console.log(`${apiUrl} 响应内容:`, responseText);
        
        if (!response.ok) {
          const errorMsg = `验证失败(${response.status}): ${responseText}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          continue; // 尝试下一个URL
        }
        
        // 尝试解析响应JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          const errorMsg = `响应不是有效的JSON: ${responseText}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          continue; // 尝试下一个URL
        }
        
        if (!data.success) {
          const errorMsg = data.error || '许可证验证失败';
          errors.push(errorMsg);
          console.error(errorMsg);
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
        
        return licenseInfo;
        
      } catch (error) {
        // 记录错误并继续尝试下一个URL
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${apiUrl}: ${errorMsg}`);
        console.error(`${apiUrl} 请求失败:`, errorMsg);
      }
    }
    
    // 所有URL都失败了，抛出综合错误
    throw new Error(`所有许可证验证尝试均失败: ${errors.join('; ')}`);
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
      await this.initialize();
    }
    
    if (!this.licenseKey || !this.deviceId) {
      return {};
    }
    
    return {
      'X-License-Key': this.licenseKey,
      'X-Device-ID': this.deviceId
    };
  }

  /**
   * 清除许可证
   */
  public async clearLicense(): Promise<void> {
    this.licenseKey = null;
    this.licenseInfo = null;
    await AsyncStorage.removeItem(LICENSE_KEY_STORAGE_KEY);
    console.log('License cleared');
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
}

// 导出单例
export const licenseService = new LicenseService();
