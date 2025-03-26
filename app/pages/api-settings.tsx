import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/constants/UserContext';
import { ApiServiceProvider } from '@/services/api-service-provider';
import ModelSelector from '@/components/settings/ModelSelector';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { GlobalSettings } from '@/shared/types';
import { theme } from '@/constants/theme';
import Mem0Service from '@/src/memory/services/Mem0Service';
import { licenseService, LicenseInfo } from '@/services/license-service';

const ApiSettings = () => {
  const router = useRouter();
  const { user, updateSettings } = useUser();
  const [isTesting, setIsTesting] = useState(false);
  
  // Gemini settings
  const [geminiKey, setGeminiKey] = useState(user?.settings?.chat?.characterApiKey || '');
  
  // OpenRouter settings
  const [openRouterEnabled, setOpenRouterEnabled] = useState(
    user?.settings?.chat?.apiProvider === 'openrouter' && 
    user?.settings?.chat?.openrouter?.enabled || false
  );
  const [openRouterKey, setOpenRouterKey] = useState(
    user?.settings?.chat?.openrouter?.apiKey || ''
  );
  const [selectedModel, setSelectedModel] = useState(
    user?.settings?.chat?.openrouter?.model || 'openai/gpt-3.5-turbo'
  );
  const [useBackupModels, setUseBackupModels] = useState(
    user?.settings?.chat?.openrouter?.useBackupModels || false
  );

  // Zhipu embedding settings
  const [useZhipuEmbedding, setUseZhipuEmbedding] = useState(
    user?.settings?.chat?.useZhipuEmbedding || false
  );
  const [zhipuApiKey, setZhipuApiKey] = useState(
    user?.settings?.chat?.zhipuApiKey || ''
  );

  const [isModelSelectorVisible, setIsModelSelectorVisible] = useState(false);
  
  // Activation code settings with enhanced state
  const [useActivationCode, setUseActivationCode] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  
  // Load existing license information on component mount
  useEffect(() => {
    const loadLicenseInfo = async () => {
      try {
        const info = await licenseService.getLicenseInfo();
        if (info) {
          setLicenseInfo(info);
          setUseActivationCode(true);
          setActivationCode(info.licenseKey);
        }
      } catch (error) {
        console.error('Failed to load license info:', error);
      }
    };
    
    loadLicenseInfo();
  }, []);
  
  // Handle API provider toggle
  const handleProviderToggle = (value: boolean) => {
    setOpenRouterEnabled(value);
  };

  // Test connection
  const testConnection = async () => {
    try {
      setIsTesting(true);
      
      const apiKey = openRouterEnabled ? openRouterKey : geminiKey;
      const apiProvider = openRouterEnabled ? 'openrouter' : 'gemini';
      
      if (!apiKey) {
        Alert.alert('错误', '请输入API密钥');
        return;
      }
      
      // Test connection using ApiServiceProvider
      const testMessage = "This is a test message. Please respond with 'OK' if you receive this.";
      const messages = [{ role: 'user', parts: [{ text: testMessage }] }];
      
      let response;
      if (apiProvider === 'openrouter') {
        response = await ApiServiceProvider.generateContent(
          messages, 
          apiKey, 
          {
            apiProvider: 'openrouter',
            openrouter: {
              enabled: true,
              apiKey: openRouterKey,
              model: selectedModel,
              autoRoute: false,
              useBackupModels: useBackupModels,
              backupModels: [],
            }
          }
        );
      } else {
        response = await ApiServiceProvider.generateContent(messages, apiKey);
      }
      
      if (response) {
        Alert.alert('连接成功', '成功连接到API服务');
      } else {
        Alert.alert('连接失败', '未能获得有效响应');
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      Alert.alert('连接失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsTesting(false);
    }
  };

  // Test Zhipu embeddings
  const testZhipuEmbedding = async () => {
    try {
      setIsTesting(true);
      
      if (!zhipuApiKey) {
        Alert.alert('错误', '请输入智谱清言API密钥');
        return;
      }
      
      // 构建请求体，测试嵌入功能
      const testUrl = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
      const testInput = "这是一个测试智谱清言嵌入功能的文本。";
      
      const requestBody = {
        model: 'embedding-3',
        input: testInput
      };
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zhipuApiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`智谱清言API错误: ${response.status} ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      if (data.data && data.data[0]?.embedding) {
        const embeddingLength = data.data[0].embedding.length;
        Alert.alert('嵌入测试成功', `成功获取嵌入向量，维度: ${embeddingLength}`);
      } else {
        Alert.alert('嵌入测试失败', '未能获得有效的嵌入向量');
      }
    } catch (error) {
      console.error('智谱嵌入测试失败:', error);
      Alert.alert('嵌入测试失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsTesting(false);
    }
  };

  // Activate license function
  const activateLicense = async () => {
    if (!activationCode.trim()) {
      Alert.alert('错误', '请输入激活码');
      return;
    }
    
    try {
      setIsActivating(true);
      
      // Add logging to debug the request
      console.log('Activating license with code:', activationCode.trim());
      
      const licenseInfo = await licenseService.verifyLicense(activationCode.trim());
      console.log('License verification response:', licenseInfo);
      
      // Update state with the license info
      setLicenseInfo(licenseInfo);
      
      Alert.alert(
        '激活成功', 
        `许可证已成功激活\n有效期至: ${licenseInfo.expiryDate}`,
        [{ text: '确定' }]
      );
    } catch (error) {
      console.error('License activation error:', error);
      // More detailed error handling
      let errorMessage = '未知错误，请检查激活码是否正确';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      Alert.alert(
        '激活失败', 
        errorMessage
      );
    } finally {
      // Ensure loading state is cleared whether successful or not
      setIsActivating(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    try {
      // Include license info in settings if using activation code
      if (useActivationCode && licenseInfo) {
        // Store license headers for future API requests
        const licenseHeaders = await licenseService.getLicenseHeaders();
        
        // Prepare API settings object with license info
        const apiSettings: Partial<GlobalSettings> = {
          chat: {
            ...user?.settings?.chat,
            serverUrl: user?.settings?.chat?.serverUrl || '',
            characterApiKey: geminiKey,
            xApiKey: user?.settings?.chat?.xApiKey || '',
            apiProvider: openRouterEnabled ? 'openrouter' : 'gemini',
            typingDelay: user?.settings?.chat?.typingDelay || 50,
            temperature: user?.settings?.chat?.temperature || 0.7,
            maxtokens: user?.settings?.chat?.maxtokens || 2000,
            maxTokens: user?.settings?.chat?.maxTokens || 2000,
            // Add Zhipu embedding settings
            useZhipuEmbedding: useZhipuEmbedding,
            zhipuApiKey: zhipuApiKey,
            openrouter: {
              enabled: openRouterEnabled,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels,
              backupModels: user?.settings?.chat?.openrouter?.backupModels || []
            }
          },
          // Add license information to settings
          license: {
            enabled: true,
            licenseKey: licenseInfo.licenseKey,
            deviceId: licenseInfo.deviceId,
            planId: licenseInfo.planId,
            expiryDate: licenseInfo.expiryDate
          }
        };
        
        await updateSettings(apiSettings);
        
        // Also save to localStorage for services that need synchronous access
        try {
          const fullSettings = {
            ...user?.settings,
            ...apiSettings
          };
          
          // 保存到localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('user_settings', JSON.stringify(fullSettings));
            console.log('API settings saved to localStorage');
          }
          
          // 保存到AsyncStorage
          if (typeof require !== 'undefined') {
            try {
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              await AsyncStorage.setItem('user_settings', JSON.stringify(fullSettings));
              console.log('API settings saved to AsyncStorage');
            } catch (e) {
              console.log('Failed to save settings to AsyncStorage:', e);
            }
          }
        } catch (error) {
          console.warn('Could not save settings to storage:', error);
        }
        
        // 特别地，确保智谱API密钥被正确保存
        try {
          // 这是一个冗余的保存操作，确保即使其他方式失败，至少智谱API密钥被保存
          if (useZhipuEmbedding && zhipuApiKey) {
            // 同时，直接更新Memory服务中的嵌入器API密钥
            try {
              const mem0Service = Mem0Service.getInstance();
              if (mem0Service && mem0Service.memoryRef) {
                // 如果内存服务已初始化，直接更新嵌入器
                if (typeof mem0Service.memoryRef.updateEmbedderApiKey === 'function') {
                  mem0Service.memoryRef.updateEmbedderApiKey(zhipuApiKey);
                  console.log('直接更新了Memory嵌入器的API密钥');
                }
              }
            } catch (memError) {
              console.warn('直接更新Memory嵌入器API密钥失败:', memError);
            }
            
            // Web环境
            if (typeof localStorage !== 'undefined') {
              const existingSettingsStr = localStorage.getItem('user_settings');
              const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
              
              const updatedSettings = {
                ...existingSettings,
                chat: {
                  ...(existingSettings.chat || {}),
                  zhipuApiKey: zhipuApiKey,
                  useZhipuEmbedding: true
                }
              };
              
              localStorage.setItem('user_settings', JSON.stringify(updatedSettings));
              console.log('Zhipu API key explicitly saved to localStorage');
            }
            
            // React Native环境
            if (typeof require !== 'undefined') {
              try {
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const existingSettingsStr = await AsyncStorage.getItem('user_settings');
                const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
                
                const updatedSettings = {
                  ...existingSettings,
                  chat: {
                    ...(existingSettings.chat || {}),
                    zhipuApiKey: zhipuApiKey,
                    useZhipuEmbedding: true
                  }
                };
                
                await AsyncStorage.setItem('user_settings', JSON.stringify(updatedSettings));
                console.log('Zhipu API key explicitly saved to AsyncStorage');
              } catch (e) {
                console.log('Failed to save Zhipu API key to AsyncStorage:', e);
              }
            }
          }
        } catch (error) {
          console.warn('Failed to explicitly save Zhipu API key:', error);
        }
        
        // Also update Mem0Service with new API settings
        try {
          const mem0Service = Mem0Service.getInstance();
          // 确定当前的API提供商和密钥
          const currentApiProvider = openRouterEnabled ? 'openrouter' : 'gemini';
          const currentApiKey = openRouterEnabled ? openRouterKey : geminiKey;
          const currentModel = openRouterEnabled ? selectedModel : 'gemini-2.0-flash-exp';
          
          // 更新记忆服务的LLM配置
          mem0Service.updateLLMConfig({
            apiKey: currentApiKey,
            model: currentModel,
            apiProvider: currentApiProvider,
            openrouter: openRouterEnabled ? {
              enabled: true,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels
            } : undefined
          });
          
          console.log('Memory LLM configuration updated');
        } catch (memError) {
          console.warn('Failed to update memory LLM configuration:', memError);
          // Non-blocking error - don't prevent settings from being saved
        }
        
        // Update NodeSTManager with new settings
        NodeSTManager.updateApiSettings(
          openRouterEnabled ? openRouterKey : geminiKey,
          {
            apiProvider: openRouterEnabled ? 'openrouter' : 'gemini',
            openrouter: openRouterEnabled ? {
              enabled: true,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels
            } : undefined
          }
        );
        
        Alert.alert('成功', '设置已保存', [
          { text: '确定', onPress: () => router.back() }
        ]);
        
      } else if (!useActivationCode) {
        // If activation code is disabled, clear the license
        await licenseService.clearLicense();
        
        // Prepare API settings object without license
        const apiSettings: Partial<GlobalSettings> = {
          chat: {
            ...user?.settings?.chat,
            serverUrl: user?.settings?.chat?.serverUrl || '',
            characterApiKey: geminiKey,
            xApiKey: user?.settings?.chat?.xApiKey || '',
            apiProvider: openRouterEnabled ? 'openrouter' : 'gemini',
            typingDelay: user?.settings?.chat?.typingDelay || 50,
            temperature: user?.settings?.chat?.temperature || 0.7,
            maxtokens: user?.settings?.chat?.maxtokens || 2000,
            maxTokens: user?.settings?.chat?.maxTokens || 2000,
            // Add Zhipu embedding settings
            useZhipuEmbedding: useZhipuEmbedding,
            zhipuApiKey: zhipuApiKey,
            openrouter: {
              enabled: openRouterEnabled,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels,
              backupModels: user?.settings?.chat?.openrouter?.backupModels || []
            }
          },
          // Remove license information
          license: {
            enabled: false
          }
        };
        
        await updateSettings(apiSettings);
        
        // Also save to localStorage for services that need synchronous access
        try {
          const fullSettings = {
            ...user?.settings,
            ...apiSettings
          };
          
          // 保存到localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('user_settings', JSON.stringify(fullSettings));
            console.log('API settings saved to localStorage');
          }
          
          // 保存到AsyncStorage
          if (typeof require !== 'undefined') {
            try {
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              await AsyncStorage.setItem('user_settings', JSON.stringify(fullSettings));
              console.log('API settings saved to AsyncStorage');
            } catch (e) {
              console.log('Failed to save settings to AsyncStorage:', e);
            }
          }
        } catch (error) {
          console.warn('Could not save settings to storage:', error);
        }
        
        // 特别地，确保智谱API密钥被正确保存
        try {
          // 这是一个冗余的保存操作，确保即使其他方式失败，至少智谱API密钥被保存
          if (useZhipuEmbedding && zhipuApiKey) {
            // 同时，直接更新Memory服务中的嵌入器API密钥
            try {
              const mem0Service = Mem0Service.getInstance();
              if (mem0Service && mem0Service.memoryRef) {
                // 如果内存服务已初始化，直接更新嵌入器
                if (typeof mem0Service.memoryRef.updateEmbedderApiKey === 'function') {
                  mem0Service.memoryRef.updateEmbedderApiKey(zhipuApiKey);
                  console.log('直接更新了Memory嵌入器的API密钥');
                }
              }
            } catch (memError) {
              console.warn('直接更新Memory嵌入器API密钥失败:', memError);
            }
            
            // Web环境
            if (typeof localStorage !== 'undefined') {
              const existingSettingsStr = localStorage.getItem('user_settings');
              const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
              
              const updatedSettings = {
                ...existingSettings,
                chat: {
                  ...(existingSettings.chat || {}),
                  zhipuApiKey: zhipuApiKey,
                  useZhipuEmbedding: true
                }
              };
              
              localStorage.setItem('user_settings', JSON.stringify(updatedSettings));
              console.log('Zhipu API key explicitly saved to localStorage');
            }
            
            // React Native环境
            if (typeof require !== 'undefined') {
              try {
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const existingSettingsStr = await AsyncStorage.getItem('user_settings');
                const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
                
                const updatedSettings = {
                  ...existingSettings,
                  chat: {
                    ...(existingSettings.chat || {}),
                    zhipuApiKey: zhipuApiKey,
                    useZhipuEmbedding: true
                  }
                };
                
                await AsyncStorage.setItem('user_settings', JSON.stringify(updatedSettings));
                console.log('Zhipu API key explicitly saved to AsyncStorage');
              } catch (e) {
                console.log('Failed to save Zhipu API key to AsyncStorage:', e);
              }
            }
          }
        } catch (error) {
          console.warn('Failed to explicitly save Zhipu API key:', error);
        }
        
        // Also update Mem0Service with new API settings
        try {
          const mem0Service = Mem0Service.getInstance();
          // 确定当前的API提供商和密钥
          const currentApiProvider = openRouterEnabled ? 'openrouter' : 'gemini';
          const currentApiKey = openRouterEnabled ? openRouterKey : geminiKey;
          const currentModel = openRouterEnabled ? selectedModel : 'gemini-2.0-flash-exp';
          
          // 更新记忆服务的LLM配置
          mem0Service.updateLLMConfig({
            apiKey: currentApiKey,
            model: currentModel,
            apiProvider: currentApiProvider,
            openrouter: openRouterEnabled ? {
              enabled: true,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels
            } : undefined
          });
          
          console.log('Memory LLM configuration updated');
        } catch (memError) {
          console.warn('Failed to update memory LLM configuration:', memError);
          // Non-blocking error - don't prevent settings from being saved
        }
        
        // Update NodeSTManager with new settings
        NodeSTManager.updateApiSettings(
          openRouterEnabled ? openRouterKey : geminiKey,
          {
            apiProvider: openRouterEnabled ? 'openrouter' : 'gemini',
            openrouter: openRouterEnabled ? {
              enabled: true,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels
            } : undefined
          }
        );
        
        Alert.alert('成功', '设置已保存', [
          { text: '确定', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API 设置</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Activation Code Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>激活码</Text>
              <Switch
                value={useActivationCode}
                onValueChange={setUseActivationCode}
                trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                thumbColor={useActivationCode ? theme.colors.primary : '#f4f3f4'}
              />
            </View>

            {useActivationCode && (
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>激活码</Text>
                <TextInput
                  style={styles.input}
                  value={activationCode}
                  onChangeText={setActivationCode}
                  placeholder="输入激活码"
                  placeholderTextColor="#999"
                  secureTextEntry={false}
                />
                
                {licenseInfo ? (
                  <View style={styles.licenseInfoContainer}>
                    <Text style={styles.licenseStatusText}>
                      <Ionicons 
                        name="checkmark-circle" 
                        size={16} 
                        color="#4CAF50" 
                      /> 已激活
                    </Text>
                    <Text style={styles.licenseInfoText}>
                      计划: {licenseInfo.planId || '标准版'}
                    </Text>
                    <Text style={styles.licenseInfoText}>
                      有效期至: {licenseInfo.expiryDate || '永久'}
                    </Text>
                    <Text style={styles.licenseInfoText}>
                      已绑定设备数: {licenseInfo.deviceCount || 1}/3
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.activateButton, isActivating && styles.disabledButton]}
                    onPress={activateLicense}
                    disabled={isActivating || !activationCode.trim()}
                  >
                    {isActivating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>验证激活</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Gemini API Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gemini API</Text>
              <Switch
                value={!openRouterEnabled}
                onValueChange={(value) => setOpenRouterEnabled(!value)}
                trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                thumbColor={!openRouterEnabled ? theme.colors.primary : '#f4f3f4'}
              />
            </View>

            {!openRouterEnabled && (
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>Gemini API Key</Text>
                <TextInput
                  style={styles.input}
                  value={geminiKey}
                  onChangeText={setGeminiKey}
                  placeholder="输入 Gemini API Key"
                  placeholderTextColor="#999"
                  secureTextEntry={true}
                />
                <Text style={styles.helperText}>
                  可从 <Text style={styles.link}>Google AI Studio</Text> 获取免费 API Key
                </Text>
              </View>
            )}
          </View>

          {/* OpenRouter API Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OpenRouter API</Text>
              <Switch
                value={openRouterEnabled}
                onValueChange={setOpenRouterEnabled}
                trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                thumbColor={openRouterEnabled ? theme.colors.primary : '#f4f3f4'}
              />
            </View>

            {openRouterEnabled && (
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>OpenRouter API Key</Text>
                <TextInput
                  style={styles.input}
                  value={openRouterKey}
                  onChangeText={setOpenRouterKey}
                  placeholder="输入 OpenRouter API Key"
                  placeholderTextColor="#999"
                  secureTextEntry={true}
                />
                <Text style={styles.helperText}>
                  可从 <Text style={styles.link}>OpenRouter</Text> 获取 API Key
                </Text>

                {/* Model Selector Button */}
                <View style={styles.modelSection}>
                  <Text style={styles.inputLabel}>当前选定模型</Text>
                  <TouchableOpacity
                    style={styles.modelButton}
                    onPress={() => setIsModelSelectorVisible(true)}
                  >
                    <Text style={styles.modelButtonText}>{selectedModel}</Text>
                    <Ionicons name="chevron-down" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>使用备用模型</Text>
                  <Switch
                    value={useBackupModels}
                    onValueChange={setUseBackupModels}
                    trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                    thumbColor={useBackupModels ? theme.colors.primary : '#f4f3f4'}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Zhipu API Settings - New section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>智谱清言嵌入</Text>
              <Switch
                value={useZhipuEmbedding}
                onValueChange={setUseZhipuEmbedding}
                trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                thumbColor={useZhipuEmbedding ? theme.colors.primary : '#f4f3f4'}
              />
            </View>

            {useZhipuEmbedding && (
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>智谱清言 API Key</Text>
                <TextInput
                  style={styles.input}
                  value={zhipuApiKey}
                  onChangeText={setZhipuApiKey}
                  placeholder="输入智谱清言 API Key"
                  placeholderTextColor="#999"
                  secureTextEntry={true}
                />
                <Text style={styles.helperText}>
                  可从 <Text style={styles.link}>智谱清言开放平台</Text> 获取 API Key
                </Text>

                <TouchableOpacity
                  style={[styles.testButton, styles.zhipuTestButton, { marginTop: 16 }]}
                  onPress={testZhipuEmbedding}
                  disabled={isTesting || !zhipuApiKey}
                >
                  {isTesting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>测试智谱嵌入</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={testConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>测试连接</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveSettings}
            >
              <Ionicons name="save-outline" size={18} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>保存设置</Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.noteTitle}>使用说明:</Text>
            <View style={styles.noteItem}>
              <Ionicons name="information-circle-outline" size={16} color="#aaa" style={styles.noteIcon} />
              <Text style={styles.noteText}>Gemini API 可免费获取，适合基础对话</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="information-circle-outline" size={16} color="#aaa" style={styles.noteIcon} />
              <Text style={styles.noteText}>OpenRouter 支持多种高级模型，包括 GPT、Claude 等</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="information-circle-outline" size={16} color="#aaa" style={styles.noteIcon} />
              <Text style={styles.noteText}>智谱清言嵌入支持高精度的中文向量化，提升记忆检索准确度</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="warning-outline" size={16} color="#f0ad4e" style={styles.noteIcon} />
              <Text style={styles.noteText}>智谱清言嵌入需要单独的API密钥，与LLM的密钥不通用</Text>
            </View>
            {/* Add license-related notes */}
            <View style={styles.noteItem}>
              <Ionicons name="key-outline" size={16} color="#aaa" style={styles.noteIcon} />
              <Text style={styles.noteText}>激活码可以在最多3台设备上使用，首次使用将自动绑定设备</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="shield-outline" size={16} color="#aaa" style={styles.noteIcon} />
              <Text style={styles.noteText}>激活后可使用所有高级API功能，无需再配置其他API密钥</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Model Selector Modal */}
      <Modal
        visible={isModelSelectorVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModelSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择模型</Text>
              <TouchableOpacity
                onPress={() => setIsModelSelectorVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ModelSelector
              apiKey={openRouterKey}
              selectedModelId={selectedModel}
              onSelectModel={(modelId) => {
                setSelectedModel(modelId);
                setIsModelSelectorVisible(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(60, 60, 60, 0.5)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  contentSection: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ddd',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  modelSection: {
    marginTop: 16,
  },
  modelButton: {
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: '#ddd',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#666',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  notesContainer: {
    backgroundColor: 'rgba(60, 60, 60, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#ddd',
    flex: 1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#333',
    width: '90%',
    height: '70%', // Change maxHeight to fixed height
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#444',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  // Add new styles for Zhipu section
  zhipuTestButton: {
    backgroundColor: '#8e44ad', // Purple color for Zhipu
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  // Add new styles for license activation
  licenseInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  licenseStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  licenseInfoText: {
    fontSize: 14,
    color: '#ddd',
    marginBottom: 4,
  },
  activateButton: {
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default ApiSettings;
