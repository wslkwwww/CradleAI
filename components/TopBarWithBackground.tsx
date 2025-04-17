import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import RegexToolModal from '@/components/RegexToolModal';
import MemoryProcessingControl from '@/src/memory/components/MemoryProcessingControl';
import { Group } from '@/src/group/group-types';
import { GroupAvatar } from './GroupAvatar';

interface TopBarWithBackgroundProps {
  selectedCharacter: Character | undefined | null;
  selectedGroup?: Group | null; // Add group prop
  onAvatarPress: () => void;
  onMemoPress: () => void;
  onSettingsPress: () => void;
  onMenuPress: () => void;
  onSaveManagerPress?: () => void;
  showBackground?: boolean;
  isGroupMode?: boolean; // Add flag to indicate group chat mode
}

const HEADER_HEIGHT = 90; // Fixed height for consistency
const { width } = Dimensions.get('window');

const TopBarWithBackground: React.FC<TopBarWithBackgroundProps> = ({
  selectedCharacter,
  selectedGroup,
  onAvatarPress,
  onMemoPress,
  onSettingsPress,
  onMenuPress,
  onSaveManagerPress,
  showBackground = true,
  isGroupMode = false, // Default to character mode
}) => {
  const [scrollY] = useState(new Animated.Value(0));
  const [navbarHeight, setNavbarHeight] = useState(
    Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0
  );
  const [isRegexModalVisible, setIsRegexModalVisible] = useState(false);
  const [isMemoryControlVisible, setIsMemoryControlVisible] = useState(false);

  // Calculate header opacity based on scroll position
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0.85, 1],
    extrapolate: 'clamp',
  });

  // Set up safe area insets
  useEffect(() => {
    if (Platform.OS === 'ios') {
      // On iOS we can use a fixed value for the status bar
      setNavbarHeight(44);
    }
  }, []);

  // Handle memory control button press
  const handleMemoryControlPress = () => {
    setIsMemoryControlVisible(true);
    console.log('[TopBar] Opening memory control panel');
  };

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: headerOpacity,
            height: HEADER_HEIGHT,
            paddingTop: navbarHeight,
          },
        ]}
      >
        {/* Background Image or Gradient */}
        {showBackground && (!isGroupMode ? (selectedCharacter?.backgroundImage ? (
          <Image
            source={
              typeof selectedCharacter.backgroundImage === 'string'
                ? { uri: selectedCharacter.backgroundImage }
                : selectedCharacter.backgroundImage || require('@/assets/images/default-background.jpeg')
            }
            style={styles.backgroundImage}
          />
        ) : (
          <LinearGradient
            colors={['#333', '#282828']}
            style={styles.backgroundGradient}
          />
        )) : (
          <LinearGradient
            colors={['#2c3e50', '#1a2533']}
            style={styles.backgroundGradient}
          />
        ))}

        {/* Blur Overlay */}
        {showBackground && <BlurView intensity={80} style={styles.blurView} tint="dark" />}
        
        {/* Dark Overlay */}
        {showBackground && <View style={styles.overlay} />}

        {/* Content */}
        <View style={styles.content}>
          <TouchableOpacity 
            style={styles.menuButton} 
            onPress={onMenuPress}
          >
            <Ionicons name="menu" size={26} color="#fff" />
          </TouchableOpacity>

          <View style={styles.characterInfo}>
            <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={onAvatarPress}
            >
              {isGroupMode && selectedGroup ? (
                <View style={styles.groupAvatarWrapper}>
                  <GroupAvatar
                    members={[]} // Get members from character data based on group member IDs 
                    size={40}
                    maxDisplayed={4}
                  />
                </View>
              ) : (
                <Image
                  source={
                    selectedCharacter?.avatar
                      ? { uri: String(selectedCharacter.avatar) }
                      : require('@/assets/images/default-avatar.png')
                  }
                  style={styles.avatar}
                />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.nameContainer}
              onPress={onAvatarPress}
            >
              <Text style={styles.characterName} numberOfLines={1}>
                {isGroupMode 
                  ? (selectedGroup?.groupName || '群聊')
                  : (selectedCharacter?.name || '选择角色')}
              </Text>
              
              {/* Add group topic as subtitle */}
              {isGroupMode && selectedGroup?.groupTopic && (
                <Text style={styles.groupTopic} numberOfLines={1}>
                  {selectedGroup.groupTopic}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            {/* Show memory control button only in character mode */}
            {!isGroupMode && selectedCharacter && (
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleMemoryControlPress}
                accessibilityLabel="Memory Control"
              >
                <MaterialCommunityIcons 
                  name="memory" 
                  size={24} 
                  color="#fff" 
                />
              </TouchableOpacity>
            )}
            
            {/* Show memo button in both modes */}
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={onMemoPress}
            >
              <MaterialCommunityIcons name="notebook-outline" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Show settings button in both modes */}
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={onSettingsPress}
            >
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Show save manager button only in character mode */}
            {!isGroupMode && onSaveManagerPress && (
              <TouchableOpacity onPress={onSaveManagerPress} style={styles.actionButton}>
                <Ionicons name="bookmark-outline" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            
            {/* Show manage button only in group mode */}
            {isGroupMode && (
              <TouchableOpacity onPress={onAvatarPress} style={styles.actionButton}>
                <Ionicons name="people" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
      
      {/* Memory Processing Control Modal - only available in character mode */}
      {!isGroupMode && (
        <MemoryProcessingControl 
          visible={isMemoryControlVisible}
          onClose={() => setIsMemoryControlVisible(false)}
          characterId={selectedCharacter?.id}
          conversationId={selectedCharacter ? `conversation-${selectedCharacter.id}` : undefined}
        />
      )}
      
      {/* Keep the RegexToolModal for use in other screens */}
      <RegexToolModal 
        visible={isRegexModalVisible}
        onClose={() => setIsRegexModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  groupAvatarWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTopic: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backgroundGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  blurView: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark overlay
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  menuButton: {
    padding: 8,
  },
  characterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgb(255, 224, 195)',
  },
  nameContainer: {
    flex: 1,
  },
  characterName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
    position: 'relative',
  },
});

export default TopBarWithBackground;
