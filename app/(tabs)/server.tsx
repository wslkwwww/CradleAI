import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Modal,
  TextInput,
  Animated,
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import * as sdk from "matrix-js-sdk";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Types
interface User {
  name: string;
  avatar: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  category: string;
  active?: boolean;
}

// Mock data
const mockServers = [
  { id: '1', name: 'Discord', icon: '🎮', active: true },
  { id: '2', name: 'Gaming', icon: '🎯', active: false },
  { id: '3', name: 'Art', icon: '🎨', active: false },
  { id: '4', name: 'Music', icon: '🎵', active: false },
];

const mockChannels: Channel[] = [
  { id: '1', name: '公告', type: 'announcement', category: '信息' },
  { id: '2', name: '一般', type: 'text', category: '文字频道', active: true },
  { id: '3', name: '随机', type: 'text', category: '文字频道' },
  { id: '4', name: '讨论区', type: 'forum', category: '论坛' },
  { id: '5', name: '一般', type: 'voice', category: '语音频道' },
  { id: '6', name: '音乐', type: 'voice', category: '语音频道' },
];

const mockMessages = [
  {
    id: '1',
    author: { name: 'Alice', avatar: 'https://via.placeholder.com/40' },
    content: '大家好！欢迎来到我们的服务器！',
    timestamp: '今天 14:32',
  },
  {
    id: '2',
    author: { name: 'Bob', avatar: 'https://via.placeholder.com/40' },
    content: '这个界面做得真不错，很像Discord！',
    timestamp: '今天 14:35',
  },
  {
    id: '3',
    author: { name: 'Charlie', avatar: 'https://via.placeholder.com/40' },
    content: '确实！UI还原度很高 🎉',
    timestamp: '今天 14:38',
  },
];

const mockForumPosts = [
  {
    id: '1',
    title: '欢迎新成员！请在这里自我介绍',
    preview: '这里是新成员自我介绍的地方，大家可以在这里分享自己的兴趣爱好...',
    author: { name: 'Admin', avatar: 'https://via.placeholder.com/40' },
    tags: ['置顶', '公告'],
    timestamp: '2天前',
    replies: 23,
    likes: 15,
  },
  {
    id: '2',
    title: '分享一些有用的开发资源',
    preview: '收集了一些React Native和Expo的学习资源，希望对大家有帮助...',
    author: { name: 'Developer', avatar: 'https://via.placeholder.com/40' },
    tags: ['资源', '开发'],
    timestamp: '1天前',
    replies: 8,
    likes: 12,
  },
];

const Server: React.FC = () => {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<'text' | 'forum' | 'voice'>('text');
  const [messageInput, setMessageInput] = useState('');
  
  // Animation for modal slide from right
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;

  useEffect(() => {
    if (showChannelModal) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showChannelModal]);

  // Get current channel data
  const getCurrentChannel = () => {
    return mockChannels.find(channel => channel.id === selectedChannel);
  };

  // Server List Component
  const ServerList = () => (
    <View style={styles.serverList}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Home Server */}
        <TouchableOpacity style={[styles.serverIcon, styles.serverIconHome]}>
          <Ionicons name="home" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={styles.serverSeparator} />
        
        {/* Server Icons */}
        {mockServers.map((server) => (
          <TouchableOpacity
            key={server.id}
            style={[
              styles.serverIcon,
              server.active && styles.serverIconActive
            ]}
          >
            <Text style={styles.serverIconText}>{server.icon}</Text>
            {server.active && <View style={styles.serverActiveIndicator} />}
          </TouchableOpacity>
        ))}
        
        {/* Add Server Button */}
        <TouchableOpacity style={[styles.serverIcon, styles.addServerIcon]}>
          <Ionicons name="add" size={24} color="#23a559" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // Channel List Component
  const ChannelList = () => {
    const groupedChannels = mockChannels.reduce((acc, channel) => {
      if (!acc[channel.category]) {
        acc[channel.category] = [];
      }
      acc[channel.category].push(channel);
      return acc;
    }, {} as Record<string, typeof mockChannels>);

    const getChannelIcon = (type: string) => {
      switch (type) {
        case 'text': return 'chatbubble-outline';
        case 'voice': return 'volume-high-outline';
        case 'announcement': return 'megaphone-outline';
        case 'forum': return 'chatbubbles-outline';
        default: return 'chatbubble-outline';
      }
    };

    return (
      <View style={styles.channelList}>
        {/* Server Header */}
        <TouchableOpacity style={styles.serverHeader}>
          <Text style={styles.serverHeaderText}>CradleAI 社区</Text>
          <Ionicons name="chevron-down" size={16} color="#949ba4" />
        </TouchableOpacity>

        <ScrollView style={styles.channelScrollView} showsVerticalScrollIndicator={false}>
          {Object.entries(groupedChannels).map(([category, channels]) => (
            <View key={category}>
              <View style={styles.channelCategory}>
                <Text style={styles.channelCategoryText}>{category}</Text>
                <Ionicons name="add" size={16} color="#949ba4" />
              </View>
              
              {channels.map((channel) => (
                <TouchableOpacity
                  key={channel.id}
                  style={[
                    styles.channelItem,
                    selectedChannel === channel.id && styles.channelItemActive
                  ]}
                  onPress={() => {
                    setSelectedChannel(channel.id);
                    setModalType(channel.type === 'forum' ? 'forum' : channel.type === 'voice' ? 'voice' : 'text');
                    setShowChannelModal(true);
                  }}
                  onLongPress={() => {
                    setSelectedChannel(channel.id);
                    setModalType(channel.type === 'forum' ? 'forum' : channel.type === 'voice' ? 'voice' : 'text');
                  }}
                >
                  <Ionicons
                    name={getChannelIcon(channel.type)}
                    size={20}
                    color={selectedChannel === channel.id ? "#ffffff" : "#80848e"}
                  />
                  <Text style={[
                    styles.channelName,
                    selectedChannel === channel.id && styles.channelNameActive
                  ]}>
                    {channel.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>

        {/* User Panel */}
        <View style={styles.userPanel}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => setShowUserModal(true)}
          >
            <Image
              source={{ uri: 'https://via.placeholder.com/32' }}
              style={styles.userAvatar}
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>用户名</Text>
              <Text style={styles.userStatus}>在线</Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.userControls}>
            <TouchableOpacity style={styles.userControlButton}>
              <Ionicons name="mic" size={16} color="#b5bac1" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.userControlButton}>
              <Ionicons name="headset" size={16} color="#b5bac1" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.userControlButton}>
              <Ionicons name="settings" size={16} color="#b5bac1" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Text Channel Content Component
  const TextChannelContent = () => (
    <View style={styles.channelContent}>
      {/* Channel Header */}
      <View style={styles.channelHeader}>
        <View style={styles.channelHeaderLeft}>
          <Ionicons name="chatbubble-outline" size={20} color="#80848e" />
          <Text style={styles.channelHeaderTitle}>{getCurrentChannel()?.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setShowChannelModal(true)}
        >
          <Ionicons name="expand-outline" size={20} color="#b5bac1" />
        </TouchableOpacity>
      </View>

      {/* Messages Preview */}
      <ScrollView style={styles.messagesPreview}>
        {mockMessages.slice(0, 3).map((message) => (
          <TouchableOpacity
            key={message.id}
            style={styles.messagePreview}
            onPress={() => {
              setSelectedUser(message.author);
              setShowUserModal(true);
            }}
          >
            <Image source={{ uri: message.author.avatar }} style={styles.messagePreviewAvatar} />
            <View style={styles.messagePreviewContent}>
              <View style={styles.messagePreviewHeader}>
                <Text
                  style={styles.messagePreviewUsername}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  {message.author.name}
                </Text>
                <Text
                  style={styles.messagePreviewTimestamp}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  {message.timestamp}
                </Text>
              </View>
              <Text
                style={styles.messagePreviewText}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {message.content}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>


    </View>
  );

  // Forum Channel Content Component
  const ForumChannelContent = () => (
    <View style={styles.channelContent}>
      {/* Channel Header */}
      <View style={styles.channelHeader}>
        <View style={styles.channelHeaderLeft}>
          <Ionicons name="chatbubbles-outline" size={20} color="#80848e" />
          <Text style={styles.channelHeaderTitle}>{getCurrentChannel()?.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setShowChannelModal(true)}
        >
          <Ionicons name="expand-outline" size={20} color="#b5bac1" />
        </TouchableOpacity>
      </View>

      {/* Forum Posts Preview */}
      <ScrollView style={styles.forumPreview}>
        {mockForumPosts.slice(0, 2).map((post) => (
          <View key={post.id} style={styles.forumPostPreview}>
            <Text style={styles.postPreviewTitle} numberOfLines={2}>{post.title}</Text>
            <Text style={styles.postPreviewContent} numberOfLines={2}>{post.preview}</Text>
            <View style={styles.postPreviewMeta}>
              <Text style={styles.postPreviewAuthor}>{post.author.name}</Text>
              <Text style={styles.postPreviewStats}>{post.replies} 回复</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Partial Content Hint */}
      <View style={styles.partialContentHint}>
        <Text style={styles.hintText}>长按频道查看完整内容</Text>
        <Ionicons name="chevron-forward" size={16} color="#949ba4" />
      </View>
    </View>
  );

  // Voice Channel Content Component
  const VoiceChannelContent = () => (
    <View style={styles.channelContent}>
      {/* Channel Header */}
      <View style={styles.channelHeader}>
        <View style={styles.channelHeaderLeft}>
          <Ionicons name="volume-high-outline" size={20} color="#80848e" />
          <Text style={styles.channelHeaderTitle}>{getCurrentChannel()?.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setShowChannelModal(true)}
        >
          <Ionicons name="expand-outline" size={20} color="#b5bac1" />
        </TouchableOpacity>
      </View>

      {/* Voice Channel Status */}
      <View style={styles.voiceChannelStatus}>
        <Ionicons name="volume-off" size={48} color="#80848e" />
        <Text style={styles.voiceStatusTitle}>语音频道</Text>
        <Text style={styles.voiceStatusSubtitle}>当前无人在线</Text>
        <TouchableOpacity style={styles.joinVoiceButton}>
          <Ionicons name="call" size={16} color="#ffffff" />
          <Text style={styles.joinVoiceText}>加入语音</Text>
        </TouchableOpacity>
      </View>

      {/* Partial Content Hint */}
      <View style={styles.partialContentHint}>
        <Text style={styles.hintText}>长按频道查看完整内容</Text>
        <Ionicons name="chevron-forward" size={16} color="#949ba4" />
      </View>
    </View>
  );

  // Main Content Area
  const MainContent = () => {
    if (!selectedChannel) {
      return (
        <View style={styles.mainContent}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>欢迎来到 CradleAI</Text>
            <Text style={styles.welcomeSubtitle}>点击左侧频道开始聊天</Text>
            <Ionicons name="chatbubbles-outline" size={64} color="#80848e" />
          </View>
        </View>
      );
    }

    const currentChannel = getCurrentChannel();
    if (!currentChannel) return null;

    switch (currentChannel.type) {
      case 'text':
      case 'announcement':
        return <TextChannelContent />;
      case 'forum':
        return <ForumChannelContent />;
      case 'voice':
        return <VoiceChannelContent />;
      default:
        return <TextChannelContent />;
    }
  };

  // Text Channel Modal
  const TextChannelModal = () => (
    <Modal
      visible={showChannelModal && (modalType === 'text' || modalType === 'voice')}
      animationType="none"
      transparent={true}
      onRequestClose={() => setShowChannelModal(false)}
    >
      <Animated.View 
        style={[
          styles.modalContainer, 
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <Ionicons 
              name={modalType === 'voice' ? "volume-high-outline" : "chatbubble-outline"} 
              size={24} 
              color="#80848e" 
            />
            <Text style={styles.modalTitle}>{getCurrentChannel()?.name}</Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowChannelModal(false)}
          >
            <Ionicons name="close" size={24} color="#b5bac1" />
          </TouchableOpacity>
        </View>

        {modalType === 'voice' ? (
          // Voice Channel Content
          <View style={styles.voiceModalContent}>
            <View style={styles.voiceChannelCenter}>
              <Ionicons name="volume-high" size={80} color="#80848e" />
              <Text style={styles.voiceModalTitle}>语音频道</Text>
              <Text style={styles.voiceModalSubtitle}>当前无人在线</Text>
              <TouchableOpacity style={styles.joinVoiceButtonLarge}>
                <Ionicons name="call" size={20} color="#ffffff" />
                <Text style={styles.joinVoiceTextLarge}>加入语音频道</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {/* Messages Area */}
            <ScrollView style={styles.messagesArea}>
              {mockMessages.map((message) => (
                <TouchableOpacity
                  key={message.id}
                  style={styles.messageGroup}
                  onPress={() => {
                    setSelectedUser(message.author);
                    setShowUserModal(true);
                  }}
                >
                  <Image source={{ uri: message.author.avatar }} style={styles.messageAvatar} />
                  <View style={styles.messageContent}>
                    <View style={styles.messageHeader}>
                      <Text style={styles.messageUsername}>{message.author.name}</Text>
                      <Text style={styles.messageTimestamp}>{message.timestamp}</Text>
                    </View>
                    <Text style={styles.messageText}>{message.content}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Message Input */}
            <View style={styles.messageInputArea}>
              <View style={styles.messageInputContainer}>
                <TextInput
                  style={styles.messageInput}
                  placeholder={`在 #${getCurrentChannel()?.name} 中发送消息`}
                  placeholderTextColor="#72767d"
                  value={messageInput}
                  onChangeText={setMessageInput}
                  multiline
                />
                <TouchableOpacity style={styles.sendButton}>
                  <Ionicons name="send" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </Modal>
  );

  // Forum Channel Modal
  const ForumChannelModal = () => (
    <Modal
      visible={showChannelModal && modalType === 'forum'}
      animationType="none"
      transparent={true}
      onRequestClose={() => setShowChannelModal(false)}
    >
      <Animated.View 
        style={[
          styles.modalContainer, 
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <Ionicons name="chatbubbles-outline" size={24} color="#80848e" />
            <Text style={styles.modalTitle}>{getCurrentChannel()?.name}</Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowChannelModal(false)}
          >
            <Ionicons name="close" size={24} color="#b5bac1" />
          </TouchableOpacity>
        </View>

        {/* Forum Controls */}
        <View style={styles.forumControls}>
          <TouchableOpacity style={styles.forumControlButton}>
            <Text style={styles.forumControlText}>最新</Text>
            <Ionicons name="chevron-down" size={16} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.forumControlButton}>
            <Text style={styles.forumControlText}>标签</Text>
          </TouchableOpacity>
        </View>

        {/* Forum Posts */}
        <ScrollView style={styles.forumPostsContainer}>
          {mockForumPosts.map((post) => (
            <TouchableOpacity key={post.id} style={styles.forumPost}>
              <View style={styles.postHeader}>
                <Image source={{ uri: post.author.avatar }} style={styles.postAuthorAvatar} />
                <View style={styles.postInfo}>
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postPreview}>{post.preview}</Text>
                  <View style={styles.postTags}>
                    {post.tags.map((tag, index) => (
                      <View key={index} style={styles.postTag}>
                        <Text style={styles.postTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.postMeta}>
                    <Text style={styles.postAuthor}>{post.author.name}</Text>
                    <Text style={styles.postTimestamp}>{post.timestamp}</Text>
                    <Text style={styles.postStats}>{post.replies} 回复 • {post.likes} 👍</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );

  // User Modal
  const UserModal = () => (
    <Modal
      visible={showUserModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowUserModal(false)}
    >
      <View style={styles.userModalOverlay}>
        <View style={styles.userModal}>
          <View style={styles.userModalHeader}>
            <TouchableOpacity
              style={styles.userModalClose}
              onPress={() => setShowUserModal(false)}
            >
              <Ionicons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          
          <Image
            source={{ uri: selectedUser?.avatar || 'https://via.placeholder.com/80' }}
            style={styles.userModalAvatar}
          />
          
          <View style={styles.userModalContent}>
            <Text style={styles.userModalName}>{selectedUser?.name || '用户名'}</Text>
            <Text style={styles.userModalDiscriminator}>#1234</Text>
            
            <View style={styles.userBio}>
              <Text style={styles.userBioTitle}>关于我</Text>
              <Text style={styles.userBioContent}>
                这是一个用户简介的示例文本，用户可以在这里介绍自己。
              </Text>
            </View>
          </View>
          
          <View style={styles.userActionButtons}>
            <TouchableOpacity style={[styles.userActionButton, styles.primaryButton]}>
              <Text style={styles.userActionButtonText}>发送消息</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.userActionButton}>
              <Text style={styles.userActionButtonText}>更多</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      <View style={styles.mainLayout}>
        <ServerList />
        <ChannelList />
        <MainContent />
      </View>

      <TextChannelModal />
      <ForumChannelModal />
      <UserModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1f22',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  
  // Server List Styles
  serverList: {
    width: 70,
    backgroundColor: '#1e1f22',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  serverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#36393f',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  serverIconHome: {
    backgroundColor: theme.colors.primary,
  },
  serverIconActive: {
    borderRadius: 16,
  },
  serverIconText: {
    fontSize: 20,
  },
  serverActiveIndicator: {
    position: 'absolute',
    left: -16,
    width: 4,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  serverSeparator: {
    height: 2,
    backgroundColor: '#36393f',
    marginVertical: 8,
    borderRadius: 1,
  },
  addServerIcon: {
    backgroundColor: '#36393f',
  },

  // Channel List Styles
  channelList: {
    width: 240,
    backgroundColor: '#2b2d31',
  },
  serverHeader: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1f22',
  },
  serverHeaderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  channelScrollView: {
    flex: 1,
    paddingTop: 8,
  },
  channelCategory: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelCategoryText: {
    color: '#949ba4',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  channelItem: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelItemActive: {
    backgroundColor: '#404249',
  },
  channelName: {
    color: '#949ba4',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  channelNameActive: {
    color: '#ffffff',
  },
  userPanel: {
    height: 52,
    backgroundColor: '#232428',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  userStatus: {
    color: '#23a559',
    fontSize: 12,
  },
  userControls: {
    flexDirection: 'row',
  },
  userControlButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  // Main Content Styles
  mainContent: {
    flex: 1,
    backgroundColor: '#313338',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    alignItems: 'center',
    opacity: 0.6,
  },
  welcomeTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#949ba4',
    fontSize: 16,
    marginBottom: 32,
  },

  // Channel Content Styles
  channelContent: {
    flex: 1,
    backgroundColor: '#313338',
  },
  channelHeader: {
    height: 48,
    backgroundColor: '#2b2d31',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1f22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  channelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  expandButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },

  // Messages Preview Styles
  messagesPreview: {
    flex: 1,
    paddingVertical: 8,
  },
  messagePreview: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    marginBottom: 8,
    minHeight: 40,
  },
  messagePreviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    flexShrink: 0,
  },
  messagePreviewContent: {
    flex: 1,
    minWidth: 0, // 允许子元素超出
  },
  messagePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'nowrap', // 强制横向排列
    minWidth: 0, // 允许子元素超出
  },
  messagePreviewUsername: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
    flexShrink: 0,
    minWidth: 0,
  },
  messagePreviewTimestamp: {
    color: '#949ba4',
    fontSize: 11,
    flexShrink: 0,
    minWidth: 0,
  },
  messagePreviewText: {
    color: '#dcddde',
    fontSize: 14,
    lineHeight: 18,
    flexShrink: 1,
    minWidth: 0,
  },

  // Forum Preview Styles
  forumPreview: {
    flex: 1,
    paddingVertical: 8,
  },
  forumPostPreview: {
    backgroundColor: '#2b2d31',
    margin: 8,
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  postPreviewTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  postPreviewContent: {
    color: '#b5bac1',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  postPreviewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postPreviewAuthor: {
    color: '#949ba4',
    fontSize: 11,
  },
  postPreviewStats: {
    color: '#949ba4',
    fontSize: 11,
  },

  // Voice Channel Styles
  voiceChannelStatus: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  voiceStatusTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  voiceStatusSubtitle: {
    color: '#949ba4',
    fontSize: 14,
    marginBottom: 20,
  },
  joinVoiceButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinVoiceText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Partial Content Hint
  partialContentHint: {
    height: 40,
    backgroundColor: '#2b2d31',
    borderTopWidth: 1,
    borderTopColor: '#1e1f22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  hintText: {
    color: '#949ba4',
    fontSize: 12,
    marginRight: 6,
  },

  // Modal Styles
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: screenWidth,
    height: screenHeight,
    flex: 1,
    backgroundColor: '#313338',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  slideFromRight: {
    // Animation handled by the transform
  },
  modalHeader: {
    height: 48,
    backgroundColor: '#2b2d31',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1f22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },

  // Voice Modal Styles
  voiceModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceChannelCenter: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  voiceModalTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  voiceModalSubtitle: {
    color: '#949ba4',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  joinVoiceButtonLarge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinVoiceTextLarge: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Text Channel Styles
  messagesArea: {
    flex: 1,
    paddingVertical: 16,
  },
  messageGroup: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    marginBottom: 16,
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  messageUsername: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  messageTimestamp: {
    color: '#949ba4',
    fontSize: 12,
    fontWeight: '500',
  },
  messageText: {
    color: '#dcddde',
    fontSize: 16,
    lineHeight: 22,
  },
  messageInputArea: {
    padding: 16,
  },
  messageInputContainer: {
    backgroundColor: '#383a40',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
  },
  messageInput: {
    flex: 1,
    color: '#dcddde',
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Forum Styles
  forumControls: {
    height: 48,
    backgroundColor: '#313338',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1f22',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  forumControlButton: {
    backgroundColor: '#4e5058',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  forumControlText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  forumPostsContainer: {
    flex: 1,
    padding: 20,
  },
  forumPost: {
    backgroundColor: '#2b2d31',
    borderWidth: 1,
    borderColor: '#1e1f22',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
  },
  postAuthorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postInfo: {
    flex: 1,
  },
  postTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  postPreview: {
    color: '#b5bac1',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  postTags: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  postTag: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
  },
  postTagText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAuthor: {
    color: '#949ba4',
    fontSize: 13,
    marginRight: 8,
  },
  postTimestamp: {
    color: '#949ba4',
    fontSize: 13,
    marginRight: 8,
  },
  postStats: {
    color: '#949ba4',
    fontSize: 13,
  },

  // User Modal Styles
  userModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  userModal: {
    backgroundColor: '#2b2d31',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: screenHeight * 0.8,
    overflow: 'hidden',
  },
  userModalHeader: {
    height: 120,
    backgroundColor: theme.colors.primary,
    position: 'relative',
    padding: 16,
  },
  userModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userModalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: '#2b2d31',
    position: 'absolute',
    top: 80,
    left: screenWidth / 2 - 40,
  },
  userModalContent: {
    padding: 16,
    paddingTop: 50,
    alignItems: 'center',
  },
  userModalName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  userModalDiscriminator: {
    color: '#949ba4',
    fontSize: 14,
    marginBottom: 16,
  },
  userBio: {
    backgroundColor: '#1e1f22',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  userBioTitle: {
    color: '#949ba4',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  userBioContent: {
    color: '#dcddde',
    fontSize: 14,
    lineHeight: 18,
  },
  userActionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  userActionButton: {
    flex: 1,
    backgroundColor: '#4e5058',
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  userActionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Server;
