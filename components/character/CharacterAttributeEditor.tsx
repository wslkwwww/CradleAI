import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CharacterAttributeEditorProps {
  title: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

const CharacterAttributeEditor: React.FC<CharacterAttributeEditorProps> = ({
  title,
  value,
  onChangeText,
  placeholder,
  style,
  multiline = true,
  numberOfLines = 4
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.header} onPress={toggleExpanded}>
        <Text style={styles.title}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#aaa"
        />
      </TouchableOpacity>
      
      {(expanded || !value) ? (
        <TextInput
          style={[
            styles.inputField,
            multiline && { minHeight: numberOfLines * 24 }
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#666"
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? "top" : "center"}
        />
      ) : (
        <TouchableOpacity onPress={toggleExpanded}>
          <Text style={styles.previewText} numberOfLines={2}>
            {value}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#333',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#444',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
    fontSize: 16,
  },
  inputField: {
    color: '#fff',
    padding: 12,
    paddingTop: 12,
    fontSize: 16,
    backgroundColor: '#333',
    borderTopWidth: 1,
    borderTopColor: '#555',
  },
  previewText: {
    color: '#ccc',
    padding: 12,
    fontSize: 14,
  }
});

export default CharacterAttributeEditor;
