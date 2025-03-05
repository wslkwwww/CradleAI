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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/constants/UserContext';
import { ApiServiceProvider } from '@/services/api-service-provider';
import ModelSelector from '@/components/settings/ModelSelector';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { GlobalSettings } from '@/shared/types';


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

  // Save settings
  const saveSettings = async () => {
    try {
      // Prepare API settings object
      const apiSettings: Partial<GlobalSettings> = {
        chat: {
          ...user?.settings?.chat,
          serverUrl: user?.settings?.chat?.serverUrl || '',
          characterApiKey: geminiKey,
          memoryApiKey: user?.settings?.chat?.memoryApiKey || '',
          xApiKey: user?.settings?.chat?.xApiKey || '',
          apiProvider: openRouterEnabled ? 'openrouter' : 'gemini',
          typingDelay: user?.settings?.chat?.typingDelay || 50,
          temperature: user?.settings?.chat?.temperature || 0.7,
          maxtokens: user?.settings?.chat?.maxtokens || 2000,
          maxTokens: user?.settings?.chat?.maxTokens || 2000,
          openrouter: {
            enabled: openRouterEnabled,
            apiKey: openRouterKey,
            model: selectedModel,
            useBackupModels: useBackupModels,
            backupModels: user?.settings?.chat?.openrouter?.backupModels || []
          }
        }
      };
      
      await updateSettings(apiSettings);
      
      // Also save to localStorage for services that need synchronous access
      try {
        const fullSettings = {
          ...user?.settings,
          ...apiSettings
        };
        localStorage.setItem('user_settings', JSON.stringify(fullSettings));
        console.log('API settings saved to localStorage');
      } catch (error) {
        console.warn('Could not save settings to localStorage', error);
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
      
    } catch (error) {
      console.error('保存设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>API 设置</Text>
          <View style={styles.placeholderButton} />
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Gemini API Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gemini API</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Gemini API Key</Text>
              <TextInput
                style={styles.input}
                value={geminiKey}
                onChangeText={setGeminiKey}
                placeholder="输入 Gemini API Key"
                placeholderTextColor="#999"
                secureTextEntry={true}
              />
            </View>
          </View>

          {/* OpenRouter API Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OpenRouter API</Text>
              <Switch
                value={openRouterEnabled}
                onValueChange={handleProviderToggle}
                trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.4)' }}
                thumbColor={openRouterEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
              />
            </View>

            {openRouterEnabled && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>OpenRouter API Key</Text>
                  <TextInput
                    style={styles.input}
                    value={openRouterKey}
                    onChangeText={setOpenRouterKey}
                    placeholder="输入 OpenRouter API Key"
                    placeholderTextColor="#999"
                    secureTextEntry={true}
                  />
                </View>

                <View style={styles.modelSelectorContainer}>
                  <Text style={styles.inputLabel}>选择模型</Text>
                  <ModelSelector
                    apiKey={openRouterKey}
                    selectedModelId={selectedModel}
                    onSelectModel={setSelectedModel}
                  />
                </View>

                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>使用备用模型</Text>
                  <Switch
                    value={useBackupModels}
                    onValueChange={setUseBackupModels}
                    trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.4)' }}
                    thumbColor={useBackupModels ? 'rgb(255, 224, 195)' : '#f4f3f4'}
                    ios_backgroundColor="#3e3e3e"
                  />
                </View>
              </>
            )}
          </View>

          {/* Test Connection Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={testConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>测试连接</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.noteTitle}>说明：</Text>
            <Text style={styles.noteText}>1. Gemini API 密钥可以从 Google AI Studio 免费获取</Text>
            <Text style={styles.noteText}>2. OpenRouter 支持多种模型，包括 OpenAI、Claude、PaLM 等</Text>
            <Text style={styles.noteText}>3. 启用 OpenRouter 后，默认使用选定的 OpenRouter 模型</Text>
            <Text style={styles.noteText}>4. 如果连接测试失败，请检查 API 密钥是否正确</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveSettings}
          >
            <Text style={styles.buttonText}>保存设置</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  placeholderButton: {
    width: 40,
    height: 40,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#FF9ECD',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
    color: '#333',
  },
  modelSelectorContainer: {
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: '#333',
  },
  buttonContainer: {
    marginBottom: 24,
  },
  testButton: {
    backgroundColor: '#FF9ECD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notesContainer: {
    marginBottom: 24,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});


export default ApiSettings;
