import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Alert,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { CradleCharacter } from '@/shared/types';

// Import components from original cradle page
import CradleCharacterCarousel from '@/components/CradleCharacterCarousel';
import CradleApiSettings from '@/components/CradleApiSettings';
import CradleSettings from '@/components/CradleSettings';
import ImportToCradleModal from '@/components/ImportToCradleModal';
import CradleFeedModal from '@/components/CradleFeedModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Updated tabs to match original cradle page
const TABS = [
  { id: 'main', title: '主页', icon: 'home-outline' },
  { id: 'import', title: '导入', icon: 'download-outline' },
  { id: 'settings', title: '设置', icon: 'settings-outline' },
  { id: 'api', title: 'API', icon: 'cloud-outline' }
];

export default function CradlePage() {
  const router = useRouter();
  
  const { 
    getCradleCharacters, 
    getCradleSettings,
    updateCradleSettings,
    updateCradleCharacter
  } = useCharacters();

  // States for data with proper typing
  const [cradleCharacters, setCradleCharacters] = useState<CradleCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CradleCharacter | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cradleSettings = getCradleSettings();
  
  // State for tabs
  const [activeTab, setActiveTab] = useState('main');
  const [showFeedModal, setShowFeedModal] = useState(false);
  
  // State for notifications
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notification, setNotification] = useState({ title: '', message: '' });

  // Load characters when component mounts or refreshes
  useEffect(() => {
    loadCradleCharacters();
    
    // Set up a refresh interval for checking image generation status
    const intervalId = setInterval(() => {
      handleRefresh();
    }, 60000); // Check every minute
    
    return () => clearInterval(intervalId);
  }, []);

  // Load cradle characters from context
  const loadCradleCharacters = useCallback(() => {
    const characters = getCradleCharacters();
    setCradleCharacters(characters);
    
    // If we have characters but none selected, select the first one
    if (characters.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characters[0]);
    } else if (selectedCharacter) {
      // If we have a selected character, make sure it's updated
      const updatedSelectedChar = characters.find(c => c.id === selectedCharacter.id);
      if (updatedSelectedChar) {
        setSelectedCharacter(updatedSelectedChar);
      } else if (characters.length > 0) {
        // If the selected character no longer exists, select the first one
        setSelectedCharacter(characters[0]);
      } else {
        setSelectedCharacter(null);
      }
    }
  }, [selectedCharacter, getCradleCharacters]);

  // Handle refresh - check character generation status and image generation status
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      console.log('[摇篮页面] 开始刷新角色状态和图像生成状态');
      // 获取最新角色列表
      const characters = getCradleCharacters();
      
      console.log(`[摇篮页面] 共有 ${characters.length} 个角色，开始检查图像生成状态`);
      
      // 检查所有摇篮角色
      await Promise.all(
        characters.map(async (character) => {
          // 如果角色有图像生成任务，检查其状态
          if (character.imageGenerationTaskId) {
            console.log(`[摇篮页面] 角色 "${character.name}" 有图像生成任务ID: ${character.imageGenerationTaskId}, 当前状态: ${character.imageGenerationStatus}`);
            
            // 计算培育完成状态
            const { days, hours, ready } = calculateRemainingTime(character);
            if (ready) {
              console.log(`[摇篮页面] 角色 "${character.name}" 培育已完成，可以获取图像`);
            } else {
              console.log(`[摇篮页面] 角色 "${character.name}" 培育未完成，剩余时间: ${days}天${hours}小时`);
            }
            
            // 检查图像生成状态
            await checkImageGenerationStatus(character);
          }
        })
      );
      
      // 重新加载角色以获取最新更新
      loadCradleCharacters();
      console.log('[摇篮页面] 角色状态和图像生成状态刷新完成');
    } catch (error) {
      console.error('[摇篮页面] 刷新摇篮角色失败:', error);
    } finally {
      setRefreshing(false);
    }
  }, [cradleCharacters]);
  
  // Enhance the checkImageGenerationStatus function
const checkImageGenerationStatus = async (character: CradleCharacter) => {
  if (!character.imageGenerationTaskId) return;
  
  try {
    console.log(`[摇篮页面] 检查角色 "${character.name}" 的图像生成任务状态: ${character.imageGenerationTaskId}`);
    
    // 请求状态从服务器
    const response = await fetch(`http://152.69.219.182:5000/task_status/${character.imageGenerationTaskId}`);
    if (!response.ok) {
      console.warn(`[摇篮页面] 获取任务状态失败: HTTP ${response.status}`);
      return;
    }
    
    const data = await response.json();
    console.log(`[摇篮页面] 任务状态响应:`, data);
    
    // 如果任务完成且成功
    if (data.done && data.success && data.image_url) {
      console.log(`[摇篮页面] 图像生成成功: ${data.image_url}`);
      
      // 更新角色信息
      let updatedCharacter = { ...character };
      updatedCharacter.backgroundImage = data.image_url;
      updatedCharacter.imageGenerationStatus = 'success';
      
      // 保存更新后的角色
      await updateCradleCharacter(updatedCharacter);
      
      // 显示通知
      showNotification('图像生成成功', `角色 ${character.name} 的图像已成功生成！`);
      
      // 重新加载角色列表以刷新UI
      loadCradleCharacters();
    } 
    // 如果任务失败
    else if (data.done && !data.success) {
      console.error(`[摇篮页面] 图像生成失败: ${data.error || '未知错误'}`);
      
      let updatedCharacter = { ...character };
      updatedCharacter.imageGenerationStatus = 'error';
      updatedCharacter.imageGenerationError = data.error || '未知错误';
      
      // 保存更新后的角色
      await updateCradleCharacter(updatedCharacter);
      
      // 显示错误通知
      showNotification('图像生成失败', `角色 ${character.name} 的图像生成失败：${data.error || '未知错误'}`);
    }
    // 如果任务仍在队列中
    else if (data.queue_info) {
      // 更新队列状态信息
      const queuePosition = data.queue_info.position;
      const estimatedWait = data.queue_info.estimated_wait || 0;
      
      console.log(`[摇篮页面] 图像生成任务在队列中，位置: ${queuePosition}，预计等待时间: ${Math.round(estimatedWait / 60)} 分钟`);
      
      // 仅在第一次获取队列状态时显示通知，避免频繁打扰用户
      if (character.imageGenerationStatus === 'idle') {
        let updatedCharacter = { ...character };
        updatedCharacter.imageGenerationStatus = 'pending';
        await updateCradleCharacter(updatedCharacter);
        
        showNotification(
          '图像生成进行中',
          `角色 ${character.name} 的图像生成任务已加入队列。\n队列位置: ${queuePosition}\n预计等待时间: ${Math.round(estimatedWait / 60)} 分钟`
        );
      }
    }
  } catch (error) {
    console.error(`[摇篮页面] 检查图像生成状态失败:`, error);
  }
};

// Add this function to ensure character cards are re-rendered when needed
const refreshCharacterCards = useCallback(() => {
  console.log('[摇篮页面] 强制刷新角色卡片');
  
  // Get fresh list of characters from context
  const freshCharacters = getCradleCharacters();
  setCradleCharacters([...freshCharacters]);
  
  // Update selected character if needed
  if (selectedCharacter) {
    const updatedSelectedChar = freshCharacters.find(c => c.id === selectedCharacter.id);
    if (updatedSelectedChar) {
      setSelectedCharacter(updatedSelectedChar);
    }
  }
}, [getCradleCharacters, selectedCharacter]);

// Modify the handleCreateCharacter callback in CradleFeedModal to refresh the UI
useEffect(() => {
  // Set up interval to refresh character cards periodically
  const refreshInterval = setInterval(() => {
    refreshCharacterCards();
    // Check image generation status for all characters
    cradleCharacters.forEach(character => {
      if (character.imageGenerationTaskId && 
          character.imageGenerationStatus !== 'success' && 
          character.imageGenerationStatus !== 'error') {
        checkImageGenerationStatus(character);
      }
    });
  }, 30000); // Check every 30 seconds
  
  return () => clearInterval(refreshInterval);
}, [cradleCharacters, refreshCharacterCards]);

// Update the useEffect that handles refresh to also immediately check status
useEffect(() => {
  loadCradleCharacters();
  
  // Immediately check image generation status for pending characters
  const checkPendingImageTasks = async () => {
    const characters = getCradleCharacters();
    for (const character of characters) {
      if (character.imageGenerationTaskId && 
          character.imageGenerationStatus !== 'success' && 
          character.imageGenerationStatus !== 'error') {
        await checkImageGenerationStatus(character);
      }
    }
  };
  
  checkPendingImageTasks();
}, []);

// Show notification
  const showNotification = (title: string, message: string) => {
    setNotification({ title, message });
    setNotificationVisible(true);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      setNotificationVisible(false);
    }, 5000);
  };

  // Handle character selection
  const handleSelectCharacter = (character: CradleCharacter) => {
    setSelectedCharacter(character);
  };

  // Handle feed character
  const handleFeedCharacter = (characterId: string) => {
    // Find the character
    const character = cradleCharacters.find(c => c.id === characterId);
    if (character) {
      setSelectedCharacter(character);
      setShowFeedModal(true);
    }
  };

  // Fix the scrollToIndex error by making sure we handle onScrollToIndexFailed
  const handleTabChange = (tabId: string) => {
    // Reset any flatlist scroll position issues when changing tabs
    if (tabId === 'main') {
      // Use setTimeout to ensure the state update happens after the tab change
      setTimeout(() => {
        loadCradleCharacters();
      }, 10);
    }
    setActiveTab(tabId);
  };
  


  // Calculate remaining cradle time
  const calculateRemainingTime = (character: CradleCharacter) => {
    const cradle_duration = cradleSettings.duration || 7; // Default 7 days
    const createdAt = character.createdAt;
    const now = Date.now();
    const elapsedDays = (now - createdAt) / (24 * 60 * 60 * 1000);
    const remainingDays = Math.max(0, cradle_duration - elapsedDays);
    
    return {
      days: Math.floor(remainingDays),
      hours: Math.floor((remainingDays % 1) * 24),
      ready: remainingDays <= 0
    };
  };

  // Render character card for carousel
  const renderCharacterCard = (character: CradleCharacter, isSelected: boolean) => {
    const { days, hours, ready } = calculateRemainingTime(character);
    const feedCount = character.feedHistory ? character.feedHistory.length : 0;
    
    // Determine character state
    const isGenerated = character.isCradleGenerated;
    const isReadyForGeneration = ready && !isGenerated;
    
    return (
      <View style={[
        styles.characterCard,
        isReadyForGeneration && styles.characterCardReadyForGeneration,
        isGenerated && styles.characterCardReady,
        isSelected && styles.selectedCharacterCard
      ]}>
        {/* Character Image */}
        <View style={styles.characterImageContainer}>
          {character.backgroundImage ? (
            <Image 
              source={{ uri: character.backgroundImage }} 
              style={styles.characterImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={40} color="#555" />
            </View>
          )}
          
          {/* Image Generation Status Indicator */}
          {character.imageGenerationTaskId && character.imageGenerationStatus !== 'idle' && (
            <View style={[
              styles.imageStatusBadge,
              character.imageGenerationStatus === 'pending' && styles.imageStatusPending,
              character.imageGenerationStatus === 'success' && styles.imageStatusSuccess,
              character.imageGenerationStatus === 'error' && styles.imageStatusError
            ]}>
              {character.imageGenerationStatus === 'pending' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons 
                  name={character.imageGenerationStatus === 'success' ? "checkmark" : "alert"} 
                  size={12} 
                  color="#fff" 
                />
              )}
            </View>
          )}
          
          {/* Character Avatar */}
          <View style={styles.avatarContainer}>
            {character.avatar ? (
              <Image 
                source={{ uri: character.avatar }} 
                style={styles.avatarImage} 
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons 
                  name={character.gender === 'female' ? 'female' : character.gender === 'male' ? 'male' : 'person'} 
                  size={20} 
                  color="#aaa" 
                />
              </View>
            )}
          </View>
        </View>
        
        {/* Character Info */}
        <View style={styles.characterInfo}>
          <Text style={styles.characterName} numberOfLines={1}>{character.name}</Text>
          
          <View style={styles.statusContainer}>
            {isGenerated ? (
              <View style={styles.readyBadge}>
                <Text style={styles.readyBadgeText}>已生成</Text>
              </View>
            ) : isReadyForGeneration ? (
              <View style={styles.readyForGenBadge}>
                <Text style={styles.readyForGenBadgeText}>准备生成</Text>
              </View>
            ) : (
              <View style={styles.breedingBadge}>
                <Text style={styles.breedingBadgeText}>
                  培育中 ({days}天{hours}小时)
                </Text>
              </View>
            )}
            
            <Text style={styles.feedCount}>{feedCount} 次投喂</Text>
          </View>
          
          {/* Feed Button */}
          <TouchableOpacity 
            style={styles.feedButton}
            onPress={() => handleFeedCharacter(character.id)}
          >
            <Ionicons name="leaf-outline" size={16} color="#fff" />
            <Text style={styles.feedButtonText}>投喂</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render notification
  const renderNotification = () => (
    notificationVisible && (
      <View style={styles.notificationContainer}>
        <View style={styles.notification}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
          <TouchableOpacity
            style={styles.closeNotificationButton}
            onPress={() => setNotificationVisible(false)}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    )
  );

  // Render character details for selected character
  const renderCharacterDetails = () => {
    if (!selectedCharacter) return null;
    
    const { days, hours, ready } = calculateRemainingTime(selectedCharacter);
    const feedCount = selectedCharacter.feedHistory ? selectedCharacter.feedHistory.length : 0;
    
    return (
      <View style={styles.characterDetailSection}>
        {/* Character Card with Image Background */}
        <View style={styles.characterDetailCard}>
          {/* Background Image */}
          {selectedCharacter.backgroundImage ? (
            <Image
              source={{ uri: selectedCharacter.backgroundImage }}
              style={styles.characterDetailBackground}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.characterDetailBackgroundPlaceholder}>
              <Ionicons name="image-outline" size={50} color="#555" />
            </View>
          )}
          
          {/* Gradient overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
            style={styles.characterDetailGradient}
          />
          
          {/* Image Generation Status */}
          {selectedCharacter.imageGenerationTaskId && selectedCharacter.imageGenerationStatus !== 'idle' && (
            <View style={styles.imageGenerationStatusContainer}>
              {selectedCharacter.imageGenerationStatus === 'pending' && (
                <>
                  <ActivityIndicator size="small" color="#FFD700" style={styles.imageStatusIndicator} />
                  <Text style={styles.imageGenerationStatusText}>图像生成中...</Text>
                </>
              )}
              {selectedCharacter.imageGenerationStatus === 'success' && (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={styles.imageStatusIndicator} />
                  <Text style={[styles.imageGenerationStatusText, { color: '#4CAF50' }]}>图像生成成功</Text>
                </>
              )}
              {selectedCharacter.imageGenerationStatus === 'error' && (
                <>
                  <Ionicons name="alert-circle" size={16} color="#F44336" style={styles.imageStatusIndicator} />
                  <Text style={[styles.imageGenerationStatusText, { color: '#F44336' }]}>
                    图像生成失败: {selectedCharacter.imageGenerationError?.substring(0, 30) || "未知错误"}
                  </Text>
                </>
              )}
            </View>
          )}
          
          {/* Character Info Overlay */}
          <View style={styles.characterDetailInfo}>
            <Text style={styles.characterDetailName}>{selectedCharacter.name}</Text>
            <Text style={styles.characterDetailDescription} numberOfLines={3}>
              {selectedCharacter.description || "暂无角色描述"}
            </Text>
            
            {/* Character Status */}
            <View style={styles.characterStatusRow}>
              {/* Remaining Time or Status */}
              <View style={styles.characterStatusItem}>
                <Ionicons name="time-outline" size={16} color="#aaa" />
                <Text style={styles.characterStatusText}>
                  {selectedCharacter.isCradleGenerated ? '已生成' : 
                   ready ? '准备生成' : 
                   `剩余 ${days}天${hours}小时`}
                </Text>
              </View>
              
              {/* Feed Count */}
              <View style={styles.characterStatusItem}>
                <Ionicons name="leaf-outline" size={16} color="#aaa" />
                <Text style={styles.characterStatusText}>
                  {feedCount} 次投喂
                </Text>
              </View>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.characterActionButtons}>
              <TouchableOpacity 
                style={styles.characterActionButton}
                onPress={() => handleFeedCharacter(selectedCharacter.id)}
              >
                <Ionicons name="leaf-outline" size={18} color="#fff" />
                <Text style={styles.characterActionButtonText}>投喂数据</Text>
              </TouchableOpacity>
              
              {selectedCharacter.isCradleGenerated && (
                <TouchableOpacity 
                  style={[styles.characterActionButton, styles.viewButton]}
                  onPress={() => router.push({
                    pathname: "/(tabs)",
                    params: { characterId: selectedCharacter.id }
                  })}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" />
                  <Text style={styles.characterActionButtonText}>查看角色</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Render the main content for the homepage tab
  const renderMainContent = () => {
    if (cradleCharacters.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="cradle" size={60} color="#555" />
        </View>
      );
    }

    return (
      <View style={styles.mainContent}>
        {/* Selected Character Details - Top section */}
        {renderCharacterDetails()}
        
        {/* Character Carousel - Bottom section */}
        <CradleCharacterCarousel
          characters={cradleCharacters}
          selectedCharacterId={selectedCharacter?.id}
          onSelectCharacter={handleSelectCharacter}
          onFeedCharacter={handleFeedCharacter}
          customRenderItem={(character, isSelected) => renderCharacterCard(character, isSelected)}
        />
        
        {/* Create Character Button */}
      </View>
    );
  };

  // Render the appropriate content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'main':
        return (
          <ScrollView 
            style={styles.tabContent}
            contentContainerStyle={styles.tabPageContent}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]} 
                tintColor={theme.colors.primary}
              />
            }
          >
            <View style={styles.statusBar}>
              <View style={styles.statusContainer}>
                <View style={[
                  styles.statusIndicator, 
                  cradleSettings.enabled ? styles.statusActive : styles.statusInactive
                ]} />
                <Text style={styles.statusText}>
                  {cradleSettings.enabled 
                    ? `摇篮系统已启用 · ${cradleSettings.duration || 7}天培育期`
                    : '摇篮系统未启用'}
                </Text>
              </View>
            </View>

            {renderMainContent()}
          </ScrollView>
        );
      case 'import':
        return (
          <View style={styles.tabContent}>
            <ImportToCradleModal 
              embedded={true}
              visible={true}
              onClose={() => handleTabChange('main')}
              onImportSuccess={loadCradleCharacters}
            />
          </View>
        );
      case 'settings':
        return (
          <View style={styles.tabContent}>
            <CradleSettings
              embedded={true}
              isVisible={true}
              onClose={() => handleTabChange('main')}
              isCradleEnabled={cradleSettings.enabled}
              cradleDuration={cradleSettings.duration}
              onCradleToggle={(enabled) => {
                updateCradleSettings({
                  ...cradleSettings,
                  enabled,
                  startDate: enabled ? new Date().toISOString() : undefined
                });
              }}
              onDurationChange={(duration) => {
                updateCradleSettings({
                  ...cradleSettings,
                  duration
                });
              }}
            />
          </View>
        );
      case 'api':
        return (
          <View style={styles.tabContent}>
            <CradleApiSettings
              embedded={true}
              isVisible={true}
              onClose={() => handleTabChange('main')}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#282828" />
      
      {/* Header with title and tabs */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>摇篮系统</Text>
        </View>
        
        <View style={styles.tabsContainer}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => handleTabChange(tab.id)}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.title}
                </Text>
                {isActive && <View style={styles.activeTabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {renderTabContent()}
      </View>
      
      {/* Feed Modal */}
      <CradleFeedModal
        visible={showFeedModal}
        onClose={() => {
          setShowFeedModal(false);
          loadCradleCharacters();
        }}
        characterId={selectedCharacter?.id}
      />
      
      {/* Notification */}
      {renderNotification()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#222',
  },
  header: {
    backgroundColor: '#282828',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 10,
    marginRight: 20,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 0,
  },
  tabText: {
    color: '#aaa',
    fontSize: 15,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#222',
  },
  tabPageContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  statusBar: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusInactive: {
    backgroundColor: '#F44336',
  },
  statusText: {
    color: '#ddd',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    paddingBottom: 80, // Space for floating button
  },
  
  // Empty state styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  createCharacterButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCharacterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Floating create button
  floatingCreateButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  
  // Character detail styles
  characterDetailSection: {
    padding: 16,
    marginBottom: 16,
  },
  characterDetailCard: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333',
    position: 'relative',
  },
  characterDetailBackground: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  characterDetailBackgroundPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterDetailGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  imageGenerationStatusContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '70%',
  },
  imageStatusIndicator: {
    marginRight: 8,
  },
  imageGenerationStatusText: {
    color: '#FFD700',
    fontSize: 14,
  },
  characterDetailInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  characterDetailName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  characterDetailDescription: {
    color: '#eee',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  characterStatusRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  characterStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  characterStatusText: {
    color: '#ddd',
    marginLeft: 6,
    fontSize: 14,
  },
  characterActionButtons: {
    flexDirection: 'row',
  },
  characterActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  viewButton: {
    backgroundColor: '#4A90E2',
  },
  characterActionButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 14,
  },
  
  // Carousel card styles
  characterCard: {
    width: SCREEN_WIDTH * 0.7,
    height: 180,
    backgroundColor: '#333',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  characterCardReadyForGeneration: {
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  characterCardReady: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  selectedCharacterCard: {
    transform: [{scale: 1.05}],
    shadowColor: theme.colors.primary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  characterImageContainer: {
    height: 120,
    position: 'relative',
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageStatusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageStatusPending: {
    backgroundColor: '#FFC107',
  },
  imageStatusSuccess: {
    backgroundColor: '#4CAF50',
  },
  imageStatusError: {
    backgroundColor: '#F44336',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -20,
    left: 10,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#555',
  },
  characterInfo: {
    flex: 1,
    padding: 12,
    paddingTop: 16,
  },
  characterName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  readyBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readyBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  readyForGenBadge: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readyForGenBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '500',
  },
  breedingBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  breedingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  feedCount: {
    color: '#aaa',
    fontSize: 12,
  },
  feedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  feedButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  
  // Notification styles
  notificationContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    left: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  notification: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    maxWidth: 500,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  notificationTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  notificationMessage: {
    color: '#eee',
    fontSize: 14,
    lineHeight: 20,
  },
  closeNotificationButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});