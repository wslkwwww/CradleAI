import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  Image,
  TextInput
} from 'react-native';
import { Character, CirclePost } from '@/shared/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ForwardSheetProps {
  isVisible: boolean;
  onClose: () => void;
  characters: Character[];
  post: CirclePost;
  onForward: (characterId: string, message: string) => void;
}

const ForwardSheet: React.FC<ForwardSheetProps> = ({
  isVisible,
  onClose,
  characters,
  post,
  onForward
}) => {
  const [additionalMessage, setAdditionalMessage] = useState('');
  const router = useRouter();

  const handleForward = async (character: Character) => {
    // Forward the message through callback
    onForward(character.id, additionalMessage);
    
    // Also navigate to the chat with this character
    await AsyncStorage.setItem('lastConversationId', character.id);
    router.replace({
      pathname: "/(tabs)",
      params: { characterId: character.id }
    });
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.headerText}>转发到聊天</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.postPreview}>
            <Text style={styles.postAuthor}>{post.characterName}:</Text>
            <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input}
              placeholder="添加评论..."
              placeholderTextColor="#999"
              value={additionalMessage}
              onChangeText={setAdditionalMessage}
              multiline={true}
              numberOfLines={3}
            />
          </View>

          <Text style={styles.sectionTitle}>选择角色</Text>
          <FlatList
            data={characters}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.characterItem}
                onPress={() => handleForward(item)}
              >
                <Image
                  source={item.avatar ? { uri: String(item.avatar) } : require('@/assets/images/default-avatar.png')}
                  style={styles.characterAvatar}
                />
                <Text style={styles.characterName}>{item.name}</Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.charactersList}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetContainer: {
    backgroundColor: '#333',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  postPreview: {
    backgroundColor: '#444',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  postAuthor: {
    color: '#FF9ECD',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  postContent: {
    color: '#fff',
  },
  inputContainer: {
    backgroundColor: '#444',
    borderRadius: 10,
    marginBottom: 20,
  },
  input: {
    padding: 15,
    color: '#fff',
    height: 80,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 10,
  },
  charactersList: {
    paddingVertical: 10,
  },
  characterItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  characterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 5,
  },
  characterName: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
  },
  selectedCharacterText: {
    color: '#FF9ECD',
    fontWeight: 'bold',
  },
  checkIconContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#333',
    borderRadius: 12,
  },
  forwardButton: {
    backgroundColor: '#FF9ECD',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  forwardButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ForwardSheet;