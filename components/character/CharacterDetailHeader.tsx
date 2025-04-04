import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface CharacterDetailHeaderProps {
  name: string;
  backgroundImage: string | null;
  onBackgroundPress: () => void;
  onBackPress: () => void;
  onFullscreenPress?: () => void;
}

const { width } = Dimensions.get('window');

const CharacterDetailHeader: React.FC<CharacterDetailHeaderProps> = ({
  name,
  backgroundImage,
  onBackgroundPress,
  onBackPress,
  onFullscreenPress
}) => {
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.backgroundContainer} 
        onPress={onBackgroundPress}
        activeOpacity={0.9}
      >
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
            
            {onFullscreenPress && (
              <TouchableOpacity 
                style={styles.fullscreenButton} 
                onPress={onFullscreenPress}
              >
                <Ionicons name="expand-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}

            <Text style={styles.characterName}>{name}</Text>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    height: 180,
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
  fullscreenButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default CharacterDetailHeader;
