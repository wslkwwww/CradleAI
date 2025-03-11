import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { Character } from '@/shared/types';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface ImportToCradleModalProps {
  visible: boolean;
  embedded?: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  isVisible: boolean; 
}

export default function ImportToCradleModal({ 
  visible, 
  embedded = false,
  onClose, 
  onImportSuccess 
}: ImportToCradleModalProps) {
  const { characters, importCharacterToCradle } = useCharacters();
  const [loading, setLoading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [cardImage, setCardImage] = useState<string | null>(null);
  
  // Reset state when modal opens or embedded component mounts
  useEffect(() => {
    if (visible || embedded) {
      setSelectedCharacter(null);
      setBackgroundImage(null);
      setCardImage(null);
    }
  }, [visible, embedded]);
  
  const handleSelectCharacter = (character: Character) => {
    if (selectedCharacter?.id === character.id) {
      setSelectedCharacter(null); // Deselect if already selected
    } else {
      setSelectedCharacter(character);
      // If character has background image, use it
      setBackgroundImage(character.backgroundImage || null);
    }
  };
  
  const handleImport = async () => {
    if (!selectedCharacter) {
      Alert.alert('请选择角色', '请先选择一个角色导入到摇篮系统');
      return;
    }
    
    try {
      setLoading(true);
      
      // Create a modified character with the new background (if changed)
      const characterToImport = backgroundImage !== selectedCharacter.backgroundImage
        ? { ...selectedCharacter, backgroundImage }
        : selectedCharacter;
      
      await importCharacterToCradle(characterToImport.id);
      
      Alert.alert(
        '导入成功', 
        `已成功将角色 ${selectedCharacter.name} 导入到摇篮系统`
      );
      
      if (onImportSuccess) {
        onImportSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error('导入角色失败:', error);
      Alert.alert(
        '导入失败', 
        error instanceof Error ? error.message : '未知错误'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Select or capture background image
  const handleSelectImage = async (useCamera: boolean = false) => {
    try {
      let result;
      
      if (useCamera) {
        // Request camera permissions
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限错误', '需要相机权限才能拍照');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });
      } else {
        // Request media library permissions
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限错误', '需要访问相册的权限才能选择图片');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });
      }
      
      if (!result.canceled && result.assets && result.assets[0]) {
        // Process and set the image
        const processedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1280 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setBackgroundImage(processedImage.uri);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('错误', '选择图片时发生错误');
    }
  };

  // Select card image with 9:16 aspect ratio
  const handleSelectCardImage = async (useCamera: boolean = false) => {
    try {
      let result;
      
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限错误', '需要相机权限才能拍照');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [9, 16],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限错误', '需要访问相册的权限才能选择图片');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [9, 16],
          quality: 0.8,
        });
      }
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const processedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 900, height: 1600 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setCardImage(processedImage.uri);
        setBackgroundImage(processedImage.uri); // Also set as background for compatibility
      }
    } catch (error) {
      console.error('选择角色卡图片失败:', error);
      Alert.alert('错误', '选择角色卡图片失败');
    }
  };

  const renderItem = ({ item }: { item: Character }) => (
    <TouchableOpacity
      style={[
        styles.characterCard,
        selectedCharacter?.id === item.id && styles.selectedCard
      ]}
      onPress={() => handleSelectCharacter(item)}
    >
      <View style={styles.cardContent}>
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Ionicons name="person" size={30} color="#ccc" />
            </View>
          )}
        </View>
        <View style={styles.characterInfo}>
          <Text style={styles.characterName}>{item.name || '未命名角色'}</Text>
          <Text style={styles.characterDescription} numberOfLines={2}>
            {item.description || '无描述'}
          </Text>
        </View>
        {selectedCharacter?.id === item.id && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
  
  const content = (
    <>
      <ScrollView style={embedded ? styles.embeddedScrollContent : styles.scrollContent}>
        <Text style={styles.sectionTitle}>选择角色</Text>
        
        {characters.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sad-outline" size={40} color="#666" />
            <Text style={styles.emptyText}>没有可导入的角色</Text>
          </View>
        ) : (
          <FlatList
            data={characters.filter(char => !char.inCradleSystem)} // Only show characters not already in cradle
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            scrollEnabled={false} // Disable scrolling of FlatList since it's inside ScrollView
          />
        )}
        
        {selectedCharacter && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              角色卡图片
            </Text>
            
            <View style={styles.cardImageContainer}>
              {cardImage ? (
                <Image 
                  source={{ uri: cardImage }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noCardImage}>
                  <Ionicons name="card-outline" size={40} color="#666" />
                  <Text style={styles.noBackgroundText}>无角色卡图片</Text>
                  <Text style={styles.noBackgroundSubtext}>(9:16比例)</Text>
                </View>
              )}
            </View>
            
            <View style={styles.imageButtonsRow}>
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={() => handleSelectCardImage(false)}
              >
                <Ionicons name="images-outline" size={20} color="#fff" />
                <Text style={styles.imageButtonText}>选择图片</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={() => handleSelectCardImage(true)}
              >
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.imageButtonText}>拍摄照片</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      
      <View style={embedded ? styles.embeddedFooter : styles.footer}>
        <TouchableOpacity 
          style={[
            styles.importButton,
            (!selectedCharacter || loading) && styles.disabledButton
          ]}
          onPress={handleImport}
          disabled={!selectedCharacter || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.importButtonText}>导入到摇篮系统</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
  
  // If embedded mode is enabled, render directly without a modal
  if (embedded) {
    return (
      <View style={styles.embeddedContainer}>
        <Text style={styles.embeddedTitle}>导入角色到摇篮系统</Text>
        {content}
      </View>
    );
  }
  
  // Otherwise render as a modal
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>导入角色到摇篮系统</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {content}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#282828',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    maxHeight: '70%',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContainer: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  characterCard: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  selectedCard: {
    backgroundColor: '#3a4563',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  placeholderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterInfo: {
    flex: 1,
  },
  characterName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  characterDescription: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  backgroundImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#444',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  noBackgroundImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noBackgroundText: {
    color: '#666',
    marginTop: 8,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  imageButtonText: {
    color: '#fff',
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#444',
    backgroundColor: '#333',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
  },
  importButtonText: {
    color: '#fff',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.7,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    marginTop: 8,
  },
  // Add embedded mode styles
  embeddedContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#282828',
  },
  embeddedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  embeddedScrollContent: {
    flex: 1,
  },
  embeddedFooter: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  cardImageContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#444',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  noCardImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noBackgroundSubtext: {
    color: '#555',
    fontSize: 12,
    marginTop: 4,
  },
});
