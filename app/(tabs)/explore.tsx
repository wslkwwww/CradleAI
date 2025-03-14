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
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { CirclePost, CircleComment, CircleLike, Character, Message } from '@/shared/types';
import ForwardSheet from '@/components/ForwardSheet';
import TestResultsModal from '@/components/TestResultsModal';
import { useUser } from '@/constants/UserContext';
import { CircleService } from '@/services/circle-service';
import { RelationshipAction } from '@/shared/types/relationship-types';
import RelationshipActions from '@/components/RelationshipActions';
import { ActionService } from '@/services/action-service';
import CharacterSelector from '@/components/CharacterSelector';
import EmptyState from '@/components/EmptyState';
import RelationshipTestControls, { RelationshipTestOptions } from '@/components/RelationshipTestControls';
import RelationshipTestResults, { RelationshipTestResult } from '@/components/RelationshipTestResults';
import { RelationshipService, SocialInteraction, PostInteraction } from '@/services/relationship-service';
import { Relationship } from '@/shared/types/relationship-types';
import { format } from 'date-fns';
import { ActionType } from '@/shared/types/relationship-types';
import MessageBoxContent from '@/components/MessageBoxContent';
import ActionCard from '@/components/ActionCard';
import * as ImagePicker from 'expo-image-picker';

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
  const { characters, setCharacters, updateCharacter, toggleFavorite, addMessage } = useCharacters();
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
  
  // Tab Navigation state
  const [activeTab, setActiveTab] = useState<'circle' | 'relationships'>('circle');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<RelationshipAction[]>([]);
  const [isGeneratingActions, setIsGeneratingActions] = useState(false);

  // Add these states and variables for relationship testing
  const [isRunningRelationshipTest, setIsRunningRelationshipTest] = useState(false);
  const [relationshipTestResults, setRelationshipTestResults] = useState<RelationshipTestResult | null>(null);
  const [showRelationshipTestResults, setShowRelationshipTestResults] = useState(false);

  // Add state for message box modal
  const [showMessageBoxModal, setShowMessageBoxModal] = useState(false);
  const [showTestControlsModal, setShowTestControlsModal] = useState(false);

  // Add states for user post creation
  const [showUserPostModal, setShowUserPostModal] = useState(false);
  const [userPostText, setUserPostText] = useState('');
  const [userPostImages, setUserPostImages] = useState<string[]>([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  // Select first character as default when characters are loaded
  useEffect(() => {
    if (!isLoading && characters.length > 0 && !selectedCharacterId) {
      setSelectedCharacterId(characters[0].id);
    }
  }, [characters, isLoading, selectedCharacterId]);
  
  // Load the active character's pending actions
  useEffect(() => {
    if (selectedCharacterId && characters.length > 0) {
      const character = characters.find(c => c.id === selectedCharacterId);
      if (character) {
        // Filter pending actions for this character
        if (character.relationshipActions) {
          const now = Date.now();
          const pending = character.relationshipActions.filter(
            action => action.status === 'pending' && action.expiresAt > now
          );
          setPendingActions(pending);
        }
      }
    }
  }, [selectedCharacterId, characters]);

  // Generate new relationship actions
  const handleGenerateActions = async () => {
    if (!selectedCharacterId) return;
    
    const character = characters.find(c => c.id === selectedCharacterId);
    if (!character) return;
    
    setIsGeneratingActions(true);
    
    try {
      // Check for potential relationship actions
      const newActions = ActionService.checkForPotentialActions(character);
      
      if (newActions.length > 0) {
        // Update the character with new actions
        const updatedCharacter = {
          ...character,
          relationshipActions: [
            ...(character.relationshipActions || []),
            ...newActions
          ]
        };
        
        // Update character
        await updateCharacter(updatedCharacter);
        
        setPendingActions([...pendingActions, ...newActions]);
      } else {
        Alert.alert('提示', '没有新的关系行动可生成');
      }
    } catch (error) {
      console.error('Failed to generate relationship actions:', error);
      Alert.alert('错误', '生成关系行动时发生错误');
    } finally {
      setIsGeneratingActions(false);
    }
  };

  // Map characters object to an array for CharacterSelector
  const charactersArray = Object.values(characters || {});

  // Process characters update from RelationshipActions component
  const handleUpdateCharacters = (updatedCharacters: Character[]) => {
    setCharacters(updatedCharacters);
  };

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
      const apiSettings = {
        apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
        openrouter: user?.settings?.chat?.openrouter
      };

      if (!apiKey) {
        console.warn('【朋友圈测试】缺少API Key，将使用模拟数据');
      } else {
        console.log('【朋友圈测试】使用真实API Key进行调用');
      }
      
      // Process test interaction for all enabled characters using CircleService with API Key
      const { updatedPost, results } = await CircleService.processTestInteraction(
        testPost, 
        interactingCharacters,
        apiKey,
        apiSettings
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
        likedBy: [...(post.likedBy || [] as CircleLike[]), newLike]
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
      let updatedPost: CirclePost = {
        ...post,
        comments: [...(post.comments || []), newComment] as CircleComment[],
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
          
          (updatedPost.comments = updatedPost.comments || []).push(characterReply);
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
      const apiSettings = {
        apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
        openrouter: user?.settings?.chat?.openrouter
      };
      
      // 使用CircleService创建测试帖子
      const { post, author } = await CircleService.publishTestPost(characters, apiKey, apiSettings);
      
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

  // Add the relationship test functions
  const runRelationshipTest = async (options: RelationshipTestOptions) => {
    // Don't run if a test is already in progress
    if (isRunningRelationshipTest) return;
    
    setIsRunningRelationshipTest(true);
    const messages: string[] = [];
    
    const log = (message: string) => {
      console.log(`【关系测试】${message}`);
      if (options.showDetailedLogs) {
        messages.push(message);
      }
    };
    
    try {
      log('开始执行关系系统测试...');
      
      // 1. Select a character with relationship system enabled as the post author
      const eligibleAuthors = characters.filter(c => c.relationshipEnabled);
      
      if (eligibleAuthors.length === 0) {
        log('❌ 没有找到启用关系系统的角色，请先启用至少一个角色的关系系统');
        Alert.alert('测试失败', '没有找到启用关系系统的角色，请先启用至少一个角色的关系系统');
        setIsRunningRelationshipTest(false);
        return;
      }
      
      const author = eligibleAuthors[Math.floor(Math.random() * eligibleAuthors.length)];
      log(`选择 ${author.name} 作为帖子发布者`);
      
      // 2. Find interacting characters (with relationship system enabled but not the author)
      const interactors = characters.filter(c => 
        c.relationshipEnabled && c.id !== author.id
      );
      
      if (interactors.length === 0) {
        log('❌ 没有足够的角色进行互动测试，请启用至少两个角色的关系系统');
        Alert.alert('测试失败', '没有足够的角色进行互动测试，请启用至少两个角色的关系系统');
        setIsRunningRelationshipTest(false);
        return;
      }
      
      log(`找到 ${interactors.length} 个可用于互动的角色`);
      
      // 3. Record relationships before the test
      const beforeRelationships: Record<string, Relationship | null> = {};
      
      interactors.forEach(interactor => {
        const rel = author.relationshipMap?.relationships[interactor.id] || null;
        beforeRelationships[interactor.id] = rel ? {...rel} : null;
        
        if (rel) {
          log(`${author.name} 与 ${interactor.name} 的初始关系: 类型=${rel.type}, 强度=${rel.strength}, 互动次数=${rel.interactions}`);
        } else {
          log(`${author.name} 与 ${interactor.name} 尚无关系记录`);
        }
      });
      
      // 4. Generate test post content
      const postTemplates = [
        '今天的心情超级好！阳光明媚，万里无云，你们周末有什么计划吗？',
        '刚读完一本很棒的书，书名是《未来简史》，强烈推荐给大家！',
        '昨晚做了一个奇怪的梦，梦见自己在太空中漂浮，感觉既恐怖又奇妙...',
        '新学会了一道菜，红烧排骨，味道居然出乎意料的好，有没有人想要食谱？',
        '今天工作中遇到了一个难题，思考了一整天都没解决，有点沮丧...'
      ];
      
      const postContent = postTemplates[Math.floor(Math.random() * postTemplates.length)];
      log(`${author.name} 发布了帖子: "${postContent}"`);
      
      // 5. Record interactions
      const participants: {id: string; name: string; action: string}[] = [];
      
      // 6. Process interactions
      log('开始处理角色互动...');
      
      // Create a test post object
      const testPost = {
        id: `test-post-${Date.now()}`,
        characterId: author.id,
        characterName: author.name,
        characterAvatar: author.avatar || null,
        content: postContent,
        createdAt: new Date().toISOString(),
        comments: [], // Initialize as empty array
        likes: 0,
        hasLiked: false,
        likedBy: [] // Initialize as empty array
      };
      
      // Process interactions for each character
      for (const interactor of interactors) {
        try {
          // Randomly choose interaction type
          const interactionType = Math.random() > 0.4 ? 'comment' : 'like';
          let actionText = '';
          
          if (interactionType === 'like') {
            actionText = '点赞了帖子';
            log(`${interactor.name} 点赞了 ${author.name} 的帖子`);
            
            // Process like interaction
            let updatedAuthor = { ...author };
            if (!author.relationshipMap) {
              updatedAuthor = await RelationshipService.initializeRelationshipMap(author);
            }
            
            updatedAuthor = RelationshipService.processPostInteraction(
              updatedAuthor,
              interactor.id,
              interactor.name,
              'like',
              '点赞',
              testPost.id,
              testPost.content
            );
            
            // Apply strength modifier
            if (updatedAuthor.relationshipMap?.relationships[interactor.id]) {
              const rel = updatedAuthor.relationshipMap.relationships[interactor.id];
              
              // Add proper strength delta based on options
              const strengthDelta = options.strengthModifier;
              
              // Randomly choose positive or negative update
              const isPositive = Math.random() > 0.3; // 70% chance of positive
              
              if (isPositive) {
                rel.strength = Math.min(100, rel.strength + strengthDelta);
                log(`👍 ${author.name} 对 ${interactor.name} 的好感度增加了 ${strengthDelta} (${rel.strength})`);
              } else {
                rel.strength = Math.max(-100, rel.strength - strengthDelta);
                log(`👎 ${author.name} 对 ${interactor.name} 的好感度降低了 ${strengthDelta} (${rel.strength})`);
              }
              
              // Update relationship type
              const oldType = rel.type;
              rel.type = RelationshipService.getRelationshipTypeFromStrength(rel.strength);
              
              if (oldType !== rel.type) {
                log(`🔄 关系类型从 ${oldType} 变为 ${rel.type}`);
              }
              
              // Accelerate interaction count if enabled
              if (options.accelerateInteractions) {
                rel.interactions += 3; // Add extra interactions to accelerate action triggers
                log(`🔄 互动次数加速增长到 ${rel.interactions}`);
              }
            }
            
            // Add like to test post
            testPost.likes += 1;
            (testPost.likedBy = testPost.likedBy || [] as CircleLike[]).push({
              userId: interactor.id,
              userName: interactor.name,
              isCharacter: true,
              createdAt: new Date().toISOString()
            });
            
            // Update author
            await updateCharacter(updatedAuthor);
            
            // Record participant action
            participants.push({
              id: interactor.id,
              name: interactor.name,
              action: '点赞了帖子'
            });
            
          } else {
            // Comment interaction
            const commentTemplates = [
              '这个内容真有趣，谢谢分享！',
              '我也有类似的经历，感同身受。',
              '这让我想到了一些事情，改天我们聊聊？',
              '这真是太棒了，我很喜欢！',
              '有意思，不过我有不同的看法...'
            ];
            
            const commentContent = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
            actionText = `评论: "${commentContent}"`;
            log(`${interactor.name} 评论了 ${author.name} 的帖子: "${commentContent}"`);
            
            // Process comment interaction
            let updatedAuthor = { ...author };
            if (!author.relationshipMap) {
              updatedAuthor = await RelationshipService.initializeRelationshipMap(author);
            }
            
            updatedAuthor = RelationshipService.processPostInteraction(
              updatedAuthor,
              interactor.id,
              interactor.name,
              'comment',
              commentContent,
              testPost.id,
              testPost.content
            );
            
            // Apply strength modifier as with likes
            if (updatedAuthor.relationshipMap?.relationships[interactor.id]) {
              const rel = updatedAuthor.relationshipMap.relationships[interactor.id];
              
              // Comments have more impact than likes
              const strengthDelta = options.strengthModifier * 1.5;
              
              const isPositive = Math.random() > 0.2; // 80% chance of positive for comments
              
              if (isPositive) {
                rel.strength = Math.min(100, rel.strength + strengthDelta);
                log(`👍 ${author.name} 对 ${interactor.name} 的好感度增加了 ${strengthDelta} (${rel.strength})`);
              } else {
                rel.strength = Math.max(-100, rel.strength - strengthDelta);
                log(`👎 ${author.name} 对 ${interactor.name} 的好感度降低了 ${strengthDelta} (${rel.strength})`);
              }
              
              // Update relationship type
              const oldType = rel.type;
              rel.type = RelationshipService.getRelationshipTypeFromStrength(rel.strength);
              
              if (oldType !== rel.type) {
                log(`🔄 关系类型从 ${oldType} 变为 ${rel.type}`);
              }
              
              // Accelerate interaction count if enabled
              if (options.accelerateInteractions) {
                rel.interactions += 5; // Comments add more interactions
                log(`🔄 互动次数加速增长到 ${rel.interactions}`);
              }
            }
            
            // Add comment to test post
            (testPost.comments = testPost.comments || []).push({
              id: `comment-${Date.now()}-${interactor.id}`,
              userId: interactor.id,
              userName: interactor.name,
              content: commentContent,
              createdAt: new Date().toISOString(),
              type: 'character'
            });
            
            // Update author
            await updateCharacter(updatedAuthor);
            
            // Record participant action
            participants.push({
              id: interactor.id,
              name: interactor.name,
              action: `评论: "${commentContent}"`
            });
          }
        } catch (err) {
          log(`处理 ${interactor.name} 互动时出错: ${err}`);
        }
      }
      
      // 7. Check for relationship updates
      log('检查关系更新结果...');
      
      const relationshipUpdates: {
        targetId: string;
        targetName: string;
        before: Relationship | null;
        after: Relationship | null;
      }[] = [];
      
      // Get latest author data
      const updatedAuthor = characters.find(c => c.id === author.id);
      if (!updatedAuthor || !updatedAuthor.relationshipMap) {
        throw new Error('无法获取更新后的作者数据');
      }
      
      // Compare before and after relationships
      interactors.forEach(interactor => {
        const beforeRel = beforeRelationships[interactor.id];
        const afterRel = updatedAuthor.relationshipMap?.relationships[interactor.id] || null;
        
        relationshipUpdates.push({
          targetId: interactor.id,
          targetName: interactor.name,
          before: beforeRel,
          after: afterRel
        });
        
        if (beforeRel && afterRel) {
          if (beforeRel.strength !== afterRel.strength) {
            log(`${updatedAuthor.name} 对 ${interactor.name} 的关系强度: ${beforeRel.strength} -> ${afterRel.strength}`);
          }
          if (beforeRel.type !== afterRel.type) {
            log(`${updatedAuthor.name} 对 ${interactor.name} 的关系类型: ${beforeRel.type} -> ${afterRel.type}`);
          }
        } else if (!beforeRel && afterRel) {
          log(`${updatedAuthor.name} 与 ${interactor.name} 建立了新关系: 类型=${afterRel.type}, 强度=${afterRel.strength}`);
        }
      });
      
      // 8. Check for triggered actions
      log('检查是否触发关系行动...');
      
      const newActions = ActionService.checkForPotentialActions(updatedAuthor);
      log(`检测到 ${newActions.length} 个潜在关系行动`);
      
      if (newActions.length > 0) {
        const updatedAuthorWithActions = {
          ...updatedAuthor,
          relationshipActions: [
            ...(updatedAuthor.relationshipActions || []),
            ...newActions
          ]
        };
        
        await updateCharacter(updatedAuthorWithActions);
        
        // Log triggered actions
        newActions.forEach(action => {
          const targetChar = characters.find(c => c.id === action.targetCharacterId);
          log(`🎯 触发行动: ${action.type} - ${updatedAuthor.name} -> ${targetChar?.name || 'unknown'}`);
        });
      }
      
      // 9. Prepare test results
      const testResult: RelationshipTestResult = {
        postAuthor: {
          id: author.id,
          name: author.name
        },
        postContent,
        participants,
        relationshipUpdates,
        triggeredActions: newActions,
        messages
      };
      
      // 10. Display results
      setRelationshipTestResults(testResult);
      setShowRelationshipTestResults(true);
      
      log('测试完成');
      
    } catch (error) {
      console.error('【关系测试】测试过程出错:', error);
      Alert.alert('测试失败', '测试过程中发生错误');
    } finally {
      setIsRunningRelationshipTest(false);
    }
  };

  // Reset all relationships
  const resetAllRelationships = async () => {
    try {
      let updatedCount = 0;
      
      // Reset each character's relationship data
      for (const character of characters) {
        if (character.relationshipMap || character.messageBox || character.relationshipActions) {
          const resetCharacter = {
            ...character,
            relationshipMap: undefined,
            messageBox: undefined,
            relationshipActions: undefined
          };
          
          await updateCharacter(resetCharacter);
          updatedCount++;
        }
      }
      
      Alert.alert('重置完成', `已重置 ${updatedCount} 个角色的关系数据`);
    } catch (error) {
      console.error('重置关系数据失败:', error);
      Alert.alert('错误', '重置关系数据时发生错误');
    }
  };

  // Add function to handle image selection
  const handleSelectImages = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library');
        return;
      }
      
      // Launch image picker with Expo API
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 4,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        // Add selected images to state - extract URIs
        const imageUris = result.assets.map(asset => asset.uri);
        setUserPostImages([...userPostImages, ...imageUris]);
      }
    } catch (error) {
      console.error('Error selecting images:', error);
      Alert.alert('Error', 'Failed to select images');
    }
  };

  // Add function to create user post
  const handleCreateUserPost = async () => {
    if (!userPostText.trim() && userPostImages.length === 0) {
      Alert.alert('错误', '请输入文字或选择图片');
      return;
    }
    
    try {
      setIsCreatingPost(true);
      
      // Get API key and settings
      const apiKey = user?.settings?.chat?.characterApiKey;
      const apiSettings = {
        apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
        openrouter: user?.settings?.chat?.openrouter
      };
      
      // Create the user post object before sending to API
      const newPost: CirclePost = {
        id: `user-post-${Date.now()}`,
        characterId: 'user-1',
        characterName: user?.settings?.self.nickname || '我',
        characterAvatar: user?.avatar || null,
        content: userPostText,
        images: userPostImages,
        createdAt: new Date().toISOString(),
        comments: [],
        likes: 0,
        likedBy: [],
        hasLiked: false
      };
      
      // Add post to posts list immediately for better UX
      setPosts(prevPosts => [newPost, ...prevPosts]);
      
      // Close modal and reset form immediately
      setShowUserPostModal(false);
      setUserPostText('');
      setUserPostImages([]);
      
      // Show a temporary toast/alert that the post is being processed
      Alert.alert('发布成功', '你的朋友圈已发布，角色们将很快响应');
      
      // Now process character responses in the background
      CircleService.createUserPost(
        user?.settings?.self.nickname || '我',
        user?.avatar || null,
        userPostText,
        userPostImages,
        apiKey,
        apiSettings,
        characters // Pass the characters array
      ).then(({ post, responses }) => {
        // Update the post with character responses after they're ready
        setPosts(prevPosts => 
          prevPosts.map(p => p.id === newPost.id ? post : p)
        );
        
        // Optionally show a notification that responses have arrived
        const respondedCharacters = responses.filter(r => r.success).length;
        if (respondedCharacters > 0) {
          const likedPost = responses.filter(r => r.success && r.response?.action?.like).length;
          const commentedPost = responses.filter(r => r.success && r.response?.action?.comment).length;
          
          console.log(`【朋友圈】${respondedCharacters}个角色响应了你的帖子，其中${likedPost}个点赞，${commentedPost}个评论`);
        }
      }).catch(error => {
        console.error('处理角色响应失败:', error);
        // We don't need to alert the user since the post is already published
      });
      
    } catch (error) {
      console.error('创建用户帖子失败:', error);
      Alert.alert('错误', '发布失败，请稍后重试');
      setShowUserPostModal(false);
    } finally {
      setIsCreatingPost(false);
    }
  };

  const renderCircleHeaderButtons = () => (
    <View style={styles.circleHeaderButtons}>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => setShowUserPostModal(true)}
      >
        <Text style={styles.headerButtonText}>新建动态</Text>
      </TouchableOpacity>
      
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
          <Text style={styles.headerButtonText}>角色发布</Text>
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
  );

  const renderUserPostModal = () => (
    <Modal
      visible={showUserPostModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowUserPostModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.postModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>发布新动态</Text>
            <TouchableOpacity
              onPress={() => setShowUserPostModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.postInputContainer}>
            <TextInput
              style={styles.postTextInput}
              multiline
              placeholder="分享你的想法..."
              placeholderTextColor="#888"
              value={userPostText}
              onChangeText={setUserPostText}
              maxLength={500}
            />
            
            {/* Image preview section */}
            {userPostImages.length > 0 && (
              <View style={styles.imagePreviewContainer}>
                {userPostImages.map((uri, index) => (
                  <View key={index} style={styles.imagePreviewWrapper}>
                    <Image source={{ uri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => {
                        const newImages = [...userPostImages];
                        newImages.splice(index, 1);
                        setUserPostImages(newImages);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={styles.imagePickerButton}
                onPress={handleSelectImages}
                disabled={userPostImages.length >= 4}
              >
                <Ionicons 
                  name="image-outline" 
                  size={24} 
                  color={userPostImages.length >= 4 ? "#666" : "#fff"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.postSubmitButton,
                  (!userPostText.trim() && userPostImages.length === 0) && styles.disabledButton
                ]}
                onPress={handleCreateUserPost}
                disabled={isCreatingPost || (!userPostText.trim() && userPostImages.length === 0)}
              >
                {isCreatingPost ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.postSubmitButtonText}>发布</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isLoading && activeTab === 'circle') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9ECD" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && activeTab === 'circle') {
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

  // Change the CharacterSelector implementation to avoid nesting FlatLists
  const renderCharacterSelector = () => {
    if (!charactersArray || charactersArray.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.characterSelectorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.characterSelectorContent}
        >
          {charactersArray.filter(c => c.relationshipEnabled).map(character => (
            <TouchableOpacity
              key={character.id}
              style={[
                styles.characterAvatarContainer,
                selectedCharacterId === character.id && styles.selectedCharacterContainer
              ]}
              onPress={() => setSelectedCharacterId(character.id)}
            >
              <Image
                source={
                  character.avatar
                    ? { uri: character.avatar }
                    : require('@/assets/images/default-avatar.png')
                }
                style={[
                  styles.characterAvatar, 
                  selectedCharacterId === character.id && styles.selectedCharacterAvatar
                ]}
              />
              <Text
                style={[
                  styles.characterName,
                  selectedCharacterId === character.id && styles.selectedCharacterName
                ]}
                numberOfLines={1}
              >
                {character.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

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
        {/* 调整后的 Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'circle' && styles.activeTab]}
            onPress={() => setActiveTab('circle')}
          >
            <MaterialCommunityIcons 
              name="forum-outline" 
              size={20} 
              color={activeTab === 'circle' ? "#FF9ECD" : "#FFFFFF"} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'circle' && styles.activeTabText
            ]}>
              动态
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'relationships' && styles.activeTab]}
            onPress={() => setActiveTab('relationships')}
          >
            <MaterialCommunityIcons 
              name="account-multiple-outline" 
              size={20} 
              color={activeTab === 'relationships' ? "#FF9ECD" : "#FFFFFF"} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'relationships' && styles.activeTabText
            ]}>
              关系
            </Text>
          </TouchableOpacity>
        </View>

        {/* Circle Tab Content */}
        {activeTab === 'circle' && (
          <>
            {renderCircleHeaderButtons()}
            
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
          </>
        )}
        
        {/* Relationships Tab Content */}
        {activeTab === 'relationships' && (
          <View style={styles.relationshipsContainer}>
            {/* Character selector row with avatars */}
            <View style={styles.characterSelectorContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.characterSelectorContent}
              >
                {charactersArray.filter(c => c.relationshipEnabled).map(character => (
                  <TouchableOpacity
                    key={character.id}
                    style={[
                      styles.characterAvatarContainer,
                      selectedCharacterId === character.id && styles.selectedCharacterContainer
                    ]}
                    onPress={() => setSelectedCharacterId(character.id)}
                  >
                    <Image
                      source={
                        character.avatar
                          ? { uri: character.avatar }
                          : require('@/assets/images/default-avatar.png')
                      }
                      style={[
                        styles.characterAvatar, 
                        selectedCharacterId === character.id && styles.selectedCharacterAvatar
                      ]}
                    />
                    <Text
                      style={[
                        styles.characterName,
                        selectedCharacterId === character.id && styles.selectedCharacterName
                      ]}
                      numberOfLines={1}
                    >
                      {character.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            {selectedCharacterId ? (
              <View style={styles.relationshipActionsContainer}>
                {/* Action buttons toolbar */}
                <View style={styles.actionToolbar}>
                  <View style={styles.toolbarTitle}>
                    <Text style={styles.toolbarTitleText}>角色关系互动</Text>
                    {isGeneratingActions && <ActivityIndicator size="small" color="#FF9ECD" style={{marginLeft: 10}} />}
                  </View>
                  
                  <View style={styles.toolbarButtons}>
                    <TouchableOpacity 
                      style={styles.toolbarButton}
                      onPress={handleGenerateActions}
                      disabled={isGeneratingActions}
                    >
                      <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.toolbarButtonText}>生成行动</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.toolbarButton}
                      onPress={() => setShowMessageBoxModal(true)}
                    >
                      <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.toolbarButtonText}>消息盒子</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.toolbarButton}
                      onPress={() => setShowTestControlsModal(true)}
                    >
                      <FontAwesome5 name="flask" size={16} color="#FFFFFF" />
                      <Text style={styles.toolbarButtonText}>关系测试</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Main content - Relationship Actions */}
                {characters.find(c => c.id === selectedCharacterId)?.relationshipActions?.length === 0 ? (
                  <View style={styles.emptyActionsContainer}>
                    <Ionicons name="people-outline" size={64} color="#555" />
                    <Text style={styles.emptyActionsText}>暂无关系互动</Text>
                    <Text style={styles.emptyActionsSubtext}>
                      角色之间的互动会在此处显示，点击"生成行动"按钮尝试创建新的互动
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={
                      characters
                        .find(c => c.id === selectedCharacterId)
                        ?.relationshipActions?.sort((a, b) => b.createdAt - a.createdAt) || []
                    }
                    renderItem={({ item }) => (
                      <ActionCard
                        key={`action-${item.id}`} // Add explicit key here
                        action={item}
                        sourceCharacter={characters.find(c => c.id === item.sourceCharacterId)}
                        targetCharacter={characters.find(c => c.id === item.targetCharacterId)}
                        currentCharacterId={selectedCharacterId} // Pass the current character ID
                        onRespond={(response) => {
                          // Use the ActionService approach like in RelationshipActions
                          const updatedCharacters = ActionService.processActionResponse(
                            item,
                            response,
                            Object.fromEntries(charactersArray.map(c => [c.id, c]))
                          );
                          handleUpdateCharacters(Object.values(updatedCharacters));
                        }}
                      />
                    )}
                    keyExtractor={item => `action-${item.id}`} // Ensure unique keys in FlatList
                    contentContainerStyle={styles.actionsList}
                    ItemSeparatorComponent={() => <View style={styles.actionSeparator} />}
                    ListEmptyComponent={
                      <View style={styles.emptyActionsContainer}>
                        <Ionicons name="people-outline" size={64} color="#555" />
                        <Text style={styles.emptyActionsText}>暂无关系互动</Text>
                        <Text style={styles.emptyActionsSubtext}>
                          角色之间的互动会在此处显示，点击"生成行动"按钮尝试创建新的互动
                        </Text>
                      </View>
                    }
                  />
                )}
              </View>
            ) : (
              <View style={styles.noCharacterContainer}>
                <Ionicons name="person-circle-outline" size={80} color="#555" />
                <Text style={styles.noCharacterText}>请选择一个角色</Text>
                <Text style={styles.noCharacterSubtext}>点击上方的角色头像以查看其关系互动</Text>
              </View>
            )}
            
            {/* Message Box Modal */}
            <Modal
              visible={showMessageBoxModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowMessageBoxModal(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>消息盒子</Text>
                    <TouchableOpacity
                      onPress={() => setShowMessageBoxModal(false)}
                      style={styles.modalCloseButton}
                    >
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  
                  {selectedCharacterId && (
                    <MessageBoxContent
                      character={characters.find(c => c.id === selectedCharacterId)!}
                      onUpdateCharacter={updateCharacter}
                    />
                  )}
                </View>
              </View>
            </Modal>
            
            {/* Test Controls Modal */}
            <Modal
              visible={showTestControlsModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowTestControlsModal(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>关系测试</Text>
                    <TouchableOpacity
                      onPress={() => setShowTestControlsModal(false)}
                      style={styles.modalCloseButton}
                    >
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.modalBody}>
                    <RelationshipTestControls
                      characters={charactersArray}
                      onRunTest={(options) => {
                        runRelationshipTest(options);
                        setShowTestControlsModal(false);
                      }}
                      onResetRelationships={() => {
                        resetAllRelationships();
                        setShowTestControlsModal(false);
                      }}
                      isRunningTest={isRunningRelationshipTest}
                    />
                  </View>
                </View>
              </View>
            </Modal>

            {/* Keep the existing RelationshipTestResults modal */}
            <RelationshipTestResults
              visible={showRelationshipTestResults}
              onClose={() => setShowRelationshipTestResults(false)}
              results={relationshipTestResults}
            />
          </View>
        )}
        
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

        {/* 测试结果模态窗口 */}
        <TestResultsModal
          visible={showTestResults}
          onClose={() => setShowTestResults(false)}
          results={testResults}
        />

        {/* Relationship Test Results Modal */}
        <RelationshipTestResults
          visible={showRelationshipTestResults}
          onClose={() => setShowRelationshipTestResults(false)}
          results={relationshipTestResults}
        />

        {/* User Post Modal */}
        {renderUserPostModal()}
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // Existing tab navigation styles
  // ...
  
  // Post and card styles
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
  actionText: {
    color: '#FFFFFF',
    marginLeft: 4,
  },
  
  // Like section styles
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
  
  // Comment styles
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
  replyText: {
    color: '#FF9ECD',
    fontWeight: 'bold',
    marginRight: 4,
  },
  replyButton: {
    marginTop: 4,
    paddingVertical: 4,
  },
  replyButtonText: {
    color: '#666',
    fontSize: 12,
  },
  
  // Comment input styles
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
  
  // The rest of your existing styles
  // ...
  // Tab navigation styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: Platform.OS === 'ios' ? 47 : StatusBar.currentHeight, // 调整顶部内边距
    height: Platform.OS === 'ios' ? 90 : 90, // 确保总高度与其他页面一致
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12, // 调整底部内边距
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FFFFFF',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF9ECD',
  },
  activeTabText: {
    color: '#FF9ECD',
    fontWeight: '500',
  },
  relationshipsContent: {
    flex: 1,
    backgroundColor: 'rgba(40, 40, 40, 0.7)',
  },
  actionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9ECD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  generateButtonText: {
    color: '#ffffff',
    marginLeft: 6,
    fontWeight: '500',
  },
  circleHeaderButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: 'rgba(51, 51, 51, 0.95)',
  },
  
  // These style properties should be moved from your existing styles
  // to create comprehensive styles list
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
  listContainer: {
    padding: 16,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
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
  testButtonActive: {
    backgroundColor: '#FF9ECD',
  },
  testControlContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  
  // Updated relationship container styles
  relationshipsContainer: {
    flex: 1,
    backgroundColor: 'rgba(40, 40, 40, 0.7)',
  },
  
  // Character selector styles
  characterSelectorContainer: {
    backgroundColor: 'rgba(51, 51, 51, 0.95)',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  characterSelectorContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  characterAvatarContainer: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 70,
    opacity: 0.7,
  },
  selectedCharacterContainer: {
    opacity: 1,
  },
  characterAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  selectedCharacterAvatar: {
    borderColor: '#FF9ECD',
    borderWidth: 3,
  },
  characterName: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    width: 70,
  },
  selectedCharacterName: {
    fontWeight: 'bold',
    color: '#FF9ECD',
  },
  
  // Action toolbar styles
  actionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  toolbarTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toolbarButtons: {
    flexDirection: 'row',
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginLeft: 8,
  },
  toolbarButtonText: {
    color: '#FFFFFF',
    marginLeft: 6,
    fontSize: 14,
  },
  
  // Relationship actions container
  relationshipActionsContainer: {
    flex: 1,
  },
  actionsList: {
    padding: 16,
  },
  actionSeparator: {
    height: 16,
  },
  
  // Action card styles
  actionCard: {
    backgroundColor: 'rgba(51, 51, 51, 0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCharacters: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  actionAvatarPlaceholder: {
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionArrow: {
    marginHorizontal: 8,
  },
  actionStatus: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  actionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 156, 205, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  actionType: {
    color: '#FF9ECD',
    fontSize: 14,
    fontWeight: '500',
  },
  actionContent: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  actionTime: {
    color: '#999',
    fontSize: 12,
  },
  responseContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  responseLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  responseContent: {
    color: '#fff',
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#4CAF50', // Green
  },
  rejectButton: {
    backgroundColor: '#F44336', // Red
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  
  // Empty states
  noCharacterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noCharacterText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  noCharacterSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyActionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 300,
  },
  emptyActionsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  emptyActionsSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 300,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 156, 205, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  
  // Message Box styles
  emptyMessagesContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessagesText: {
    color: '#999',
    marginTop: 16,
    fontSize: 16,
  },
  messagesList: {
    padding: 16,
  },
  messageItem: {
    backgroundColor: 'rgba(40, 40, 40, 0.7)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageSender: {
    color: '#FF9ECD',
    fontWeight: '600',
    fontSize: 16,
  },
  messageTime: {
    color: '#999',
    fontSize: 12,
  },
  messageContent: {
    color: '#fff',
    fontSize: 15,
  },
  messageContext: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  contextLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  contextContent: {
    color: '#ddd',
    fontSize: 14,
  },

  // New styles for user post modal
  postModalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
  },
  postInputContainer: {
    padding: 16,
  },
  postTextInput: {
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  imagePickerButton: {
    padding: 10,
  },
  postSubmitButton: {
    backgroundColor: '#FF9ECD',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  postSubmitButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 16,
  },
});

export default Explore;