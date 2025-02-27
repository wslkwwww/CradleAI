import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CradleFeedModalProps {
  visible: boolean;
  onClose: () => void;
}

const CradleFeedModal: React.FC<CradleFeedModalProps> = ({
  visible,
  onClose,
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState('');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    console.log('Submitted:', { image, text });
    setImage(null);
    setText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>投喂摇篮</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.imageUpload} 
              onPress={pickImage}
              activeOpacity={0.7}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholder}>
                  <MaterialIcons name="add-photo-alternate" size={40} color="#666" />
                  <Text style={styles.placeholderText}>添加图片</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              multiline
              placeholder="描述一下你的兴趣..."
              placeholderTextColor="#666"
              value={text}
              onChangeText={setText}
            />

            <TouchableOpacity 
              style={[
                styles.submitButton,
                (!image && !text) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!image && !text}
            >
              <Text style={styles.submitButtonText}>确认投喂</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#282828',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  imageUpload: {
    height: 200,
    backgroundColor: '#333',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    height: 120,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: 'rgb(255, 224, 195)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CradleFeedModal;
