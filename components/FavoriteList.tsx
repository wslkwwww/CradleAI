import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import { CirclePost } from '@/shared/types';
import { Ionicons } from '@expo/vector-icons';

interface FavoriteListProps {
  posts: CirclePost[];
  onClose: () => void;
  onUpdatePost: (post: CirclePost) => void;
}

const FavoriteList: React.FC<FavoriteListProps> = ({
  posts,
  onClose,
  onUpdatePost,
}) => {
  const favoritePosts = useMemo(() => 
    posts.filter(post => post.isFavorited),
    [posts]
  );

  const renderItem = ({ item }: { item: CirclePost }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image
          source={
            item.characterAvatar
              ? { uri: item.characterAvatar }
              : require('@/assets/images/default-avatar.png')
          }
          style={styles.avatar}
        />
        <View style={styles.postInfo}>
          <Text style={styles.authorName}>{item.characterName}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>

      <Text style={styles.content}>{item.content}</Text>

      {item.images && item.images.length > 0 && (
        <View style={styles.imagesContainer}>
          {item.images.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              style={styles.thumbnail}
            />
          ))}
        </View>
      )}

      <View style={styles.postFooter}>
        <Text style={styles.statsText}>
          {item.likes} 赞 · {item.comments?.length || 0} 评论
        </Text>
        <TouchableOpacity
          onPress={() => {
            const updatedPost = { ...item, isFavorited: false };
            onUpdatePost(updatedPost);
          }}
        >
          <Ionicons name="bookmark" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>收藏夹</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={favoritePosts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>暂无收藏的帖子</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
  },
  postCard: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postInfo: {
    flex: 1,
  },
  authorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#444',
    paddingTop: 12,
  },
  statsText: {
    color: '#999',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
});

export default FavoriteList;
