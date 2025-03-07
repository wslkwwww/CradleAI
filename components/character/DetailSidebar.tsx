import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Alert,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { POSITION_OPTIONS } from './CharacterFormComponents';
import { theme } from '@/constants/theme';

interface EntryOptions {
  position?: number;
  constant?: boolean;
  depth?: number;
  insertType?: 'relative' | 'chat';
  role?: 'user' | 'model';
  injection_depth?: number;
  [key: string]: any;
}

interface DetailSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onContentChange?: (text: string) => void;
  editable?: boolean;
  entryType?: 'worldbook' | 'preset' | 'author_note';
  entryOptions?: EntryOptions;
  onOptionsChange?: (options: any) => void;
  name?: string;
  onNameChange?: (text: string) => void;
}

const DetailSidebar: React.FC<DetailSidebarProps> = ({
  isVisible,
  onClose,
  title,
  content,
  onContentChange,
  editable = true,
  entryType,
  entryOptions,
  onOptionsChange,
  name = '',
  onNameChange,
}) => {
  // Base state
  const [editableContent, setEditableContent] = useState(content);
  const [localOptions, setLocalOptions] = useState<EntryOptions>(entryOptions || {});
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  // Update local state when props change
  useEffect(() => {
    setEditableContent(content);
  }, [content]);

  // Sync localOptions with entryOptions
  useEffect(() => {
    if (entryOptions) {
      setLocalOptions(entryOptions);
    }
  }, [entryOptions]);
  
  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Handle save action
  const handleSave = () => {
    if (onContentChange) {
      onContentChange(editableContent);
    }
    
    setIsEditMode(false);
    setIsExpanded(false);
    onClose();
  };

  // Handle cancel action
  const handleCancel = () => {
    setEditableContent(content);
    setIsEditMode(false);
    setIsExpanded(false);
    onClose();
  };

  // Handle option updates
  const handleOptionUpdate = useCallback((key: string, value: any) => {
    // Update local state immediately for UI response
    setLocalOptions((prev: EntryOptions) => ({
      ...prev,
      [key]: value
    }));
    
    // Also update parent state
    if (onOptionsChange) {
      onOptionsChange({ ...localOptions, [key]: value });
    }
  }, [onOptionsChange, localOptions]);

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    
    // Focus the text input when entering edit mode
    if (!isEditMode && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };
  
  // Toggle expanded mode
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Existing option renderers (WorldBook, Preset, AuthorNote)
  const renderWorldbookOptions = () => {
    if (entryType === 'worldbook' && localOptions) {
      return (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>条目选项</Text>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>位置:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.positionsContainer}
            >
              {POSITION_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.positionOption,
                    localOptions.position === option.value && styles.selectedPosition
                  ]}
                  onPress={() => handleOptionUpdate('position', option.value)}
                >
                  <Text style={[
                    styles.positionText,
                    localOptions.position === option.value && styles.selectedPositionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>固定:</Text>
            <TouchableOpacity
              style={styles.toggleOption}
              onPress={() => handleOptionUpdate('constant', !localOptions.constant)}
            >
              <MaterialCommunityIcons
                name={localOptions.constant ? "toggle-switch" : "toggle-switch-off"}
                size={36}
                color={localOptions.constant ? "#64D2FF" : "#666"}
              />
              <Text style={styles.toggleText}>
                {localOptions.constant ? "已固定" : "未固定"}
              </Text>
            </TouchableOpacity>
          </View>
          
          {localOptions.position === 4 && (
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>深度:</Text>
              <View style={styles.depthInputContainer}>
                <TouchableOpacity
                  style={styles.depthButton}
                  onPress={() => {
                    const newDepth = Math.max(0, (localOptions.depth || 0) - 1);
                    handleOptionUpdate('depth', newDepth);
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.depthInput}
                  value={String(localOptions.depth || 0)}
                  onChangeText={(value) => {
                    const depth = parseInt(value);
                    if (!isNaN(depth) && depth >= 0) {
                      handleOptionUpdate('depth', depth);
                    }
                  }}
                  keyboardType="number-pad"
                />
                
                <TouchableOpacity
                  style={styles.depthButton}
                  onPress={() => {
                    const newDepth = (localOptions.depth || 0) + 1;
                    handleOptionUpdate('depth', newDepth);
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  const renderPresetOptions = () => {
    if (entryType === 'preset' && localOptions && editable) {
      return (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>预设条目选项</Text>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>插入类型:</Text>
            <View style={styles.buttonGroupContainer}>
              <TouchableOpacity 
                style={[
                  styles.insertTypeButton, 
                  localOptions.insertType === 'relative' && styles.selectedInsertType
                ]}
                onPress={() => handleOptionUpdate('insertType', 'relative')}
              >
                <Text style={[
                  styles.insertTypeText,
                  localOptions.insertType === 'relative' && styles.selectedInsertTypeText
                ]}>
                  相对
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.insertTypeButton, 
                  localOptions.insertType === 'chat' && styles.selectedInsertType
                ]}
                onPress={() => handleOptionUpdate('insertType', 'chat')}
              >
                <Text style={[
                  styles.insertTypeText,
                  localOptions.insertType === 'chat' && styles.selectedInsertTypeText
                ]}>
                  聊天中
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>角色:</Text>
            <View style={styles.buttonGroupContainer}>
              <TouchableOpacity 
                style={[
                  styles.roleButton, 
                  localOptions.role === 'user' && styles.selectedRole
                ]}
                onPress={() => handleOptionUpdate('role', 'user')}
              >
                <Text style={[
                  styles.roleText,
                  localOptions.role === 'user' && styles.selectedRoleText
                ]}>
                  用户
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.roleButton, 
                  localOptions.role === 'model' && styles.selectedRole
                ]}
                onPress={() => handleOptionUpdate('role', 'model')}
              >
                <Text style={[
                  styles.roleText,
                  localOptions.role === 'model' && styles.selectedRoleText
                ]}>
                  AI助手
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {localOptions.insertType === 'chat' && (
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>插入深度:</Text>
              <View style={styles.depthInputContainer}>
                <TouchableOpacity
                  style={styles.depthButton}
                  onPress={() => {
                    const newDepth = Math.max(0, (localOptions.depth || 0) - 1);
                    handleOptionUpdate('depth', newDepth);
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.depthInput}
                  value={String(localOptions.depth || 0)}
                  onChangeText={(value) => {
                    const depth = parseInt(value);
                    if (!isNaN(depth) && depth >= 0) {
                      handleOptionUpdate('depth', depth);
                    }
                  }}
                  keyboardType="number-pad"
                />
                
                <TouchableOpacity
                  style={styles.depthButton}
                  onPress={() => {
                    const newDepth = (localOptions.depth || 0) + 1;
                    handleOptionUpdate('depth', newDepth);
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  const renderAuthorNoteOptions = () => {
    if (entryType === 'author_note' && localOptions) {
      return (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>作者注释选项</Text>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>插入深度:</Text>
            <View style={styles.depthInputContainer}>
              <TouchableOpacity
                style={styles.depthButton}
                onPress={() => {
                  const newDepth = Math.max(0, (localOptions.injection_depth || 0) - 1);
                  handleOptionUpdate('injection_depth', newDepth);
                }}
              >
                <MaterialCommunityIcons name="minus" size={20} color="#fff" />
              </TouchableOpacity>
              
              <TextInput
                style={styles.depthInput}
                value={String(localOptions.injection_depth || 0)}
                onChangeText={(value) => {
                  const depth = parseInt(value);
                  if (!isNaN(depth) && depth >= 0) {
                    handleOptionUpdate('injection_depth', depth);
                  }
                }}
                keyboardType="number-pad"
              />
              
              <TouchableOpacity
                style={styles.depthButton}
                onPress={() => {
                  const newDepth = (localOptions.injection_depth || 0) + 1;
                  handleOptionUpdate('injection_depth', newDepth);
                }}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
      statusBarTranslucent={isExpanded}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[
            styles.modalContainer,
            isExpanded && styles.modalContainerExpanded
          ]}>
            <View style={[
              styles.sidebar,
              isExpanded && styles.sidebarExpanded
            ]}>
              {/* Header with actions */}
              <View style={styles.header}>
                <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                  <MaterialCommunityIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                
                <View style={styles.headerActions}>
                  {editable && (
                    <>
                      <TouchableOpacity 
                        onPress={toggleExpanded} 
                        style={styles.actionButton}
                      >
                        <MaterialCommunityIcons 
                          name={isExpanded ? "arrow-collapse" : "arrow-expand"} 
                          size={22} 
                          color={theme.colors.primary} 
                        />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        onPress={toggleEditMode} 
                        style={[
                          styles.actionButton,
                          isEditMode && styles.activeActionButton
                        ]}
                      >
                        <MaterialCommunityIcons 
                          name="pencil" 
                          size={22} 
                          color={isEditMode ? "#000" : theme.colors.primary} 
                        />
                      </TouchableOpacity>
                    </>
                  )}
                  
                  <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                    <MaterialCommunityIcons name="content-save" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Main content area */}
              <ScrollView 
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                scrollEventThrottle={16}
                ref={scrollViewRef}
              >
                {/* Content section */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>内容</Text>
                    {editable && !isEditMode && (
                      <TouchableOpacity 
                        onPress={toggleEditMode}
                        style={styles.editButton}
                      >
                        <Text style={styles.editButtonText}>编辑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {isEditMode ? (
                    <View style={[
                      styles.textInputWrapper,
                      isExpanded && styles.textInputWrapperExpanded
                    ]}>
                      <TextInput
                        ref={textInputRef}
                        style={[
                          styles.textInput,
                          isExpanded && styles.textInputExpanded
                        ]}
                        value={editableContent}
                        onChangeText={setEditableContent}
                        multiline
                        textAlignVertical="top"
                        placeholder="输入内容..."
                        placeholderTextColor="#888"
                        scrollEnabled={true}
                        editable={editable && isEditMode}
                      />
                    </View>
                  ) : (
                    // Improved scrollable content view
                    <ScrollView 
                      style={[
                        styles.contentView,
                        isExpanded && styles.contentViewExpanded
                      ]}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      scrollEnabled={true}
                      contentContainerStyle={{ flexGrow: 1 }}
                    >
                      <Text style={styles.contentText}>
                        {editableContent || '暂无内容'}
                      </Text>
                    </ScrollView>
                  )}
                </View>
                
                {/* Options sections */}
                {renderWorldbookOptions()}
                {renderPresetOptions()}
                {renderAuthorNoteOptions()}
              </ScrollView>
              
              {/* Removed bottom bar */}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainerExpanded: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebar: {
    width: WINDOW_WIDTH * 0.8,
    height: WINDOW_HEIGHT * 0.7,
    backgroundColor: '#333',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  sidebarExpanded: {
    width: WINDOW_WIDTH * 0.95,
    height: WINDOW_HEIGHT * 0.85,
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
    marginHorizontal: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 5,
    borderRadius: 16,
  },
  activeActionButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
  },
  editButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  textInputWrapper: {
    backgroundColor: '#444',
    borderRadius: 10,
    minHeight: 150,
    maxHeight: 300,
  },
  textInputWrapperExpanded: {
    minHeight: 300,
    maxHeight: WINDOW_HEIGHT * 0.5,
  },
  textInput: {
    color: '#fff',
    padding: 15,
    minHeight: 150,
    maxHeight: 300,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24,
  },
  textInputExpanded: {
    minHeight: 300,
    maxHeight: WINDOW_HEIGHT * 0.5,
    fontSize: 18,
    lineHeight: 26,
  },
  contentView: {
    backgroundColor: 'rgba(60,60,60,0.5)',
    borderRadius: 10,
    padding: 15,
    minHeight: 150,
    maxHeight: 300,
  },
  contentViewExpanded: {
    minHeight: 300,
    maxHeight: WINDOW_HEIGHT * 0.6, // Increased max height
    height: WINDOW_HEIGHT * 0.5, // Fixed height for better scrolling
  },
  contentText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bottomBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(60,60,60,0.8)',
    marginHorizontal: 5,
  },
  saveBarButton: {
    backgroundColor: theme.colors.primary,
    flex: 2,
  },
  bottomBarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Keep other existing styles for options
  optionsContainer: {
    marginBottom: 20,
  },
  optionsTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionLabel: {
    color: '#fff',
    marginRight: 10,
    width: 70,
  },
  positionsContainer: {
    flexDirection: 'row',
  },
  positionOption: {
    padding: 10,
    backgroundColor: '#555',
    borderRadius: 10,
    marginRight: 10,
  },
  selectedPosition: {
    backgroundColor: theme.colors.primary,
  },
  positionText: {
    color: '#fff',
  },
  selectedPositionText: {
    color: '#333',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    color: '#fff',
    marginLeft: 10,
  },
  depthInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  depthButton: {
    padding: 10,
    backgroundColor: '#555',
    borderRadius: 10,
  },
  depthInput: {
    width: 50,
    textAlign: 'center',
    color: '#fff',
    backgroundColor: '#444',
    borderRadius: 10,
    marginHorizontal: 10,
  },
  buttonGroupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insertTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#555',
    borderRadius: 8,
    marginRight: 8,
  },
  selectedInsertType: {
    backgroundColor: theme.colors.primary,
  },
  insertTypeText: {
    color: '#fff',
    fontSize: 14,
  },
  selectedInsertTypeText: {
    color: '#333',
    fontWeight: 'bold',
  },
  roleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#555',
    borderRadius: 8,
    marginRight: 8,
  },
  selectedRole: {
    backgroundColor: theme.colors.primary,
  },
  roleText: {
    color: '#fff',
    fontSize: 14,
  },
  selectedRoleText: {
    color: '#333',
    fontWeight: 'bold',
  },
  inputLabel: {
    color: '#fff',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DetailSidebar;
