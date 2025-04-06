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
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5, Feather, AntDesign } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { CirclePost, CircleComment, CircleLike, Character, Message } from '@/shared/types';
import ForwardSheet from '@/components/ForwardSheet';
import TestResultsModal from '@/components/TestResultsModal';
import { useUser } from '@/constants/UserContext';
import { CircleService } from '@/services/circle-service';
import { RelationshipAction } from '@/shared/types/relationship-types';
import { ActionService } from '@/services/action-service';
import RelationshipTestResults, { RelationshipTestResult } from '@/components/RelationshipTestResults';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import FavoriteList from '@/components/FavoriteList';
import ImageViewer from '@/components/ImageViewer';
import CharacterInteractionSettings from '@/components/CharacterInteractionSettings';
import { theme } from '@/constants/theme';

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

  // Add these new state variables
  const [refreshing, setRefreshing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Add new states for image viewer and favorite list
  const [showFavoriteList, setShowFavoriteList] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Add new state for character interaction settings modal
  const [showInteractionSettings, setShowInteractionSettings] = useState(false);

  // Add a new state to track expanded thought bubbles
  const [expandedThoughts, setExpandedThoughts] = useState<{[key: string]: boolean}>({});

  // Add new state to track when comment input is active
  const [isCommentInputActive, setIsCommentInputActive] = useState(false);

  // Add the image handling function before renderPost
  const handleImagePress = useCallback((images: string[], index: number) => {
    setSelectedImages(images);
    setCurrentImageIndex(index);
    setIsImageViewerVisible(true);
  }, []);

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

      // Load posts from AsyncStorage and merge with character posts
      const storedPosts = await CircleService.loadSavedPosts();
      const refreshedPosts = await CircleService.refreshPosts(
        characters,
        storedPosts,
        user?.settings?.chat?.characterApiKey,
        {
          apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
          openrouter: user?.settings?.chat?.openrouter
        }
      );
      
      // Update favorite status for each post
      const postsWithFavoriteStatus = refreshedPosts.map(post => {
        const character = characters.find(c => c.id === post.characterId);
        const isFavorited = character?.favoritedPosts?.includes(post.id) || false;
        return { ...post, isFavorited };
      });
      
      setPosts(postsWithFavoriteStatus);
      console.log(`【朋友圈】加载了 ${postsWithFavoriteStatus.length} 条帖子`);
      
    } catch (err) {
      console.error('【朋友圈】加载帖子失败:', err);
      setError('加载动态失败，请重试');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [characters, testModeEnabled, testPost, user?.settings?.chat]);

  // Add pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [loadPosts]);
  
  // Add useFocusEffect to reload posts when the tab is focused
  useFocusEffect(
    useCallback(() => {
      if (characters.length > 0 && activeTab === 'circle') {
        loadPosts();
      }
    }, [characters, loadPosts, activeTab])
  );

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
    try {
      // Check if user has already liked the post
      const hasUserLiked = post.likedBy?.some(like => 
        !like.isCharacter && like.userId === 'user-1'
      );
      
      let updatedPost: CirclePost;
    
      if (hasUserLiked) {
        // Remove like
        updatedPost = {
          ...post,
          likes: post.likes - 1,
          hasLiked: false,
          likedBy: post.likedBy?.filter(like => 
            like.isCharacter || like.userId !== 'user-1'
          )
        };
      } else {
        // Add like
        const newLike: CircleLike = {
          userId: 'user-1',
          userName: user?.settings?.self.nickname || '我',
          userAvatar: user?.avatar,
          isCharacter: false,
          createdAt: new Date().toISOString()
        };
  
        updatedPost = {
          ...post,
          likes: post.likes + 1,
          hasLiked: true,
          likedBy: [...(post.likedBy || [] as CircleLike[]), newLike]
        };
      }
      
      // Update the posts state without reloading
      setPosts(prevPosts => prevPosts.map(p => p.id === post.id ? updatedPost : p));
      
      // Save to AsyncStorage in the background
      AsyncStorage.setItem('circle_posts', JSON.stringify(
        posts.map(p => p.id === post.id ? updatedPost : p)
      ));
      
      // If this is a character's post, update the character data in the background
      if (post.characterId !== 'user-1') {
        const character = characters.find(c => c.id === post.characterId);
        if (character?.circlePosts) {
          const updatedCharacterPosts = character.circlePosts.map(p =>
            p.id === post.id ? updatedPost : p
          );
      
          await updateCharacter({
            ...character,
            circlePosts: updatedCharacterPosts,
          });
        }
      }
    } catch (error) {
      console.error('【朋友圈】点赞操作失败:', error);
      Alert.alert('操作失败', '无法完成点赞操作');
    }
  }, [characters, posts, updateCharacter, user]);

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
      
      // Create the user post object
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
      
      // Update posts state with the new post
      const updatedPosts = [newPost, ...posts];
      setPosts(updatedPosts);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('circle_posts', JSON.stringify(updatedPosts));
      
      // Close modal and reset form immediately
      setShowUserPostModal(false);
      setUserPostText('');
      setUserPostImages([]);
      
      // Show a temporary toast/alert
      Alert.alert('发布成功', '你的朋友圈已发布，角色们将很快响应');
      
      // Process character responses in the background
      CircleService.createUserPost(
        user?.settings?.self.nickname || '我',
        user?.avatar || null,
        userPostText,
        userPostImages,
        apiKey,
        apiSettings,
        characters
      ).then(({ post, responses }) => {
        // Update the post with character responses
        setPosts(prevPosts => {
          const updatedPosts = prevPosts.map(p => p.id === newPost.id ? post : p);
          // Save updated posts to AsyncStorage
          AsyncStorage.setItem('circle_posts', JSON.stringify(updatedPosts))
            .catch(error => console.error('【朋友圈】保存更新的帖子失败:', error));
          return updatedPosts;
        });
        
        // Log response stats
        const respondedCharacters = responses.filter(r => r.success).length;
        if (respondedCharacters > 0) {
          const likedPost = responses.filter(r => r.success && r.response?.action?.like).length;
          const commentedPost = responses.filter(r => r.success && r.response?.action?.comment).length;
          
          console.log(`【朋友圈】${respondedCharacters}个角色响应了你的帖子，其中${likedPost}个点赞，${commentedPost}个评论`);
        }
      }).catch(error => {
        console.error('处理角色响应失败:', error);
      });
      
    } catch (error) {
      console.error('创建用户帖子失败:', error);
      Alert.alert('错误', '发布失败，请稍后重试');
      setShowUserPostModal(false);
    } finally {
      setIsCreatingPost(false);
    }
  };

  // Comment handling
  const handleComment = useCallback(async (post: CirclePost) => {
    if (!commentText.trim() || !activePostId) return;
  
    try {
      // Create user comment
      const newComment: CircleComment = {
        id: String(Date.now()),
        userId: 'user-1',
        userName: user?.settings?.self.nickname || '我',
        content: commentText.trim(),
        createdAt: new Date().toISOString(),
        type: 'user',
        replyTo: replyTo || undefined,
        userAvatar: user?.avatar || undefined
      };
  
      // Update the post with the new comment immediately
      let updatedPost: CirclePost = {
        ...post,
        comments: [...(post.comments || []), newComment] as CircleComment[],
      };
      
      // Update posts state without reloading
      setPosts(prevPosts => prevPosts.map(p => p.id === post.id ? updatedPost : p));
  
      // Reset input state
      setCommentText('');
      setActivePostId(null);
      setReplyTo(null);
      setIsCommentInputActive(false);
  
      // Save to AsyncStorage in the background
      try {
        const allPosts = await CircleService.loadSavedPosts();
        const updatedPosts = allPosts.map(p => p.id === post.id ? updatedPost : p);
        await CircleService.savePosts(updatedPosts);
      } catch (error) {
        console.error('保存帖子到存储失败:', error);
      }
      
      // Continue with character response handling
      // Only if this is a character's post (not a user post) and we're not replying to someone else
      if (post.characterId !== 'user-1') {
        const character = characters.find(c => c.id === post.characterId);
        if (character) {
          // Process the interaction through CircleService
          const response = await CircleService.processCommentInteraction(
            character,
            post,
            commentText.trim(),
            user?.settings?.chat?.characterApiKey,
            replyTo || undefined, // Convert null to undefined
            {
              apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
              openrouter: user?.settings?.chat?.openrouter
            }
          );
          
          if (response.success && response.action?.comment) {
            // Add character's reply comment
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
                userName: user?.settings?.self.nickname || '我'
              },
              thoughts: response.thoughts // Add thoughts if available
            };
            
            // Update with the character's comment
            updatedPost = {
              ...updatedPost,
              comments: [...(updatedPost.comments || []), characterReply]
            };
            
            // Update posts state again without reloading
            setPosts(prevPosts => prevPosts.map(p => p.id === post.id ? updatedPost : p));
            
            // Save the updated post with character's response
            try {
              const allPosts = await CircleService.loadSavedPosts();
              const updatedPosts = allPosts.map(p => p.id === post.id ? updatedPost : p);
              await CircleService.savePosts(updatedPosts);
            } catch (error) {
              console.error('保存带角色回复的帖子到存储失败:', error);
            }
          }
        }
      }
      
      // Handle comment reply to character's comment (new feature)
      if (replyTo && replyTo.userId !== 'user-1' && replyTo.userId !== post.characterId) {
        // Find the commented character
        const commentedCharacter = characters.find(c => c.id === replyTo.userId);
        if (commentedCharacter) {
          console.log(`【朋友圈】用户回复了角色 ${commentedCharacter.name} 的评论`);
          
          // Process the comment interaction
          const response = await CircleService.processCommentInteraction(
            commentedCharacter,
            post,
            commentText.trim(),
            user?.settings?.chat?.characterApiKey,
            {
              userId: 'user-1',
              userName: user?.settings?.self.nickname || '我'
            },
            {
              apiProvider: user?.settings?.chat?.apiProvider || 'gemini',
              openrouter: user?.settings?.chat?.openrouter
            }
          );
          
          if (response.success && response.action?.comment) {
            // Add character's reply to the user's reply
            const characterReply: CircleComment = {
              id: String(Date.now() + 2),
              userId: commentedCharacter.id,
              userName: commentedCharacter.name,
              userAvatar: commentedCharacter.avatar as string,
              content: response.action.comment,
              createdAt: new Date().toISOString(),
              type: 'character',
              replyTo: {
                userId: 'user-1',
                userName: user?.settings?.self.nickname || '我'
              },
              thoughts: response.thoughts // Add thoughts if available
            };
            
            // Update with the character's reply
            updatedPost = {
              ...updatedPost,
              comments: [...updatedPost.comments, characterReply]
            };
            
            // Update posts state again
            setPosts(prevPosts => prevPosts.map(p => p.id === post.id ? updatedPost : p));
            
            // Save the updated post with character's reply
            try {
              const allPosts = await CircleService.loadSavedPosts();
              const updatedPosts = allPosts.map(p => p.id === post.id ? updatedPost : p);
              await CircleService.savePosts(updatedPosts);
            } catch (error) {
              console.error('保存带角色回复的帖子到存储失败:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('发送评论失败:', error);
      Alert.alert('评论失败', '发送评论时出现错误');
    }
  }, [activePostId, commentText, replyTo, characters, user, posts]);

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

  const toggleThoughtExpansion = useCallback((commentId: string) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  }, []);

  const handleReplyPress = useCallback((comment: CircleComment) => {
    setReplyTo({
      userId: comment.userId,
      userName: comment.userName
    });
    
    // Find the post that contains this comment
    const postId = posts.find(p => 
      p.comments?.some(c => c.id === comment.id)
    )?.id;
    
    if (postId) {
      // Set the active post ID to enable comment input on the correct post
      setActivePostId(postId);
      setIsCommentInputActive(true);
      
      // Focus on comment area and scroll
      setTimeout(() => {
        scrollToPost(postId);
      }, 200);
    } else {
      // If we can't find the post, at least set the active comment state
      setIsCommentInputActive(true);
    }
  }, [posts, scrollToPost]);

  const handleCommentPress = useCallback((postId: string) => {
    if (activePostId === postId) {
      setActivePostId(null);
      setIsCommentInputActive(false);
      Keyboard.dismiss();
    } else {
      setActivePostId(postId);
      setIsCommentInputActive(true);
    }
  }, [activePostId]);

  const handleFavorite = useCallback(async (post: CirclePost) => {
    try {
      const character = characters.find(c => c.id === post.characterId);
      if (!character) return;
      
      // Toggle favorite status first to provide immediate UI feedback
      const newFavoriteStatus = !post.isFavorited;
      
      // Update local posts state immediately for UI feedback
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === post.id) {
          return { ...p, isFavorited: newFavoriteStatus };
        }
        return p;
      }));
      
      // Then persist the change through the context
      await toggleFavorite(character.id, post.id);
      
      // Show feedback
      const actionText = newFavoriteStatus ? '已加入收藏' : '已取消收藏';
      console.log(`【朋友圈】${actionText}: ${post.characterName} 的帖子`);
      
    } catch (error) {
      // If error occurs, revert the UI change
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === post.id) {
          return { ...p, isFavorited: !p.isFavorited };
        }
        return p;
      }));
      
      console.error('【朋友圈】收藏操作失败:', error);
      Alert.alert('操作失败', '无法完成收藏操作');
    }
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
    const hasThoughts = !!comment.thoughts;
    const isExpanded = expandedThoughts[comment.id] || false;

    return (
      <View key={comment.id} style={styles.comment}>
        <Image
          source={comment.userAvatar ? { uri: comment.userAvatar } : require('@/assets/images/default-avatar.png')}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <Text style={styles.commentAuthor}>{comment.userName}</Text>
          
          {/* Display thoughts if available */}
          {hasThoughts && (
            <View style={styles.thoughtsContainer}>
              <TouchableOpacity 
                style={styles.thoughtsHeader}
                onPress={() => toggleThoughtExpansion(comment.id)}
              >
                <Text style={styles.thoughtsTitle}>
                  {isExpanded ? '收起内心想法' : '查看内心想法'}
                </Text>
                <AntDesign 
                  name={isExpanded ? 'caretup' : 'caretdown'} 
                  size={12} 
                  color={theme.colors.textSecondary} 
                />
              </TouchableOpacity>
              
              {isExpanded && (
                <View style={styles.thoughtsBubble}>
                  <Text style={styles.thoughtsText}>{comment.thoughts}</Text>
                </View>
              )}
            </View>
          )}
          
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
  }, [handleReplyPress, expandedThoughts, toggleThoughtExpansion]);

  // Listen to keyboard events to update comment input state
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setIsCommentInputActive(true);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // Add delay to prevent flashing of the FAB
        setTimeout(() => {
          if (!activePostId) {
            setIsCommentInputActive(false);
          }
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [activePostId]);
  
  // Add listener for comment input blur
  const commentInputRef = useRef<TextInput>(null);
  useEffect(() => {
    return () => {
      setIsCommentInputActive(false);
    };
  }, []);

  // Update renderCommentInput to add ref and handle blur
  const renderCommentInput = useCallback((post: CirclePost) => {
    return (
      <View style={styles.commentInput}>
        {replyTo && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyIndicatorText}>
              回复 {replyTo.userName}
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          ref={commentInputRef}
          style={styles.commentTextInput}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={replyTo ? `回复 ${replyTo.userName}...` : "写评论..."}
          placeholderTextColor={theme.colors.textSecondary}
          multiline={false}
          autoFocus={true}
          blurOnSubmit={false}
          onBlur={() => {
            if (!commentText.trim()) {
              setIsCommentInputActive(false);
            }
          }}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => handleComment(post)}
        >
          <MaterialIcons name="send" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }, [commentText, replyTo, handleComment]);

  // Add function to handle post deletion
  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      setDeletingPostId(postId);
      const postToDelete = posts.find(p => p.id === postId);
      if (!postToDelete) return;
      
      // If it's a character post, update the character data
      if (postToDelete.characterId !== 'user-1') {
        const character = characters.find(c => c.id === postToDelete.characterId);
        if (character?.circlePosts) {
          const updatedPosts = character.circlePosts.filter(p => p.id !== postId);
          await updateCharacter({
            ...character,
            circlePosts: updatedPosts,
          });
        }
      }
      
      // Update the posts state
      const updatedPosts = posts.filter(p => p.id !== postId);
      setPosts(updatedPosts);
      
      // Update AsyncStorage
      await AsyncStorage.setItem('circle_posts', JSON.stringify(updatedPosts));
      console.log(`【朋友圈】已删除帖子 ID: ${postId}, 剩余 ${updatedPosts.length} 条帖子`);
    } catch (error) {
      console.error('【朋友圈】删除帖子失败:', error);
      Alert.alert('删除失败', '无法删除此帖子');
    } finally {
      setDeletingPostId(null);
    }
  }, [posts, characters, updateCharacter]);

  // Add post menu for deletion - update to allow deletion of character posts too
  const showPostMenu = useCallback((post: CirclePost) => {
    // Allow deletion of user's posts and character posts
    const isUserPost = post.characterId === 'user-1';
    const isCharacterPost = !isUserPost;
    
    const options: Array<{
      text: string;
      onPress?: () => void;
      style: 'default' | 'cancel' | 'destructive';
    }> = [];
    
    // Add delete option (available for all posts)
    options.push({
      text: '删除',
      onPress: () => {
        Alert.alert(
          '确认删除',
          isUserPost 
            ? '确定要删除这条帖子吗？此操作不可撤销。'
            : `确定要删除 ${post.characterName} 的这条帖子吗？此操作不可撤销。`,
          [
            {
              text: '取消',
              style: 'cancel'
            },
            {
              text: '删除',
              onPress: () => handleDeletePost(post.id),
              style: 'destructive'
            }
          ]
        );
      },
      style: 'destructive'
    });
    
    // Add cancel option
    options.push({
      text: '取消',
      style: 'cancel'
    });
    
    // Show alert with options
    Alert.alert(
      '帖子操作',
      '请选择要执行的操作',
      options
    );
  }, [handleDeletePost]);

  // Post rendering
  const renderPost: ListRenderItem<CirclePost> = useCallback(({ item }) => (
    <TouchableOpacity
      activeOpacity={1}
      onLongPress={() => showPostMenu(item)}
      delayLongPress={500}
      style={styles.card}
      key={item.id}
    >
      <View style={styles.cardHeader}>
        <Image
          source={item.characterAvatar ? { uri: item.characterAvatar } : require('@/assets/images/default-avatar.png')}
          style={styles.authorAvatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{item.characterName}</Text>
          <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        
        {/* Show deletion indicator */}
        {deletingPostId === item.id && (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: theme.spacing.sm }} />
        )}
        
        {/* Show test processing indicator */}
        {testModeEnabled && processingCharacters.length > 0 && (
          <View style={styles.processingIndicator}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.processingText}>处理中 ({processingCharacters.length})</Text>
          </View>
        )}
        
        {/* Add menu button for all posts - modified to allow for all posts */}
        <TouchableOpacity 
          style={styles.postMenuButton}
          onPress={() => showPostMenu(item)}
        >
          <MaterialIcons name="more-vert" size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <Text style={styles.content}>{item.content}</Text>
      
      {/* Show post thoughts if available */}
      {item.thoughts && (
        <View style={styles.thoughtsContainer}>
          <TouchableOpacity 
            style={styles.thoughtsHeader}
            onPress={() => toggleThoughtExpansion(`post-${item.id}`)}
          >
            <Text style={styles.thoughtsTitle}>
              {expandedThoughts[`post-${item.id}`] ? '收起发布想法' : '查看发布想法'}
            </Text>
            <AntDesign 
              name={expandedThoughts[`post-${item.id}`] ? 'caretup' : 'caretdown'} 
              size={12} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>
          
          {expandedThoughts[`post-${item.id}`] && (
            <View style={styles.thoughtsBubble}>
              <Text style={styles.thoughtsText}>{item.thoughts}</Text>
            </View>
          )}
        </View>
      )}
      
      {/* Show images if available */}
      {item.images && item.images.length > 0 && (
        <View style={styles.imagesContainer}>
          {item.images.map((image, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleImagePress(item.images!, index)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: image }} style={styles.contentImage} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
          <Ionicons
            name={item.hasLiked ? "heart" : "heart-outline"}
            size={24}
            color={item.hasLiked ? theme.colors.primary : theme.colors.white}
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
            color={item.isFavorited ? theme.colors.accent : theme.colors.white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCommentPress(item.id)}
        >
          <MaterialIcons name="comment" size={24} color={theme.colors.white} />
          <Text style={styles.actionText}>{item.comments?.length || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedPost(item);
            setIsForwardSheetVisible(true);
          }}
        >
          <MaterialIcons name="share" size={24} color={theme.colors.white} />
          <Text style={styles.actionText}>转发</Text>
        </TouchableOpacity>
      </View>

      {/* Show likes */}
      {item.likes > 0 && (
        <View style={styles.likesContainer}>
          <Ionicons name="heart" size={16} color={theme.colors.primary} style={styles.likeIcon} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.likeAvatars}>
            {item.likedBy?.map((like: CircleLike, index: number) => (
              <TouchableOpacity 
                key={`${like.userId}-${index}`}
                onPress={() => {
                  // Show like thoughts if available
                  if (like.thoughts) {
                    const likeId = `like-${like.userId}-${index}`;
                    toggleThoughtExpansion(likeId);
                  }
                }}
              >
                <Image
                  source={
                    like.userAvatar
                      ? { uri: like.userAvatar }
                      : like.isCharacter
                        ? require('@/assets/images/default-avatar.png')
                        : require('@/assets/images/default-user-avatar.png')
                  }
                  style={styles.likeAvatar}
                />
                
                {/* Display like thoughts in a tooltip/popup if available */}
                {like.thoughts && expandedThoughts[`like-${like.userId}-${index}`] && (
                  <View style={styles.likeThoughtsBubble}>
                    <Text style={styles.thoughtsText}>{like.thoughts}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Show comments */}
      {item.comments?.map(comment => renderComment(comment))}
      
      {/* Show comment input if active */}
      {activePostId === item.id && renderCommentInput(item)}
    </TouchableOpacity>
  ), [activePostId, renderComment, renderCommentInput, testModeEnabled, processingCharacters, 
      handleLike, handleFavorite, handleCommentPress, deletingPostId, showPostMenu, handleImagePress,
      expandedThoughts, toggleThoughtExpansion]);

  const renderCircleHeaderButtons = () => (
    <View style={styles.circleHeaderButtons}>
      {/* Add Character Interaction Settings button */}
      <TouchableOpacity 
        style={styles.iconButton}
        onPress={() => setShowInteractionSettings(true)}
      >
        <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
      </TouchableOpacity>

      {/* Add Favorite List button */}
      <TouchableOpacity 
        style={styles.iconButton}
        onPress={() => setShowFavoriteList(true)}
      >
        <MaterialCommunityIcons name="bookmark-outline" size={24} color={theme.colors.text} />
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
          <ActivityIndicator size="small" color={theme.colors.white} />
        ) : (
          <View style={styles.headerButtonContent}>
            <MaterialIcons name="auto-awesome" size={16} color={theme.colors.white} />
            <Text style={styles.headerButtonText}>角色发布</Text>
          </View>
        )}
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
              <Ionicons name="close" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.postInputContainer}>
            <TextInput
              style={styles.postTextInput}
              multiline
              placeholder="分享你的想法..."
              placeholderTextColor={theme.colors.textSecondary}
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
                      <Ionicons name="close-circle" size={20} color={theme.colors.white} />
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
                  color={userPostImages.length >= 4 ? theme.colors.textSecondary : theme.colors.white} 
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
                  <ActivityIndicator size="small" color={theme.colors.white} />
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
          <ActivityIndicator size="large" color={theme.colors.primary} />
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

  function handleForward(characterId: string, message: string): Promise<void> {
    throw new Error('Function not implemented.');
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.safeArea}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : -200}
      enabled={true}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <ImageBackground 
        source={require('@/assets/images/default-background.jpeg')}
        style={styles.backgroundImage}
      >
        {/* 新设计的社交媒体样式顶部栏 */}
        <View style={styles.socialHeader}>
          <View style={styles.headerTitle}>
            <Text style={styles.headerTitleText}>朋友圈</Text>
          </View>
          
          {renderCircleHeaderButtons()}
        </View>

        {/* Circle Tab Content */}
        {activeTab === 'circle' && (
          <>
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
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                  title="加载中..."
                  titleColor={theme.colors.primary}
                />
              }
            />
          </>
        )}      

        {/* 浮动发布按钮 - 仅在评论输入框未激活时显示 */}
        {!isCommentInputActive && (
          <TouchableOpacity 
            style={styles.floatingActionButton}
            onPress={() => setShowUserPostModal(true)}
          >
            <Feather name="plus" size={24} color={theme.colors.white} />
          </TouchableOpacity>
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

        {/* Image Viewer */}
        {isImageViewerVisible && (
          <ImageViewer
            images={selectedImages}
            initialIndex={currentImageIndex}
            isVisible={isImageViewerVisible}
            onClose={() => setIsImageViewerVisible(false)}
          />
        )}

        {/* Favorite List Modal */}
        <Modal
          visible={showFavoriteList}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFavoriteList(false)}
        >
          <FavoriteList
            posts={posts}
            onClose={() => setShowFavoriteList(false)}
            onUpdatePost={(updatedPost) => {
              setPosts(prevPosts => 
                prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
              );
            }}
          />
        </Modal>

        {/* Character Interaction Settings Modal */}
        <CharacterInteractionSettings
          isVisible={showInteractionSettings}
          onClose={() => setShowInteractionSettings(false)}
        />
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // Social media style header
  socialHeader: {
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'ios' ? 47 : StatusBar.currentHeight,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    height: Platform.OS === 'ios' ? 90 : 90,
  },
  headerTitle: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  
  // Floating action button style
  floatingActionButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  
  // Post and card styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  authorAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: theme.spacing.sm,
  },
  authorName: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
  },
  timestamp: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.sm,
  },
  content: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    marginBottom: theme.spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.xs,
  },
  actionText: {
    color: theme.colors.text,
    marginLeft: 4,
  },
  
  // Header button styles
  circleHeaderButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing.sm, // Add gap between buttons
  },
  
  // Add new style for icon button
  iconButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'transparent',
  },

  headerButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  headerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  headerButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.sm,
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Like section styles
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  likeIcon: {
    marginRight: theme.spacing.sm,
  },
  likeAvatars: {
    flexDirection: 'row',
  },
  likeAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 4,
    backgroundColor: theme.colors.input,
  },
  
  // Comment styles
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: theme.spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    color: theme.colors.text,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  commentText: {
    color: theme.colors.text,
    flexShrink: 1,
  },
  replyText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    marginRight: 4,
  },
  replyButton: {
    marginTop: 4,
    paddingVertical: 4,
  },
  replyButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.xs,
  },
  
  // Comment input styles
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    position: 'relative',
    zIndex: 1,
    paddingBottom: Platform.OS === 'android' ? 4 : 0,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: theme.colors.input,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
    marginRight: theme.spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    padding: theme.spacing.sm,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  replyIndicatorText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: theme.colors.overlay,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  processingText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    marginLeft: 4,
  },
  
  // Common layout styles
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.text,
    marginTop: 10,
    fontSize: theme.fontSizes.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.md,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.md,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },

  // User Post Modal styles
  postModalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  postInputContainer: {
    padding: theme.spacing.md,
  },
  postTextInput: {
    backgroundColor: theme.colors.input,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    color: theme.colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.md,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.sm,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.colors.overlay,
    borderRadius: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  imagePickerButton: {
    padding: 10,
  },
  postSubmitButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
  },
  postSubmitButtonText: {
    color: theme.colors.text,
    fontWeight: '500',
    fontSize: theme.fontSizes.md,
  },
  // Add post menu button style
  postMenuButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
  
  // Images container style
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: theme.spacing.sm,
  },
  
  contentImage: {
    width: CARD_WIDTH / 2 - 12,
    height: 150,
    borderRadius: theme.borderRadius.sm,
    margin: 4,
    backgroundColor: theme.colors.input,
  },

  // Add styles for thoughts section
  thoughtsContainer: {
    marginVertical: theme.spacing.xs,
  },
  thoughtsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  thoughtsTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.xs,
    marginRight: 4,
  },
  thoughtsBubble: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.accent,
  },
  thoughtsText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.sm,
    fontStyle: 'italic',
  },
  
  // Add styles for like thoughts tooltip
  likeThoughtsBubble: {
    position: 'absolute',
    bottom: 40,
    left: -50,
    width: 150,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    zIndex: 100,
    elevation: 5,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  
  // ...existing code...
});

export default Explore;