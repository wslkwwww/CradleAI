import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Switch,
  Alert,
  Image,
  ScrollView,
  PanResponder,
} from 'react-native';
import { Character } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '@/constants/theme';
import { Picker } from '@react-native-picker/picker';

const SIDEBAR_WIDTH_EXPANDED = 280;
const SWIPE_THRESHOLD = 50; // 向下滑动超过这个距离时关闭侧边栏

interface SettingsSideBarProps {
  isVisible: boolean;
  onClose: () => void;
  selectedCharacter: Character | undefined | null;
}

// Add this interface for CircleInteractionSettings props
interface CircleInteractionSettingsProps {
  character: Character;
  updateCharacter: (character: Character) => Promise<void>;
}

export default function SettingsSidebar({
  isVisible,
  onClose,
  selectedCharacter,
}: SettingsSideBarProps) {
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH_EXPANDED)).current;
  const slideYAnim = useRef(new Animated.Value(0)).current; // 用于向下滑动动画
  const { updateCharacter } = useCharacters();

  const [isPermanentMemoryEnabled, setIsPermanentMemoryEnabled] = useState(selectedCharacter?.memX === 1);
  const [isAutoMessageEnabled, setIsAutoMessageEnabled] = useState(selectedCharacter?.autoMessage || false);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [isCircleInteractionEnabled, setIsCircleInteractionEnabled] = useState(
    selectedCharacter?.circleInteraction || false
  );

  // 处理滑动手势
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        // 仅处理向下滑动
        if (gestureState.dy > 0) {
          slideYAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // 如果向下滑动超过阈值，关闭侧边栏
        if (gestureState.dy > SWIPE_THRESHOLD) {
          // 先完成滑动动画
          Animated.timing(slideYAnim, {
            toValue: 300, // 设置一个足够大的值让侧边栏滑出屏幕
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            // 动画完成后调用关闭回调
            onClose();
            // 重置Y轴位置
            slideYAnim.setValue(0);
          });
        } else {
          // 如果没超过阈值，恢复原位
          Animated.spring(slideYAnim, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Sync states with character properties
  useEffect(() => {
    setIsPermanentMemoryEnabled(selectedCharacter?.memX === 1);
    setIsAutoMessageEnabled(selectedCharacter?.autoMessage || false);
    setIsCircleInteractionEnabled(selectedCharacter?.circleInteraction || false);
  }, [selectedCharacter]);

  // Handle sidebar animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : SIDEBAR_WIDTH_EXPANDED,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // 重置Y轴位置
    if (isVisible) {
      slideYAnim.setValue(0);
    }
  }, [isVisible]);

  const handleMemoryToggle = async () => {
    if (selectedCharacter) {
      const updatedCharacter = {
        ...selectedCharacter,
        memX: isPermanentMemoryEnabled ? 0 : 1,
      };
      await updateCharacter(updatedCharacter);
      setIsPermanentMemoryEnabled(!isPermanentMemoryEnabled);
    }
  };

  const handleAutoMessageToggle = async () => {
    if (selectedCharacter) {
      const updatedCharacter = {
        ...selectedCharacter,
        autoMessage: !isAutoMessageEnabled
      };
      await updateCharacter(updatedCharacter);
      setIsAutoMessageEnabled(!isAutoMessageEnabled);
    }
  };

  const handleCircleInteractionToggle = async () => {
    if (selectedCharacter) {
      const updatedCharacter = {
        ...selectedCharacter,
        circleInteraction: !isCircleInteractionEnabled
      };
      await updateCharacter(updatedCharacter);
      setIsCircleInteractionEnabled(!isCircleInteractionEnabled);
    }
  };

  const handleBackgroundChange = async () => {
    if (!selectedCharacter) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const updatedCharacter = {
          ...selectedCharacter,
          backgroundImage: result.assets[0].uri,
        };
        await updateCharacter(updatedCharacter);
        Alert.alert('Success', 'Chat background image has been updated');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update background image');
    }
  };

  const CircleInteractionSettings: React.FC<CircleInteractionSettingsProps> = ({ character, updateCharacter }) => {
    const handleToggleCircleInteraction = (value: boolean) => {
      // 默认值设置
      const updates: Partial<Character> = {
        circleInteraction: value,
      };
      
      // 如果是开启状态，设置默认频率
      if (value) {
        Object.assign(updates, {
          circlePostFrequency: character.circlePostFrequency || 'medium',
          circleInteractionFrequency: character.circleInteractionFrequency || 'medium',
          circleStats: character.circleStats || {
            repliedToCharacters: {},
            repliedToPostsCount: 0,
            repliedToCommentsCount: {}
          }
        });
      }
      
      updateCharacter({
        ...character,
        ...updates
      });
    };
    
    const handleFrequencyChange = (type: 'circlePostFrequency' | 'circleInteractionFrequency', value: 'low' | 'medium' | 'high') => {
      updateCharacter({
        ...character,
        [type]: value
      });
    };
    
    const getFrequencyDescription = (type: 'circlePostFrequency' | 'circleInteractionFrequency', value: string | undefined) => {
      if (type === 'circlePostFrequency') {
        switch (value) {
          case 'low': return '低 (1次/天)';
          case 'medium': return '中 (3次/天)';
          case 'high': return '高 (5次/天)';
          default: return '中';
        }
      } else {
        switch (value) {
          case 'low': return '低';
          case 'medium': return '中';
          case 'high': return '高';
          default: return '中';
        }
      }
    };
    
    return (
      <View style={styles.settingSection}>
        <Text style={styles.settingSectionTitle}>朋友圈互动设置</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>启用朋友圈互动</Text>
          <Switch
            value={character.circleInteraction || false}
            onValueChange={handleToggleCircleInteraction}
            trackColor={{ false: '#767577', true: '#FF9ECD' }}
            thumbColor={character.circleInteraction ? '#FF9ECD' : '#f4f3f4'}
          />
        </View>
        
        {character.circleInteraction && (
          <>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>发布频率</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={character.circlePostFrequency || 'medium'}
                  style={styles.picker}
                  onValueChange={(value) => handleFrequencyChange('circlePostFrequency', value as 'low' | 'medium' | 'high')}
                  dropdownIconColor="#fff"
                >
                  <Picker.Item label="低 (1次/天)" value="low" />
                  <Picker.Item label="中 (3次/天)" value="medium" />
                  <Picker.Item label="高 (5次/天)" value="high" />
                </Picker>
              </View>
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>互动频率</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={character.circleInteractionFrequency || 'medium'}
                  style={styles.picker}
                  onValueChange={(value) => handleFrequencyChange('circleInteractionFrequency', value as 'low' | 'medium' | 'high')}
                  dropdownIconColor="#fff"
                >
                  <Picker.Item label="低" value="low" />
                  <Picker.Item label="中" value="medium" />
                  <Picker.Item label="高" value="high" />
                </Picker>
              </View>
            </View>
            
            <Text style={styles.settingDescription}>
              {`互动频率 ${getFrequencyDescription('circleInteractionFrequency', character.circleInteractionFrequency || 'medium')} 表示：\n`}
              {character.circleInteractionFrequency === 'low' 
                ? '- 最多回复同一角色的朋友圈1次\n- 最多回复5个不同角色的朋友圈\n- 最多回复朋友圈下其他角色的评论1次' 
                : character.circleInteractionFrequency === 'medium'
                  ? '- 最多回复同一角色的朋友圈3次\n- 最多回复5个不同角色的朋友圈\n- 最多回复朋友圈下其他角色的评论3次'
                  : '- 最多回复同一角色的朋友圈5次\n- 最多回复7个不同角色的朋友圈\n- 最多回复朋友圈下其他角色的评论5次'
              }
            </Text>
          </>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.sidebar,
        {
          transform: [
            { translateX: slideAnim },
            { translateY: slideYAnim }
          ],
          width: SIDEBAR_WIDTH_EXPANDED,
          right: 0,
          left: 'auto',
        },
      ]}
    >
      {/* 添加滑动手势处理区域 */}
      <View 
        style={styles.swipeHandle}
        {...panResponder.panHandlers}
      >
        <View style={styles.handleBar} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.settingsContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>角色设置</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>永久记忆</Text>
          <Switch
            value={isPermanentMemoryEnabled}
            onValueChange={handleMemoryToggle}
            trackColor={{ false: '#767577', true: '#FFD1DC' }}
            thumbColor={isPermanentMemoryEnabled ? '#FF9ECD' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>主动消息</Text>
          <Switch
            value={isAutoMessageEnabled}
            onValueChange={handleAutoMessageToggle}
            trackColor={{ false: '#767577', true: '#FFD1DC' }}
            thumbColor={isAutoMessageEnabled ? '#FF9ECD' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>消息提醒</Text>
          <Switch
            value={isNotificationEnabled}
            onValueChange={setIsNotificationEnabled}
            trackColor={{ false: '#767577', true: '#FFD1DC' }}
            thumbColor={isNotificationEnabled ? '#FF9ECD' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>朋友圈互动</Text>
          <Switch
            value={isCircleInteractionEnabled}
            onValueChange={handleCircleInteractionToggle}
            trackColor={{ false: '#767577', true: '#FFD1DC' }}
            thumbColor={isCircleInteractionEnabled ? '#FF9ECD' : '#f4f3f4'}
          />
        </View>

        <TouchableOpacity
          style={styles.backgroundButton}
          onPress={handleBackgroundChange}
        >
          <MaterialIcons name="image" size={24} color="#4A4A4A" />
          <Text style={styles.backgroundButtonText}>更换背景</Text>
        </TouchableOpacity>

        {selectedCharacter && (
          <CircleInteractionSettings character={selectedCharacter} updateCharacter={updateCharacter} />
        )}
        
        {/* 添加一些底部间距 */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {isVisible && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    position: 'absolute',
    backgroundColor: "rgba(0, 0, 0, 0.66)",
    zIndex: 1000,
    height: '100%',
    ...theme.shadows.medium,
  },
  scrollView: {
    flex: 1,
  },
  settingsContainer: {
    paddingTop: 10, // Reduced from previous padding to account for swipe handle
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 20,
  },
  swipeHandle: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40, // 顶部安全区域
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 5,
  },
  bottomPadding: {
    height: 30, // 添加底部额外空间
  },
  settingLabel: {
    fontSize: 16,
    color: "black",
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: SIDEBAR_WIDTH_EXPANDED,
    height: '100%',
    width: Dimensions.get('window').width - SIDEBAR_WIDTH_EXPANDED,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.small,
    marginBottom: theme.spacing.sm,
  },
  backgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  backgroundButtonText: {
    fontSize: 16,
    color: '#4A4A4A',
    fontWeight: '500',
  },
  settingSection: {
    marginTop: 20,
  },
  settingSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.small,
    marginBottom: theme.spacing.sm,
  },
  pickerContainer: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  picker: {
    height: 40,
    color: theme.colors.text,
  },
  settingDescription: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
});

