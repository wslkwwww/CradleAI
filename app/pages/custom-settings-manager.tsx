import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { UserCustomSetting } from '@/shared/types';

interface CustomSettingItem {
  id: string;
  key: string;
  isGlobal: boolean;
  setting: UserCustomSetting;
  characterName?: string;
  hasCustom: boolean;
}

const CustomSettingsManager = () => {
  const [settings, setSettings] = useState<CustomSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSetting, setCurrentSetting] = useState<CustomSettingItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSetting, setEditedSetting] = useState<UserCustomSetting | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Get all keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();

      // Filter out keys related to custom settings
      const globalSettingKey = 'global_user_custom_setting';
      const settingsKeys = keys.filter(key => 
        key === globalSettingKey || 
        key.includes('_custom_setting') ||
        key.includes('_has_custom')
      );

      // Extract character IDs from keys
      const characterIds = new Set<string>();
      const hasCustomKeys = new Map<string, boolean>();
      
      settingsKeys.forEach(key => {
        if (key.includes('character_') && key.includes('_custom_setting')) {
          const characterId = key.split('_custom_setting')[0].replace('character_', '');
          characterIds.add(characterId);
        }
        if (key.includes('_has_custom')) {
          const characterId = key.split('_has_custom')[0].replace('character_', '');
          hasCustomKeys.set(characterId, true);
        }
      });

      // Also check full character objects for embedded custom settings
      const characterKeys = keys.filter(key => 
        key.startsWith('character_') && 
        !key.includes('_custom_setting') && 
        !key.includes('_has_custom')
      );

      for (const key of characterKeys) {
        try {
          const charData = await AsyncStorage.getItem(key);
          if (charData) {
            const character = JSON.parse(charData);
            if (character.hasCustomUserSetting && character.customUserSetting) {
              const characterId = character.id;
              characterIds.add(characterId);
            }
          }
        } catch (error) {
          console.log("Error checking character for custom setting:", error);
        }
      }

      // Load global setting
      let settingsData: CustomSettingItem[] = [];
      const globalData = await AsyncStorage.getItem(globalSettingKey);
      
      if (globalData) {
        try {
          const globalSetting = JSON.parse(globalData);
          settingsData.push({
            id: 'global',
            key: globalSettingKey,
            isGlobal: true,
            setting: globalSetting,
            hasCustom: true
          });
        } catch (error) {
          console.error("Error parsing global setting:", error);
        }
      }

      // Load character-specific settings
      for (const characterId of characterIds) {
        try {
          // Try different approaches to get the setting
          let characterSetting: UserCustomSetting | null = null;
          let characterName = '';
          let hasCustom = hasCustomKeys.has(characterId) || false;

          // First try the separate custom setting key
          const customSettingKey = `character_${characterId}_custom_setting`;
          const customSettingData = await AsyncStorage.getItem(customSettingKey);
          
          if (customSettingData) {
            characterSetting = JSON.parse(customSettingData);
          }

          // If not found, try the character object itself
          if (!characterSetting) {
            const characterKey = `character_${characterId}`;
            const characterData = await AsyncStorage.getItem(characterKey);
            
            if (characterData) {
              const character = JSON.parse(characterData);
              if (character.hasCustomUserSetting && character.customUserSetting) {
                characterSetting = character.customUserSetting;
                characterName = character.name || '';
                hasCustom = true;
              }
            }
          }

          if (characterSetting) {
            settingsData.push({
              id: characterId,
              key: customSettingKey,
              isGlobal: false,
              setting: characterSetting,
              characterName,
              hasCustom
            });
          }
        } catch (error) {
          console.error(`Error loading setting for character ${characterId}:`, error);
        }
      }

      setSettings(settingsData);
    } catch (error) {
      console.error("Error loading custom settings:", error);
      Alert.alert('错误', '加载自设数据时出错');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: CustomSettingItem) => {
    setCurrentSetting(item);
    setEditedSetting({...item.setting});
    setIsEditing(true);
  };

  const handleDelete = (item: CustomSettingItem) => {
    Alert.alert(
      '确认删除',
      `确定要删除${item.isGlobal ? '全局自设' : `角色"${item.characterName || item.id}"的自设`}吗？`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              if (item.isGlobal) {
                // Delete global setting
                await AsyncStorage.removeItem('global_user_custom_setting');
              } else {
                // For character settings, we need to handle both storage methods
                
                // 1. Remove from separate keys
                await AsyncStorage.removeItem(`character_${item.id}_custom_setting`);
                await AsyncStorage.removeItem(`character_${item.id}_has_custom`);
                
                // 2. Update the character object if it exists
                try {
                  const characterKey = `character_${item.id}`;
                  const characterData = await AsyncStorage.getItem(characterKey);
                  
                  if (characterData) {
                    const character = JSON.parse(characterData);
                    if (character.hasCustomUserSetting) {
                      character.hasCustomUserSetting = false;
                      character.customUserSetting = null;
                      await AsyncStorage.setItem(characterKey, JSON.stringify(character));
                    }
                  }
                } catch (charError) {
                  console.error("Error updating character object:", charError);
                }
              }
              
              // Refresh the list
              await loadSettings();
              Alert.alert('成功', '自设已删除');
            } catch (error) {
              console.error("Error deleting custom setting:", error);
              Alert.alert('错误', '删除自设时出错');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const saveEditedSetting = async () => {
    if (!currentSetting || !editedSetting) return;
    
    try {
      setLoading(true);
      
      if (currentSetting.isGlobal) {
        // Save global setting
        await AsyncStorage.setItem('global_user_custom_setting', JSON.stringify({
          ...editedSetting,
          global: true
        }));
      } else {
        // For character settings, we need to handle both storage methods
        
        // 1. Save to separate keys
        await AsyncStorage.setItem(
          `character_${currentSetting.id}_custom_setting`, 
          JSON.stringify(editedSetting)
        );
        await AsyncStorage.setItem(
          `character_${currentSetting.id}_has_custom`, 
          'true'
        );
        
        // 2. Update the character object if it exists
        try {
          const characterKey = `character_${currentSetting.id}`;
          const characterData = await AsyncStorage.getItem(characterKey);
          
          if (characterData) {
            try {
              const character = JSON.parse(characterData);
              character.hasCustomUserSetting = true;
              character.customUserSetting = editedSetting;
              
              await AsyncStorage.setItem(characterKey, JSON.stringify(character));
            } catch (parseError) {
              console.error("Error parsing character data:", parseError);
              // If we can't update the full character, at least the separate keys are saved
            }
          }
        } catch (charError) {
          console.error("Error updating character object:", charError);
        }
      }
      
      // Refresh and close editor
      await loadSettings();
      setIsEditing(false);
      setCurrentSetting(null);
      setEditedSetting(null);
      
      Alert.alert('成功', '自设已保存');
    } catch (error) {
      console.error("Error saving custom setting:", error);
      Alert.alert('错误', '保存自设时出错');
    } finally {
      setLoading(false);
    }
  };

  const renderSettingItem = ({ item }: { item: CustomSettingItem }) => {
    const displayName = item.isGlobal 
      ? '全局自设' 
      : `${item.characterName || `角色 ${item.id.substring(0, 8)}...`}的自设`;
    
    const commentPreview = item.setting?.comment || '自设';
    const contentPreview = item.setting?.content 
      ? (item.setting.content.length > 40 
        ? item.setting.content.substring(0, 40) + '...' 
        : item.setting.content)
      : '无内容';
    
    const disabledStyle = item.setting?.disable ? styles.disabledItem : null;
    
    return (
      <TouchableOpacity
        style={[styles.settingItem, disabledStyle]}
        onPress={() => handleEdit(item)}
      >
        <View style={styles.settingHeader}>
          <Text style={styles.settingName}>{displayName}</Text>
          <View style={styles.settingActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.settingDetails}>
          <Text style={styles.settingTitle}>标题: {commentPreview}</Text>
          <Text style={styles.settingPreview}>{contentPreview}</Text>
          <View style={styles.settingMeta}>
            <Text style={styles.settingMetaText}>
              位置: {item.setting?.position || 4} | 
              深度: {item.setting?.depth || 1} | 
              {item.setting?.disable ? ' 已禁用' : ' 已启用'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEditor = () => {
    if (!isEditing || !editedSetting) return null;
    
    return (
      <View style={styles.editorContainer}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>
            编辑{currentSetting?.isGlobal ? '全局自设' : '角色自设'}
          </Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setIsEditing(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.editorContent}>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>标题</Text>
            <TextInput
              style={styles.textInput}
              value={editedSetting.comment}
              onChangeText={(value) => setEditedSetting({...editedSetting, comment: value})}
              placeholder="自设标题"
              placeholderTextColor="#777"
            />
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>内容</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              value={editedSetting.content}
              onChangeText={(value) => setEditedSetting({...editedSetting, content: value})}
              placeholder="自设内容"
              placeholderTextColor="#777"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>插入位置</Text>
            <View style={styles.positionSelector}>
              {[0, 1, 2, 3, 4].map(pos => (
                <TouchableOpacity
                  key={pos}
                  style={[
                    styles.positionButton,
                    editedSetting.position === pos && styles.positionButtonSelected
                  ]}
                  onPress={() => setEditedSetting({
                    ...editedSetting, 
                    position: pos as 0 | 1 | 2 | 3 | 4
                  })}
                >
                  <Text style={[
                    styles.positionButtonText,
                    editedSetting.position === pos && styles.positionButtonTextSelected
                  ]}>
                    {pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldDescription}>
              推荐选择 4，代表在对话内按深度动态插入
            </Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>插入深度</Text>
            <View style={styles.positionSelector}>
              {[0, 1, 2, 3].map(depth => (
                <TouchableOpacity
                  key={depth}
                  style={[
                    styles.positionButton,
                    editedSetting.depth === depth && styles.positionButtonSelected
                  ]}
                  onPress={() => setEditedSetting({...editedSetting, depth: depth})}
                >
                  <Text style={[
                    styles.positionButtonText,
                    editedSetting.depth === depth && styles.positionButtonTextSelected
                  ]}>
                    {depth}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldDescription}>
              0: 在最新消息后，1: 在上一条用户消息前，2+: 在更早消息前
            </Text>
          </View>
          
          <View style={styles.switchContainer}>
            <Text style={styles.fieldLabel}>启用状态</Text>
            <Switch
              value={!editedSetting.disable}
              onValueChange={(value) => setEditedSetting({...editedSetting, disable: !value})}
              trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }}
              thumbColor={!editedSetting.disable ? 'rgb(255, 224, 195)' : '#f4f3f4'}
            />
          </View>
          
          {currentSetting?.isGlobal && (
            <View style={styles.switchContainer}>
              <Text style={styles.fieldLabel}>全局应用</Text>
              <Switch
                value={editedSetting.global || false}
                onValueChange={(value) => setEditedSetting({...editedSetting, global: value})}
                trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }}
                thumbColor={editedSetting.global ? 'rgb(255, 224, 195)' : '#f4f3f4'}
              />
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={saveEditedSetting}
          >
            <Text style={styles.saveButtonText}>保存</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerTitle: '自设管理',
          headerRight: () => (
            <TouchableOpacity onPress={loadSettings} style={{marginRight: 10}}>
              <Ionicons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
          )
        }} 
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <>
          {settings.length > 0 ? (
            <FlatList
              data={settings}
              renderItem={renderSettingItem}
              keyExtractor={item => (item.isGlobal ? 'global' : item.id)}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#777" />
              <Text style={styles.emptyText}>没有找到自设数据</Text>
              <Text style={styles.emptySubtext}>
                在角色设置中创建自设后，可以在这里统一管理
              </Text>
            </View>
          )}
        </>
      )}
      
      {isEditing && renderEditor()}
      
      {/* Loading overlay */}
      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: 16,
  },
  settingItem: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  disabledItem: {
    opacity: 0.6,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgb(255, 224, 195)',
  },
  settingActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    margin: 2,
  },
  settingDetails: {
    marginTop: 4,
  },
  settingTitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  settingPreview: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
  },
  settingMeta: {
    marginTop: 4,
  },
  settingMetaText: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  editorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    zIndex: 10,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  editorContent: {
    flex: 1,
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  fieldDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: 'rgba(80, 80, 80, 0.8)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  textAreaInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  positionSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  positionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionButtonSelected: {
    backgroundColor: 'rgba(255, 224, 195, 0.3)',
    borderColor: 'rgb(255, 224, 195)',
    borderWidth: 1,
  },
  positionButtonText: {
    color: '#ddd',
    fontSize: 16,
    fontWeight: '500',
  },
  positionButtonTextSelected: {
    color: 'rgb(255, 224, 195)',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.3)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: 'rgb(255, 224, 195)',
    fontWeight: 'bold',
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
});

export default CustomSettingsManager;
