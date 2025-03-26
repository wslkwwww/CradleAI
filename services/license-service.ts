import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { LicenseRequestHelper } from './license-request-helper';

/**
 * License information interface
 */
export interface LicenseInfo {
  licenseKey: string;
  deviceId: string;
  isValid: boolean;
  planId?: string;
  expiryDate?: string;
  deviceCount?: number;
}

/**
 * Service to handle license verification and management
 */
export class LicenseService {
  private static instance: LicenseService;
  private licenseInfo: LicenseInfo | null = null;
  private readonly storageKey = 'license_info';

  constructor() {
    // Load stored license info on init
    this.loadLicenseInfo();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }

  /**
   * Get a unique device identifier
   */
  public async getDeviceId(): Promise<string> {
    // Check if we already have a stored device ID
    const storedDeviceId = await AsyncStorage.getItem('device_id');
    if (storedDeviceId) {
      return storedDeviceId;
    }

    // Generate a new device ID
    let deviceId: string;

    try {
      // Try to get a unique identifier based on the platform
      if (Platform.OS === 'web') {
        // For web, create a fingerprint based on browser information
        const nav = window.navigator;
        const fingerprint = `${nav.userAgent}-${nav.language}-${window.screen.width}x${window.screen.height}`;
        deviceId = `web-${this.hashString(fingerprint)}`;
      } else {
        // For React Native, use DeviceInfo
        deviceId = await DeviceInfo.getUniqueId();
      }
    } catch (error) {
      // Fallback to a random ID
      deviceId = `device-${Math.random().toString(36).substring(2, 15)}`;
      console.warn("Using fallback device ID generation:", error);
    }

    // Store the device ID for future use
    await AsyncStorage.setItem('device_id', deviceId);
    return deviceId;
  }

  /**
   * Hash a string to create a device identifier
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Verify a license key
   */
  public async verifyLicense(licenseKey: string): Promise<LicenseInfo> {
    try {
      const deviceId = await this.getDeviceId();
      
      // Call the license verification API
      const response = await LicenseRequestHelper.verifyLicense(licenseKey, deviceId);
      
      if (response.success) {
        // Create license info object
        const licenseInfo: LicenseInfo = {
          licenseKey,
          deviceId,
          isValid: true,
          planId: response.license_info?.plan_id,
          expiryDate: response.license_info?.expiry_date,
          deviceCount: response.license_info?.device_count
        };
        
        // Save the license info
        await this.saveLicenseInfo(licenseInfo);
        this.licenseInfo = licenseInfo;
        
        return licenseInfo;
      } else {
        throw new Error(response.error || '许可证验证失败');
      }
    } catch (error) {
      console.error('License verification error:', error);
      throw error;
    }
  }

  /**
   * Save license information to storage
   */
  private async saveLicenseInfo(licenseInfo: LicenseInfo): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(licenseInfo));
    } catch (error) {
      console.error('Failed to save license info:', error);
    }
  }

  /**
   * Load license information from storage
   */
  private async loadLicenseInfo(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      if (data) {
        this.licenseInfo = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load license info:', error);
    }
  }

  /**
   * Get the current license information
   */
  public async getLicenseInfo(): Promise<LicenseInfo | null> {
    if (!this.licenseInfo) {
      await this.loadLicenseInfo();
    }
    return this.licenseInfo;
  }

  /**
   * Check if a license is active
   */
  public async isLicenseActive(): Promise<boolean> {
    const info = await this.getLicenseInfo();
    return !!info?.isValid;
  }

  /**
   * Clear the current license information
   */
  public async clearLicense(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.storageKey);
      this.licenseInfo = null;
    } catch (error) {
      console.error('Failed to clear license info:', error);
    }
  }

  /**
   * Get license headers for API requests
   */
  public async getLicenseHeaders(): Promise<Record<string, string>> {
    const info = await this.getLicenseInfo();
    if (!info) {
      return {};
    }
    
    return {
      'X-License-Key': info.licenseKey,
      'X-Device-ID': info.deviceId
    };
  }
}

// Export singleton instance
export const licenseService = LicenseService.getInstance();
