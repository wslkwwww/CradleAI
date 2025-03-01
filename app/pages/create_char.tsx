import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { Character } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { useUser } from '@/constants/UserContext';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NodeSTManager } from '@/utils/NodeSTManager';
import {
  RoleCardJson,
  WorldBookJson,
  AuthorNoteJson,
  WorldBookEntry,
} from '@/shared/types';
import { WorldBookEntryUI, PresetEntryUI } from '@/constants/types';
import {
  styles as sharedStyles,
  headerImageHeight,
  slideDistance
} from '@/components/character/CharacterFormComponents';
import { 
  WorldBookSection,
  PresetSection,
  AuthorNoteSection
} from '@/components/character/CharacterSections';
import DetailSidebar from '@/components/character/DetailSidebar';

export const DEFAULT_PRESET_ENTRIES = {
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

export const DEFAULT_PRESET_ORDER = [
  "main",           // 可编辑
  "world_before",   // 只可排序
  "char_desc",      // 只可排序
  "char_pers",      // 只可排序
  "scenario",       // 只可排序
  "enhance_def",    // 可编辑
  "aux_prompt",     // 可编辑
  "world_after",    // 只可排序
  "chat_ex",        // 只可排序
  "chat_hist",      // 只可排序
  "post_hist"       // 可编辑
];

// 添加插入类型常量
const INSERT_TYPE_OPTIONS = {
  RELATIVE: 'relative',
  CHAT: 'chat'
} as const;

const CreateChar: React.FC = () => {
  const router = useRouter();
  const { addCharacter, addConversation,} = useCharacters();
  const { user } = useUser();
  const [showSettings, setShowSettings] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [character, setCharacter] = useState<Character>({
    id: '',
    name: '',
    avatar: null,
    backgroundImage: null,
    conversationId: '',  // 将在保存时设置为与id相同的值
    description: '',
    personality: '',
    interests: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  const [loading, setLoading] = useState(false);

  const [roleCard, setRoleCard] = useState<Partial<RoleCardJson>>({
    name: '',
    first_mes: '',
    description: '',
    personality: '',
    scenario: '',
    mes_example: '',
    data: {  // 添加data字段
      extensions: {
        regex_scripts: []
      }
    }
  });

  const [worldBook, setWorldBook] = useState<Partial<WorldBookJson>>({
    entries: {}
  });

  const [authorNote, setAuthorNote] = useState<Partial<AuthorNoteJson>>({
    charname: '',
    username: user?.settings?.self.nickname || 'User',
    content: '',
    injection_depth: 0
  });

  const [worldBookEntries, setWorldBookEntries] = useState<WorldBookEntryUI[]>([]);
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [presetEntries, setPresetEntries] = useState<PresetEntryUI[]>(() => {
    // 合并所有默认条目
    const defaultEntries = [
      ...DEFAULT_PRESET_ENTRIES.EDITABLE.map(entry => ({
        ...entry,
        content: '',
        isEditable: true,
        insertType: 'relative' as const,
        role: 'user' as const,
        order: DEFAULT_PRESET_ORDER.indexOf(entry.identifier),
        isDefault: true,
        enable: entry.enable ?? true,
        depth: 0
      })),
      ...DEFAULT_PRESET_ENTRIES.FIXED.map(entry => ({
        ...entry,
        content: '',
        isEditable: false,
        insertType: 'relative' as const,
        role: 'user' as const,
        order: DEFAULT_PRESET_ORDER.indexOf(entry.identifier),
        isDefault: true,
        enable: entry.enable ?? true,
        depth: 0
      }))
    ];

    // 根据 DEFAULT_PRESET_ORDER 排序
    return defaultEntries
      .sort((a, b) => {
        const orderA = DEFAULT_PRESET_ORDER.indexOf(a.identifier);
        const orderB = DEFAULT_PRESET_ORDER.indexOf(b.identifier);
        return orderA - orderB;
      });
  });

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

  const handleInputChange = useCallback(
    (field: keyof Character, value: string) => {
      setCharacter((prevCharacter) => ({ ...prevCharacter, [field]: value }));
    },
    []
  );

  const handleRoleCardChange = (field: keyof RoleCardJson, value: string) => {
    setRoleCard(prev => ({ ...prev, [field]: value }));
    // 同步更新角色基本信息
    if (field === 'name') {
      setCharacter(prev => ({ ...prev, name: value }));
      setAuthorNote(prev => ({ ...prev, charname: value }));
    }
  };

  const handleWorldBookEntry = (key: string, entry: Partial<WorldBookEntry>) => {
    setWorldBook(prev => ({
      ...prev,
      entries: {
        ...prev.entries,
        [key]: {
          comment: entry.comment || '',
          content: entry.content || '',
          disable: false,
          position: entry.position || 0,
          constant: entry.constant || false,
          order: entry.order || 0,
          vectorized: entry.vectorized || false,
          key: entry.key || [],
          depth: entry.depth || 0
        }
      }
    }));
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
      isDefault: false,
      enable: true,
      depth: 0
    };
    setPresetEntries(prev => [...prev, newEntry]);
  };

  const handleUpdatePresetEntry = (id: string, updates: Partial<PresetEntryUI>) => {
    setPresetEntries(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, ...updates } : entry
      )
    );
  };

  // 处理条目排序
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
      
      // 更新order值
      return newEntries.map((entry, idx) => ({
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

  const pickAvatar = async () => {
    try {
      // 首先选择图片
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
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

        setCharacter(prev => ({
          ...prev,
          avatar: manipResult.uri
        }));
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
        setCharacter(prev => ({
          ...prev,
          backgroundImage: newImage  // 形象图
        }));
      }
    } catch (error: any) {
      console.error("Image picking error:", error);
      Alert.alert("Error", "Could not pick image: " + error.message);
    }
  };

  const validateCharacter = (): boolean => {
    if (!character.name.trim()) {
      Alert.alert('保存失败', '角色名称不能为空。');
      return false;
    }

    return true;
  };

  const saveCharacter = async () => {
    if (!roleCard.name?.trim()) {
      Alert.alert('保存失败', '角色名称不能为空。');
      return;
    }
  
    setLoading(true);
    const characterId = String(Date.now());
    
    try {
      // 构建角色数据
      const jsonData = {
        roleCard: {
          name: roleCard.name.trim(),
          first_mes: roleCard.first_mes || '',
          description: roleCard.description || '',
          personality: roleCard.personality || '',
          scenario: roleCard.scenario || '',
          mes_example: roleCard.mes_example || '',
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
                  // 保持 constant 值，不受位置影响
                  constant: entry.constant || false,
                  key: Array.isArray(entry.key) ? entry.key : [],
                  // 只在 position=4 时设置 depth
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
            order: presetEntries
              .sort((a, b) => a.order - b.order)
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
  
      // 创建新角色对象
      const newCharacter: Character = {
        id: characterId,
        name: roleCard.name.trim(),
        avatar: character.avatar,
        backgroundImage: character.backgroundImage,
        conversationId: characterId,
        description: roleCard.description || '',
        personality: roleCard.personality || '',
        interests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        jsonData: JSON.stringify(jsonData)
      };
  
      // 保存角色和创建会话
      await addCharacter(newCharacter);
      await addConversation({
        id: characterId,
        title: roleCard.name.trim()
      });
  
      // 设置为当前会话
      await AsyncStorage.setItem('lastConversationId', characterId);
  
      // 立即导航到首页对话界面
      router.replace({
        pathname: "/(tabs)",
        params: { characterId }
      });
  
      // 异步初始化 NodeST，不阻塞导航
      NodeSTManager.processChatMessage({
        userMessage: "你好！",
        conversationId: characterId,
        status: "新建角色",
        apiKey: user?.settings?.chat.characterApiKey || '',
        character: newCharacter
      }).catch(error => {
        console.error('NodeST initialization error:', error);
        // 可以选择是否显示错误提示
        // Alert.alert('提示', 'NodeST 初始化出现问题，可能会影响对话体验');
      });
  
    } catch (error) {
      console.error('[Error] Character creation failed:', error);
      Alert.alert(
        '保存失败', 
        `创建角色时出现错误：\n${error instanceof Error ? error.message : String(error)}`
      );
      setLoading(false);
    }
  };

  // 从 AsyncStorage 加载导入的数据
  useEffect(() => {
    const loadImportedData = async () => {
      try {
        const importData = await AsyncStorage.getItem('temp_import_data');
        if (importData) {
          const data = JSON.parse(importData);
          
          // 填充角色数据
          if (data.roleCard) {
            setRoleCard(data.roleCard);
            setCharacter(prev => ({
              ...prev,
              name: data.roleCard.name,
              avatar: data.avatar || null
            }));
          }

          // 填充世界书数据，修正 position 和 constant 的映射
          if (data.worldBook?.entries) {
            setWorldBook(data.worldBook);
            console.log('[WorldBook 导入] 原始数据:');
            Object.entries(data.worldBook.entries).forEach(([key, entry]: [string, any]) => {
              console.log(`条目: ${key}, position: ${entry.position}`);
            });

            const entries = Object.entries(data.worldBook.entries).map(([key, entry]: [string, any]) => {
              // 确保 position 是有效值（0-4），默认为 4
              const rawPosition = Number(entry.position);
              const position = (isNaN(rawPosition) || rawPosition < 0 || rawPosition > 4 ? 4 : rawPosition) as 0 | 1 | 2 | 3 | 4;

              const newEntry: WorldBookEntryUI = {
                id: key,
                name: entry.comment || key,
                comment: entry.comment || '',
                content: entry.content || '',
                disable: entry.enable === undefined ? false : !entry.enable,
                position,
                constant: !!entry.constant,
                order: entry.order || 0,
                vectorized: entry.vectorized || false,
                key: entry.key || [],
                depth: position === 4 ? (entry.depth || 0) : undefined
              };

              console.log('[WorldBook 导入] 转换后:', {
                name: newEntry.name,
                position: newEntry.position,
                constant: newEntry.constant,
                depth: newEntry.depth
              });

              return newEntry;
            });
            
            setWorldBookEntries(entries);
          }

          // 简化预设数据填充逻辑
          if (data.preset?.prompts) {
            console.log('[创建角色] 开始处理预设数据:', 
              data.preset.prompts.map((p: any) => ({
                name: p.name,
                injection_position: p.injection_position,
                injection_depth: p.injection_depth
            })));
  
            const importedEntries = data.preset.prompts.map((prompt: any, index: number) => ({
              id: `imported_${index}`,
              name: prompt.name || '',
              content: prompt.content || '',
              identifier: prompt.identifier,
              isEditable: true,
              insertType: prompt.injection_position === 1 ? 
                INSERT_TYPE_OPTIONS.CHAT : 
                INSERT_TYPE_OPTIONS.RELATIVE,
              role: prompt.role || 'user',
              order: index,
              isDefault: false,
              enable: prompt.enabled ?? true,
              depth: prompt.injection_depth // 直接使用原始值，不做任何处理或转换
            }));
            
            setPresetEntries(importedEntries);
          }

          // 清除临时存储的导入数据
          await AsyncStorage.removeItem('temp_import_data');
        }
      } catch (error) {
        console.error('[创建角色] 加载导入数据失败:', error);
        Alert.alert('导入失败', '无法加载导入的数据');
      }
    };

    loadImportedData();
  }, []);

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{
        translateY: withTiming(showSettings ? -slideDistance : 0, { duration: 300 })
      }],
    };
  }, [showSettings]);

  return (
    <SafeAreaView style={sharedStyles.safeArea}>
      <StatusBar barStyle="dark-content" />
        <View style={sharedStyles.container}>
          <View style={sharedStyles.header}>
            {character.backgroundImage ? (
              <>
                <Image
                  source={{ uri: String(character.backgroundImage) }}
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
                  character.avatar 
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
              onPress={() => setShowSettings(!showSettings)}
              accessibilityLabel={showSettings ? "收起设置" : "展开设置"}
            >
              <MaterialCommunityIcons
                name={showSettings ? "chevron-down" : "chevron-up"}
                size={24}
                color="white"
              />
            </TouchableOpacity>

            <ScrollView style={sharedStyles.settingsContent} contentContainerStyle={sharedStyles.scrollContent}>
              <View style={sharedStyles.attributesContainer}>
                <View style={sharedStyles.sectionHeader}>
                  <Text style={sharedStyles.sectionTitle}>角色卡信息</Text>
                </View>
                
                <View style={sharedStyles.inputContainer}>
                  <Text style={sharedStyles.inputLabel}>名称</Text>
                  <TextInput
                    style={sharedStyles.input}
                    value={roleCard.name}
                    onChangeText={(text) => handleRoleCardChange('name', text)}
                    placeholder="角色名称"
                    placeholderTextColor="#999" 
                  />
                </View>
    
                <View style={sharedStyles.inputContainer}>
                  <Text style={sharedStyles.inputLabel}>首次对话内容</Text>
                  <TextInput
                    style={[sharedStyles.input, sharedStyles.multilineInput]}
                    value={roleCard.first_mes}
                    onChangeText={(text) => handleRoleCardChange('first_mes', text)}
                    placeholder="角色的第一句话"
                    placeholderTextColor="#999"
                    multiline
                  />
                </View>
  
                <View style={sharedStyles.inputContainer}>
                  <Text style={sharedStyles.inputLabel}>角色描述</Text>
                  <TextInput
                    style={[sharedStyles.input, sharedStyles.multilineInput]}
                    value={roleCard.description}
                    onChangeText={(text) => handleRoleCardChange('description', text)}
                    placeholder="角色的基本描述"
                    placeholderTextColor="#999"
                    multiline
                  />
                </View>
    
                <View style={sharedStyles.inputContainer}>
                  <Text style={sharedStyles.inputLabel}>性格特征</Text>
                  <TextInput
                    style={[sharedStyles.input, sharedStyles.multilineInput]}
                    value={roleCard.personality}
                    onChangeText={(text) => handleRoleCardChange('personality', text)}
                    placeholder="角色的性格特点"
                    placeholderTextColor="#999"
                    multiline
                  />
                </View>
    
                <View style={sharedStyles.inputContainer}>
                  <Text style={sharedStyles.inputLabel}>场景设定</Text>
                  <TextInput
                    style={[sharedStyles.input, sharedStyles.multilineInput]}
                    value={roleCard.scenario}
                    onChangeText={(text) => handleRoleCardChange('scenario', text)}
                    placeholder="角色的场景设定"
                    placeholderTextColor="#999"
                    multiline
                  />
                </View>
    
                <View style={sharedStyles.inputContainer}>
                  <Text style={sharedStyles.inputLabel}>对话示例</Text>
                  <TextInput
                    style={[sharedStyles.input, sharedStyles.multilineInput]}
                    value={roleCard.mes_example}
                    onChangeText={(text) => handleRoleCardChange('mes_example', text)}
                    placeholder="角色的对话示例"
                    placeholderTextColor="#999"
                    multiline
                  />
                </View>

                {/* 世界书部分 */}
                <WorldBookSection 
                  entries={worldBookEntries}
                  onAdd={handleAddWorldBookEntry}
                  onUpdate={handleUpdateWorldBookEntry}
                  onReorder={handleReorderWorldBook}
                  onViewDetail={handleViewDetail} // Add this
                />
    
                {/* 作者注释部分 */}
                <AuthorNoteSection
                  content={authorNote.content || ''}
                  injection_depth={authorNote.injection_depth || 0}
                  onUpdateContent={(text) => setAuthorNote(prev => ({ ...prev, content: text }))}
                  onUpdateDepth={(depth) => setAuthorNote(prev => ({ 
                    ...prev, 
                    injection_depth: depth 
                  }))}
                  onViewDetail={handleViewDetail} // Add this
                />

                {/* 预设信息部分 */}
                <PresetSection
                  entries={presetEntries}
                  onAdd={handleAddPresetEntry}
                  onUpdate={handleUpdatePresetEntry}
                  onMove={handleMoveEntry}
                  onReorder={handleReorderPresets}
                  onViewDetail={handleViewDetail} // Add this
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={sharedStyles.saveButton} onPress={saveCharacter} disabled={loading} accessibilityLabel="保存设定">
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={sharedStyles.saveButtonText}>保存设定</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
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
        </View>
    </SafeAreaView>
  );
};

// 删除重复的样式定义,只保留特定于 create_char 的独特样式
const styles = StyleSheet.create({
  // 继承共用样式
  ...sharedStyles,
  
  // 只保留 create_char 特有的或需要覆盖的样式
  profileInfo: {
    padding: 10,
    borderRadius: 10,
    marginTop: headerImageHeight - 40,
    marginLeft: 20
  },
  editButton: {
    backgroundColor: 'rgb(255, 224, 195)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginTop: 2,
    marginLeft: 0,
    marginRight: 0,
  },
  editButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  zipper: {
    width: 40,
    height: 5,
    backgroundColor: '#777',
    borderRadius: 5
  },
  handleArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 40,
    height: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  }
});

export default CreateChar;

