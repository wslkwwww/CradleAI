import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { OpenRouterAdapter } from '@/NodeST/nodest/utils/openrouter-adapter';
import { OpenRouterModelManager } from '@/NodeST/nodest/utils/openrouter-model-manager';
import { OpenRouterModel } from '@/shared/types/api-types';

interface CradleApiSettingsProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function CradleApiSettings({ isVisible, onClose }: CradleApiSettingsProps) {
  const { getCradleApiSettings, updateCradleApiSettings } = useCharacters();
  const currentSettings = getCradleApiSettings();
  
  // State variables
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openrouter'>(
    currentSettings.apiProvider || 'gemini'
  );
  const [openrouterEnabled, setOpenrouterEnabled] = useState(
    currentSettings.openrouter?.enabled || false
  );
  const [openrouterApiKey, setOpenrouterApiKey] = useState(
    currentSettings.openrouter?.apiKey || ''
  );
  const [openrouterModel, setOpenrouterModel] = useState(
    currentSettings.openrouter?.model || 'openai/gpt-3.5-turbo'
  );
  
  // Models list state
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  
  // Load models on mount if OpenRouter is enabled
  useEffect(() => {
    if (openrouterEnabled && openrouterApiKey) {
      loadModels();
    }
  }, []);
  
  // Load models from OpenRouter
  const loadModels = async () => {
    if (!openrouterApiKey) {
      Alert.alert('错误', '请先输入OpenRouter API密钥');
      return;
    }
    
    setLoadingModels(true);
    
    try {
      const modelsList = await OpenRouterModelManager.getModels(openrouterApiKey, true);
      setModels(modelsList);
    } catch (error) {
      console.error('加载模型失败:', error);
      Alert.alert(
        '加载模型失败', 
        error instanceof Error ? error.message : '未知错误'
      );
    } finally {
      setLoadingModels(false);
    }
  };
  
  // Test OpenRouter connection
  const testConnection = async () => {
    if (!openrouterApiKey) {
      Alert.alert('错误', '请先输入API密钥');
      return;
    }
    
    setTestingConnection(true);
    
    try {
      const adapter = new OpenRouterAdapter(openrouterApiKey);
      const testResponse = await adapter.generateContent([{
        role: 'user',
        parts: [{ text: 'Say "Connection successful!" and nothing else.' }]
      }]);
      
      if (testResponse.includes('Connection successful')) {
        Alert.alert('连接成功', '成功连接到OpenRouter API');
        // Load models after successful connection
        await loadModels();
      } else {
        Alert.alert('连接失败', '连接测试未返回预期响应');
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      Alert.alert(
        '连接测试失败', 
        error instanceof Error ? error.message : '未知错误'
      );
    } finally {
      setTestingConnection(false);
    }
  };
  
  // Save settings
  const saveSettings = async () => {
    try {
      const settings = {
        apiProvider,
        openrouter: apiProvider === 'openrouter' ? {
          enabled: openrouterEnabled,
          apiKey: openrouterApiKey,
          model: openrouterModel
        } : undefined
      };
      
      await updateCradleApiSettings(settings);
      Alert.alert('设置已保存', '摇篮系统API设置已更新');
      onClose();
    } catch (error) {
      console.error('保存设置失败:', error);
      Alert.alert('保存失败', error instanceof Error ? error.message : '未知错误');
    }
  };
  
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>摇篮系统API设置</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContent}>
            <Text style={styles.sectionTitle}>API提供商</Text>
            <View style={styles.providerSelection}>
              <TouchableOpacity 
                style={[
                  styles.providerButton, 
                  apiProvider === 'gemini' && styles.selectedProvider
                ]}
                onPress={() => setApiProvider('gemini')}
              >
                <Text style={[
                  styles.providerText,
                  apiProvider === 'gemini' && styles.selectedProviderText
                ]}>
                  Gemini API
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.providerButton, 
                  apiProvider === 'openrouter' && styles.selectedProvider
                ]}
                onPress={() => setApiProvider('openrouter')}
              >
                <Text style={[
                  styles.providerText,
                  apiProvider === 'openrouter' && styles.selectedProviderText
                ]}>
                  OpenRouter
                </Text>
              </TouchableOpacity>
            </View>
            
            {apiProvider === 'openrouter' && (
              <>
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>启用 OpenRouter</Text>
                  <Switch
                    value={openrouterEnabled}
                    onValueChange={setOpenrouterEnabled}
                    trackColor={{ false: '#767577', true: '#4A90E2' }}
                    thumbColor={openrouterEnabled ? '#fff' : '#f4f3f4'}
                  />
                </View>
                
                {openrouterEnabled && (
                  <>
                    <Text style={styles.label}>API密钥</Text>
                    <TextInput
                      style={styles.input}
                      value={openrouterApiKey}
                      onChangeText={setOpenrouterApiKey}
                      placeholder="输入OpenRouter API密钥"
                      placeholderTextColor="#888"
                      secureTextEntry={true}
                    />
                    
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
                    
                    <Text style={styles.label}>选择模型</Text>
                    <TouchableOpacity 
                      style={styles.modelSelector}
                      onPress={() => setShowModelSelector(true)}
                    >
                      <Text style={styles.modelText}>
                        {openrouterModel || '选择模型'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#ccc" />
                    </TouchableOpacity>
                    
                    <Text style={styles.infoText}>
                      OpenRouter让你可以访问多种AI模型，包括GPT-3.5、GPT-4、Claude等。
                      这些模型可能比默认的Gemini模型更适合某些类型的角色培育。
                    </Text>
                  </>
                )}
              </>
            )}
          </ScrollView>
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={saveSettings}
            >
              <Text style={styles.saveButtonText}>保存设置</Text>
            </TouchableOpacity>
          </View>
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
            <View style={styles.modelHeader}>
              <Text style={styles.modelTitle}>选择模型</Text>
              <TouchableOpacity onPress={() => setShowModelSelector(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {loadingModels ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.loadingText}>加载模型中...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modelList}>
                {models.length > 0 ? (
                  models.map(model => (
                    <TouchableOpacity
                      key={model.id}
                      style={[
                        styles.modelItem,
                        model.id === openrouterModel && styles.selectedModel
                      ]}
                      onPress={() => {
                        setOpenrouterModel(model.id);
                        setShowModelSelector(false);
                      }}
                    >
                      <Text style={styles.modelName}>{model.name || model.id}</Text>
                      {model.provider && (
                        <Text style={styles.providerName}>
                          {model.provider.name || model.provider.id}
                        </Text>
                      )}
                      {model.id === openrouterModel && (
                        <Ionicons name="checkmark-circle" size={22} color="#4A90E2" />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      没有可用的模型。请检查API密钥并重试。
                    </Text>
                    <TouchableOpacity 
                      style={styles.retryButton}
                      onPress={loadModels}
                    >
                      <Text style={styles.retryButtonText}>重试</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#444',
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  providerSelection: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  providerButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedProvider: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  providerText: {
    color: '#ccc',
    fontWeight: 'bold',
  },
  selectedProviderText: {
    color: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  label: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#444',
    borderRadius: 4,
    padding: 12,
    color: '#fff',
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#555',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  testButtonText: {
    color: '#fff',
  },
  modelSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#444',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  modelText: {
    color: '#fff',
  },
  infoText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#555',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#ccc',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modelModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelModalContent: {
    width: '90%',
    height: '70%',
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#444',
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  modelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ccc',
    marginTop: 16,
  },
  modelList: {
    flex: 1,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  selectedModel: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  modelName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  providerName: {
    color: '#aaa',
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#555',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
  },
});