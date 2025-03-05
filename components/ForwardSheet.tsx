import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  Image,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Character, CirclePost } from '@/shared/types';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';

const { height } = Dimensions.get('window');

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
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Open animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Close animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, fadeAnim]);

  const handleCharacterSelect = (characterId: string) => {
    setSelectedCharacter(prev => prev === characterId ? null : characterId);
  };

  const handleForward = async () => {
    if (selectedCharacter) {
      setIsForwarding(true);
      try {
        await onForward(selectedCharacter, additionalMessage);
        // Reset state after forwarding
        setAdditionalMessage('');
        setSelectedCharacter(null);
      } catch (error) {
        console.error('Error forwarding message:', error);
      } finally {
        setIsForwarding(false);
      }
    }
  };

  const renderCharacterItem = ({ item }: { item: Character }) => (
    <TouchableOpacity 
      style={[
        styles.characterItem, 
        selectedCharacter === item.id && styles.selectedCharacter
      ]}
      onPress={() => handleCharacterSelect(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image 
          source={item.avatar ? { uri: item.avatar } : require('@/assets/images/default-avatar.png')} 
          style={styles.characterAvatar} 
        />
        {selectedCharacter === item.id && (
          <View style={styles.checkIconContainer}>
            <LinearGradient
              colors={['#FF9ECD', '#FF7BAC']}
              style={styles.checkIconBackground}
            >
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </LinearGradient>
          </View>
        )}
      </View>
      <Text style={[
        styles.characterName,
        selectedCharacter === item.id && styles.selectedCharacterText
      ]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        {/* Backdrop with touch to close */}
        <Animated.View 
          style={[styles.backdrop, { opacity: fadeAnim }]}
        >
          <TouchableOpacity 
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
        
        {/* Sheet Content */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
            <LinearGradient
              colors={['rgba(40, 40, 40, 0.95)', 'rgba(30, 30, 30, 0.98)']}
              style={styles.gradientContainer}
            >
              {/* Handle Bar */}
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>
              
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerText}>转发到聊天</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {/* Post Preview */}
              <View style={styles.postPreview}>
                <View style={styles.posterInfo}>
                  <Image 
                    source={post.characterAvatar 
                      ? { uri: post.characterAvatar } 
                      : require('@/assets/images/default-avatar.png')}
                    style={styles.posterAvatar}
                  />
                  <Text style={styles.postAuthor}>{post.characterName}</Text>
                </View>
                <Text style={styles.postContent}>{post.content}</Text>
                <View style={styles.postMeta}>
                  <Text style={styles.postTime}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.postStats}>
                    <Ionicons name="heart" size={14} color="#999" />
                    <Text style={styles.statText}>{post.likes || 0}</Text>
                    <Ionicons name="chatbubble" size={14} color="#999" style={{ marginLeft: 8 }} />
                    <Text style={styles.statText}>{post.comments?.length || 0}</Text>
                  </View>
                </View>
              </View>
              
              {/* Input Area */}
              <View style={styles.inputContainer}>
                <TextInput 
                  style={styles.input}
                  placeholder="添加评论..."
                  placeholderTextColor="#999"
                  value={additionalMessage}
                  onChangeText={setAdditionalMessage}
                  multiline
                />
              </View>
              
              {/* Character Selection */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>选择角色</Text>
                <Text style={styles.sectionSubtitle}>
                  {selectedCharacter ? '已选择 1 个角色' : '请选择一个角色'}
                </Text>
              </View>
              
              <FlatList
                data={characters}
                renderItem={renderCharacterItem}
                keyExtractor={(item) => item.id}
                numColumns={4}
                contentContainerStyle={styles.charactersList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={42} color="#666" />
                    <Text style={styles.emptyStateText}>
                      暂无可用角色
                    </Text>
                  </View>
                }
              />
              
              {/* Action Button */}
              <TouchableOpacity 
                style={[
                  styles.forwardButton,
                  (!selectedCharacter || isForwarding) && styles.disabledButton
                ]}
                disabled={!selectedCharacter || isForwarding}
                onPress={handleForward}
              >
                {isForwarding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.forwardButtonText}>
                      {selectedCharacter ? '转发' : '请选择角色'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </BlurView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    flex: 1,
  },
  blurContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  gradientContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 8,
  },
  sheetContainer: {
    height: height * 0.8,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  postPreview: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  posterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  posterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  postAuthor: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  postContent: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
  },
  postTime: {
    color: '#999',
    fontSize: 12,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#999',
    fontSize: 13,
  },
  charactersList: {
    paddingVertical: 8,
  },
  characterItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 12,
    marginBottom: 16,
  },
  selectedCharacter: {
    backgroundColor: 'rgba(255, 158, 205, 0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  characterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  characterName: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    maxWidth: 70,
  },
  selectedCharacterText: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  checkIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  checkIconBackground: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  forwardButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 158, 205, 0.4)',
  },
  forwardButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#999',
    marginTop: 8,
    fontSize: 14,
  },
});

export default ForwardSheet;