import React, { useState, useEffect, useRef } from 'react';
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
  ImageBackground,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useUser } from '@/constants/UserContext';
import { GlobalSettings } from '@/shared/types';
import ApiProviderSettings from '@/components/settings/ApiProviderSettings';
import { StorageUtils } from '@/utils/storage-utils';
import { ApiDebugger } from '@/utils/api-debug';

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
  const [isSaving, setIsSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Ensure settings include necessary openrouter fields
  useEffect(() => {
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

  // Handle save settings - updated to use StorageUtils
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Validate API keys
      if (settings.chat.apiProvider === 'gemini' && !settings.chat.characterApiKey) {
        Alert.alert('错误', '请输入 Gemini API Key');
        setIsSaving(false);
        return;
      }
      
      if (settings.chat.apiProvider === 'openrouter' && 
          settings.chat.openrouter?.enabled && 
          !settings.chat.openrouter?.apiKey) {
        Alert.alert('错误', '请输入 OpenRouter API Key');
        setIsSaving(false);
        return;
      }

      if (user) {
        // Log detailed API settings for debugging
        ApiDebugger.logOpenRouterSettings('ApiSettings - Save', {
          apiProvider: settings.chat.apiProvider,
          openrouter: settings.chat.openrouter
        });
        
        console.log('[ApiSettings] 保存设置:', {
          apiProvider: settings.chat.apiProvider,
          openRouterEnabled: settings.chat.openrouter?.enabled,
          openRouterModel: settings.chat.openrouter?.model
        });

        // Update user in context
        await updateUser({
          ...user,
          settings,
        });
        
        // Also save to AsyncStorage directly to ensure it's available everywhere
        await StorageUtils.saveUserSettings({ ...user, settings });
        
        Alert.alert('成功', '设置已保存');
        router.back();
      }
    } catch (error) {
      console.error('[ApiSettings] 保存错误:', error);
      Alert.alert('错误', '保存设置失败');
    } finally {
      setIsSaving(false);
    }
  };

  // Update settings from ApiProviderSettings component
  const handleUpdateSettings = (updatedSettings: GlobalSettings) => {
    setSettings(updatedSettings);
  };

  // Scroll to top when settings are updated
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: true });
    }
  }, [settings.chat.apiProvider]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground 
        source={require('@/assets/images/default-background.jpeg')} 
        style={styles.backgroundImage}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>API 设置</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, isSaving && styles.savingButton]}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>保存</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.contentWrapper}>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={true}
          >
            <ApiProviderSettings 
              settings={settings}
              onUpdate={handleUpdateSettings}
            />
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#282828',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  saveButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 158, 205, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  savingButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.8)',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ApiSettingsScreen;
