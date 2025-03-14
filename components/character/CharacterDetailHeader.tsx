import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface CharacterDetailHeaderProps {
  name: string;
  avatar: string | null;
  backgroundImage: string | null;
  onAvatarPress: () => void;
  onBackgroundPress: () => void;
  onBackPress: () => void;
  onChatBackgroundPress: () => void;
  onFullscreenPress: () => void;
}

const { width } = Dimensions.get('window');

const CharacterDetailHeader: React.FC<CharacterDetailHeaderProps> = ({
  name,
  avatar,
  backgroundImage,
  onAvatarPress,
  onBackgroundPress,
  onBackPress
}) => {
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity style={styles.backgroundContainer} onPress={onBackgroundPress}>
        <ImageBackground
          source={
            backgroundImage
              ? { uri: backgroundImage }
              : require('@/assets/images/default-background.png')
          }
          style={styles.backgroundImage}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            style={styles.gradient}
          >
            <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <TouchableOpacity style={styles.avatarContainer} onPress={onAvatarPress}>
                <Image
                  source={
                    avatar
                      ? { uri: avatar }
                      : require('@/assets/images/default-avatar.png')
                  }
                  style={styles.avatar}
                />
                <View style={styles.editIconContainer}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </TouchableOpacity>

              <Text style={styles.characterName}>{name}</Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    height: 200,
  },
  backgroundContainer: {
    flex: 1,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CharacterDetailHeader;
