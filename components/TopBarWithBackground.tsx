import React from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Character } from '@/constants/types';

const windowHeight = Dimensions.get('window').height;

const defaultAvatar = require('@/assets/images/default-avatar.png'); // 添加默认头像

interface TopBarWithBackgroundProps {
  selectedCharacter: Character | null | undefined;
  onAvatarPress: () => void;
  onMemoPress: () => void;
  onSettingsPress: () => void;
  onMenuPress: () => void;
}

const TopBarWithBackground = ({
  selectedCharacter,
  onAvatarPress,
  onMemoPress,
  onSettingsPress,
  onMenuPress,
}: TopBarWithBackgroundProps) => {
  // 获取头像源
  const getAvatarSource = () => {
    if (typeof selectedCharacter?.avatar === 'string') {
      return { uri: selectedCharacter.avatar };
    }
    return defaultAvatar;
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <ImageBackground
          source={
            selectedCharacter?.backgroundImage
              ? { uri: selectedCharacter.backgroundImage }
              : require('@/assets/images/default-background.jpeg')
          }
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.overlay} />
        <View style={styles.topBar}>
          <View style={styles.characterInfo}>
            <TouchableOpacity onPress={onAvatarPress}>
              <Image
                source={getAvatarSource()}
                style={styles.avatar}
              />
            </TouchableOpacity>
            <View style={styles.nameContainer}>
              <Text style={styles.charName}>{selectedCharacter?.name || "未选择角色"}</Text>
            </View>
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.iconButton} onPress={onMemoPress}>
              <Icon name="note-add" size={24} color="#4A4A4A" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onSettingsPress}>
              <Icon name="settings" size={24} color="#4A4A4A" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
              <Icon name="menu" size={24} color="#4A4A4A" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: windowHeight, // 使用固定的窗口高度
    zIndex: -1,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 40,
    zIndex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 10,
  },
  charName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: 'black',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',

  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 224, 195, 0.7)',
    marginHorizontal: 2,
  },
  characterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 224, 195, 0.7)', // 半透明红色背景
    borderRadius: 25,
    padding: 4,
    paddingRight: 16,
  },
  nameContainer: {
    marginLeft: 10,
    // 移除 flex: 1，避免不必要的拉伸
  },
});

export default TopBarWithBackground;
