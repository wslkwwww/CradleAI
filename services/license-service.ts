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
    
    // 构建 API 请求
    const apiUrl = `${API_CONFIG.LICENSE_API_URL}/verify`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: this.deviceId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'License verification failed');
      }
      
      // 创建许可证信息对象
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
      console.error('License verification error:', error);
      throw error;
    }
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
