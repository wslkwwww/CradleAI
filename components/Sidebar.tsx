import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
  Animated,
  Dimensions,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Character } from '@/shared/types';
import { useRouter } from 'expo-router';
import SearchBar from '@/components/SearchBar';
import { theme } from '@/constants/theme';

// Match the width used in SettingsSidebar
const SIDEBAR_WIDTH = 280;

interface SidebarProps {
  isVisible: boolean;
  conversations: Character[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onClose: () => void;
  animationValue?: Animated.Value;
}

const Sidebar: React.FC<SidebarProps> = ({
  isVisible,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onClose,
  animationValue,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create a local slide animation value
  const localSlideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  
  // Animate the sidebar separately from the content
  useEffect(() => {
    Animated.timing(localSlideAnim, {
      toValue: isVisible ? 0 : -SIDEBAR_WIDTH,
      duration: 100, // Match the animation duration with contentSlideAnim
      easing: Easing.inOut(Easing.ease), // 添加这行来使用缓和函数
      useNativeDriver: true,
    }).start();
  }, [isVisible, localSlideAnim]);

  // 过滤出搜索结果
  const filteredConversations = searchQuery 
    ? conversations.filter(conv => 
        conv.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <View
      style={[
        styles.sidebarContainer,
        {
          pointerEvents: isVisible ? 'auto' : 'none',
        }
      ]}
    >
      <Animated.View 
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: localSlideAnim }],
          }
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>窗口</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <SearchBar
            placeholder="搜索角色..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery('')}
            style={styles.searchBar}
            blurBackground={true}
            blurIntensity={15}
          />
        </View>

        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.conversationItem,
                selectedConversationId === item.id && styles.selectedConversation,
              ]}
              onPress={() => {
                onSelectConversation(item.id);
                onClose();
              }}
            >
              <Image
                source={
                  item.avatar
                    ? { uri: item.avatar }
                    : require('@/assets/images/default-avatar.png')
                }
                style={styles.avatar}
              />
              <View style={styles.conversationDetails}>
                <Text style={styles.conversationName}>{item.name}</Text>
                <Text style={styles.conversationPreview} numberOfLines={1}>
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.emptyResult}>
                <Ionicons name="search-outline" size={32} color="#9e9e9e" />
                <Text style={styles.emptyResultText}>没有找到匹配的角色</Text>
              </View>
            ) : null
          }
        />
      </Animated.View>
      
      {/* Add overlay to close sidebar when touching outside */}
      {isVisible && (
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 20, // Higher than content but lower than modals
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: "rgba(40, 40, 40, 0.9)",
    paddingTop: StatusBar.currentHeight || 0,
    ...theme.shadows.medium,
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: SIDEBAR_WIDTH,
    height: '100%',
    width: Dimensions.get('window').width - SIDEBAR_WIDTH,
    backgroundColor: 'transparent', // Make sure it's transparent
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50, // Add safe area padding
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "rgb(255, 224, 195)",
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    padding: theme.spacing.md,
    marginBottom: 8,
  },
  searchBar: {
    height: 40,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedConversation: {
    backgroundColor: 'rgba(255, 224, 195, 0.2)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  conversationDetails: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: 14,
    color: '#9e9e9e',
  },
  emptyResult: {
    padding: 24,
    alignItems: 'center',
  },
  emptyResultText: {
    marginTop: 8,
    color: '#9e9e9e',
    fontSize: 16,
  },
});

export default Sidebar;