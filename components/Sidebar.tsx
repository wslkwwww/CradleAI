import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Character } from '@/shared/types';
import { useRouter } from 'expo-router';
import SearchBar from '@/components/SearchBar';

interface SidebarProps {
  isVisible: boolean;
  conversations: Character[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isVisible,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onClose,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤出搜索结果
  const filteredConversations = searchQuery 
    ? conversations.filter(conv => 
        conv.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return isVisible ? (
    <View style={styles.overlay}>
      <BlurView style={styles.sidebar} intensity={30} tint="dark">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>聊天</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* 用新的SearchBar组件替换旧的搜索功能 */}
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
                  {item.type || "AI角色"}
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

        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => {
            router.push('/pages/create_char');
            onClose();
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.createButtonText}>创建新角色</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  ) : null;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  sidebar: {
    width: '80%',
    height: '100%',
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    paddingTop: StatusBar.currentHeight || 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    padding: 8,
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
    backgroundColor: 'rgba(255, 158, 205, 0.1)',
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 158, 205, 0.2)',
    margin: 16,
    borderRadius: 8,
  },
  createButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});

export default Sidebar;