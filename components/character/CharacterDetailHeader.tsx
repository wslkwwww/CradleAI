import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface CharacterDetailHeaderProps {
  name: string;
  avatar: string | null;
  backgroundImage: string | null;
  onAvatarPress: () => void;
  onBackgroundPress: () => void;
  onBackPress: () => void;
}

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.35;

const CharacterDetailHeader: React.FC<CharacterDetailHeaderProps> = ({
  name,
  avatar,
  backgroundImage,
  onAvatarPress,
  onBackgroundPress,
  onBackPress,
}) => {
  return (
    <View style={styles.header}>
      <ImageBackground
        source={
          backgroundImage
            ? { uri: backgroundImage }
            : require('@/assets/images/default-background.jpeg')
        }
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)', 'transparent']}
          style={styles.gradientOverlay}
        />

        <BlurView intensity={10} tint="dark" style={styles.blurContainer}>
          <View style={styles.contentContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.profileContainer}>
              <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
                <Image
                  source={
                    avatar
                      ? { uri: avatar }
                      : require('@/assets/images/default-avatar.png')
                  }
                  style={styles.avatar}
                />
                <View style={styles.editAvatarButton}>
                  <Ionicons name="camera" size={16} color="#282828" />
                </View>
              </TouchableOpacity>

              <Text style={styles.characterName}>{name || '未命名角色'}</Text>

              <TouchableOpacity
                style={styles.changeBackgroundButton}
                onPress={onBackgroundPress}
              >
                <Ionicons name="image" size={14} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>更换背景图</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 70,
    zIndex: 2,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 50,
  },
  backButton: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#282828',
  },
  characterName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  changeBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  buttonIcon: {
    marginRight: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default CharacterDetailHeader;
