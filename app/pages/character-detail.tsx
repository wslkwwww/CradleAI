import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Character } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { useUser } from '@/constants/UserContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { 
  RoleCardJson, 
  WorldBookEntry, 
  AuthorNoteJson,
} from '@/shared/types';
import { WorldBookEntryUI, PresetEntryUI } from '@/constants/types';
import { BlurView } from 'expo-blur';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

// Import our new components
import CharacterDetailHeader from '@/components/character/CharacterDetailHeader';
import CharacterAttributeEditor from '@/components/character/CharacterAttributeEditor';
import LoadingIndicator from '@/components/LoadingIndicator';
import ConfirmDialog from '@/components/ConfirmDialog';
import ActionButton from '@/components/ActionButton';
import DetailSidebar from '@/components/character/DetailSidebar';

// Import existing components that we'll continue to use
import { 
  WorldBookSection,
  PresetSection,
  AuthorNoteSection
} from '@/components/character/CharacterSections';
import { POSITION_OPTIONS } from '@/components/character/CharacterFormComponents';

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
  const { characters, updateCharacter } = useCharacters();
  const { user } = useUser();

  const [character, setCharacter] = useState<Character | null>(null);
  const [roleCard, setRoleCard] = useState<Partial<RoleCardJson>>({
    name: '',
    first_mes: '',
    description: '',
    personality: '',
    scenario: '',
    mes_example: ''
  });
  
  // ... existing state variables ...
  
  const [worldBookEntries, setWorldBookEntries] = useState<WorldBookEntryUI[]>([]);
  const [presetEntries, setPresetEntries] = useState<PresetEntryUI[]>([]);
  const [authorNote, setAuthorNote] = useState<Partial<AuthorNoteJson>>({
    charname: '',
    username: user?.settings?.self.nickname || 'User',
    content: '',
    injection_depth: 0
  });

  // New state variables for the enhanced UI
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedDialogAction, setSelectedDialogAction] = useState<'save' | 'discard' | 'delete' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Add missing selectedField state
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

  // ... existing selectedField state and handlers ...

  useEffect(() => {
    const loadCharacterData = async () => {
      setIsLoading(true);
      try {
        const foundCharacter = characters.find((c) => c.id === id);
        if (!foundCharacter || !foundCharacter.jsonData) {
          throw new Error('Character data not found');
        }
        
        setCharacter(foundCharacter);
        const data = JSON.parse(foundCharacter.jsonData);
        
        // Load roleCard, worldBook, authorNote, preset data...
        // ... existing loading logic ...
        
        setRoleCard(data.roleCard || {});
        setAuthorNote(data.authorNote || {
          charname: '',
          username: user?.settings?.self.nickname || 'User',
          content: '',
          injection_depth: 0
        });

        // Process worldBook entries
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
        
        // Process preset entries
        if (data.preset?.prompts) {
          // ... existing preset processing ...
        }
        
      } catch (error) {
        console.error('Failed to parse character data:', error);
        Alert.alert('错误', '角色数据格式错误');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCharacterData();
  }, [id, characters, user?.settings?.self.nickname]);

  // Avatar and background image picker handlers
  const pickAvatar = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // Process the image to make it square
        const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
          // 修复：使用 Image.getSize 来获取图像尺寸
          Image.getSize(result.assets[0].uri, (w: number, h: number) => {
            resolve({ width: w, height: h });
          }, () => {
            // 添加错误处理函数
            resolve({ width: 300, height: 300 }); // 默认值
          });
        });

        const size = Math.min(width, height);
        const x = (width - size) / 2;
        const y = (height - size) / 2;

        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ crop: { originX: x, originY: y, width: size, height: size } }],
          { format: ImageManipulator.SaveFormat.PNG, compress: 1 }
        );

        if (character) {
          const updatedCharacter = { ...character, avatar: manipResult.uri };
          setCharacter(updatedCharacter);
          setHasUnsavedChanges(true);
        }
      }
    } catch (error) {
      console.error("Image picking error:", error);
      Alert.alert("提示", "请确保选择合适的图片并正确裁剪");
    }
  };

  const pickBackground = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],  // 横向背景图
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        if (character) {
          const updatedCharacter = { 
            ...character, 
            backgroundImage: result.assets[0].uri 
          };
          setCharacter(updatedCharacter);
          setHasUnsavedChanges(true);
        }
      }
    } catch (error) {
      console.error("Background image picking error:", error);
      Alert.alert("错误", "选择背景图片失败");
    }
  };

  const pickChatBackground = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],  // 竖向聊天背景图
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        if (character) {
          const updatedCharacter = {
            ...character,
            chatBackground: result.assets[0].uri
          };
          setCharacter(updatedCharacter);
          setHasUnsavedChanges(true);
        }
      }
    } catch (error) {
      console.error("Chat background picking error:", error);
      Alert.alert("错误", "选择聊天背景失败");
    }
  };

  // Handle role card changes
  const handleRoleCardChange = (field: keyof RoleCardJson, value: string) => {
    setRoleCard(prev => ({ ...prev, [field]: value }));
    
    // Update character name when name field is changed
    if (field === 'name') {
      setAuthorNote(prev => ({ ...prev, charname: value }));
    }
    
    setHasUnsavedChanges(true);
  };

  // Content saving logic
  const saveCharacter = async () => {
    if (!roleCard.name?.trim()) {
      Alert.alert('保存失败', '角色名称不能为空。');
      return;
    }
  
    if (!character || !character.id) {
      Alert.alert('保存失败', '角色ID不存在');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Construct worldBook from worldBookEntries
      const worldBookData = {
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
      };
      
      // Construct presetData with proper handling of insertion types and depths
      const presetData = {
        prompts: presetEntries.map(entry => ({
          name: entry.name,
          content: entry.content || '',
          identifier: entry.identifier,
          enable: entry.enable,
          role: entry.role,
          // Handle insertion type and depth correctly
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
      };
      
      // Construct authorNote data
      const authorNoteData = {
        charname: roleCard.name.trim(),
        username: user?.settings?.self.nickname || "User",
        content: authorNote.content || '',
        injection_depth: authorNote.injection_depth || 0
      };
      
      // Complete JSON data to be saved
      const jsonData = {
        roleCard: {
          ...roleCard,
          name: roleCard.name.trim()
        },
        worldBook: worldBookData,
        preset: presetData,
        authorNote: authorNoteData
      };
      
      // Build updated character object
      const updatedCharacter: Character = {
        ...character,
        name: roleCard.name.trim(),
        description: roleCard.description || '',
        personality: roleCard.personality || '',
        updatedAt: Date.now(),
        jsonData: JSON.stringify(jsonData)
      };
      
      console.log("[CharacterDetail] Saving character with ID:", updatedCharacter.id);
      
      // Save updated character
      await updateCharacter(updatedCharacter);
      
      // Send update to NodeST
      const apiKey = user?.settings?.chat?.characterApiKey || '';
      const apiSettings = user?.settings?.chat;
      
      if (apiKey) {
        console.log("[CharacterDetail] Updating character in NodeST");
        await NodeSTManager.processChatMessage({
          userMessage: "",
          status: "更新人设",
          conversationId: character.id,
          apiKey: apiKey,
          apiSettings: {
            apiProvider: apiSettings?.apiProvider || 'gemini',
            openrouter: apiSettings?.openrouter
          },
          character: updatedCharacter
        });
      }
      
      // Notify user on success
      setHasUnsavedChanges(false);
      Alert.alert('成功', '角色设定已更新');
    } catch (error) {
      console.error('Character update failed:', error);
      Alert.alert('保存失败', error instanceof Error ? error.message : '更新角色时出现错误。');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle back button with unsaved changes warning
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setSelectedDialogAction('discard');
      setShowDialog(true);
    } else {
      router.back();
    }
  };

  // Handle dialog confirmation
  const handleConfirmDialog = () => {
    if (selectedDialogAction === 'save') {
      saveCharacter();
    } else if (selectedDialogAction === 'discard') {
      router.back();
    } else if (selectedDialogAction === 'delete') {
      // Handle character deletion
    }
    
    setShowDialog(false);
    setSelectedDialogAction(null);
  };

  // Add missing handler methods
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

  // Add world book entry handlers
  const handleAddWorldBookEntry = () => {
    const newEntry: WorldBookEntryUI = {
      id: String(Date.now()),
      name: '',
      comment: '',
      content: '',
      disable: false,
      position: 4,
      constant: false,
      key: [],
      depth: 0,
      order: worldBookEntries.length
    };
    setWorldBookEntries(prev => [...prev, newEntry]);
    setHasUnsavedChanges(true);
  };
  
  const handleUpdateWorldBookEntry = (id: string, updates: Partial<WorldBookEntryUI>) => {
    setWorldBookEntries(prev =>
      prev.map(entry => entry.id === id ? { ...entry, ...updates } : entry)
    );
    setHasUnsavedChanges(true);
  };
  
  const handleReorderWorldBook = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    setWorldBookEntries(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      
      // Update the order values
      return result.map((entry, idx) => ({
        ...entry,
        order: idx
      }));
    });
    setHasUnsavedChanges(true);
  };

  // Add preset entry handlers
  const handleAddPresetEntry = () => {
    const newEntry: PresetEntryUI = {
      id: String(Date.now()),
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
      prev.map(entry => entry.id === id ? { ...entry, ...updates } : entry)
    );
    setHasUnsavedChanges(true);
  };
  
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
    setHasUnsavedChanges(true);
  };
  
  const handleReorderPresets = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    setPresetEntries(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      
      return result.map((entry, idx) => ({
        ...entry,
        order: idx
      }));
    });
    setHasUnsavedChanges(true);
  };

  // If still loading data
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <LoadingIndicator 
          visible={true} 
          text="加载角色数据"
          type="animated"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Character Header */}
      <CharacterDetailHeader
        name={roleCard.name || ''}
        avatar={character?.avatar || null}
        backgroundImage={character?.backgroundImage || null}
        onAvatarPress={pickAvatar}
        onBackgroundPress={pickBackground}
        onChatBackgroundPress={pickChatBackground} // 新增聊天背景选择按钮
        onBackPress={handleBack}
      />
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'basic' && styles.activeTab]} 
          onPress={() => setActiveTab('basic')}
        >
          <Text style={[styles.tabText, activeTab === 'basic' && styles.activeTabText]}>基本设定</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'advanced' && styles.activeTab]} 
          onPress={() => setActiveTab('advanced')}
        >
          <Text style={[styles.tabText, activeTab === 'advanced' && styles.activeTabText]}>高级设定</Text>
        </TouchableOpacity>
      </View>
      
      {/* Content Area */}
      <ScrollView style={styles.content}>
        {activeTab === 'basic' ? (
          <View style={styles.tabContent}>
            <CharacterAttributeEditor
              title="开场白"
              value={roleCard.first_mes || ''}
              onChangeText={(text) => handleRoleCardChange('first_mes', text)}
              placeholder="角色与用户的第一次对话内容..."
              onFullscreenPress={() => {
                // Handle fullscreen editor
              }}
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
      
      {/* Bottom Actions Bar */}
      <BlurView intensity={30} tint="dark" style={styles.bottomBar}>
        <ActionButton
          title="取消"
          icon="close-outline"
          onPress={handleBack}
          color="#666666"
          textColor="#000" // Updated text color
          style={styles.cancelButton}
        />
        
        <ActionButton
          title="保存设定"
          icon="save-outline"
          onPress={() => {
            setSelectedDialogAction('save');
            setShowDialog(true);
          }}
          loading={isSaving}
          color="rgb(255, 224, 195)" // 修改：使用米黄色而不是theme.colors.primary
          textColor="#000" // Updated text color
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
        visible={showDialog}
        title={
          selectedDialogAction === 'save' ? '保存设定' :
          selectedDialogAction === 'discard' ? '放弃更改' :
          selectedDialogAction === 'delete' ? '删除角色' : '确认'
        }
        message={
          selectedDialogAction === 'save' ? '确认保存所有更改？' :
          selectedDialogAction === 'discard' ? '您有未保存的更改，确定要离开吗？' :
          selectedDialogAction === 'delete' ? '确定要删除这个角色吗？此操作无法撤销。' : ''
        }
        confirmText={
          selectedDialogAction === 'save' ? '保存' :
          selectedDialogAction === 'discard' ? '放弃更改' :
          selectedDialogAction === 'delete' ? '删除' : '确认'
        }
        cancelText="取消"
        confirmAction={handleConfirmDialog}
        cancelAction={() => setShowDialog(false)}
        destructive={selectedDialogAction === 'delete' || selectedDialogAction === 'discard'}
        icon={
          selectedDialogAction === 'save' ? 'save-outline' :
          selectedDialogAction === 'discard' ? 'alert-circle-outline' :
          selectedDialogAction === 'delete' ? 'trash-outline' : 'help-circle-outline'
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

export default CharacterDetail;
