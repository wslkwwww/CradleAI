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
  const [isRelationshipEnabled, setIsRelationshipEnabled] = useState(
    selectedCharacter?.relationshipEnabled || false
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
    setIsRelationshipEnabled(selectedCharacter?.relationshipEnabled || false);
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
      
      // Show a hint if enabling circle interaction
      if (!isCircleInteractionEnabled) {
        Alert.alert(
          '提示', 
          '已启用朋友圈互动功能，角色将能够发布、点赞和评论朋友圈内容。',
          [{ text: '确定', style: 'default' }]
        );
      }
    }
  };
  
  const handleRelationshipToggle = async () => {
    if (selectedCharacter) {
      const updatedCharacter = {
        ...selectedCharacter,
        relationshipEnabled: !isRelationshipEnabled
      };
      await updateCharacter(updatedCharacter);
      setIsRelationshipEnabled(!isRelationshipEnabled);
      
      // Show a hint if enabling relationship system
      if (!isRelationshipEnabled) {
        Alert.alert(
          '提示', 
          '已启用关系系统功能，角色将能够与其他角色建立和发展关系。',
          [{ text: '确定', style: 'default' }]
        );
      }
    }
  };

  const handleBackgroundChange = async () => {
    if (!selectedCharacter) return;

    try {
      // 直接进入选择聊天背景的流程，不再弹出选择对话框
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16], // 竖向聊天背景图
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const updatedCharacter = {
          ...selectedCharacter,
          chatBackground: result.assets[0].uri,
        };
        
        await updateCharacter(updatedCharacter);
        Alert.alert('成功', '聊天背景已更新');
      }
    } catch (error) {
      console.error("Background update error:", error);
      Alert.alert('错误', '无法更新背景图片');
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
          <View style={styles.pickerContainer}>
            <Text style={styles.settingLabel}>发布频率</Text>
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
          <View style={styles.pickerContainer}>
            <Text style={styles.settingLabel}>互动频率</Text>
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
            trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }} // 修改：使用米黄色
            thumbColor={isPermanentMemoryEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'} // 修改：使用米黄色
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>主动消息</Text>
          <Switch
            value={isAutoMessageEnabled}
            onValueChange={handleAutoMessageToggle}
            trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }} // 修改：使用米黄色
            thumbColor={isAutoMessageEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'} // 修改：使用米黄色
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>消息提醒</Text>
          <Switch
            value={isNotificationEnabled}
            onValueChange={setIsNotificationEnabled}
            trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }} // 修改：使用米黄色
            thumbColor={isNotificationEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'} // 修改：使用米黄色
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>朋友圈互动</Text>
          <Switch
            value={isCircleInteractionEnabled}
            onValueChange={handleCircleInteractionToggle}
            trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }} // 修改：使用米黄色
            thumbColor={isCircleInteractionEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'} // 修改：使用米黄色
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>关系系统</Text>
          <Switch
            value={isRelationshipEnabled}
            onValueChange={handleRelationshipToggle}
            trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }} // 修改：使用米黄色
            thumbColor={isRelationshipEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'} // 修改：使用米黄色
          />
        </View>

        <TouchableOpacity
          style={styles.backgroundButton}
          onPress={handleBackgroundChange}
        >
          <MaterialIcons name="image" size={24} color="#fff" />
          <Text style={styles.backgroundButtonText}>更换聊天背景</Text>
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
    backgroundColor: "rgba(40, 40, 40, 0.9)", // Darker background to match app theme
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
    color: "#fff", // White text for better contrast
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
    color: "rgb(255, 224, 195)", // 修改：使用米黄色
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: 'rgba(60, 60, 60, 0.8)', // Darker item background
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.small,
    marginBottom: theme.spacing.sm,
  },
  backgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60, 60, 60, 0.8)', // Darker button background
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
    color: '#fff', // White text for better contrast
    fontWeight: '500',
  },
  settingSection: {
    marginTop: 20,
  },
  settingSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "rgb(255, 224, 195)", // 修改：使用米黄色
    marginBottom: theme.spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: 'rgba(60, 60, 60, 0.8)', // Darker row background
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
    color: "#fff", // White text for better contrast
  },
  settingDescription: {
    color: '#ccc', // Lighter text for better visibility
    fontSize: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
});

