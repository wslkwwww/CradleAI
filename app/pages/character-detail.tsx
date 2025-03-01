import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Character } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { useUser } from '@/constants/UserContext';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { 
  RoleCardJson, 
  WorldBookEntry, 
  AuthorNoteJson,
} from '@/shared/types';
import { WorldBookEntryUI,PresetEntryUI } from '@/constants/types';
import {
  InputField,
  styles as sharedStyles,
  slideDistance,
  POSITION_OPTIONS
} from '@/components/character/CharacterFormComponents';
import { 
  WorldBookSection,
  PresetSection,
  AuthorNoteSection
} from '@/components/character/CharacterSections';
import DetailSidebar from '@/components/character/DetailSidebar';

const DEFAULT_PRESET_ENTRIES = {
  // 可编辑条目
  EDITABLE: [
    { 
      id: "main", 
      name: "Main", 
      identifier: "main",
      enable: true,
      role: "user"
    },
    { 
      id: "enhance_def", 
      name: "Enhance Definitions", 
      identifier: "enhanceDefinitions",
      enable: true,
      role: "user",
      injection_position: 1,
      injection_depth: 3
    },
    { id: "aux_prompt", name: "Auxiliary Prompt", identifier: "nsfw" },
    { id: "post_hist", name: "Post-History Instructions", identifier: "jailbreak" }
  ],

  // 只可排序条目 (与角色卡关联)
  FIXED: [
    {
      id: "world_before",
      name: "World Info (before)",
      identifier: "worldInfoBefore",
      enable: true,
      role: "user"
    },
    { id: "char_desc", name: "Char Description", identifier: "charDescription" },
    { id: "char_pers", name: "Char Personality", identifier: "charPersonality" },
    { id: "scenario", name: "Scenario", identifier: "scenario" },
    { id: "world_after", name: "World Info (after)", identifier: "worldInfoAfter" },
    { id: "chat_ex", name: "Chat Examples", identifier: "dialogueExamples" },
    { id: "chat_hist", name: "Chat History", identifier: "chatHistory" }
  ]
};

const CharacterDetail: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { characters, updateCharacter,} = useCharacters();
  const { user } = useUser();

  const [character, setCharacter] = useState<Character | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [roleCard, setRoleCard] = useState<Partial<RoleCardJson>>({
      name: '',
      first_mes: '',
      description: '',
      personality: '',
      scenario: '',
      mes_example: ''
  });
  const [worldBookEntries, setWorldBookEntries] = useState<WorldBookEntryUI[]>([]);
  const [presetEntries, setPresetEntries] = useState<PresetEntryUI[]>([]);
  const [authorNote, setAuthorNote] = useState<Partial<AuthorNoteJson>>({
      charname: '',
      username: user?.settings?.self.nickname || 'User',
      content: '',
      injection_depth: 0
  });

  const translateY = useSharedValue(0);

  const animatedStyles = useAnimatedStyle(() => {
      return {
          transform: [{
              translateY: withTiming(showSettings ? -slideDistance : 0, { duration: 300 })
          }],
      };
  }, [showSettings]);

  const [selectedField, setSelectedField] = useState<{
    title: string;
    content: string;
    onContentChange?: (text: string) => void;
    editable?: boolean;
    entryType?: 'worldbook' | 'preset' | 'author_note';
    entryOptions?: any;
    onOptionsChange?: (options: any) => void;
  } | null>(null);

  const handleViewDetail = (
    title: string, 
    content: string,
    onContentChange?: (text: string) => void,
    editable: boolean = true,
    entryType?: 'worldbook' | 'preset' | 'author_note',
    entryOptions?: any,
    onOptionsChange?: (options: any) => void
  ) => {
    setSelectedField({ 
      title, 
      content, 
      onContentChange, 
      editable,
      entryType,
      entryOptions,
      onOptionsChange
    });
  };

  useEffect(() => {
    const loadCharacterData = () => {
      const foundCharacter = characters.find((c) => c.id === id);
      if (!foundCharacter || !foundCharacter.jsonData) {
        console.warn('Character or character data not found');
        return;
      }
      
      try {
        setCharacter(foundCharacter);
        const data = JSON.parse(foundCharacter.jsonData);
        
        setRoleCard(data.roleCard || {});
        setAuthorNote(data.authorNote || {
          charname: '',
          username: user?.settings?.self.nickname || 'User',
          content: '',
          injection_depth: 0
        });

        // 安全处理 worldBook 条目
        if (data.worldBook?.entries) {
          const worldBookEntries = Object.entries(data.worldBook.entries)
            .map(([name, entry]: [string, any]) => ({
              id: String(Date.now()) + Math.random(),
              name,
              comment: entry.comment || '',
              content: entry.content || '',
              disable: !!entry.disable,
              position: entry.position || 4,
              constant: !!entry.constant,
              key: Array.isArray(entry.key) ? entry.key : [],
              depth: entry.position === 4 ? (entry.depth || 0) : undefined,
              order: entry.order || 0
            }));
          
          setWorldBookEntries(worldBookEntries);
        }
        
        // 安全处理 preset 条目
        if (data.preset?.prompts) {
          const loadedPresets = data.preset.prompts.map((prompt: any) => {
            const isFixedEntry = DEFAULT_PRESET_ENTRIES.FIXED.some(
              fixed => fixed.identifier === prompt.identifier
            );
            
            return {
              id: prompt.identifier || String(Date.now() + Math.random()),
              name: prompt.name || '',
              content: prompt.content || '',
              identifier: prompt.identifier || `custom_${Date.now()}`,
              isEditable: !isFixedEntry,
              insertType: 'relative' as const,
              role: prompt.role || 'user',
              order: data.preset.prompt_order?.[0]?.order?.findIndex(
                (o: { identifier: string }) => o.identifier === prompt.identifier
              ) ?? 0,
              isDefault: true,
              enable: prompt.enable ?? true,
              depth: prompt.depth || 0,
              injection_position: prompt.injection_position
            };
          });

          const sortedPresets = [...loadedPresets].sort((a, b) => a.order - b.order);
          setPresetEntries(sortedPresets);
        } else {
          // 如果没有预设数据，设置为空数组
          setPresetEntries([]);
        }

      } catch (error) {
        console.error('Failed to parse character data:', error);
        Alert.alert('错误', '角色数据格式错误');
      }
    };
    
    loadCharacterData();
  }, [id, characters, user?.settings?.self.nickname]);

  const pickAvatar = async () => {
      try {
          let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],  // 强制使用 1:1 比例
              quality: 1,
          });

          if (!result.canceled && result.assets[0]) {
              const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
                  Image.getSize(result.assets[0].uri, (width, height) => {
                      resolve({ width, height });
                  });
              });

              // 计算圆形裁剪的尺寸和位置
              const size = Math.min(width, height);
              const x = (width - size) / 2;
              const y = (height - size) / 2;

              // 执行圆形裁剪
              const manipResult = await ImageManipulator.manipulateAsync(
                  result.assets[0].uri,
                  [
                      {
                          crop: {
                              originX: x,
                              originY: y,
                              width: size,
                              height: size,
                          },
                      },
                  ],
                  {
                      format: ImageManipulator.SaveFormat.PNG,
                      compress: 1,
                  }
              );

              if (character) {
                  const updatedCharacter = { ...character, avatar: manipResult.uri };
                  setCharacter(updatedCharacter);
                  await updateCharacter(updatedCharacter);
              }
          }
      } catch (error: any) {
          console.error("Image picking error:", error);
          Alert.alert("提示", "请确保选择合适的图片并正确裁剪");
      }
  };

  const pickImage = async () => {
    try {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [9, 16],
            quality: 1,
        });

        if (!result.canceled && result.assets[0]) {
            const newImage = result.assets[0].uri;
            if (character) {
                const updatedCharacter = {
                    ...character,
                    backgroundImage: newImage, // 修改这里：直接使用 string 类型
                };
                setCharacter(updatedCharacter);
                await updateCharacter(updatedCharacter);
            }
        }
    } catch (error: any) {
        console.error("Image picking error:", error);
        Alert.alert("Error", "Could not pick image: " + error.message);
    }
};

  const handleInputChange = (field: keyof Character, value: string) => {
      if (character) {
          setCharacter({ ...character, [field]: value });
      }
  };

  const saveCharacter = async () => {
    if (!roleCard.name?.trim()) {
      Alert.alert('保存失败', '角色名称不能为空。');
      return;
    }
  
    if (!character || !character.id) {
      Alert.alert('保存失败', '角色ID不存在');
      return;
    }
  
    try {
      // 构建完整的角色数据
      const jsonData = {
        roleCard: {
          ...roleCard,
          data: {
            extensions: {
              regex_scripts: []
            }
          }
        },
        worldBook: {
          entries: Object.fromEntries(
            worldBookEntries
              .filter(entry => entry.name && entry.content)
              .map(entry => [
                entry.name,
                {
                  comment: entry.comment || '',
                  content: entry.content,
                  disable: false,
                  position: entry.position,
                  // 重要：保持原有的 constant 值，不再根据位置改变它
                  constant: entry.constant || false,
                  key: Array.isArray(entry.key) ? entry.key : [],
                  // 只有在 position=4 时才设置 depth
                  ...(entry.position === 4 ? { depth: entry.depth || 0 } : {}),
                  order: entry.order || 0,
                  vectorized: false
                }
              ])
          )
        },
        preset: {
          prompts: presetEntries.map(entry => ({
            name: entry.name,
            content: entry.content || '',
            identifier: entry.identifier,
            enable: entry.enable,
            role: entry.role
          })),
          prompt_order: [{
            // 保存当前的排序顺序
            order: presetEntries
              .sort((a, b) => a.order - b.order) // 确保按正确顺序排序
              .map(entry => ({
                identifier: entry.identifier,
                enabled: entry.enable
              }))
          }]
        },
        authorNote: {
          charname: roleCard.name.trim(),
          username: user?.settings?.self.nickname || "User",
          content: authorNote.content || '',
          injection_depth: authorNote.injection_depth || 0
        }
      };
  
      // 更新角色对象，确保所有必需字段都有值
      const updatedCharacter: Character = {
        id: character.id,
        name: roleCard.name.trim(),
        description: roleCard.description || '',
        personality: roleCard.personality || '',
        interests: character.interests || [],
        jsonData: JSON.stringify(jsonData),
        avatar: character.avatar,
        backgroundImage: character.backgroundImage,
        conversationId: character.id, // 使用角色ID作为会话ID
        circlePosts: character.circlePosts || [],
        createdAt: character.createdAt || new Date().getTime(),
        updatedAt: new Date().getTime()
      };
  
      // 更新到 NodeST
      const updateResult = await NodeSTManager.processChatMessage({
        userMessage: "更新设定",
        conversationId: character.id, // 使用角色ID作为会话ID
        status: "更新人设",
        apiKey: user?.settings?.chat.characterApiKey || '',
        character: updatedCharacter
      });
  
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'NodeST 更新失败');
      }
  
      await updateCharacter(updatedCharacter);
      Alert.alert('成功', '角色设定已更新');
      router.back();
  
    } catch (error) {
      console.error('Character update failed:', error);
      Alert.alert('保存失败', error instanceof Error ? error.message : '更新角色时出现错误。');
    }
  };

  // 添加排序和编辑相关方法
  const handleMoveEntry = (id: string, direction: 'up' | 'down') => {
      setPresetEntries(prev => {
          const index = prev.findIndex(entry => entry.id === id);
          if (
              (direction === 'up' && index === 0) ||
              (direction === 'down' && index === prev.length - 1)
          ) {
              return prev;
          }

          const newEntries = [...prev];
          const swapIndex = direction === 'up' ? index - 1 : index + 1;
          [newEntries[index], newEntries[swapIndex]] = [newEntries[swapIndex], newEntries[index]];

          return newEntries.map((entry, idx) => ({
              ...entry,
              order: idx
          }));
      });
  };

  const handleUpdatePresetEntry = (id: string, updates: Partial<PresetEntryUI>) => {
      setPresetEntries(prev =>
          prev.map(entry =>
              entry.id === id ? { ...entry, ...updates } : entry
          )
      );
  };

  const handleAddPresetEntry = () => {
      const newEntry: PresetEntryUI = {
          id: Date.now().toString(),
          name: '',
          content: '',
          identifier: `custom_${Date.now()}`,
          isEditable: true,
          insertType: 'relative',
          role: 'user',
          order: presetEntries.length,
          depth: 0,
          enable: true
      };
      setPresetEntries(prev => [...prev, newEntry]);
  };

  const handleAddWorldBookEntry = () => {
      const newEntry: WorldBookEntryUI = {
        id: Date.now().toString(),
        name: '',
        comment: '',
        content: '',
        disable: false,
        position: 4,
        key: [],
        constant: false,
        depth: 0,
      };
      setWorldBookEntries(prev => [...prev, newEntry]);
    };
    
    const handleUpdateWorldBookEntry = (id: string, updates: Partial<WorldBookEntryUI>) => {
      setWorldBookEntries(prev =>
        prev.map(entry => {
            if (entry.id === id) {
                // 如果更新包含 position，确保正确处理框架位置和动态插入位置
                if ('position' in updates) {
                    const positionOption = POSITION_OPTIONS.find(opt => opt.value === updates.position);
                    if (positionOption?.isFrameworkPosition) {
                        // 对于框架位置（0或1），清除可能存在的动态插入相关属性
                        return {
                            ...entry,
                            ...updates,
                            is_d_entry: false, // 确保不会被当作D类条目处理
                            injection_depth: undefined,
                            constant: false,
                        };
                    }
                }
                // 仅当选择position=4时才设置depth
                if ('position' in updates) {
                    return {
                        ...entry,
                        ...updates,
                        // 只在position=4时保留depth值
                        depth: updates.position === 4 ? (entry.depth || 0) : undefined
                    };
                }
                return { ...entry, ...updates };
            }
            return entry;
        })
    );
};

  const handleReorderWorldBook = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    setWorldBookEntries(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      
      // Update the order values after reordering
      return result.map((entry, idx) => ({
        ...entry,
        order: idx
      }));
    });
  };
  
  const handleReorderPresets = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    setPresetEntries(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      
      // Update the order values after reordering
      return result.map((entry, idx) => ({
        ...entry,
        order: idx
      }));
    });
  };

  return (
      <SafeAreaView style={sharedStyles.safeArea}>
          <StatusBar barStyle="dark-content" />
          <View style={sharedStyles.container}>
              <View style={sharedStyles.header}>
                  {character?.backgroundImage ? (
                      <>
                          <Image
                              source={typeof character?.backgroundImage === 'string' ? { uri: character.backgroundImage } : (character?.backgroundImage || { uri: '' })}
                              style={sharedStyles.backgroundImage}
                          />
                          <TouchableOpacity
                              style={sharedStyles.changeImageButton}
                              onPress={pickImage}
                          >
                              <Text style={sharedStyles.changeImageButtonText}>更换形象</Text>
                          </TouchableOpacity>
                      </>
                  ) : (
                      <TouchableOpacity
                          style={sharedStyles.uploadImageContainer}
                          onPress={pickImage}
                      >
                          <MaterialCommunityIcons name="plus" size={40} color="rgb(255, 224, 195)" />
                          <Text style={sharedStyles.uploadImageText}>点击上传形象</Text>
                      </TouchableOpacity>
                  )}

                  <TouchableOpacity style={sharedStyles.avatarContainer} onPress={pickAvatar}>
                      <Image
                          source={
                              character?.avatar
                                  ? { uri: String(character.avatar) }
                                  : require('@/assets/images/default-avatar.png')
                          }
                          style={sharedStyles.avatar}
                      />
                  </TouchableOpacity>
              </View>

              <Animated.View style={[sharedStyles.settingsPanel, animatedStyles]}>
                  <TouchableOpacity
                      style={sharedStyles.handle}
                      onPress={() => {
                          setShowSettings(!showSettings);
                      }}
                  >
                      <MaterialCommunityIcons name="chevron-up" size={24} color="#fff" />
                  </TouchableOpacity>
                  <ScrollView style={sharedStyles.attributesContainer} contentContainerStyle={sharedStyles.scrollContent}>
                      {/* 角色卡信息 */}
                      <View style={sharedStyles.sectionHeader}>
                          <Text style={sharedStyles.sectionTitle}>角色卡信息</Text>
                          <InputField
                              label="名称"
                              value={roleCard.name || ''}
                              onChangeText={(text: string) => setRoleCard(prev => ({ ...prev, name: text }))}
                              truncate={false}
                          />
                          <InputField
                              label="首次对话内容"
                              value={roleCard.first_mes || ''}
                              onChangeText={(text: string) => setRoleCard(prev => ({ ...prev, first_mes: text }))}
                              onViewDetail={() => handleViewDetail(
                                '首次对话内容',
                                roleCard.first_mes || '',
                                (text) => setRoleCard(prev => ({ ...prev, first_mes: text }))
                              )}
                          />
                          <InputField
                              label="角色描述"
                              value={roleCard.description || ''}
                              onChangeText={(text: string) => setRoleCard(prev => ({ ...prev, description: text }))}
                              multiline
                          />
                          <InputField
                              label="性格特征"
                              value={roleCard.personality || ''}
                              onChangeText={(text: string) => setRoleCard(prev => ({ ...prev, personality: text }))}
                              multiline
                          />
                          <InputField
                              label="场景设定"
                              value={roleCard.scenario || ''}
                              onChangeText={(text: string) => setRoleCard(prev => ({ ...prev, scenario: text }))}
                              multiline
                          />
                          <InputField
                              label="对话示例"
                              value={roleCard.mes_example || ''}
                              onChangeText={(text: string) => setRoleCard(prev => ({ ...prev, mes_example: text }))}
                              multiline
                          />
                      </View>

                      <WorldBookSection 
                        entries={worldBookEntries}
                        onAdd={handleAddWorldBookEntry}
                        onUpdate={handleUpdateWorldBookEntry}
                        onViewDetail={handleViewDetail}
                        onReorder={handleReorderWorldBook}
                      />

                      <PresetSection
                        entries={presetEntries}
                        onAdd={handleAddPresetEntry}
                        onUpdate={handleUpdatePresetEntry}
                        onMove={handleMoveEntry}
                        onReorder={handleReorderPresets}
                        onViewDetail={handleViewDetail}
                      />

                      <AuthorNoteSection
                        content={authorNote.content || ''}
                        injection_depth={authorNote.injection_depth || 0}
                        onUpdateContent={(text) => setAuthorNote(prev => ({ ...prev, content: text }))}
                        onUpdateDepth={(depth) => setAuthorNote(prev => ({ 
                          ...prev, 
                          injection_depth: depth 
                        }))}
                        onViewDetail={handleViewDetail}
                      />
                  </ScrollView>
              </Animated.View>
          </View>

          <DetailSidebar
            isVisible={!!selectedField}
            onClose={() => setSelectedField(null)}
            title={selectedField?.title || ''}
            content={selectedField?.content || ''}
            onContentChange={selectedField?.onContentChange}
            editable={selectedField?.editable}
            entryType={selectedField?.entryType}
            entryOptions={selectedField?.entryOptions}
            onOptionsChange={selectedField?.onOptionsChange}
          />

          {/* 恢复保存按钮 */}
          <TouchableOpacity
              style={sharedStyles.saveButton}
              onPress={saveCharacter}
          >
              <Text style={sharedStyles.saveButtonText}>保存修改</Text>
          </TouchableOpacity>
      </SafeAreaView>
  );
};

// 只保留页面特有的样式，删除与共享组件重复的样式
const styles = {
  // ...任何特定于character-detail的样式
};

export default CharacterDetail;
