import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import ShimmerPlaceholder from '../ShimmerPlaceholder';

interface AttributeEditorProps {
  title: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: ViewStyle;
  maxLength?: number;
  loading?: boolean;
  showFullscreen?: boolean;
  onFullscreenPress?: () => void;
}

const CharacterAttributeEditor: React.FC<AttributeEditorProps> = ({
  title,
  value,
  onChangeText,
  placeholder = '请输入内容...',
  multiline = true,
  style,
  maxLength,
  loading = false,
  showFullscreen = true,
  onFullscreenPress,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [textHeight, setTextHeight] = useState(100);
  
  const handleContentSizeChange = (event: any) => {
    if (multiline) {
      setTextHeight(Math.max(100, event.nativeEvent.contentSize.height));
    }
  };
  
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {maxLength && (
            <Text style={styles.counter}>{value.length}/{maxLength}</Text>
          )}
        </View>
        
        {showFullscreen && onFullscreenPress && (
          <TouchableOpacity 
            style={styles.fullscreenButton}
            onPress={onFullscreenPress}
          >
            <Ionicons name="expand-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      
      <ShimmerPlaceholder
        visible={!loading}
        style={styles.inputContainer}
        shimmerColors={['#333', '#444', '#333']}
      >
        <View 
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            multiline={multiline}
            style={[
              styles.input, 
              multiline && { height: textHeight }
            ]}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onContentSizeChange={handleContentSizeChange}
            maxLength={maxLength}
            textAlignVertical="top"
          />
        </View>
      </ShimmerPlaceholder>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginRight: 8,
  },
  counter: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  fullscreenButton: {
    padding: 5,
  },
  inputContainer: {
    backgroundColor: 'rgba(60, 60, 60, 0.5)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  input: {
    color: theme.colors.text,
    fontSize: 15,
    padding: 12,
    minHeight: 100,
  },
});

export default CharacterAttributeEditor;
