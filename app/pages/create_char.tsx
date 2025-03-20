import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system'; // Fix: Correct FileSystem import
import * as DocumentPicker from 'expo-document-picker'; // Fix: Correct DocumentPicker import
import { useRouter } from 'expo-router';
import { Character, CradleCharacter } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { useUser } from '@/constants/UserContext';
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
  WorldBookSection,
  PresetSection,
  AuthorNoteSection
} from '@/components/character/CharacterSections';
import DetailSidebar from '@/components/character/DetailSidebar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CharacterImporter } from '@/utils/CharacterImporter';
import CharacterAttributeEditor from '@/components/character/CharacterAttributeEditor';
import { Ionicons } from '@expo/vector-icons';
import TagSelector from '@/components/TagSelector';
import ArtistReferenceSelector from '@/components/ArtistReferenceSelector';
import { theme } from '@/constants/theme';
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

interface CreateCharProps {
  activeTab?: 'basic' | 'advanced';
  creationMode?: 'manual' | 'auto';
  allowTagImageGeneration?: boolean;
}

const CreateChar: React.FC<CreateCharProps> = ({ activeTab: initialActiveTab = 'basic' }) => {
  const router = useRouter();
  const { addCharacter, addConversation,} = useCharacters();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  
  // Character and role card state
  const [character, setCharacter] = useState<Character & Partial<CradleCharacter>>({
    id: '',
    name: '',
    avatar: null,
    backgroundImage: null,
    conversationId: '',
    description: '',
    personality: '',
    interests: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Add cradle system fields
    inCradleSystem: true,
    cradleStatus: 'growing',
    feedHistory: [],
    cradleCreatedAt: Date.now(),
    cradleUpdatedAt: Date.now()
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
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>(initialActiveTab);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add ref to track unsaved changes for back button handling
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  
  // Update the ref when hasUnsavedChanges changes
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);
  
  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      if (hasUnsavedChangesRef.current) {
        setShowConfirmDialog(true);
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  // Update activeTab when initialActiveTab changes
  useEffect(() => {
    setActiveTab(initialActiveTab);
  }, [initialActiveTab]);

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
        aspect: [9, 16],
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

  // Add tag-based image generation support
  const [uploadMode, setUploadMode] = useState<'upload' | 'generate'>('upload');
  const [positiveTags, setPositiveTags] = useState<string[]>([]);
  const [negativeTags, setNegativeTags] = useState<string[]>([]);
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);
  const [selectedArtistPrompt, setSelectedArtistPrompt] = useState<string | null>(null);

  // Saving character - update to include cradle fields
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
  
      // Create cradle character specific properties
      const cradleFields = {
        inCradleSystem: true,
        cradleStatus: 'growing' as 'growing' | 'mature' | 'ready',
        cradleCreatedAt: Date.now(),
        cradleUpdatedAt: Date.now(),
        feedHistory: [],
        // Flag to indicate this character is editable via dialog
        isDialogEditable: true,
        // Store appearance tags even though we're not generating images
        ...(positiveTags.length > 0 ? {
          generationData: {
            appearanceTags: {
              positive: positiveTags,
              negative: negativeTags,
              artistPrompt: selectedArtistPrompt || undefined
            }
          }
        } : {})
      };
  
      // 创建新角色对象 - include cradle fields
      const newCharacter: Character & Partial<CradleCharacter> = {
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
        jsonData: JSON.stringify(jsonData),
        // Add cradle-specific fields
        ...cradleFields
      };
  
      // 保存角色和创建会话
      await addCharacter(newCharacter);
      await addConversation({
        id: characterId,
        title: roleCard.name.trim()
      });
  
      // 设置为当前会话
      await AsyncStorage.setItem('lastConversationId', characterId);
  
      // Always use the standard flow since we're not generating images
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
                disable: entry.disable, // Correctly use disable from import
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

          // Handle preset entries - COMPLETELY REPLACE default presets
          if (data.preset?.prompts && data.replaceDefaultPreset) {
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
              enable: prompt.enable ?? true, // Correctly map enable property from import
              depth: prompt.injection_depth || 0
            }));
            
            // Completely replace all preset entries
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

  // Add a new function for preset import
  const handleImportPreset = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
  
      if (!result.assets || !result.assets[0]) {
        return;
      }
  
      console.log('[Preset Import] File selected:', result.assets[0].name);
      
      try {
        const fileUri = result.assets[0].uri;
        // Fix: Use FileSystem.cacheDirectory properly
        const cacheUri = `${FileSystem.cacheDirectory}${result.assets[0].name}`;
        
        // Fix: Use FileSystem.copyAsync properly
        await FileSystem.copyAsync({
          from: fileUri,
          to: cacheUri
        });
  
        const presetJson = await CharacterImporter.importPresetForCharacter(cacheUri, 'temp');
        
        if (presetJson && presetJson.prompts) {
          // Clear existing presets completely
          const importedEntries = presetJson.prompts.map((prompt: any, index: number) => ({
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
            enable: prompt.enable ?? true, // Use enable property directly from import
            depth: prompt.injection_depth || 0
          }));
          
          // Replace all preset entries
          setPresetEntries(importedEntries);
          
          Alert.alert('成功', '预设导入成功');
          setHasUnsavedChanges(true);
        }
      } catch (error) {
        console.error('[Preset Import] Error:', error);
        Alert.alert('导入失败', error instanceof Error ? error.message : '未知错误');
      }
    } catch (error) {
      console.error('[Preset Import] Document picker error:', error);
      Alert.alert('错误', '选择文件失败');
    }
  };

  // Enhance the tag-based image section with more feedback about tag storage
  const renderTagGenerationSection = () => (
    <View style={styles.tagGenerateContainer}>
      <Text style={styles.tagInstructionsText}>
        请选择描述角色外观的正面和负面标签，这些标签将被保存作为角色描述的一部分
      </Text>
      
      {/* Update note about cradle system integration */}
      <View style={styles.cradleInfoContainer}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.info} />
        <Text style={styles.cradleInfoText}>
          选择的标签将保存为角色的外观描述数据，但不会自动生成图像
        </Text>
      </View>
      
      {/* Add artist reference selector */}
      <ArtistReferenceSelector 
        selectedGender={character.gender as 'male' | 'female' | 'other'}
        onSelectArtist={setSelectedArtistPrompt}
        selectedArtistPrompt={selectedArtistPrompt}
      />
      
      {/* Tag selection summary */}
      <View style={styles.tagSummaryContainer}>
        <Text style={styles.tagSummaryTitle}>已选标签</Text>
        <View style={styles.selectedTagsRow}>
          {positiveTags.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {positiveTags.map((tag, index) => (
                <TouchableOpacity
                  key={`pos-${index}`}
                  style={styles.selectedPositiveTag}
                  onPress={() => {
                    setPositiveTags(tags => tags.filter(t => t !== tag));
                  }}
                >
                  <Text style={styles.selectedTagText} numberOfLines={1}>{tag}</Text>
                  <Ionicons name="close-circle" size={14} color="rgba(0,0,0,0.5)" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noTagsSelectedText}>未选择正面标签</Text>
          )}
        </View>
        
        <View style={styles.selectedTagsRow}>
          {negativeTags.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {negativeTags.map((tag, index) => (
                <TouchableOpacity
                  key={`neg-${index}`}
                  style={styles.selectedNegativeTag}
                  onPress={() => {
                    setNegativeTags(tags => tags.filter(t => t !== tag));
                  }}
                >
                  <Text style={styles.selectedTagText} numberOfLines={1}>{tag}</Text>
                  <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noTagsSelectedText}>未选择负面标签</Text>
          )}
        </View>
        
        {/* Add hint for tag use */}
        <Text style={styles.defaultTagsInfo}>
          选择的标签仅用于保存角色外观描述，不会触发图像生成
        </Text>
      </View>
      
      {/* Open tag selector button */}
      <TouchableOpacity 
        style={styles.openTagSelectorButton}
        onPress={() => setTagSelectorVisible(true)}
      >
        <Ionicons name="pricetag-outline" size={20} color="#fff" />
        <Text style={styles.openTagSelectorText}>浏览标签并添加</Text>
      </TouchableOpacity>
    </View>
  );

  // Update the renderContent function to use the improved styling matching CradleCreateForm
  const renderContent = () => {
    if (activeTab === 'basic') {
      return (
        <View style={styles.tabContent}>
          <Text style={styles.sectionTitle}>角色外观</Text>
          
          {/* Mode selection with improved styling to match CradleCreateForm */}
          <View style={styles.modeSelectionContainer}>
            <TouchableOpacity 
              style={[styles.modeButton, uploadMode === 'upload' && styles.activeMode]}
              onPress={() => setUploadMode('upload')}
            >
              <View style={styles.modeIconContainer}>
                <Ionicons 
                  name="cloud-upload-outline" 
                  size={24} 
                  color={uploadMode === 'upload' ? theme.colors.primary : "#888"}
                />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={[styles.modeText, uploadMode === 'upload' && styles.activeModeText]}>
                  自己上传图片
                </Text>
                <Text style={styles.modeDescription}>
                  上传您准备好的角色形象图片
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modeButton, uploadMode === 'generate' && styles.activeMode]}
              onPress={() => setUploadMode('generate')}
            >
              <View style={styles.modeIconContainer}>
                <Ionicons 
                  name="color-wand-outline" 
                  size={24} 
                  color={uploadMode === 'generate' ? theme.colors.primary : "#888"} 
                />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={[styles.modeText, uploadMode === 'generate' && styles.activeModeText]}>
                  根据Tag生成图片
                </Text>
                <Text style={styles.modeDescription}>
                  通过组合标签生成符合需求的角色形象
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Render content based on selected mode */}
          {uploadMode === 'upload' ? (
            <View style={styles.uploadContainer}>
              <View style={styles.cardPreviewSection}>
                <Text style={styles.inputLabel}>角色卡图片 (9:16)</Text>
                <View style={styles.cardImageContainer}>
                  <TouchableOpacity
                    style={styles.cardImagePicker}
                    onPress={pickBackgroundImage}
                  >
                    {character.backgroundImage ? (
                      <Image source={{ uri: character.backgroundImage }} style={styles.cardImagePreview} />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={40} color="#aaa" />
                        <Text style={styles.imageButtonText}>添加角色卡图片</Text>
                        <Text style={styles.imageButtonSubtext}>(9:16比例)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                
                <View style={styles.imageSeparator}>
                  <View style={styles.imageSeparatorLine} />
                  <Text style={styles.imageSeparatorText}>或</Text>
                  <View style={styles.imageSeparatorLine} />
                </View>
                
                {/* Avatar selection */}
                <Text style={styles.inputLabel}>头像图片 (方形)</Text>
                <View style={styles.imageSelectionContainer}>
                  <TouchableOpacity
                    style={styles.avatarButton}
                    onPress={pickAvatar}
                  >
                    {character.avatar ? (
                      <Image source={{ uri: character.avatar }} style={styles.avatarPreview} />
                    ) : (
                      <>
                        <Ionicons name="person-circle-outline" size={40} color="#aaa" />
                        <Text style={styles.imageButtonText}>添加头像</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            renderTagGenerationSection()
          )}

          {/* Tag selector modal */}
          <Modal
            visible={tagSelectorVisible}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setTagSelectorVisible(false)}
          >
            <View style={styles.tagSelectorModalContainer}>
              <View style={styles.tagSelectorHeader}>
                <Text style={styles.tagSelectorTitle}>选择标签</Text>
                <TouchableOpacity 
                  style={styles.tagSelectorCloseButton}
                  onPress={() => setTagSelectorVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.tagSelectorContent}>
                <TagSelector 
                  onClose={() => setTagSelectorVisible(false)}
                  onAddPositive={(tag) => setPositiveTags(prev => [...prev, tag])}
                  onAddNegative={(tag) => setNegativeTags(prev => [...prev, tag])}
                  existingPositiveTags={positiveTags}
                  existingNegativeTags={negativeTags}
                  onPositiveTagsChange={setPositiveTags}
                  onNegativeTagsChange={setNegativeTags}
                  sidebarWidth="auto"
                />
              </View>
            </View>
          </Modal>
        </View>
      );
    } else {
      return (
        <View style={styles.tabContent}>
          {/* Character basic information section */}
          <Text style={styles.sectionTitle}>角色信息</Text>
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

          <WorldBookSection
            entries={worldBookEntries}
            onAdd={handleAddWorldBookEntry}
            onUpdate={handleUpdateWorldBookEntry}
            onViewDetail={handleViewDetail}
            onReorder={handleReorderWorldBook}
          />
          
          {/* Modify PresetSection to include import functionality */}
          <View style={styles.presetSectionHeader}>
            <Text style={styles.sectionTitle}>预设设定</Text>
            <TouchableOpacity 
              style={styles.importPresetButton}
              onPress={handleImportPreset}
            >
              <Ionicons name="cloud-download-outline" size={16} color="#FFD700" />
              <Text style={styles.importPresetText}>导入预设</Text>
            </TouchableOpacity>
          </View>
          <PresetSection
            entries={presetEntries}
            onAdd={handleAddPresetEntry}
            onUpdate={handleUpdatePresetEntry}
            onMove={handleMoveEntry}
            onViewDetail={handleViewDetail}
            onReorder={handleReorderPresets}
          />
          
          <AuthorNoteSection
            content={authorNote.content || ''}
            injection_depth={authorNote.injection_depth || 0}
            onUpdateContent={(content) => {
              setAuthorNote(prev => ({ ...prev, content }));
              setHasUnsavedChanges(true);
            }}
            onUpdateDepth={(depth) => {
              setAuthorNote(prev => ({ ...prev, injection_depth: depth }));
              setHasUnsavedChanges(true);
            }}
            onViewDetail={handleViewDetail}
          />
        </View>
      );
    }
  };

  // Update styles to match CradleCreateForm and use theme colors consistently
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
    },
    sidebarContainer: {
      width: 80,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRightWidth: 1,
      borderRightColor: 'rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    sidebarNavItems: {
      flex: 1,
    },
    sidebarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginBottom: 8,
      borderRadius: 8,
      borderLeftWidth: 2,
      borderLeftColor: 'transparent',
    },
    activeSidebarItem: {
      backgroundColor: 'rgba(255, 224, 195, 0.1)',
      borderLeftColor: theme.colors.primary,
    },
    sidebarItemText: {
      color: theme.colors.textSecondary,
      marginLeft: 8,
      fontSize: 13,
    },
    activeSidebarItemText: {
      color: theme.colors.primary,
    },
    sidebarSaveButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.primaryDark,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      alignSelf: 'center',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 80, // Extra padding for scrolling at bottom
    },
    tabContent: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
    },
    uploadContainer: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
    },
    cardPreviewSection: {
      alignItems: 'center',
      width: '100%',
      marginBottom: 20,
    },
    // Avatar, card image, and image selection styles
    imageSelectionContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 16, 
    },
    avatarButton: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },
    avatarPreview: {
      width: '100%',
      height: '100%',
      borderRadius: 60,
    },
    cardImageContainer: {
      width: 120,
      height: 200,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: theme.colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardImagePicker: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardImagePreview: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    imageButtonText: {
      color: theme.colors.textSecondary,
      marginTop: 8,
      fontSize: 12,
      textAlign: 'center',
    },
    imageButtonSubtext: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    imageSeparator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
      width: '100%',
    },
    imageSeparatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    imageSeparatorText: {
      color: theme.colors.textSecondary,
      marginHorizontal: 8,
    },
    inputLabel: {
      color: theme.colors.text,
      fontSize: 16,
      marginBottom: 8,
    },
    // Mode selection styles to match CradleCreateForm
    modeSelectionContainer: {
      marginBottom: 16,
    },
    modeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: theme.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    activeMode: {
      backgroundColor: 'rgba(255, 224, 195, 0.1)',
      borderColor: theme.colors.primary,
    },
    modeIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    modeTextContainer: {
      flex: 1,
    },
    modeText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    activeModeText: {
      color: theme.colors.primary,
    },
    modeDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    // Tag generation styles to match CradleCreateForm
    tagGenerateContainer: {
      flex: 1,
      padding: 16,
    },
    tagInstructionsText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginBottom: 16,
    },
    tagSummaryContainer: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 8,
      padding: 12,
      marginVertical: 16,
    },
    tagSummaryTitle: {
      color: theme.colors.text,
      fontSize: 16,
      marginBottom: 8,
    },
    selectedTagsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 36,
      marginBottom: 8,
    },
    selectedPositiveTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: 16,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginRight: 8,
    },
    selectedNegativeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.danger,
      borderRadius: 16,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginRight: 8,
    },
    selectedTagText: {
      fontSize: 12,
      marginRight: 4,
      maxWidth: 100,
      color: theme.colors.black, // For positive tags with light background
    },
    noTagsSelectedText: {
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    defaultTagsInfo: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 8,
      textAlign: 'center',
    },
    openTagSelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryDark,
      borderRadius: 8,
      padding: 12,
      marginVertical: 8,
    },
    openTagSelectorText: {
      color: theme.colors.black,
      marginLeft: 8,
      fontWeight: '500',
    },
    // Tag selector modal styles
    tagSelectorModalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    tagSelectorHeader: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
      position: 'relative',
      paddingTop: Platform.OS === 'ios' ? 44 : 16,
    },
    tagSelectorTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    tagSelectorCloseButton: {
      position: 'absolute',
      right: 16,
      top: Platform.OS === 'ios' ? 44 : 16,
      padding: 4,
    },
    tagSelectorContent: {
      flex: 1,
    },
    // Add styles for the cradle info container
    cradleInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      padding: 12,
      borderRadius: 8,
      marginTop: 16,
    },
    cradleInfoText: {
      flex: 1,
      color: theme.colors.info,
      fontSize: 13,
      marginLeft: 8,
      lineHeight: 18,
    },
    attributeSection: {
      marginTop: 16,
    },
    presetSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    importPresetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(224, 196, 168, 0.2)', // Updated to use primaryDark with opacity
    },
    importPresetText: {
      color: theme.colors.primary, // Updated to use theme colors
      marginLeft: 4,
      fontSize: 12,
    },
  });

  // For embedded usage in tabs, we'll now use the sidebar pattern similar to CradleCreateForm
  return (
    <View style={styles.container}>
      <View style={styles.sidebarContainer}>
        {/* Sidebar Navigation Items */}
        <View style={styles.sidebarNavItems}>
          <TouchableOpacity 
            style={[
              styles.sidebarItem,
              activeTab === 'basic' && styles.activeSidebarItem
            ]}
            onPress={() => setActiveTab('basic')}
          >
            <Ionicons 
              name="document-outline"
              size={24} 
              color={activeTab === 'basic' ? theme.colors.primary : theme.colors.textSecondary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.sidebarItem,
              activeTab === 'advanced' && styles.activeSidebarItem
            ]}
            onPress={() => setActiveTab('advanced')}
          >
            <Ionicons 
              name="settings-outline"
              size={24} 
              color={activeTab === 'advanced' ? theme.colors.primary : theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Save button in sidebar style */}
        <TouchableOpacity
          style={styles.sidebarSaveButton}
          onPress={saveCharacter}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.black} />
          ) : (
            <Ionicons name="save-outline" size={18} color={theme.colors.black} />
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
      >
        {renderContent()}
      </ScrollView>
      
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
    </View>
  );
};

export default CreateChar;

