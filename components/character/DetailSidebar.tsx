import React, { useState, useEffect } from 'react';
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
  TouchableWithoutFeedback
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { POSITION_OPTIONS } from './CharacterFormComponents';

interface DetailSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onContentChange?: (text: string) => void;
  editable?: boolean;
  entryType?: 'worldbook' | 'preset' | 'author_note';
  entryOptions?: any;
  onOptionsChange?: (options: any) => void;
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
  onOptionsChange
}) => {
  const [editableContent, setEditableContent] = useState(content);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    setEditableContent(content);
  }, [content]);

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

  const handleSave = () => {
    if (onContentChange) {
      onContentChange(editableContent);
    }
    onClose();
  };

  const updateOption = (key: string, value: any) => {
    if (onOptionsChange && entryOptions) {
      onOptionsChange({ ...entryOptions, [key]: value });
    }
  };

  const renderWorldbookOptions = () => {
    if (entryType === 'worldbook' && entryOptions) {
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
                    entryOptions.position === option.value && styles.selectedPosition
                  ]}
                  onPress={() => updateOption('position', option.value)}
                >
                  <Text style={[
                    styles.positionText,
                    entryOptions.position === option.value && styles.selectedPositionText
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
              onPress={() => updateOption('constant', !entryOptions.constant)}
            >
              <MaterialCommunityIcons
                name={entryOptions.constant ? "toggle-switch" : "toggle-switch-off"}
                size={36}
                color={entryOptions.constant ? "#64D2FF" : "#666"}
              />
              <Text style={styles.toggleText}>
                {entryOptions.constant ? "已固定" : "未固定"}
              </Text>
            </TouchableOpacity>
          </View>
          
          {entryOptions.position === 4 && (
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>深度:</Text>
              <View style={styles.depthInputContainer}>
                <TouchableOpacity
                  style={styles.depthButton}
                  onPress={() => {
                    const newDepth = Math.max(0, (entryOptions.depth || 0) - 1);
                    updateOption('depth', newDepth);
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.depthInput}
                  value={String(entryOptions.depth || 0)}
                  onChangeText={(value) => {
                    const depth = parseInt(value);
                    if (!isNaN(depth) && depth >= 0) {
                      updateOption('depth', depth);
                    }
                  }}
                  keyboardType="number-pad"
                />
                
                <TouchableOpacity
                  style={styles.depthButton}
                  onPress={() => {
                    const newDepth = (entryOptions.depth || 0) + 1;
                    updateOption('depth', newDepth);
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
    if (entryType === 'author_note' && entryOptions) {
      return (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>作者注释选项</Text>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>插入深度:</Text>
            <View style={styles.depthInputContainer}>
              <TouchableOpacity
                style={styles.depthButton}
                onPress={() => {
                  const newDepth = Math.max(0, (entryOptions.injection_depth || 0) - 1);
                  updateOption('injection_depth', newDepth);
                }}
              >
                <MaterialCommunityIcons name="minus" size={20} color="#fff" />
              </TouchableOpacity>
              
              <TextInput
                style={styles.depthInput}
                value={String(entryOptions.injection_depth || 0)}
                onChangeText={(value) => {
                  const depth = parseInt(value);
                  if (!isNaN(depth) && depth >= 0) {
                    updateOption('injection_depth', depth);
                  }
                }}
                keyboardType="number-pad"
              />
              
              <TouchableOpacity
                style={styles.depthButton}
                onPress={() => {
                  const newDepth = (entryOptions.injection_depth || 0) + 1;
                  updateOption('injection_depth', newDepth);
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
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalContainer}>
          <View style={styles.sidebar}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                <MaterialCommunityIcons name="content-save" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.content}>
              {editable ? (
                <TextInput
                  style={styles.textInput}
                  value={editableContent}
                  onChangeText={setEditableContent}
                  multiline
                  placeholder="输入内容..."
                  placeholderTextColor="#888"
                />
              ) : (
                <Text style={styles.text}>{content}</Text>
              )}
              {renderWorldbookOptions()}
              {renderAuthorNoteOptions()}
            </ScrollView>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sidebar: {
    width: WINDOW_WIDTH * 0.8,
    height: WINDOW_HEIGHT,
    backgroundColor: '#333',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 10,
  },
  title: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    padding: 10,
  },
  content: {
    flex: 1,
  },
  textInput: {
    backgroundColor: '#444',
    color: '#fff',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  text: {
    color: '#fff',
    marginBottom: 20,
  },
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
    backgroundColor: '#64D2FF',
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
});

export default DetailSidebar;
