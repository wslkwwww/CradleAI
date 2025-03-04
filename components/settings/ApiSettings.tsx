import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Modal
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useUser } from '@/constants/UserContext';
import { GlobalSettings } from '@/shared/types';
import { ApiService } from '@/services/api-service';
import { OpenRouterModel } from '@/shared/types/api-types';

interface ApiSettingsProps {
  onClose: () => void;
  visible: boolean;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({ onClose, visible }) => {
  const { user, updateUserSettings } = useUser();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openRouterSettings, setOpenRouterSettings] = useState({
    apiKey: '',
    selectedModel: '',
    autoRoute: false,
    autoSwitchFallback: true,
    backupModels: [] as string[],
    providerSorting: 'price' as 'price' | 'speed' | 'latency',
    allowDataCollection: true,
    ignoreProviders: [] as string[],
    quantizationLevel: 'none' as string
  });
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<'name' | 'price' | 'provider'>('name');

  // Load settings from user context when component mounts
  useEffect(() => {
    if (user?.settings?.chat) {
      const chatSettings = user.settings.chat;
      setGeminiApiKey(chatSettings.characterApiKey || '');
      setApiProvider(chatSettings.apiProvider || 'gemini');
      
      // Load OpenRouter settings if available
      if (chatSettings.openrouter) {
        setOpenRouterSettings({
          apiKey: chatSettings.openrouter.apiKey || '',
          selectedModel: chatSettings.openrouter.selectedModel || '',
          autoRoute: chatSettings.openrouter.autoRoute || false,
          autoSwitchFallback: chatSettings.openrouter.autoSwitchFallback !== false,
          backupModels: chatSettings.openrouter.backupModels || [],
          providerSorting: (chatSettings.openrouter.providerSorting === 'speed' || 
            chatSettings.openrouter.providerSorting === 'latency' ? 
            chatSettings.openrouter.providerSorting : 'price') as 'price' | 'speed' | 'latency',
          allowDataCollection: chatSettings.openrouter.allowDataCollection !== false,
          ignoreProviders: chatSettings.openrouter.ignoreProviders || [],
          quantizationLevel: chatSettings.openrouter.quantizationLevel || 'none'
        });
      }
    }
  }, [user]);

  // Load available models when OpenRouter key changes or on component mount
  useEffect(() => {
    if (apiProvider === 'openrouter' && openRouterSettings.apiKey) {
      loadOpenRouterModels();
    }
  }, [apiProvider, openRouterSettings.apiKey]);

  // Load OpenRouter models
  const loadOpenRouterModels = async (forceRefresh = false) => {
    try {
      setLoadingModels(true);
      const models = await ApiService.getOpenRouterModels(
        openRouterSettings.apiKey,
        forceRefresh
      );
      setAvailableModels(models || []);
    } catch (error) {
      console.error('Failed to load OpenRouter models:', error);
      Alert.alert('错误', '加载模型列表失败');
    } finally {
      setLoadingModels(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // Create updated settings object
      const updatedChatSettings: GlobalSettings['chat'] = {
        ...user?.settings?.chat,
        apiProvider,
        characterApiKey: geminiApiKey,
        serverUrl: user?.settings?.chat?.serverUrl || '', // Preserve existing value
        memoryApiKey: user?.settings?.chat?.memoryApiKey || '', // Preserve existing value
        xApiKey: user?.settings?.chat?.xApiKey || '', // Preserve existing value
      };
      
      // Add OpenRouter settings if enabled
      if (apiProvider === 'openrouter') {
        updatedChatSettings.openrouter = {
          enabled: true,
          model: openRouterSettings.selectedModel,
          apiKey: openRouterSettings.apiKey,
          selectedModel: openRouterSettings.selectedModel,
          autoRoute: openRouterSettings.autoRoute,
          autoSwitchFallback: openRouterSettings.autoSwitchFallback,
          backupModels: openRouterSettings.backupModels,
          providerSorting: openRouterSettings.providerSorting,
          allowDataCollection: openRouterSettings.allowDataCollection,
          ignoreProviders: openRouterSettings.ignoreProviders,
          quantizationLevel: openRouterSettings.quantizationLevel
        };
      }
      
      // Update user settings
      await updateUserSettings({
        chat: updatedChatSettings
      });
      
      Alert.alert('成功', 'API设置已保存');
      onClose();
    } catch (error) {
      console.error('保存API设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  // Test OpenRouter connection
  const testOpenRouterConnection = async () => {
    try {
      setTestingConnection(true);
      const isConnected = await ApiService.testOpenRouterConnection(openRouterSettings.apiKey);
      
      if (isConnected) {
        Alert.alert('连接成功', 'OpenRouter API连接测试通过');
        // Refresh models list after successful connection test
        loadOpenRouterModels(true);
      } else {
        Alert.alert('连接失败', '无法连接到OpenRouter API，请检查您的API密钥');
      }
    } catch (error) {
      console.error('OpenRouter连接测试失败:', error);
      Alert.alert('错误', '连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  // Select a model
  const selectModel = (modelId: string) => {
    setOpenRouterSettings({
      ...openRouterSettings,
      selectedModel: modelId
    });
    setShowModelSelector(false);
  };

  // Filter and sort models for display
  const filteredModels = availableModels.filter(model => {
    const search = searchTerm.toLowerCase();
    return (
      model.id.toLowerCase().includes(search) ||
      model.name.toLowerCase().includes(search) ||
      (model.description?.toLowerCase().includes(search))
    );
  }).sort((a, b) => {
    switch (sortOption) {
      case 'price':
        const aPrice = a.pricing?.completion || 0;
        const bPrice = b.pricing?.completion || 0;
        return aPrice - bPrice;
      case 'provider':
        return (a.provider?.name || '').localeCompare(b.provider?.name || '');
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Get selected model name for display
  const getSelectedModelName = () => {
    if (!openRouterSettings.selectedModel) return 'No model selected';
    
    const model = availableModels.find(m => m.id === openRouterSettings.selectedModel);
    return model ? model.name : openRouterSettings.selectedModel;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>API设置</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollView}>
            {/* API Provider Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>API提供商</Text>
              <View style={styles.providerContainer}>
                <TouchableOpacity 
                  style={[
                    styles.providerButton, 
                    apiProvider === 'gemini' && styles.providerButtonActive
                  ]}
                  onPress={() => setApiProvider('gemini')}
                >
                  <Text style={[
                    styles.providerButtonText,
                    apiProvider === 'gemini' && styles.providerButtonTextActive
                  ]}>
                    Gemini
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.providerButton, 
                    apiProvider === 'openrouter' && styles.providerButtonActive
                  ]}
                  onPress={() => setApiProvider('openrouter')}
                >
                  <Text style={[
                    styles.providerButtonText,
                    apiProvider === 'openrouter' && styles.providerButtonTextActive
                  ]}>
                    OpenRouter
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Gemini API Settings */}
            {apiProvider === 'gemini' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Gemini API设置</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Gemini API Key</Text>
                  <View style={styles.apiKeyContainer}>
                    <TextInput
                      style={styles.input}
                      value={geminiApiKey}
                      onChangeText={setGeminiApiKey}
                      placeholder="输入Gemini API Key"
                      placeholderTextColor="#666"
                      secureTextEntry={!showApiKey}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowApiKey(!showApiKey)}
                      style={styles.visibilityButton}
                    >
                      <MaterialIcons
                        name={showApiKey ? 'visibility-off' : 'visibility'}
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            
            {/* OpenRouter API Settings */}
            {apiProvider === 'openrouter' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>OpenRouter API设置</Text>
                
                {/* API Key input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>OpenRouter API Key</Text>
                  <View style={styles.apiKeyContainer}>
                    <TextInput
                      style={styles.input}
                      value={openRouterSettings.apiKey}
                      onChangeText={(text) => 
                        setOpenRouterSettings({...openRouterSettings, apiKey: text})
                      }
                      placeholder="输入OpenRouter API Key"
                      placeholderTextColor="#666"
                      secureTextEntry={!showOpenRouterKey}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowOpenRouterKey(!showOpenRouterKey)}
                      style={styles.visibilityButton}
                    >
                      <MaterialIcons
                        name={showOpenRouterKey ? 'visibility-off' : 'visibility'}
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Test Connection Button */}
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={testOpenRouterConnection}
                  disabled={testingConnection || !openRouterSettings.apiKey}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.testButtonText}>测试连接</Text>
                  )}
                </TouchableOpacity>
                
                {/* Model Selector */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>选择模型</Text>
                  <TouchableOpacity 
                    style={styles.modelSelector}
                    onPress={() => setShowModelSelector(true)}
                    disabled={availableModels.length === 0}
                  >
                    <Text style={styles.modelSelectorText}>
                      {openRouterSettings.selectedModel ? 
                        getSelectedModelName() : 
                        (availableModels.length === 0 ? 
                          "请先添加API Key并测试连接" : 
                          "选择模型")
                      }
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                {/* Auto Route Toggle */}
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>自动路由</Text>
                  <Switch
                    value={openRouterSettings.autoRoute}
                    onValueChange={(value) => 
                      setOpenRouterSettings({...openRouterSettings, autoRoute: value})
                    }
                    trackColor={{ false: "#444", true: "#FF9ECD" }}
                    thumbColor={openRouterSettings.autoRoute ? "#fff" : "#f4f3f4"}
                  />
                </View>
                
                {/* Auto Switch Fallback Toggle */}
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>自动切换备用模型</Text>
                  <Switch
                    value={openRouterSettings.autoSwitchFallback}
                    onValueChange={(value) => 
                      setOpenRouterSettings({...openRouterSettings, autoSwitchFallback: value})
                    }
                    trackColor={{ false: "#444", true: "#FF9ECD" }}
                    thumbColor={openRouterSettings.autoSwitchFallback ? "#fff" : "#f4f3f4"}
                  />
                </View>
                
                {/* Advanced Settings Toggle */}
                <TouchableOpacity
                  style={styles.advancedSettingsToggle}
                  onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
                >
                  <Text style={styles.advancedSettingsText}>
                    {showAdvancedSettings ? "隐藏高级设置" : "显示高级设置"}
                  </Text>
                  <MaterialIcons 
                    name={showAdvancedSettings ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                    size={24} 
                    color="#FF9ECD" 
                  />
                </TouchableOpacity>
                
                {/* Advanced Settings Section */}
                {showAdvancedSettings && (
                  <View style={styles.advancedSettingsSection}>
                    {/* Provider Sorting */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>提供商排序策略</Text>
                      <View style={styles.segmentedControl}>
                        {(['price', 'speed', 'latency'] as const).map(option => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.segmentButton,
                              openRouterSettings.providerSorting === option && styles.activeSegment
                            ]}
                            onPress={() => setOpenRouterSettings({
                              ...openRouterSettings,
                              providerSorting: option
                            })}
                          >
                            <Text style={[
                              styles.segmentText,
                              openRouterSettings.providerSorting === option && styles.activeSegmentText
                            ]}>
                              {option === 'price' ? '价格优先' : 
                                option === 'speed' ? '速度优先' : '延迟优先'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    
                    {/* Allow Data Collection Toggle */}
                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>允许数据收集</Text>
                      <Switch
                        value={openRouterSettings.allowDataCollection}
                        onValueChange={(value) => 
                          setOpenRouterSettings({...openRouterSettings, allowDataCollection: value})
                        }
                        trackColor={{ false: "#444", true: "#FF9ECD" }}
                        thumbColor={openRouterSettings.allowDataCollection ? "#fff" : "#f4f3f4"}
                      />
                    </View>
                    
                    {/* Quantization Level */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>量化级别</Text>
                      <View style={styles.segmentedControl}>
                        {(['none', 'int8', 'int4'] as const).map(option => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.segmentButton,
                              openRouterSettings.quantizationLevel === option && styles.activeSegment
                            ]}
                            onPress={() => setOpenRouterSettings({
                              ...openRouterSettings,
                              quantizationLevel: option
                            })}
                          >
                            <Text style={[
                              styles.segmentText,
                              openRouterSettings.quantizationLevel === option && styles.activeSegmentText
                            ]}>
                              {option === 'none' ? '无' : option}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={saveSettings}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Model Selector Modal */}
        <Modal
          visible={showModelSelector}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModelSelector(false)}
        >
          <View style={styles.modelModalContainer}>
            <View style={styles.modelModalContent}>
              <View style={styles.modelModalHeader}>
                <Text style={styles.modelModalTitle}>选择模型</Text>
                <TouchableOpacity 
                  onPress={() => setShowModelSelector(false)} 
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {/* Search and Sort */}
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="搜索模型..."
                  placeholderTextColor="#888"
                />
                
                <View style={styles.sortContainer}>
                  <Text style={styles.sortLabel}>排序: </Text>
                  <TouchableOpacity 
                    style={[styles.sortButton, sortOption === 'name' && styles.activeSortButton]}
                    onPress={() => setSortOption('name')}
                  >
                    <Text style={[styles.sortButtonText, sortOption === 'name' && styles.activeSortButtonText]}>名称</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.sortButton, sortOption === 'price' && styles.activeSortButton]}
                    onPress={() => setSortOption('price')}
                  >
                    <Text style={[styles.sortButtonText, sortOption === 'price' && styles.activeSortButtonText]}>价格</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.sortButton, sortOption === 'provider' && styles.activeSortButton]}
                    onPress={() => setSortOption('provider')}
                  >
                    <Text style={[styles.sortButtonText, sortOption === 'provider' && styles.activeSortButtonText]}>提供商</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {loadingModels ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FF9ECD" />
                  <Text style={styles.loadingText}>加载模型列表...</Text>
                </View>
              ) : (
                <ScrollView style={styles.modelList}>
                  {filteredModels.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {searchTerm ? '没有找到匹配的模型' : '没有可用的模型'}
                    </Text>
                  ) : (
                    filteredModels.map(model => (
                      <TouchableOpacity
                        key={model.id}
                        style={[
                          styles.modelItem,
                          openRouterSettings.selectedModel === model.id && styles.selectedModelItem
                        ]}
                        onPress={() => selectModel(model.id)}
                      >
                        <View style={styles.modelItemHeader}>
                          <Text style={styles.modelName}>{model.name}</Text>
                          {openRouterSettings.selectedModel === model.id && (
                            <Ionicons name="checkmark-circle" size={20} color="#FF9ECD" />
                          )}
                        </View>
                        
                        <Text style={styles.modelId}>{model.id}</Text>
                        
                        {model.description && (
                          <Text style={styles.modelDescription}>{model.description}</Text>
                        )}
                        
                        <View style={styles.modelDetails}>
                          {model.provider && (
                            <Text style={styles.modelProvider}>
                              提供商: {model.provider.name || model.provider.id || "未知"}
                            </Text>
                          )}
                          
                          {model.pricing && (
                            <Text style={styles.modelPricing}>
                              价格: {model.pricing.prompt ? `$${model.pricing.prompt}/1K 令牌(输入)` : ''}
                              {model.pricing.prompt && model.pricing.completion ? ' | ' : ''}
                              {model.pricing.completion ? `$${model.pricing.completion}/1K 令牌(输出)` : ''}
                            </Text>
                          )}
                          
                          {model.context_length && (
                            <Text style={styles.modelContextLength}>
                              上下文长度: {model.context_length}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#333',
    borderRadius: 10,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: 500,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#444',
    color: '#fff',
    borderRadius: 4,
    padding: 12,
    flex: 1,
  },
  apiKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibilityButton: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  cancelButton: {
    marginRight: 8,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#888',
  },
  cancelButtonText: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#FF9ECD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  providerContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  providerButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#444',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  providerButtonActive: {
    backgroundColor: '#FF9ECD',
  },
  providerButtonText: {
    color: '#fff',
  },
  providerButtonTextActive: {
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  testButtonText: {
    color: '#fff',
  },
  modelSelector: {
    backgroundColor: '#444',
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelSelectorText: {
    color: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    color: '#ddd',
    fontSize: 14,
  },
  advancedSettingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  advancedSettingsText: {
    color: '#FF9ECD',
    marginRight: 8,
  },
  advancedSettingsSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#444',
    borderRadius: 4,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  segmentText: {
    color: '#fff',
  },
  activeSegment: {
    backgroundColor: '#FF9ECD',
  },
  activeSegmentText: {
    fontWeight: 'bold',
  },
  modelModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelModalContent: {
    backgroundColor: '#333',
    borderRadius: 10,
    width: '90%',
    maxWidth: 600,
    height: '80%',
    maxHeight: 700,
    overflow: 'hidden',
  },
  modelModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  modelModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  searchInput: {
    backgroundColor: '#444',
    color: '#fff',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    color: '#ddd',
    marginRight: 8,
  },
  sortButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: '#444',
  },
  activeSortButton: {
    backgroundColor: '#FF9ECD',
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  activeSortButtonText: {
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#ddd',
    marginTop: 12,
  },
  modelList: {
    flex: 1,
  },
  emptyText: {
    color: '#888',
    padding: 20,
    textAlign: 'center',
  },
  modelItem: {
    backgroundColor: '#444',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    padding: 16,
  },
  selectedModelItem: {
    backgroundColor: 'rgba(255, 158, 205, 0.25)',
    borderColor: '#FF9ECD',
    borderWidth: 1,
  },
  modelItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modelId: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  modelDescription: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 12,
  },
  modelDetails: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#555',
    paddingTop: 8,
  },
  modelProvider: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  modelPricing: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  modelContextLength: {
    color: '#ccc',
    fontSize: 12,
  }
});

export default ApiSettings;