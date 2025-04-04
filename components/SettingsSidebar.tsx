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
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Character } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '@/constants/theme';
import { Picker } from '@react-native-picker/picker';
import { memoryService } from '@/services/memory-service';
import Slider from '@react-native-community/slider';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Mem0Service from '@/src/memory/services/Mem0Service';

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

// Add this interface for MemorySummarySettings props
interface MemorySummarySettingsProps {
  character: Character;
  updateCharacter: (character: Character) => Promise<void>;
}

// Modified constructor to set notification state from character
export default function SettingsSidebar({
  isVisible,
  onClose,
  selectedCharacter,
}: SettingsSideBarProps) {
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH_EXPANDED)).current;
  const slideYAnim = useRef(new Animated.Value(0)).current; // 用于向下滑动动画
  const { updateCharacter } = useCharacters();

  // Replace isPermanentMemoryEnabled with isMemorySummaryEnabled
  const [isMemorySummaryEnabled, setIsMemorySummaryEnabled] = useState(false);
  const [summaryThreshold, setSummaryThreshold] = useState(6000); // Default: 6000 characters
  const [summaryLength, setSummaryLength] = useState(1000); // Default: 1000 characters
  
  // IMPORTANT: Initialize notification state from character
  const [isAutoMessageEnabled, setIsAutoMessageEnabled] = useState(selectedCharacter?.autoMessage === true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(selectedCharacter?.notificationEnabled === true);
  const [isCircleInteractionEnabled, setIsCircleInteractionEnabled] = useState(
    selectedCharacter?.circleInteraction === true
  );
  const [isRelationshipEnabled, setIsRelationshipEnabled] = useState(
    selectedCharacter?.relationshipEnabled === true
  );

  // Add new state for auto message timing
  const [autoMessageInterval, setAutoMessageInterval] = useState<number>(
    selectedCharacter?.autoMessageInterval || 5
  );

  // Add state for custom user name
  const [customUserName, setCustomUserName] = useState(
    selectedCharacter?.customUserName || ''
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

  // Load memory settings when character changes
  useEffect(() => {
    if (selectedCharacter?.id) {
      const loadMemorySettings = async () => {
        try {
          const settings = await memoryService.loadSettings(selectedCharacter.id);
          setIsMemorySummaryEnabled(settings.enabled);
          setSummaryThreshold(settings.summaryThreshold);
          setSummaryLength(settings.summaryLength);
        } catch (error) {
          console.error('Error loading memory settings:', error);
        }
      };
      
      loadMemorySettings();
    }
  }, [selectedCharacter?.id]);

  // Sync states with character properties - make sure to sync notifications too
  useEffect(() => {
    setIsAutoMessageEnabled(selectedCharacter?.autoMessage === true);
    setIsNotificationEnabled(selectedCharacter?.notificationEnabled === true);
    setIsCircleInteractionEnabled(selectedCharacter?.circleInteraction === true);
    setIsRelationshipEnabled(selectedCharacter?.relationshipEnabled === true);
    setAutoMessageInterval(selectedCharacter?.autoMessageInterval || 5);
    // Add the custom user name sync
    setCustomUserName(selectedCharacter?.customUserName || '');
  }, [selectedCharacter]);

  // When user name or character changes, update Mem0Service
  useEffect(() => {
    if (selectedCharacter) {
      try {
        const mem0Service = Mem0Service.getInstance();
        mem0Service.setCharacterNames(
          selectedCharacter.id,
          selectedCharacter.customUserName || '',
          selectedCharacter.name
        );
      } catch (error) {
        console.error('Failed to update memory service with custom names:', error);
      }
    }
  }, [selectedCharacter?.id, selectedCharacter?.customUserName, selectedCharacter?.name]);

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

  // Replace memory toggle with memory summary toggle
  const handleMemorySummaryToggle = async () => {
    if (selectedCharacter) {
      try {
        // Save memory summary settings
        await memoryService.saveSettings(selectedCharacter.id, {
          enabled: !isMemorySummaryEnabled,
          summaryThreshold,
          summaryLength,
          lastSummarizedAt: 0
        });
        
        setIsMemorySummaryEnabled(!isMemorySummaryEnabled);
        
        if (!isMemorySummaryEnabled) {
          Alert.alert(
            '记忆总结已启用', 
            `当聊天记录达到 ${summaryThreshold} 字符时，系统将自动总结对话内容，帮助角色记住重要信息。这对长对话特别有用。`,
            [{ text: '知道了', style: 'default' }]
          );
        }
      } catch (error) {
        console.error('Error saving memory settings:', error);
        Alert.alert('错误', '无法保存记忆设置');
      }
    }
  };

  // Add handler to update memory summary settings
  const updateMemorySummarySettings = async () => {
    if (selectedCharacter) {
      try {
        await memoryService.saveSettings(selectedCharacter.id, {
          enabled: isMemorySummaryEnabled,
          summaryThreshold,
          summaryLength,
          lastSummarizedAt: 0 // Reset last summarized timestamp
        });
        
        Alert.alert('成功', '记忆总结设置已更新');
      } catch (error) {
        console.error('Error saving memory settings:', error);
        Alert.alert('错误', '无法保存记忆设置');
      }
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

  // Add handler for auto message interval
  const handleAutoMessageIntervalChange = async (value: number) => {
    if (selectedCharacter) {
      setAutoMessageInterval(value);
      const updatedCharacter = {
        ...selectedCharacter,
        autoMessageInterval: value
      };
      await updateCharacter(updatedCharacter);
    }
  };

  // Add handler for notification toggle
  const handleNotificationToggle = async () => {
    if (selectedCharacter) {
      const updatedCharacter = {
        ...selectedCharacter,
        notificationEnabled: !isNotificationEnabled
      };
      await updateCharacter(updatedCharacter);
      setIsNotificationEnabled(!isNotificationEnabled);
      
      // If notifications are being turned off, clear any existing notifications
      if (isNotificationEnabled) {
        AsyncStorage.setItem('unreadMessagesCount', '0').catch(err => 
          console.error('Failed to reset unread messages count:', err)
        );
        
        // Emit event to clear badge
        EventRegister.emit('unreadMessagesUpdated', 0);
      }
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

  // Add handler for custom user name change
  const handleCustomUserNameChange = async (value: string) => {
    setCustomUserName(value);
  };
  
  // Add handler for saving custom user name
  const saveCustomUserName = async () => {
    if (selectedCharacter) {
      const updatedCharacter = {
        ...selectedCharacter,
        customUserName: customUserName.trim()
      };
      await updateCharacter(updatedCharacter);
      
      // Update the Mem0Service with the custom name
      try {
        const mem0Service = Mem0Service.getInstance();
        mem0Service.setCharacterNames(
          selectedCharacter.id,
          customUserName.trim(),
          selectedCharacter.name
        );
        Alert.alert('成功', '角色对你的称呼已更新');
      } catch (error) {
        console.error('Failed to update memory service with custom names:', error);
      }
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

  // Memory Summary Settings Component
  const MemorySummarySettings: React.FC<MemorySummarySettingsProps> = ({ character }) => {
    if (!isMemorySummaryEnabled) return null;
    
    return (
      <View style={styles.settingSection}>
        <Text style={styles.settingSectionTitle}>记忆总结设置</Text>
        
        <View style={styles.sliderContainer}>
          <Text style={styles.settingLabel}>总结阈值：{summaryThreshold} 字符</Text>
          <Slider
            style={styles.slider}
            minimumValue={3000}
            maximumValue={10000}
            step={1000}
            value={summaryThreshold}
            onValueChange={setSummaryThreshold}
            minimumTrackTintColor="rgb(255, 224, 195)"
            maximumTrackTintColor="#767577"
            thumbTintColor="rgb(255, 224, 195)"
          />
          <Text style={styles.sliderRangeText}>
            <Text style={styles.sliderMinText}>较少 (3000)</Text>
            <Text style={styles.sliderMaxText}>较多 (10000)</Text>
          </Text>
        </View>
        
        <View style={styles.sliderContainer}>
          <Text style={styles.settingLabel}>总结长度：{summaryLength} 字符</Text>
          <Slider
            style={styles.slider}
            minimumValue={500}
            maximumValue={2000}
            step={100}
            value={summaryLength}
            onValueChange={setSummaryLength}
            minimumTrackTintColor="rgb(255, 224, 195)"
            maximumTrackTintColor="#767577"
            thumbTintColor="rgb(255, 224, 195)"
          />
          <Text style={styles.sliderRangeText}>
            <Text style={styles.sliderMinText}>简洁 (500)</Text>
            <Text style={styles.sliderMaxText}>详细 (2000)</Text>
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.applyButton}
          onPress={updateMemorySummarySettings}
        >
          <Text style={styles.applyButtonText}>保存设置</Text>
        </TouchableOpacity>
        
        <Text style={styles.settingDescription}>
          记忆总结功能会在对话达到阈值时，自动总结对话历史，避免模型遗忘早期对话内容。总结的部分对用户不可见，只有AI能看到。
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

        {/* Add custom user name setting */}
        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>基本设置</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.settingLabel}>角色对我的称呼</Text>
            <TextInput
              style={styles.textInput}
              value={customUserName}
              onChangeText={handleCustomUserNameChange}
              placeholder="设置角色如何称呼你"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveCustomUserName}
            >
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
            
            <Text style={styles.settingDescription}>
              设置后，角色将用这个名字称呼你
            </Text>
          </View>
        </View>

        {/* Replace Permanent Memory with Memory Summary */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>记忆总结</Text>
          <Switch
            value={isMemorySummaryEnabled}
            onValueChange={handleMemorySummaryToggle}
            trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }}
            thumbColor={isMemorySummaryEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'}
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

        {/* Add auto message timing settings when enabled */}
        {isAutoMessageEnabled && (
          <View style={styles.sliderContainer}>
            <Text style={styles.settingLabel}>主动消息触发时间：{autoMessageInterval} 分钟</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={30}
              step={1}
              value={autoMessageInterval}
              onValueChange={setAutoMessageInterval}
              onSlidingComplete={handleAutoMessageIntervalChange}
              minimumTrackTintColor="rgb(255, 224, 195)"
              maximumTrackTintColor="#767577"
              thumbTintColor="rgb(255, 224, 195)"
            />
            <Text style={styles.sliderRangeText}>
              <Text style={styles.sliderMinText}>较短 (1分钟)</Text>
              <Text style={styles.sliderMaxText}>较长 (30分钟)</Text>
            </Text>
          </View>
        )}

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>消息提醒</Text>
          <Switch
            value={isNotificationEnabled}
            onValueChange={handleNotificationToggle}
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

        {selectedCharacter && isMemorySummaryEnabled && (
          <MemorySummarySettings character={selectedCharacter} updateCharacter={updateCharacter} />
        )}

        {selectedCharacter && isCircleInteractionEnabled && (
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
  sliderContainer: {
    marginVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: theme.borderRadius.md,
    padding: 15,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderRangeText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  sliderMinText: {
    color: '#ccc',
    fontSize: 12,
  },
  sliderMaxText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'right',
  },
  applyButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginVertical: 10,
  },
  applyButtonText: {
    color: 'rgb(255, 224, 195)',
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  textInput: {
    backgroundColor: 'rgba(80, 80, 80, 0.8)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginVertical: 8,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  saveButtonText: {
    color: 'rgb(255, 224, 195)',
    fontWeight: '600',
  },
});

