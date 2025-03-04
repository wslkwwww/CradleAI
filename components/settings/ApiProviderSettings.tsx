import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Switch,
  TextInput,
  Alert
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { MaterialIcons } from '@expo/vector-icons';
import { GlobalSettings } from '@/shared/types';
import { OpenRouterSettings } from '@/shared/types/api-types';
import { OpenRouterModelManager } from '@/NodeST/nodest/utils/openrouter-model-manager';
import { OpenRouterAdapter } from '@/NodeST/nodest/utils/openrouter-adapter';
import ModelSelector from './ModelSelector';
import { OpenRouterModel } from '@/shared/types/api-types';

interface ApiProviderSettingsProps {
  settings?: GlobalSettings;
  onUpdate: (updatedSettings: GlobalSettings) => void;
  character?: any; // Allow character prop for backward compatibility
}

// Default settings
const DEFAULT_OPENROUTER_SETTINGS: OpenRouterSettings = {
  enabled: false,
  apiKey: '',
  model: 'openai/gpt-3.5-turbo',
  autoRoute: false,
  useBackupModels: false,
  backupModels: [],
  sortingStrategy: 'price',
  dataCollection: false,
  ignoredProviders: []
};

// Default global settings structure
const DEFAULT_SETTINGS: GlobalSettings = {
  self: {
    nickname: '',
    gender: 'other',
    description: '',
  },
  chat: {
    serverUrl: '',
    characterApiKey: '',
    memoryApiKey: '',
    xApiKey: '',
    apiProvider: 'gemini',
    openrouter: DEFAULT_OPENROUTER_SETTINGS
  }
};

const ApiProviderSettings: React.FC<ApiProviderSettingsProps> = ({ settings, onUpdate, character }) => {
  // Handle undefined settings by using defaults
  const effectiveSettings = settings || DEFAULT_SETTINGS;
  
  // Initialize with defaults or actual values
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openrouter'>(
    effectiveSettings.chat?.apiProvider || character?.apiProvider || 'gemini'
  );
  
  const [openrouterSettings, setOpenrouterSettings] = useState<OpenRouterSettings>(
    effectiveSettings.chat?.openrouter || character?.openrouter || DEFAULT_OPENROUTER_SETTINGS
  );
  
  const [geminiApiKey, setGeminiApiKey] = useState(
    effectiveSettings.chat?.characterApiKey || ''
  );
  
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [isApiKeyHidden, setIsApiKeyHidden] = useState(true);
  const [isModelSelectorVisible, setIsModelSelectorVisible] = useState(false);
  
  // Update settings whenever the input props change
  useEffect(() => {
    // If using character prop (old way)
    if (character) {
      setApiProvider(character.apiProvider || 'gemini');
      setOpenrouterSettings(character.openrouter || DEFAULT_OPENROUTER_SETTINGS);
      return;
    }
    
    // If using settings prop (new way)
    if (settings?.chat) {
      setApiProvider(settings.chat.apiProvider || 'gemini');
      setOpenrouterSettings(settings.chat.openrouter || DEFAULT_OPENROUTER_SETTINGS);
      setGeminiApiKey(settings.chat.characterApiKey || '');
    }
  }, [settings, character]);
  
  // Load models when API key is available
  useEffect(() => {
    if (apiProvider === 'openrouter' && openrouterSettings?.enabled && openrouterSettings?.apiKey) {
      loadModels();
    }
  }, [apiProvider, openrouterSettings?.enabled, openrouterSettings?.apiKey]);
  
  const loadModels = async (forceRefresh = false) => {
    if (!openrouterSettings?.apiKey) {
      return;
    }
    
    setIsLoadingModels(true);
    
    try {
      const fetchedModels = await OpenRouterModelManager.getModels(openrouterSettings.apiKey, forceRefresh);
      setModels(fetchedModels);
      
      // If models loaded successfully, show the model selector
      if (fetchedModels.length > 0) {
        setIsModelSelectorVisible(true);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      Alert.alert('错误', '加载模型失败，请检查API Key和网络连接');
    } finally {
      setIsLoadingModels(false);
    }
  };
  
  // Update settings with new API settings
  const handleUpdateSettings = useCallback(() => {
    // Handle character-based update (old way)
    if (character) {
      const updatedCharacter = {
        ...character,
        apiProvider,
        openrouter: openrouterSettings
      };
      
      // @ts-ignore - Handle old API
      onUpdate(updatedCharacter);
      return;
    }
    
    // Create updated settings object (new way)
    const updatedSettings: GlobalSettings = {
      ...effectiveSettings,
      chat: {
        ...(effectiveSettings.chat || {}),
        apiProvider,
        characterApiKey: geminiApiKey,
        openrouter: openrouterSettings
      }
    };
    
    // Pass to parent component
    onUpdate(updatedSettings);
  }, [apiProvider, openrouterSettings, geminiApiKey, character, onUpdate, effectiveSettings]);
  
  // Update OpenRouter settings
  const updateOpenrouterSetting = useCallback(<K extends keyof OpenRouterSettings>(
    key: K, 
    value: OpenRouterSettings[K]
  ) => {
    console.log(`Updating OpenRouter setting: ${String(key)} = `, value);
    setOpenrouterSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);
  
  // Handle API provider change
  const handleApiProviderChange = useCallback((provider: 'gemini' | 'openrouter') => {
    setApiProvider(provider);
  }, []);
  
  // Test connection
  const testConnection = useCallback(async () => {
    if (apiProvider === 'gemini') {
      if (!geminiApiKey) {
        Alert.alert('错误', '请先输入Gemini API Key');
        return;
      }
    } else {
      if (!openrouterSettings?.apiKey) {
        Alert.alert('错误', '请先输入OpenRouter API Key');
        return;
      }
    }
    
    setTestingConnection(true);
    
    try {
      if (apiProvider === 'gemini') {
        // Simple validation check for Gemini (basic format)
        if (!geminiApiKey.startsWith('AI') && !geminiApiKey.startsWith('g-')) {
          Alert.alert('警告', 'Gemini API Key 格式似乎不正确，请检查');
          return;
        }
        
        Alert.alert('成功', 'Gemini API Key 格式有效');
      } else {
        // For OpenRouter, try to load models as a test
        await loadModels(true);
        Alert.alert('成功', '成功连接到 OpenRouter API');
      }
    } catch (error) {
      console.error('API连接测试失败:', error);
      Alert.alert('错误', `连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setTestingConnection(false);
    }
  }, [apiProvider, geminiApiKey, openrouterSettings?.apiKey, loadModels]);
  
  // Better model selection handler
  const handleSelectModel = useCallback((modelId: string) => {
    if (openrouterSettings.model === modelId) {
      // Skip if it's already the selected model to prevent duplicate calls
      return;
    }
    
    console.log(`ApiProviderSettings - setting model to ${modelId}`);
    updateOpenrouterSetting('model', modelId);
  }, [openrouterSettings.model, updateOpenrouterSetting]);
  
  // Fix sorting strategy buttons to prevent duplicate clicks
  const handleSortingStrategyChange = useCallback((strategy: 'price' | 'speed' | 'latency') => {
    if (openrouterSettings.sortingStrategy === strategy) {
      // Skip if already set to this strategy
      return;
    }
    
    // Log the change
    console.log(`ApiProviderSettings - changing sort strategy to ${strategy}`);
    
    // Update the setting
    updateOpenrouterSetting('sortingStrategy', strategy);
  }, [openrouterSettings.sortingStrategy, updateOpenrouterSetting]);
  
  // Save changes when leaving the component
  useEffect(() => {
    return () => {
      handleUpdateSettings();
    };
  }, [handleUpdateSettings]);

  return (
    <KeyboardAwareScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled" // Important to handle touches properly
    >
      <Text style={styles.sectionTitle}>API提供商设置</Text>
      
      {/* API提供商选择 */}
      <View style={styles.providerContainer}>
        <TouchableOpacity
          style={[
            styles.providerButton,
            apiProvider === 'gemini' && styles.activeProviderButton
          ]}
          onPress={() => handleApiProviderChange('gemini')}
        >
          <Text style={styles.providerButtonText}>Gemini</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.providerButton,
            apiProvider === 'openrouter' && styles.activeProviderButton
          ]}
          onPress={() => handleApiProviderChange('openrouter')}
        >
          <Text style={styles.providerButtonText}>OpenRouter</Text>
        </TouchableOpacity>
      </View>
      
      {/* Gemini设置 */}
      {apiProvider === 'gemini' && (
        <View style={styles.geminiSettings}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Gemini API Key</Text>
            <View style={styles.apiKeyInputContainer}>
              <TextInput
                style={styles.input}
                value={geminiApiKey}
                onChangeText={setGeminiApiKey}
                placeholder="输入Gemini API Key"
                placeholderTextColor="#777"
                secureTextEntry={isApiKeyHidden}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setIsApiKeyHidden(!isApiKeyHidden)}
              >
                <MaterialIcons 
                  name={isApiKeyHidden ? "visibility" : "visibility-off"} 
                  size={24} 
                  color="#777"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.testButton}
              onPress={testConnection}
              disabled={testingConnection}
            >
              {testingConnection ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.testButtonText}>测试连接</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* OpenRouter设置 */}
      {apiProvider === 'openrouter' && (
        <View style={styles.openrouterSettings}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>启用OpenRouter</Text>
            <Switch
              value={openrouterSettings?.enabled || false}
              onValueChange={(value) => updateOpenrouterSetting('enabled', value)}
              trackColor={{ false: '#444', true: '#FF9ECD' }}
            />
          </View>
          
          {openrouterSettings?.enabled && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>API Key</Text>
                <View style={styles.apiKeyInputContainer}>
                  <TextInput
                    style={styles.input}
                    value={openrouterSettings?.apiKey || ''}
                    onChangeText={(value) => updateOpenrouterSetting('apiKey', value)}
                    placeholder="输入OpenRouter API Key"
                    placeholderTextColor="#777"
                    secureTextEntry={isApiKeyHidden}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setIsApiKeyHidden(!isApiKeyHidden)}
                  >
                    <MaterialIcons 
                      name={isApiKeyHidden ? "visibility" : "visibility-off"} 
                      size={24} 
                      color="#777" 
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={testConnection}
                  disabled={testingConnection || !openrouterSettings?.apiKey}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.testButtonText}>测试连接</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {/* 模型选择器 */}
              <Text style={styles.sectionLabel}>选择模型</Text>
              {isModelSelectorVisible ? (
                <ModelSelector
                  models={models}
                  selectedModelId={openrouterSettings.model}
                  onSelectModel={handleSelectModel}
                  isLoading={isLoadingModels}
                />
              ) : (
                <View style={styles.loadModelsContainer}>
                  {isLoadingModels ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#FF9ECD" />
                      <Text style={styles.loadingText}>加载模型中...</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.loadModelsButton}
                      onPress={() => loadModels(true)}
                    >
                      <MaterialIcons name="cloud-download" size={24} color="#fff" />
                      <Text style={styles.loadModelsText}>加载模型列表</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              {/* 高级设置 */}
              <View style={styles.advancedSettings}>
                <Text style={styles.sectionLabel}>高级设置</Text>
                
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>自动路由</Text>
                  <Switch
                    value={openrouterSettings?.autoRoute || false}
                    onValueChange={(value) => updateOpenrouterSetting('autoRoute', value)}
                    trackColor={{ false: '#444', true: '#FF9ECD' }}
                  />
                </View>
                
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>使用备用模型</Text>
                  <Switch
                    value={openrouterSettings?.useBackupModels || false}
                    onValueChange={(value) => updateOpenrouterSetting('useBackupModels', value)}
                    trackColor={{ false: '#444', true: '#FF9ECD' }}
                  />
                </View>
                
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>允许数据收集</Text>
                  <Switch
                    value={openrouterSettings?.dataCollection || false}
                    onValueChange={(value) => updateOpenrouterSetting('dataCollection', value)}
                    trackColor={{ false: '#444', true: '#FF9ECD' }}
                  />
                </View>
                
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>排序策略</Text>
                  <View style={styles.strategyButtons}>
                    <TouchableOpacity
                      style={[
                        styles.strategyButton,
                        openrouterSettings?.sortingStrategy === 'price' && styles.activeStrategyButton
                      ]}
                      onPress={() => handleSortingStrategyChange('price')}
                    >
                      <Text style={styles.strategyButtonText}>价格</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.strategyButton,
                        openrouterSettings?.sortingStrategy === 'speed' && styles.activeStrategyButton
                      ]}
                      onPress={() => handleSortingStrategyChange('speed')}
                    >
                      <Text style={styles.strategyButtonText}>速度</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.strategyButton,
                        openrouterSettings?.sortingStrategy === 'latency' && styles.activeStrategyButton
                      ]}
                      onPress={() => handleSortingStrategyChange('latency')}
                    >
                      <Text style={styles.strategyButtonText}>延迟</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      )}
      
      {/* 保存按钮 */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleUpdateSettings}
      >
        <Text style={styles.saveButtonText}>保存API设置</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  providerContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  providerButton: {
    flex: 1,
    padding: 10,
    backgroundColor: '#444',
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeProviderButton: {
    backgroundColor: '#FF9ECD',
  },
  providerButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  openrouterSettings: {
    marginTop: 8,
  },
  geminiSettings: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#444',
    borderRadius: 4,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#444',
    color: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#FF9ECD',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  modelSelectorContainer: {
    marginBottom: 16,
    maxHeight: 300, // Limit height to avoid overlap
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
  },
  loadingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 14,
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#555',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  refreshButtonText: {
    color: '#fff',
    marginLeft: 6,
  },
  advancedSettings: {
    marginTop: 8,
  },
  strategyButtons: {
    flexDirection: 'row',
  },
  strategyButton: {
    flex: 1,
    padding: 6,
    backgroundColor: '#555',
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 2,
  },
  activeStrategyButton: {
    backgroundColor: '#FF9ECD',
  },
  strategyButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  apiKeyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeButton: {
    marginLeft: 8,
  },
  loadModelsContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  loadModelsButton: {
    flexDirection: 'row',
    backgroundColor: '#555',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadModelsText: {
    color: '#fff',
    marginLeft: 6,
  },
});

export default ApiProviderSettings;