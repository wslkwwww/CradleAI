import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
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

const GlobalSettingsScreen = () => {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const [showCharacterApiKey, setShowCharacterApiKey] = useState(false);
  const [showMemoryApiKey, setShowMemoryApiKey] = useState(false);
  const [showXApiKey, setShowXApiKey] = useState(false);

  const [settings, setSettings] = useState<GlobalSettings>({
    self: {
      nickname: user?.settings?.self.nickname || '',
      gender: user?.settings?.self.gender || 'other',
      description: user?.settings?.self.description || '',
    },
    chat: {
      serverUrl: user?.settings?.chat.serverUrl || '',
      characterApiKey: user?.settings?.chat.characterApiKey || '',
      memoryApiKey: user?.settings?.chat.memoryApiKey || '',
      xApiKey: user?.settings?.chat.xApiKey || '',
    },
  });

  const handleSave = async () => {
    try {
      if (!settings.chat.characterApiKey) {
        Alert.alert('错误', '请输入角色应用API Key');
        return;
      }

      if (user) {
        console.log('[GlobalSettings] Saving settings:', {
          hasCharacterApiKey: !!settings.chat.characterApiKey,
          keyLength: settings.chat.characterApiKey.length
        });

        await updateUser({
          ...user,
          settings,
        });
        Alert.alert('成功', '设置已保存');
        router.back();
      }
    } catch (error) {
      console.error('[GlobalSettings] Save error:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  const handleGenderSelect = (gender: 'male' | 'female' | 'other') => {
    setSettings(prev => ({
      ...prev,
      self: {
        ...prev.self,
        gender,
      },
    }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>全局设置</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>保存</Text>
          </TouchableOpacity>
        </View>

        {/* Self Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>自我设置</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>称呼</Text>
            <TextInput
              style={styles.input}
              value={settings.self.nickname}
              onChangeText={(text) => setSettings(prev => ({
                ...prev,
                self: { ...prev.self, nickname: text },
              }))}
              placeholder="角色对我的称呼"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>性别</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  settings.self.gender === 'male' && styles.genderButtonSelected,
                ]}
                onPress={() => handleGenderSelect('male')}
              >
                <Text style={[
                  styles.genderButtonText,
                  settings.self.gender === 'male' && styles.genderButtonTextSelected,
                ]}>男</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  settings.self.gender === 'female' && styles.genderButtonSelected,
                ]}
                onPress={() => handleGenderSelect('female')}
              >
                <Text style={[
                  styles.genderButtonText,
                  settings.self.gender === 'female' && styles.genderButtonTextSelected,
                ]}>女</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  settings.self.gender === 'other' && styles.genderButtonSelected,
                ]}
                onPress={() => handleGenderSelect('other')}
              >
                <Text style={[
                  styles.genderButtonText,
                  settings.self.gender === 'other' && styles.genderButtonTextSelected,
                ]}>其他</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>我是谁</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={settings.self.description}
              onChangeText={(text) => setSettings(prev => ({
                ...prev,
                self: { ...prev.self, description: text },
              }))}
              placeholder="描述你自己..."
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Chat Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>对话设置</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>服务器地址</Text>
            <TextInput
              style={styles.input}
              value={settings.chat.serverUrl}
              onChangeText={(text) => setSettings(prev => ({
                ...prev,
                chat: { ...prev.chat, serverUrl: text },
              }))}
              placeholder="输入服务器URL"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>角色应用apikey</Text>
            <View style={styles.apiKeyContainer}>
              <TextInput
                style={[styles.input, styles.apiKeyInput]}
                value={showCharacterApiKey ? settings.chat.characterApiKey : '•'.repeat(settings.chat.characterApiKey.length || 10)}
                onChangeText={(text) => setSettings(prev => ({
                  ...prev,
                  chat: { ...prev.chat, characterApiKey: text },
                }))}
                secureTextEntry={!showCharacterApiKey}
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowCharacterApiKey(!showCharacterApiKey)}
              >
                <MaterialIcons
                  name={showCharacterApiKey ? 'visibility-off' : 'visibility'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>记忆应用apikey</Text>
            <View style={styles.apiKeyContainer}>
              <TextInput
                style={[styles.input, styles.apiKeyInput]}
                value={showMemoryApiKey ? settings.chat.memoryApiKey : '•'.repeat(settings.chat.memoryApiKey.length || 10)}
                onChangeText={(text) => setSettings(prev => ({
                  ...prev,
                  chat: { ...prev.chat, memoryApiKey: text },
                }))}
                secureTextEntry={!showMemoryApiKey}
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowMemoryApiKey(!showMemoryApiKey)}
              >
                <MaterialIcons
                  name={showMemoryApiKey ? 'visibility-off' : 'visibility'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>X-apikey</Text>
            <View style={styles.apiKeyContainer}>
              <TextInput
                style={[styles.input, styles.apiKeyInput]}
                value={showXApiKey ? settings.chat.xApiKey : '•'.repeat(settings.chat.xApiKey.length || 10)}
                onChangeText={(text) => setSettings(prev => ({
                  ...prev,
                  chat: { ...prev.chat, xApiKey: text },
                }))}
                secureTextEntry={!showXApiKey}
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowXApiKey(!showXApiKey)}
              >
                <MaterialIcons
                  name={showXApiKey ? 'visibility-off' : 'visibility'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#FF9ECD',
    borderColor: '#FF9ECD',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#666',
  },
  genderButtonTextSelected: {
    color: '#fff',
  },
  apiKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiKeyInput: {
    flex: 1,
    marginRight: 8,
  },
  showButton: {
    padding: 8,
  },
});

export default GlobalSettingsScreen;