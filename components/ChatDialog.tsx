import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { ChatDialogProps } from '@/constants/types';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  cancelAnimation,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';

// 定义动画效果常量
const ANIMATION_CONFIGS = {
  RATING_1: {
    scale: 1.2,
    duration: 300,
  },
  RATING_2: {
    scale: 1.4,
    duration: 400,
  },
  RATING_3: {
    scale: 1.6,
    duration: 500,
  },
};

interface RatingButtonProps {
  isUpvote: boolean;
  rating: number;
  onPress: () => void;
}

const RatingButton: React.FC<RatingButtonProps> = ({ isUpvote, rating, onPress }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const haloScale = useSharedValue(1); // 新增光晕专用的缩放值
  const absRating = Math.abs(rating);
  const config = ANIMATION_CONFIGS[`RATING_${absRating}` as keyof typeof ANIMATION_CONFIGS] 
                || ANIMATION_CONFIGS.RATING_1;

  const animateRating = () => {
    // 取消之前的动画
    cancelAnimation(scale);
    cancelAnimation(opacity);
    cancelAnimation(translateY);
    cancelAnimation(haloScale);

    const absRating = Math.abs(rating);
    const config = ANIMATION_CONFIGS[`RATING_${absRating}` as keyof typeof ANIMATION_CONFIGS] 
                  || ANIMATION_CONFIGS.RATING_1;

    // 按钮动画
    scale.value = withSequence(
      withSpring(config.scale, { damping: 15 }),
      withSpring(1, { damping: 15 })
    );

    // 上下浮动动画
    translateY.value = withSequence(
      withSpring(isUpvote ? -10 : 10, { damping: 15 }),
      withSpring(0, { damping: 15 })
    );

    // 光晕动画 - 使用单独的值控制
    haloScale.value = withSequence(
      withSpring(config.scale * 1.5, { damping: 12 }),
      withSpring(0, { damping: 12 }) // shrink to zero
    );
  };

  const handlePress = () => {
    animateRating();
    onPress();
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: interpolate(
      haloScale.value,
      [1, config.scale * 1.5],
      [0.6, 0]
    ),
    zIndex: 9999, // ensure halo is on top
  }));

  return (
    <Animated.View style={[styles.rateButtonContainer]}>
      <TouchableOpacity 
        style={styles.rateButton} 
        onPress={handlePress}
      >
        <Animated.View style={buttonStyle}>
          <MaterialIcons 
            name={isUpvote ? "thumb-up" : "thumb-down"}
            size={20} 
            color={rating !== 0 ? (isUpvote ? "#4CAF50" : "#F44336") : "#666"} 
          />
        </Animated.View>
        {rating !== 0 && (
          <Text style={[
            styles.ratingText,
            { color: isUpvote ? "#4CAF50" : "#F44336" }
          ]}>
            {isUpvote ? `+${rating}` : rating}
          </Text>
        )}
        {Math.abs(rating) > 0 && (
          <Animated.View 
            style={[
              styles.halo,
              haloStyle,
              { 
                backgroundColor: isUpvote ? 
                  "rgba(76, 175, 80, 0.1)" : 
                  "rgba(244, 67, 54, 0.1)"
              }
            ]} 
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function ChatDialog({ messages, style, selectedCharacter, onRateMessage }: ChatDialogProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const previousMessagesLength = useRef(messages.length);

  // 检测新消息并滚动
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      const timeoutId = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    previousMessagesLength.current = messages.length;
  }, [messages.length]); // 只监听消息数量的变化，而不是整个 messages 数组

  // 添加调试日志
  // useEffect(() => {
  //   console.log('ChatDialog messages updated:', messages);
  // }, [messages]);

  const avatarSource: ImageSourcePropType | undefined =
    selectedCharacter?.avatar
      ? typeof selectedCharacter.avatar === 'string'
        ? { uri: selectedCharacter.avatar }
        : selectedCharacter.avatar
      : undefined;

  // 在 ChatDialog 组件中添加一个判断转发消息的函数
  const isForwardMessage = (text: string) => {
    return text.includes('转发自') && text.includes('的朋友圈：');
  };

  const handleRateMessage = async (messageId: string, isUpvote: boolean) => {
    // 移除自动滚动
    if (onRateMessage) {
      await onRateMessage(messageId, isUpvote);
    }
    // 不要调用 scrollToEnd 或类似的滚动方法
  };

  return (
    <View style={[styles.container, style]}>
      {selectedCharacter?.backgroundImage && (
        <Image
          source={typeof selectedCharacter.backgroundImage === 'string' 
            ? { uri: selectedCharacter.backgroundImage }
            : selectedCharacter.backgroundImage}
        />
      )}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollViewContent}
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View key={message.id} style={styles.messageWrapper}>
            <View style={[
              styles.messageContainer,
              message.sender === 'bot' ? styles.botMessage : styles.userMessage
            ]}>
              {message.sender === 'bot' && avatarSource && (
                <Image source={avatarSource} style={styles.botAvatar} />
              )}
              
              {message.isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#999" />
                  <Text style={styles.loadingText}>正在思考...</Text>
                </View>
              ) : isForwardMessage(message.text) ? (
                // 转发消息的特殊渲染
                <View style={styles.forwardContent}>
                  <View style={styles.forwardHeader}>
                    <MaterialIcons name="share" size={16} color="#666" />
                    <Text style={styles.forwardTitle}>朋友圈转发</Text>
                  </View>
                  <Text style={styles.messageText}>{message.text}</Text>
                </View>
              ) : (
                <Text style={styles.messageText}>{message.text}</Text>
              )}
            </View>
            {message.sender === 'bot' && (
              <View style={styles.ratingContainer}>
                <RatingButton
                  isUpvote={true}
                  rating={message.rating && message.rating > 0 ? message.rating : 0}
                  onPress={() => handleRateMessage(message.id, true)}
                />
                <RatingButton
                  isUpvote={false}
                  rating={message.rating && message.rating < 0 ? message.rating : 0}
                  onPress={() => handleRateMessage(message.id, false)}
                />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    position: 'relative',
  },

  scrollView: {
    flex: 1,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingTop: 40,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 15,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(220, 248, 198, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236, 236, 236, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  messageText: {
    fontSize: 16,
    flexShrink: 1,
    color: '#333',
    // 为转发消息添加特殊文本样式
    lineHeight: 20,
  },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  forwardMessage: {
    backgroundColor: 'rgba(250, 250, 250, 0.95)',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 0, // 移除默认内边距
  },
  forwardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  forwardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    marginBottom: 8,
  },
  forwardTitle: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingLeft: 10,
    marginBottom: 4,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    marginRight: 8,
  },
  rateButtonContainer: {
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    top: -10,
    left: -10,
    zIndex: -1,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  backgroundImage: {  // 这里的backgroundImage是重复的
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  messageWrapper: {
    marginBottom: 10,
  },
});