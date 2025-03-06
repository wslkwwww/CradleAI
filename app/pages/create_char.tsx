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
import { BlurView } from 'expo-blur';
import { theme } from '@/constants/theme';

// Import shared components that we're now using in both pages
import { 
  WorldBookSection,
  PresetSection,
  AuthorNoteSection
} from '@/components/character/CharacterSections';
import DetailSidebar from '@/components/character/DetailSidebar';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionButton from '@/components/ActionButton';
import CharacterAttributeEditor from '@/components/character/CharacterAttributeEditor';
import CharacterDetailHeader from '@/components/character/CharacterDetailHeader';

// Default preset entries
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
  const [loading, setLoading] = useState(false);
  
  // Character and role card state
  const [character, setCharacter] = useState<Character>({
    id: '',
    name: '',
    avatar: null,
    backgroundImage: null,
    conversationId: '',
    description: '',
    personality: '',
    interests: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  const [roleCard, setRoleCard] = useState<Partial<RoleCardJson>>({
    name: '',
    first_mes: '',
    description: '',
    personality: '',
    scenario: '',
    mes_example: '',
    data: {
      extensions: {
        regex_scripts: []
      }
    }
  });

  // World book and author note state
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
  const [presetEntries, setPresetEntries] = useState<PresetEntryUI[]>(() => {
    // ...existing preset entries initialization...
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

  // UI state variables - match character-detail page
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedField, setSelectedField] = useState<{
    title: string;
    content: string;
    onContentChange?: (text: string) => void;
    editable?: boolean;
    entryType?: 'worldbook' | 'preset' | 'author_note';
    entryOptions?: any;
    onOptionsChange?: (options: any) => void;
    name?: string;
    onNameChange?: (text: string) => void;
  } | null>(null);

  // Handle detail view for world book, preset, and author note entries
  const handleViewDetail = (
    title: string, 
    content: string,
    onContentChange?: (text: string) => void,
    editable: boolean = true,
    entryType?: 'worldbook' | 'preset' | 'author_note',
    entryOptions?: any,
    onOptionsChange?: (options: any) => void,
    name?: string,
    onNameChange?: (text: string) => void
  ) => {
    setSelectedField({ 
      title, 
      content, 
      onContentChange, 
      editable,
      entryType,
      entryOptions,
      onOptionsChange,
      name,
      onNameChange
    });
  };

  // Handle role card field changes
  const handleRoleCardChange = (field: keyof RoleCardJson, value: string) => {
    setRoleCard(prev => ({ ...prev, [field]: value }));
    // 同步更新角色基本信息
    if (field === 'name') {
      setCharacter(prev => ({ ...prev, name: value }));
      setAuthorNote(prev => ({ ...prev, charname: value }));
    }
    
    // Basic character properties syncing
    if (field === 'description') {
      setCharacter(prev => ({ ...prev, description: value }));
    }
    
    if (field === 'personality') {
      setCharacter(prev => ({ ...prev, personality: value }));
    }
    
    setHasUnsavedChanges(true);
  };

  // World Book handling functions
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
      order: worldBookEntries.length
    };
    setWorldBookEntries(prev => [...prev, newEntry]);
    setHasUnsavedChanges(true);
  };

  const handleUpdateWorldBookEntry = (id: string, updates: Partial<WorldBookEntryUI>) => {
    setWorldBookEntries(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, ...updates } : entry
      )
    );
    setHasUnsavedChanges(true);
  };
  
  // Preset handling functions
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
    setHasUnsavedChanges(true);
  };

  const handleUpdatePresetEntry = (id: string, updates: Partial<PresetEntryUI>) => {
    setPresetEntries(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, ...updates } : entry
      )
    );
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  // 重新排序函数
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  // Image handling functions
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
          }, () => {
            resolve({ width: 300, height: 300 }); // Default fallback values
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
        setHasUnsavedChanges(true);
      }
    } catch (error: any) {
      console.error("Image picking error:", error);
      Alert.alert("提示", "请确保选择合适的图片并正确裁剪");
    }
  };

  const pickBackgroundImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setCharacter(prev => ({
          ...prev,
          backgroundImage: result.assets[0].uri
        }));
        setHasUnsavedChanges(true);
      }
    } catch (error: any) {
      console.error("Background image picking error:", error);
      Alert.alert("Error", "Could not pick image: " + error.message);
    }
  };

  // Navigation handling
  const handleBackPress = () => {
    if (hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      router.back();
    }
  };

  // Saving character
  const saveCharacter = async () => {
    if (!roleCard.name?.trim()) {
      Alert.alert('保存失败', '角色名称不能为空。');
      return;
    }
  
    setIsSaving(true);
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
                  disable: entry.disable,
                  position: entry.position,
                  constant: entry.constant || false,
                  key: Array.isArray(entry.key) ? entry.key : [],
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
            role: entry.role,
            // Properly handle insertion type and depth
            ...(entry.insertType === 'chat' ? { 
              injection_position: 1,
              injection_depth: entry.depth || 0
            } : {})
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
      setIsSaving(false);
    }
  };

  // Load imported data if available
  useEffect(() => {
    const loadImportedData = async () => {
      try {
        const importData = await AsyncStorage.getItem('temp_import_data');
        if (importData) {
          const data = JSON.parse(importData);
          
          // Fill character data
          if (data.roleCard) {
            setRoleCard(data.roleCard);
            setCharacter(prev => ({
              ...prev,
              name: data.roleCard.name,
              avatar: data.avatar || null
            }));
          }

          // Handle world book entries
          if (data.worldBook?.entries) {
            // ...existing world book processing...
            setWorldBook(data.worldBook);
            
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

              return newEntry;
            });
            
            setWorldBookEntries(entries);
          }

          // Handle preset entries
          if (data.preset?.prompts) {
            // ...existing preset processing...  
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
              depth: prompt.injection_depth 
            }));
            
            setPresetEntries(importedEntries);
          }

          // Handle author note
          if (data.authorNote) {
            setAuthorNote(data.authorNote);
          }

          // Clear temporarily stored import data
          await AsyncStorage.removeItem('temp_import_data');
        }
      } catch (error) {
        console.error('[创建角色] 加载导入数据失败:', error);
        Alert.alert('导入失败', '无法加载导入的数据');
      }
    };

    loadImportedData();
  }, []);

  // Track changes to set hasUnsavedChanges flag
  useEffect(() => {
    const hasContent = roleCard.name || roleCard.first_mes || roleCard.description || 
                      roleCard.personality || roleCard.scenario || roleCard.mes_example ||
                      worldBookEntries.length > 0 || authorNote.content;
    
    // Only consider it unsaved if there's actual content
    setHasUnsavedChanges(!!hasContent);
  }, [
    roleCard.name, roleCard.first_mes, roleCard.description, roleCard.personality,
    roleCard.scenario, roleCard.mes_example, worldBookEntries, authorNote.content,
    character.avatar, character.backgroundImage
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Character Header - now using the shared CharacterDetailHeader component */}
      <CharacterDetailHeader
        name={roleCard.name || '新建角色'}
        avatar={character.avatar || null}
        backgroundImage={character.backgroundImage || null}
        onAvatarPress={pickAvatar}
        onBackgroundPress={pickBackgroundImage}
        onBackPress={handleBackPress}
      />
      
      {/* Tab Navigation - match character-detail */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'basic' && styles.activeTab]} 
          onPress={() => setActiveTab('basic')}
        >
          <Text style={[styles.tabText, activeTab === 'basic' && styles.activeTabText]}>
            基本设定
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'advanced' && styles.activeTab]} 
          onPress={() => setActiveTab('advanced')}
        >
          <Text style={[styles.tabText, activeTab === 'advanced' && styles.activeTabText]}>
            高级设定
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content Area */}
      <ScrollView style={styles.content}>
        {activeTab === 'basic' ? (
          <View style={styles.tabContent}>
            <CharacterAttributeEditor
              title="名称"
              value={roleCard.name || ''}
              onChangeText={(text) => handleRoleCardChange('name', text)}
              placeholder="角色名称..."
            />
            
            <CharacterAttributeEditor
              title="开场白"
              value={roleCard.first_mes || ''}
              onChangeText={(text) => handleRoleCardChange('first_mes', text)}
              placeholder="角色与用户的第一次对话内容..."
              style={styles.attributeSection}
            />
            
            <CharacterAttributeEditor
              title="角色描述"
              value={roleCard.description || ''}
              onChangeText={(text) => handleRoleCardChange('description', text)}
              placeholder="描述角色的外表、背景等基本信息..."
              style={styles.attributeSection}
            />
            
            <CharacterAttributeEditor
              title="性格特征"
              value={roleCard.personality || ''}
              onChangeText={(text) => handleRoleCardChange('personality', text)}
              placeholder="描述角色的性格、习惯、喜好等..."
              style={styles.attributeSection}
            />
            
            <CharacterAttributeEditor
              title="场景设定"
              value={roleCard.scenario || ''}
              onChangeText={(text) => handleRoleCardChange('scenario', text)}
              placeholder="描述角色所在的环境、情境..."
              style={styles.attributeSection}
            />
            
            <CharacterAttributeEditor
              title="对话示例"
              value={roleCard.mes_example || ''}
              onChangeText={(text) => handleRoleCardChange('mes_example', text)}
              placeholder="提供一些角色对话的范例..."
              style={styles.attributeSection}
            />
          </View>
        ) : (
          <View style={styles.tabContent}>
            {/* World Book Section */}
            <WorldBookSection 
              entries={worldBookEntries}
              onAdd={handleAddWorldBookEntry}
              onUpdate={handleUpdateWorldBookEntry}
              onReorder={handleReorderWorldBook}
              onViewDetail={handleViewDetail}
            />
            
            {/* Author Note Section */}
            <AuthorNoteSection
              content={authorNote.content || ''}
              injection_depth={authorNote.injection_depth || 0}
              onUpdateContent={(text) => {
                setAuthorNote(prev => ({ ...prev, content: text }));
                setHasUnsavedChanges(true);
              }}
              onUpdateDepth={(depth) => {
                setAuthorNote(prev => ({ ...prev, injection_depth: depth }));
                setHasUnsavedChanges(true);
              }}
              onViewDetail={handleViewDetail}
            />
            
            {/* Preset Section */}
            <PresetSection
              entries={presetEntries}
              onAdd={handleAddPresetEntry}
              onUpdate={handleUpdatePresetEntry}
              onMove={handleMoveEntry}
              onReorder={handleReorderPresets}
              onViewDetail={handleViewDetail}
            />
          </View>
        )}
      </ScrollView>
      
      {/* Bottom Actions Bar - match character-detail */}
      <BlurView intensity={30} tint="dark" style={styles.bottomBar}>
        <ActionButton
          title="取消"
          icon="close-outline"
          onPress={handleBackPress}
          color="#666666"
          style={styles.cancelButton}
        />
        
        <ActionButton
          title="创建角色"
          icon="save-outline"
          onPress={saveCharacter}
          loading={isSaving}
          color={theme.colors.primary}
          style={styles.saveButton}
        />
      </BlurView>
      
      {/* Detail Sidebar for expanded editing */}
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
        name={selectedField?.name}
        onNameChange={selectedField?.onNameChange}
      />
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={showConfirmDialog}
        title="放弃更改"
        message="您有未保存的更改，确定要离开吗？"
        confirmText="放弃更改"
        cancelText="继续编辑"
        confirmAction={() => {
          setShowConfirmDialog(false);
          router.back();
        }}
        cancelAction={() => setShowConfirmDialog(false)}
        destructive={true}
        icon="alert-circle-outline"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#aaaaaa',
  },
  activeTabText: {
    color: theme.colors.text,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  attributeSection: {
    marginTop: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  saveButton: {
    flex: 2,
  },
});

export default CreateChar;

