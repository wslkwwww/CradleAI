import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { Picker } from '@react-native-picker/picker';
import { POSITION_OPTIONS, INSERT_TYPE_OPTIONS, ROLE_OPTIONS } from './CharacterFormComponents';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

interface DetailSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onContentChange?: (newContent: string) => void;
  editable?: boolean;
  entryType?: 'worldbook' | 'preset' | 'author_note';
  entryOptions?: {
    position?: number;
    insertType?: string;
    role?: string;
    depth?: number;
    key?: string[];
  };
  onOptionsChange?: (options: any) => void;
}

export default function DetailSidebar({ 
  isVisible, 
  onClose, 
  title, 
  content,
  onContentChange,
  editable = true,
  entryType,
  entryOptions = {},
  onOptionsChange
}: DetailSidebarProps) {
  const translateX = React.useRef(new Animated.Value(WINDOW_WIDTH)).current;
  const [editedContent, setEditedContent] = useState(content);
  
  // Local state for options
  const [position, setPosition] = useState(entryOptions.position || 4);
  const [insertType, setInsertType] = useState(entryOptions.insertType || 'relative');
  const [role, setRole] = useState(entryOptions.role || 'user');
  const [depth, setDepth] = useState(entryOptions.depth || 0);
  const [keyWords, setKeyWords] = useState(entryOptions.key?.join(', ') || '');

  useEffect(() => {
    setEditedContent(content);
    
    // Update local state when entryOptions change
    if (entryOptions) {
      setPosition(entryOptions.position ?? 4);
      setInsertType(entryOptions.insertType || 'relative');
      setRole(entryOptions.role || 'user');
      setDepth(entryOptions.depth || 0);
      setKeyWords(entryOptions.key?.join(', ') || '');
    }
  }, [content, entryOptions]);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isVisible ? 0 : WINDOW_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const handleContentChange = (text: string) => {
    setEditedContent(text);
    onContentChange?.(text);
  };

  const handleSave = () => {
    // Prepare options to send back
    if (onOptionsChange) {
      const options: any = {};
      
      if (entryType === 'worldbook') {
        options.position = position;
        options.depth = position === 4 ? depth : undefined;
        options.key = keyWords.split(',').map(k => k.trim()).filter(k => k);
      } else if (entryType === 'preset') {
        options.insertType = insertType;
        options.role = role;
        options.depth = insertType === 'chat' ? depth : undefined;
      } else if (entryType === 'author_note') {
        options.injection_depth = depth;
      }
      
      onOptionsChange(options);
    }
    
    // Save content
    onContentChange?.(editedContent);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateX }] }
      ]}
    >
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={handleSave}
          >
            <MaterialIcons name="save" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Content editing area */}
          <Text style={styles.sectionLabel}>内容</Text>
          {editable ? (
            <TextInput
              style={styles.contentInput}
              value={editedContent}
              onChangeText={handleContentChange}
              multiline
              textAlignVertical="top"
              placeholder="在此输入内容..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          ) : (
            <Text style={styles.contentText}>{content}</Text>
          )}
          
          {/* Entry-specific options */}
          {editable && entryType === 'worldbook' && (
            <View style={styles.optionsContainer}>
              <Text style={styles.sectionLabel}>插入位置</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={position}
                  onValueChange={(value) => setPosition(Number(value))}
                  style={styles.picker}
                  dropdownIconColor={theme.colors.text}
                >
                  {POSITION_OPTIONS.map(option => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      color={theme.colors.text}
                    />
                  ))}
                </Picker>
              </View>
              
              {position === 4 && (
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>插入深度:</Text>
                  <TextInput
                    style={styles.depthInput}
                    value={String(depth)}
                    onChangeText={(text) => setDepth(parseInt(text) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                </View>
              )}
              
              <Text style={styles.sectionLabel}>触发关键词</Text>
              <TextInput
                style={styles.keywordsInput}
                value={keyWords}
                onChangeText={setKeyWords}
                placeholder="用逗号分隔多个关键词"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>
          )}
          
          {editable && entryType === 'preset' && (
            <View style={styles.optionsContainer}>
              <Text style={styles.sectionLabel}>插入位置</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={insertType}
                  onValueChange={setInsertType}
                  style={styles.picker}
                  dropdownIconColor={theme.colors.text}
                >
                  {INSERT_TYPE_OPTIONS.map(option => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      color={theme.colors.text}
                    />
                  ))}
                </Picker>
              </View>
              
              <Text style={styles.sectionLabel}>角色</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={role}
                  onValueChange={setRole}
                  style={styles.picker}
                  dropdownIconColor={theme.colors.text}
                >
                  {ROLE_OPTIONS.map(option => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      color={theme.colors.text}
                    />
                  ))}
                </Picker>
              </View>
              
              {insertType === 'chat' && (
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>插入深度:</Text>
                  <TextInput
                    style={styles.depthInput}
                    value={String(depth)}
                    onChangeText={(text) => setDepth(parseInt(text) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                </View>
              )}
            </View>
          )}
          
          {entryType === 'author_note' && (
            <View style={styles.optionsContainer}>
              <Text style={styles.sectionLabel}>设置</Text>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>插入深度:</Text>
                <TextInput
                  style={styles.depthInput}
                  value={String(depth)}
                  onChangeText={(text) => setDepth(parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: theme.colors.background,
    zIndex: 1000,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? theme.spacing.lg : theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.lg,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  contentText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    lineHeight: 24,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  saveButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  contentInput: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    lineHeight: 24,
    minHeight: 200,
    textAlignVertical: 'top',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: theme.spacing.md,
  },
  optionsContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionLabel: {
    color: theme.colors.primary,
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pickerContainer: {
    backgroundColor: '#000000',
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  picker: {
    color: theme.colors.text,
    backgroundColor: '#000000',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  optionLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    marginRight: theme.spacing.md,
  },
  depthInput: {
    width: 80,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  keywordsInput: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  }
});
