import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useUser } from '@/constants/UserContext';
import { GlobalSettings } from '@/shared/types';
import ApiProviderSettings from '@/components/settings/ApiProviderSettings';

const ApiSettingsScreen = () => {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const [settings, setSettings] = useState<GlobalSettings>({
    self: user?.settings?.self || {
      nickname: '',
      gender: 'other',
      description: '',
    },
    chat: user?.settings?.chat || {
      serverUrl: '',
      characterApiKey: '',
      memoryApiKey: '',
      xApiKey: '',
      apiProvider: 'gemini',
    },
  });

  useEffect(() => {
    // 确保设置中包含必要的 openrouter 字段
    if (!settings.chat.openrouter) {
      setSettings(prev => ({
        ...prev,
        chat: {
          ...prev.chat,
          openrouter: {
            enabled: false,
            apiKey: '',
            model: 'openai/gpt-3.5-turbo',
            autoRoute: false,
            useBackupModels: true,
            backupModels: [],
            sortingStrategy: 'price',
            dataCollection: false,
            ignoredProviders: [],
          }
        }
      }));
    }
  }, []);

  const handleSave = async () => {
    try {
      // 验证 API 密钥
      if (settings.chat.apiProvider === 'gemini' && !settings.chat.characterApiKey) {
        Alert.alert('错误', '请输入 Gemini API Key');
        return;
      }
      
      if (settings.chat.apiProvider === 'openrouter' && 
          settings.chat.openrouter?.enabled && 
          !settings.chat.openrouter?.apiKey) {
        Alert.alert('错误', '请输入 OpenRouter API Key');
        return;
      }

      if (user) {
        console.log('[ApiSettings] 保存设置:', {
          apiProvider: settings.chat.apiProvider,
          openRouterEnabled: settings.chat.openrouter?.enabled
        });

        await updateUser({
          ...user,
          settings,
        });
        
        Alert.alert('成功', '设置已保存');
        router.back();
      }
    } catch (error) {
      console.error('[ApiSettings] 保存错误:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  const handleUpdateSettings = (updatedSettings: GlobalSettings) => {
    setSettings(updatedSettings);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API 设置</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>保存</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        <ApiProviderSettings 
          settings={settings}
          onUpdate={handleUpdateSettings}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
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
});

export default ApiSettingsScreen;
