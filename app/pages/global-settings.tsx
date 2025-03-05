import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/constants/UserContext';
import { theme } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GlobalSettings } from '@/shared/types';  // Add 'type' keyword to import

const GlobalSettings = () => {
  const router = useRouter();
  const { user, updateSettings } = useUser();
  
  // Set initial state based on user settings
  const [settings, setSettings] = useState({
    darkMode: user?.settings?.app?.darkMode || true,
    autoSave: user?.settings?.app?.autoSave || true,
    notificationsEnabled: user?.settings?.app?.notifications?.enabled || false,
    chatDelay: user?.settings?.chat?.typingDelay || 0,
    userNickname: user?.settings?.self?.nickname || 'User',
    apiSettings: {
      provider: user?.settings?.chat?.apiProvider || 'gemini',
      apiKey: user?.settings?.chat?.characterApiKey || '',
      temperature: user?.settings?.chat?.temperature || 0.7,
      maxTokens: user?.settings?.chat?.maxTokens || 800,
    }
  });

  // Handle saving all settings
  const handleSave = async () => {
    try {
      // Validate settings
      if (!settings.userNickname.trim()) {
        Alert.alert('验证错误', '用户昵称不能为空');
        return;
      }
      
      // Update settings in UserContext
      const updatedSettings: Partial<GlobalSettings> = {
        app: {
          darkMode: settings.darkMode,
          autoSave: settings.autoSave,
          notifications: {
            enabled: settings.notificationsEnabled
          }
        },
        chat: {
          ...user?.settings?.chat,
          typingDelay: settings.chatDelay,
          apiProvider: settings.apiSettings.provider as 'gemini' | 'openrouter',
          characterApiKey: settings.apiSettings.apiKey,
          temperature: settings.apiSettings.temperature,
          maxTokens: settings.apiSettings.maxTokens,
          maxtokens: settings.apiSettings.maxTokens, // ensure we set both maxTokens variants
          serverUrl: user?.settings?.chat?.serverUrl || null,
          memoryApiKey: user?.settings?.chat?.memoryApiKey || '',
          xApiKey: user?.settings?.chat?.xApiKey || ''
        },
        self: {
          ...user?.settings?.self,
          nickname: settings.userNickname,
          gender: user?.settings?.self?.gender || 'other',
          description: user?.settings?.self?.description || ''
        }
      };
      
      await updateSettings(updatedSettings);
      Alert.alert('成功', '设置已保存');
      router.back();
      
    } catch (error) {
      console.error('保存设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };
  
  const clearAllData = async () => {
    Alert.alert(
      '清空所有数据',
      '此操作将删除所有角色、对话记录和设置。此操作不可撤销。确定要继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空数据',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('成功', '所有数据已清空，应用将重启');
              // In a real app, you would restart the app here
              router.replace('/');
            } catch (error) {
              console.error('清空数据失败:', error);
              Alert.alert('错误', '清空数据失败');
            }
          }
        }
      ]
    );
  };

  // Handle toggle switch changes
  const handleToggle = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Update API settings
  const updateApiSetting = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      apiSettings: {
        ...prev.apiSettings,
        [key]: value
      }
    }));
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
          <Text style={styles.headerTitle}>全局设置</Text>
          <View style={styles.placeholderButton} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>应用设置</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>深色模式</Text>
              <Switch
                value={settings.darkMode}
                onValueChange={value => handleToggle('darkMode', value)}
                trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.4)' }}
                thumbColor={settings.darkMode ? 'rgb(255, 224, 195)' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
              />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>自动保存对话</Text>
              <Switch
                value={settings.autoSave}
                onValueChange={value => handleToggle('autoSave', value)}
                trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.4)' }}
                thumbColor={settings.autoSave ? 'rgb(255, 224, 195)' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
              />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>推送通知</Text>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={value => handleToggle('notificationsEnabled', value)}
                trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.4)' }}
                thumbColor={settings.notificationsEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>用户设置</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.settingLabel}>您的昵称</Text>
              <TextInput
                style={styles.textInput}
                value={settings.userNickname}
                onChangeText={value => setSettings(prev => ({
                  ...prev,
                  userNickname: value
                }))}
                placeholder="输入昵称"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>聊天设置</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.settingLabel}>打字延迟 ({settings.chatDelay}ms)</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>0</Text>
                <View style={styles.slider}>
                  <TouchableOpacity
                    style={[
                      styles.sliderThumb,
                      { 
                        left: `${Math.min(100, (settings.chatDelay / 1000) * 100)}%`,
                        transform: [{ translateX: -10 }]
                      }
                    ]}
                    onPress={() => {}}
                  />
                </View>
                <Text style={styles.sliderLabel}>1000</Text>
              </View>
              <View style={styles.delayButtons}>
                <TouchableOpacity
                  style={styles.delayButton}
                  onPress={() => setSettings(prev => ({
                    ...prev,
                    chatDelay: Math.max(0, prev.chatDelay - 100)
                  }))}
                >
                  <Text style={styles.delayButtonText}>-100</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.delayButton}
                  onPress={() => setSettings(prev => ({
                    ...prev,
                    chatDelay: Math.min(1000, prev.chatDelay + 100)
                  }))}
                >
                  <Text style={styles.delayButtonText}>+100</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>API设置</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>API提供商</Text>
              <View style={styles.providerButtons}>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    settings.apiSettings.provider === 'gemini' && styles.activeProviderButton
                  ]}
                  onPress={() => updateApiSetting('provider', 'gemini')}
                >
                  <Text style={styles.providerButtonText}>Gemini</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    settings.apiSettings.provider === 'openrouter' && styles.activeProviderButton
                  ]}
                  onPress={() => updateApiSetting('provider', 'openrouter')}
                >
                  <Text style={styles.providerButtonText}>OpenRouter</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.settingLabel}>API密钥</Text>
              <TextInput
                style={styles.textInput}
                value={settings.apiSettings.apiKey}
                onChangeText={value => updateApiSetting('apiKey', value)}
                placeholder="输入API密钥"
                placeholderTextColor="#999"
                secureTextEntry={true}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.settingLabel}>Temperature ({settings.apiSettings.temperature})</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>0</Text>
                <View style={styles.slider}>
                  <TouchableOpacity
                    style={[
                      styles.sliderThumb,
                      { 
                        left: `${settings.apiSettings.temperature * 100}%`,
                        transform: [{ translateX: -10 }]
                      }
                    ]}
                    onPress={() => {}}
                  />
                </View>
                <Text style={styles.sliderLabel}>1</Text>
              </View>
              <View style={styles.delayButtons}>
                <TouchableOpacity
                  style={styles.delayButton}
                  onPress={() => updateApiSetting('temperature', Math.max(0, settings.apiSettings.temperature - 0.1))}
                >
                  <Text style={styles.delayButtonText}>-0.1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.delayButton}
                  onPress={() => updateApiSetting('temperature', Math.min(1, settings.apiSettings.temperature + 0.1))}
                >
                  <Text style={styles.delayButtonText}>+0.1</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.settingLabel}>Max Tokens ({settings.apiSettings.maxTokens})</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>100</Text>
                <View style={styles.slider}>
                  <TouchableOpacity
                    style={[
                      styles.sliderThumb,
                      { 
                        left: `${(settings.apiSettings.maxTokens / 1000) * 100}%`,
                        transform: [{ translateX: -10 }]
                      }
                    ]}
                    onPress={() => {}}
                  />
                </View>
                <Text style={styles.sliderLabel}>1000</Text>
              </View>
              <View style={styles.delayButtons}>
                <TouchableOpacity
                  style={styles.delayButton}
                  onPress={() => updateApiSetting('maxTokens', Math.max(100, settings.apiSettings.maxTokens - 100))}
                >
                  <Text style={styles.delayButtonText}>-100</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.delayButton}
                  onPress={() => updateApiSetting('maxTokens', Math.min(1000, settings.apiSettings.maxTokens + 100))}
                >
                  <Text style={styles.delayButtonText}>+100</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAllData}
            >
              <Text style={styles.clearButtonText}>清空所有数据</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>保存设置</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.primary,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholderButton: {
    width: 32,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.text,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: theme.colors.text,
  },
  slider: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    position: 'absolute',
  },
  delayButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  delayButton: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  delayButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  providerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  providerButton: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  activeProviderButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  providerButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  clearButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.danger,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  saveButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
  },
});

export default GlobalSettings;