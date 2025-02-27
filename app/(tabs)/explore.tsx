import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  ListRenderItem,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
  ImageBackground,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { CirclePost, CircleComment, CircleLike, Character, Message } from '@/shared/types';
import ForwardSheet from '@/components/ForwardSheet';
import TestResultsModal from '@/components/TestResultsModal';
import { useUser } from '@/constants/UserContext';
import { CircleService } from '@/services/circle-service';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const AVATAR_SIZE = 48;

// 多个测试帖子模板，用于随机选择
const TEST_POST_TEMPLATES = [
  {
    content: '今天天气真好，我在公园里散步时看到了很多可爱的小狗。大家喜欢小动物吗？',
    characterName: '天气爱好者',
  },
  {
    content: '刚看完一部超感人的电影，眼泪都止不住了。你们最近看过什么好电影吗？',
    characterName: '电影爱好者',
  },
  {
    content: '分享一道我最近学会的菜谱：香煎三文鱼配柠檬汁。简单又美味，推荐大家尝试！',
    characterName: '美食达人',
  },
  {
    content: '今天去书店买了几本新书，迫不及待想开始阅读了。最近大家在读什么书呢？',
    characterName: '读书人',
  }
];

// 生成随机测试帖子
const generateTestPost = () => {
  const template = TEST_POST_TEMPLATES[Math.floor(Math.random() * TEST_POST_TEMPLATES.length)];
  return {
    id: 'test-post-' + Date.now(),
    characterId: 'test-author-' + Math.floor(Math.random() * 1000),
    characterName: template.characterName,
    characterAvatar: null,
    content: template.content,
    createdAt: new Date().toISOString(),
    comments: [],
    likes: 0,
    hasLiked: false,
  };
};

const Explore: React.FC = () => {
  const { characters, updateCharacter, toggleFavorite, addMessage } = useCharacters();
  const { user } = useUser();
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [commentText, setCommentText] = useState('');
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingCharacters, setProcessingCharacters] = useState<string[]>([]);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testResults, setTestResults] = useState<Array<{characterId: string, name: string, success: boolean, action?: any}>>([]);
  const [showTestResults, setShowTestResults] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const testPost = useRef(generateTestPost()).current;

  const [isForwardSheetVisible, setIsForwardSheetVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CirclePost | null>(null);
  const [replyTo, setReplyTo] = useState<{userId: string, userName: string} | null>(null);
  const [publishingPost, setPublishingPost] = useState(false);

  // Circle interaction handling
  const handleCirclePostUpdate = useCallback(async (testPost: CirclePost) => {
    console.log('【朋友圈测试】开始朋友圈互动测试，帖子内容:', testPost.content);
    
    // Find characters with circle interaction enabled
    const interactingCharacters = characters.filter(c => c.circleInteraction);
    console.log(`【朋友圈测试】找到 ${interactingCharacters.length} 个启用了朋友圈互动的角色`);
    
    if (interactingCharacters.length === 0) {
      Alert.alert('提示', '没有启用朋友圈互动的角色，请在角色设置中开启');
      return;
    }

    // Set processing state for all interacting characters
    setProcessingCharacters(interactingCharacters.map(c => c.id));
    setTestResults([]);
    
    try {
      // 获取API Key用于真实调用
      const apiKey = user?.settings?.chat?.characterApiKey;
      
      if (!apiKey) {
        console.warn('【朋友圈测试】缺少API Key，将使用模拟数据');
      } else {
        console.log('【朋友圈测试】使用真实API Key进行调用');
      }
      
      // Process test interaction for all enabled characters using CircleService with API Key
      const { updatedPost, results } = await CircleService.processTestInteraction(
        testPost, 
        interactingCharacters,
        apiKey
      );
      
      console.log('【朋友圈测试】互动测试结果:', {
        总结果数: results.length,
        成功数: results.filter(r => r.success).length,
        点赞数: updatedPost.likes,
        评论数: updatedPost.comments?.length
      });
      
      // Update test results for display
      const formattedResults = results.map(result => {
        const character = interactingCharacters.find(c => c.id === result.characterId);
        return {
          characterId: result.characterId,
          name: character?.name || '未知角色',
          success: result.success,
          action: result.response?.action
        };
      });
      
      setTestResults(formattedResults);
      
      // Update the post with results
      setPosts(prevPosts => 
        prevPosts.map(p => p.id === testPost.id ? updatedPost : p)
      );
      
      // Show test results after processing is complete
      setShowTestResults(true);
      
    } catch (error) {
      console.error('【朋友圈测试】互动测试失败:', error);
      Alert.alert('互动失败', '处理朋友圈互动时发生错误');
    } finally {
      // Ensure all characters are removed from processing state
      setProcessingCharacters([]);
    }
  }, [characters, user?.settings?.chat?.characterApiKey]);

  // Load posts with test post if in test mode
  const loadPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // In test mode, we only show the test post
      if (testModeEnabled) {
        setPosts([testPost]);
        console.log('【朋友圈测试】测试模式已启用，显示测试帖子');
        return;
      }

      // Regular post loading logic
      const allPosts = characters.reduce((acc: CirclePost[], character) => {
        if (character.circlePosts && Array.isArray(character.circlePosts)) {
          const validPosts = character.circlePosts.filter(post => 
            post && post.id && post.content && post.characterName
          );
          return [...acc, ...validPosts];
        }
        return acc;
      }, []);

      const sortedPosts = allPosts.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setPosts(sortedPosts);
    } catch (err) {
      console.error('【朋友圈测试】加载帖子失败:', err);
      setError('加载动态失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [characters, testModeEnabled, testPost]);
  
  useEffect(() => {
    if (characters.length > 0) {
      loadPosts();
    }
  }, [characters, loadPosts]);

  // Update post avatars when characters or user changes
  useEffect(() => {
    setPosts(prevPosts => prevPosts.map(post => {
      // Update poster avatar
      const posterCharacter = characters.find(c => c.id === post.characterId);
      const updatedPost = {
        ...post,
        characterAvatar: posterCharacter?.avatar || null
      };

      // Update avatars in likes and comments
      if (updatedPost.likedBy) {
        updatedPost.likedBy = updatedPost.likedBy.map(like => {
          if (like.isCharacter) {
            const character = characters.find(c => c.id === like.userId);
            return { 
              ...like, 
              userAvatar: character?.avatar || undefined 
            };
          } else {
            return { 
              ...like, 
              userAvatar: user?.avatar || undefined 
            };
          }
        });
      }

      if (updatedPost.comments) {
        updatedPost.comments = updatedPost.comments.map(comment => {
          if (comment.type === 'character') {
            const character = characters.find(c => c.id === comment.userId);
            return { 
              ...comment, 
              userAvatar: character?.avatar || undefined 
            };
          } else {
            return { 
              ...comment, 
              userAvatar: user?.avatar || undefined 
            };
          }
        });
      }

      return updatedPost;
    }));
  }, [characters, user]);

  // Like handling
  const handleLike = useCallback(async (post: CirclePost) => {
    const character = characters.find(c => c.id === post.characterId);
    if (!character?.circlePosts) return;
  
    // 检查用户是否已经点赞
    const hasUserLiked = post.likedBy?.some(like => 
      !like.isCharacter && like.userId === 'user-1'
    );
  
    if (hasUserLiked) {
      // 如果用户已经点赞，则取消点赞
      const updatedPost = {
        ...post,
        likes: post.likes - 1,
        hasLiked: false,
        likedBy: post.likedBy?.filter(like => 
          like.isCharacter || like.userId !== 'user-1'
        )
      };
  
      const updatedPosts = character.circlePosts.map(p =>
        p.id === post.id ? updatedPost : p
      );
  
      await updateCharacter({
        ...character,
        circlePosts: updatedPosts,
      });
    } else {
      // 如果用户未点赞，则添加点赞
      const newLike: CircleLike = {
        userId: 'user-1',
        userName: user?.settings?.self.nickname || 'Me',
        userAvatar: user?.avatar,
        isCharacter: false,
        createdAt: new Date().toISOString()
      };
  
      const updatedPost = {
        ...post,
        likes: post.likes + 1,
        hasLiked: true,
        likedBy: [...(post.likedBy || []), newLike]
      };
  
      const updatedPosts = character.circlePosts.map(p =>
        p.id === post.id ? updatedPost : p
      );
  
      await updateCharacter({
        ...character,
        circlePosts: updatedPosts,
      });
    }
  }, [characters, updateCharacter, user]);

  // Comment handling
  const handleComment = useCallback(async (post: CirclePost) => {
    if (!commentText.trim() || !activePostId) return;
  
    const character = characters.find(c => c.id === post.characterId);
    if (!character?.circlePosts) return;
  
    try {
      // 获取API Key
      const apiKey = user?.settings?.chat?.characterApiKey;
      
      // 创建用户评论
      const newComment: CircleComment = {
        id: String(Date.now()),
        userId: 'user-1',
        userName: user?.settings?.self.nickname || 'Me',
        content: commentText.trim(),
        createdAt: new Date().toISOString(),
        type: 'user',
        replyTo: replyTo || undefined
      };
  
      // 更新帖子，添加用户评论
      let updatedPost = {
        ...post,
        comments: [...(post.comments || []), newComment],
      };
      
      // 现在使用 CircleService 获取角色回复
      if (!replyTo) {
        // 当用户直接评论帖子时，获取角色回复
        const response = await CircleService.processCommentInteraction(
          character,
          post,
          commentText.trim(),
          apiKey  // 传递API Key
        );
        
        if (response.success && response.action?.comment) {
          // 添加角色的回复评论
          const characterReply: CircleComment = {
            id: String(Date.now() + 1),
            userId: character.id,
            userName: character.name,
            userAvatar: character.avatar as string,
            content: response.action.comment,
            createdAt: new Date().toISOString(),
            type: 'character',
            replyTo: {
              userId: 'user-1',
              userName: user?.settings?.self.nickname || 'Me'
            }
          };
          
          updatedPost.comments.push(characterReply);
        }
      }
  
      // 更新角色的帖子列表
      const updatedPosts = character.circlePosts.map(p =>
        p.id === post.id ? updatedPost : p
      );
  
      await updateCharacter({
        ...character,
        circlePosts: updatedPosts,
      });
  
      // 重置状态
      setCommentText('');
      setActivePostId(null);
      setReplyTo(null);
  
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('评论失败', '发送评论时出现错误');
    }
  }, [activePostId, characters, commentText, replyTo, updateCharacter, user]);

  const handleReplyPress = useCallback((comment: CircleComment) => {
    setReplyTo({
      userId: comment.userId,
      userName: comment.userName
    });
    setActivePostId(activePostId);
  }, [activePostId]);

  const handleForward = useCallback(async (characterId: string, additionalMessage: string) => {
    if (!selectedPost) return;
  
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
  
    const forwardMessage = `${additionalMessage ? additionalMessage + '\n\n' : ''}转发自 ${selectedPost.characterName} 的朋友圈：\n${selectedPost.content}`;
  
    // 创建消息对象
    const message: Message = {
      id: String(Date.now()),
      text: forwardMessage,
      sender: 'user',
      timestamp: Date.now(),
    };
  
    try {
      // 获取API Key
      const apiKey = user?.settings?.chat?.characterApiKey;
      
      // 使用NodeST处理聊天消息，传递API Key
      const result = await CircleService.processCommentInteraction(
        character,
        selectedPost,
        forwardMessage,
        apiKey
      );
      
      // 添加用户的转发消息
      await addMessage(characterId, message);
      
      if (result.success && result.action?.comment) {
        // 添加角色的回复消息
        const botMessage: Message = {
          id: String(Date.now() + 1),
          text: result.action.comment,
          sender: 'bot',
          timestamp: Date.now(),
        };
        await addMessage(characterId, botMessage);
      } else {
        // 处理失败情况
        console.error('Failed to get character response:', result.error);
      }
    } catch (error) {
      console.error('Error forwarding message:', error);
      Alert.alert('Error', 'Failed to forward message');
    }
  
    setIsForwardSheetVisible(false);
    setSelectedPost(null);
  }, [selectedPost, addMessage, characters, user?.settings?.chat?.characterApiKey]);

  const scrollToPost = useCallback((postId: string) => {
    const postIndex = posts.findIndex(post => post.id === postId);
    if (postIndex !== -1) {
      // 添加延迟以确保键盘完全展开
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: postIndex,
          animated: true,
          viewOffset: 150, // 增加偏移量，确保评论框在键盘上方
        });
      }, 300); // 增加延迟时间
    }
  }, [posts]);

  const handleCommentPress = useCallback((postId: string) => {
    if (activePostId === postId) {
      setActivePostId(null);
      Keyboard.dismiss();
    } else {
      setActivePostId(postId);
    }
  }, [activePostId]);

  const handleFavorite = useCallback(async (post: CirclePost) => {
    const character = characters.find(c => c.id === post.characterId);
    if (!character) return;
    
    await toggleFavorite(character.id, post.id);
  }, [characters, toggleFavorite]);

  // Toggle test mode and run the test
  const toggleTestMode = useCallback(async () => {
    const newTestMode = !testModeEnabled;
    setTestModeEnabled(newTestMode);
    
    if (newTestMode) {
      await loadPosts(); // This will load the test post
      // Run the interaction test after a short delay to ensure UI is updated
      setTimeout(() => {
        handleCirclePostUpdate(testPost);
      }, 500);
    } else {
      // Switch back to normal mode
      loadPosts();
    }
  }, [testModeEnabled, loadPosts, handleCirclePostUpdate, testPost]);

  // Add new method to handle test post publishing
  const handlePublishTestPost = async () => {
    try {
      setPublishingPost(true);
      
      // 获取API Key
      const apiKey = user?.settings?.chat?.characterApiKey;
      
      // 使用CircleService创建测试帖子
      const { post, author } = await CircleService.publishTestPost(characters, apiKey);
      
      if (!post || !author) {
        Alert.alert('发布失败', '没有可用的角色或发布过程中出现错误');
        return;
      }
      
      // 创建新帖子列表，将新帖子放在顶部
      const updatedPosts = [post, ...posts];
      setPosts(updatedPosts);
      
      // 添加到作者的朋友圈帖子中
      const updatedAuthor = {
        ...author,
        circlePosts: [...(author.circlePosts || []), post]
      };
      
      // 更新角色
      await updateCharacter(updatedAuthor);
      
      // 显示通知
      Alert.alert('发布成功', `${author.name} 发布了新朋友圈`);
      
      // 开始让其他角色互动
      setTimeout(() => {
        handleCirclePostUpdate(post);
      }, 500);
      
    } catch (error) {
      console.error('【朋友圈测试】发布测试帖子失败:', error);
      Alert.alert('发布失败', '发布测试帖子时出现错误');
    } finally {
      setPublishingPost(false);
    }
  };

  // Comment rendering
  const renderComment = useCallback((comment: CircleComment) => {
    return (
      <View key={comment.id} style={styles.comment}>
        <Image
          source={comment.userAvatar ? { uri: comment.userAvatar } : require('@/assets/images/default-avatar.png')}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <Text style={styles.commentAuthor}>{comment.userName}</Text>
          <Text style={styles.commentText}>
            {comment.replyTo && <Text style={styles.replyText}>回复 {comment.replyTo.userName}：</Text>}
            {comment.content}
          </Text>
          <TouchableOpacity 
            style={styles.replyButton} 
            onPress={() => handleReplyPress(comment)}
          >
            <Text style={styles.replyButtonText}>回复</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [handleReplyPress]);

  const renderCommentInput = useCallback((post: CirclePost) => {
    return (
      <View style={styles.commentInput}>
        {replyTo && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyIndicatorText}>
              回复 {replyTo.userName}
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <MaterialIcons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          style={styles.commentTextInput}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={replyTo ? `回复 ${replyTo.userName}...` : "写评论..."}
          placeholderTextColor="#666"
          multiline={false}
          autoFocus={true}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => handleComment(post)}
        >
          <MaterialIcons name="send" size={24} color="#FF9ECD" />
        </TouchableOpacity>
      </View>
    );
  }, [commentText, replyTo, handleComment]);

  // Post rendering
  const renderPost: ListRenderItem<CirclePost> = useCallback(({ item }) => (
    <View style={styles.card} key={item.id}>
      <View style={styles.cardHeader}>
        <Image
          source={item.characterAvatar ? { uri: item.characterAvatar } : require('@/assets/images/default-avatar.png')}
          style={styles.authorAvatar}
        />
        <View>
          <Text style={styles.authorName}>{item.characterName}</Text>
          <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        
        {/* Show processing indicator for each character during test */}
        {testModeEnabled && processingCharacters.length > 0 && (
          <View style={styles.processingIndicator}>
            <ActivityIndicator size="small" color="#FF9ECD" />
            <Text style={styles.processingText}>处理中 ({processingCharacters.length})</Text>
          </View>
        )}
      </View>

      <Text style={styles.content}>{item.content}</Text>
      {item.images?.map((image, index) => (
        <Image key={index} source={{ uri: image }} style={styles.contentImage} />
      ))}

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
          <Ionicons
            name={item.hasLiked ? "heart" : "heart-outline"}
            size={24}
            color={item.hasLiked ? "#FF9ECD" : "#fff"}
          />
          <Text style={styles.actionText}>{item.likes}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleFavorite(item)}
        >
          <MaterialCommunityIcons
            name={item.isFavorited ? "bookmark" : "bookmark-outline"}
            size={24}
            color={item.isFavorited ? "#FFD700" : "#fff"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCommentPress(item.id)}
        >
          <MaterialIcons name="comment" size={24} color="#fff" />
          <Text style={styles.actionText}>{item.comments?.length || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedPost(item);
            setIsForwardSheetVisible(true);
          }}
        >
          <MaterialIcons name="share" size={24} color="#fff" />
          <Text style={styles.actionText}>转发</Text>
        </TouchableOpacity>
      </View>

      {/* Show likes */}
      {item.likes > 0 && (
        <View style={styles.likesContainer}>
          <Ionicons name="heart" size={16} color="#FF9ECD" style={styles.likeIcon} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.likeAvatars}>
            {item.likedBy?.map((like: CircleLike, index: number) => (
              <Image
                key={`${like.userId}-${index}`}
                source={
                  like.userAvatar
                    ? { uri: like.userAvatar }
                    : like.isCharacter
                      ? require('@/assets/images/default-avatar.png')
                      : require('@/assets/images/default-user-avatar.png')
                }
                style={styles.likeAvatar}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Show comments */}
      {item.comments?.map(comment => renderComment(comment))}
      
      {/* Show comment input if active */}
      {activePostId === item.id && renderCommentInput(item)}
    </View>
  ), [activePostId, renderComment, renderCommentInput, testModeEnabled, processingCharacters, handleLike, handleFavorite, handleCommentPress]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9ECD" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setIsLoading(true);
              loadPosts();
            }}
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.safeArea}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : -200}
      enabled={true}
    >
      <StatusBar barStyle="light-content" backgroundColor={styles.safeArea.backgroundColor} />
      <ImageBackground 
        source={require('@/assets/images/default-background.jpeg')}
        style={styles.backgroundImage}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>小窝</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[
                styles.headerButton,
                publishingPost && styles.headerButtonDisabled
              ]} 
              onPress={handlePublishTestPost}
              disabled={publishingPost}
            >
              {publishingPost ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.headerButtonText}>发布测试</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.headerButton, 
                testModeEnabled && styles.testButtonActive
              ]} 
              onPress={toggleTestMode}
            >
              <Text style={styles.headerButtonText}>
                {testModeEnabled ? '关闭测试' : '互动测试'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <FlatList
          ref={flatListRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无动态</Text>
            </View>
          }
        />
        
        {isForwardSheetVisible && selectedPost && (
          <ForwardSheet
            isVisible={isForwardSheetVisible}
            onClose={() => {
              setIsForwardSheetVisible(false);
              setSelectedPost(null);
            }}
            characters={characters}
            post={selectedPost}
            onForward={handleForward}
          />
        )}

        {/* 添加测试结果模态窗口 */}
        <TestResultsModal
          visible={showTestResults}
          onClose={() => setShowTestResults(false)}
          results={testResults}
        />
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // ...existing styles...
  
  // Add new styles
  testButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  testButtonActive: {
    backgroundColor: '#FF9ECD',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  processingText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#282828',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF9ECD',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(40, 40, 40, 0.7)',
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'relative',
  },
  headerText: {
    color: 'rgb(255, 224, 195)',
    fontSize: 20,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  // Card styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(51, 51, 51, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: 8,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timestamp: {
    color: '#777777',
    fontSize: 12,
  },
  content: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  contentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    marginLeft: 4,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  likeIcon: {
    marginRight: 8,
  },
  likeAvatars: {
    flexDirection: 'row',
  },
  likeAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 4,
    backgroundColor: '#444',
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  commentText: {
    color: '#FFFFFF',
    flexShrink: 1,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#444',
    position: 'relative',
    zIndex: 1,
    paddingBottom: Platform.OS === 'android' ? 4 : 0,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#444',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
  replyButton: {
    marginTop: 4,
    paddingVertical: 4,
  },
  replyButtonText: {
    color: '#666',
    fontSize: 12,
  },
  replyText: {
    color: '#FF9ECD',
    fontWeight: 'bold',
    marginRight: 4,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3a3a3a',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyIndicatorText: {
    color: '#fff',
    fontSize: 12,
  },
  headerButtons: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
  },
  headerButton: {
    backgroundColor: '#444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  headerButtonDisabled: {
    backgroundColor: '#666',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Explore;