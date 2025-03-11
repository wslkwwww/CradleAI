import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ImageBackground,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { CradleCharacter } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import CradleCharacterCarousel from '@/components/CradleCharacterCarousel';
import CradleFeedModal from '@/components/CradleFeedModal';
import ImportToCradleModal from '@/components/ImportToCradleModal';
import CradleSettings from '@/components/CradleSettings';
import CradleApiSettings from '@/components/CradleApiSettings';
import { downloadAndSaveImage } from '@/utils/imageUtils';
import { confirmDeleteCradleCharacter } from '@/utils/cradleUtils';
import { LinearGradient } from 'expo-linear-gradient';

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
  const insets = useSafeAreaInsets();
  
  const { 
    getCradleCharacters, 
    getCradleSettings,
    updateCradleSettings,
    updateCradleCharacter,
    deleteCradleCharacter
  } = useCharacters();

  // States for data with proper typing
  const [cradleCharacters, setCradleCharacters] = useState<CradleCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CradleCharacter | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cradleSettings = getCradleSettings();
  const characterCarouselRef = useRef(null);
  
  // State for tabs
  const [activeTab, setActiveTab] = useState('main');
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // State for notifications
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notification, setNotification] = useState({ title: '', message: '' });

  // Load characters when component mounts or refreshes
  useEffect(() => {
    loadCradleCharacters();
    
    // Setup periodic image status check
    const checkInterval = setInterval(() => {
      checkCharacterImagesStatus();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(checkInterval);
  }, []);

  // Load cradle characters from context
  const loadCradleCharacters = useCallback(() => {
    const characters = getCradleCharacters();
    console.log('[摇篮页面] 加载了', characters.length, '个摇篮角色');
    setCradleCharacters(characters);
    
    // Keep selected character if exists, otherwise select the first one
    if (selectedCharacter) {
      const stillExists = characters.find(c => c.id === selectedCharacter.id);
      if (!stillExists && characters.length > 0) {
        setSelectedCharacter(characters[0]);
      } else if (!stillExists) {
        setSelectedCharacter(null);
      } else {
        // Update selected character with latest data
        const updatedSelectedChar = characters.find(c => c.id === selectedCharacter.id);
        setSelectedCharacter(updatedSelectedChar || null);
      }
    } else if (characters.length > 0) {
      setSelectedCharacter(characters[0]);
    }
  }, [selectedCharacter, getCradleCharacters]);

  // Handle refresh - check character generation status and image generation status
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      loadCradleCharacters();
      await checkCharacterImagesStatus();
    } catch (error) {
      console.error('[摇篮页面] 刷新失败:', error);
    } finally {
      setRefreshing(false);
    }
  }, [cradleCharacters]);
  
  // Enhanced function to check image generation status for all characters
  const checkCharacterImagesStatus = async () => {
    for (const character of cradleCharacters) {
      if (character.imageGenerationTaskId && 
          character.imageGenerationStatus === 'pending') {
        await checkImageGenerationStatus(character);
      }
    }
  };
  
  // Check the status of a single character's image generation task
  const checkImageGenerationStatus = async (character: CradleCharacter) => {
    if (!character.imageGenerationTaskId) return;
    
    try {
      console.log(`[摇篮页面] 检查角色 "${character.name}" 的图像生成任务状态: ${character.imageGenerationTaskId}`);
      
      // Request status from server
      const response = await fetch(`http://152.69.219.182:5000/task_status/${character.imageGenerationTaskId}`);
      if (!response.ok) {
        console.warn(`[摇篮页面] 获取任务状态失败: HTTP ${response.status}`);
        return;
      }
      
      const data = await response.json();
      
      // If task is done and successful
      if (data.done && data.success && data.image_url) {
        console.log(`[摇篮页面] 图像生成成功: ${data.image_url}`);
        
        // Download the image to local storage
        const localImageUri = await downloadAndSaveImage(
          data.image_url,
          character.id,
          'background'
        );
        
        // Update character with image information
        let updatedCharacter = { ...character };
        updatedCharacter.localBackgroundImage = localImageUri;
        updatedCharacter.backgroundImage = localImageUri || data.image_url;
        updatedCharacter.imageGenerationStatus = 'success';
        
        // Save updated character
        await updateCradleCharacter(updatedCharacter);
        showNotification('图像生成成功', `角色 ${character.name} 的图像已成功生成！`);
        
        // If this is the currently selected character, update it
        if (selectedCharacter?.id === character.id) {
          setSelectedCharacter(updatedCharacter);
        }
        
        // Force refresh character carousel
        refreshCharacterCards();
      } 
      // If task is done but failed
      else if (data.done && !data.success) {
        console.error(`[摇篮页面] 图像生成失败: ${data.error || '未知错误'}`);
        
        let updatedCharacter = { ...character };
        updatedCharacter.imageGenerationStatus = 'error';
        updatedCharacter.imageGenerationError = data.error || '未知错误';
        
        // Save updated character
        await updateCradleCharacter(updatedCharacter);
        showNotification('图像生成失败', `角色 ${character.name} 的图像生成失败：${data.error || '未知错误'}`);
        
        // If this is the currently selected character, update it
        if (selectedCharacter?.id === character.id) {
          setSelectedCharacter(updatedCharacter);
        }
      }
      // If task is still in queue
      else if (data.queue_info) {
        // Update queue status information
        const queuePosition = data.queue_info.position;
        const estimatedWait = data.queue_info.estimated_wait || 0;
        
        console.log(`[摇篮页面] 图像生成任务在队列中，位置: ${queuePosition}，预计等待时间: ${Math.round(estimatedWait / 60)} 分钟`);
      }
    } catch (error) {
      console.error(`[摇篮页面] 检查图像生成状态失败:`, error);
    }
  };

  // Function to force refresh the character cards when needed
  const refreshCharacterCards = () => {
    // Re-fetch characters to ensure we have the latest data
    loadCradleCharacters();
  };
  
  // Show notification function
  const showNotification = (title: string, message: string) => {
    setNotification({ title, message });
    setNotificationVisible(true);
    // Auto-hide after 4 seconds
    setTimeout(() => {
      setNotificationVisible(false);
    }, 4000);
  };
  
  // Handle character deletion with confirmation
  const handleDeleteCharacter = useCallback((character: CradleCharacter) => {
    confirmDeleteCradleCharacter(character, deleteCradleCharacter, () => {
      // After successful deletion:
      showNotification('删除成功', `角色 "${character.name}" 已成功删除`);
      // Refresh the character list
      loadCradleCharacters();
    });
  }, [deleteCradleCharacter]);

  // Render the tabs at the top of the screen
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tab, 
            activeTab === tab.id && styles.activeTab
          ]}
          onPress={() => setActiveTab(tab.id)}
        >
          <Ionicons 
            name={tab.icon as any} 
            size={22} 
            color={activeTab === tab.id ? theme.colors.primary : '#aaa'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === tab.id && styles.activeTabText
          ]}>
            {tab.title}
          </Text>
          
          {activeTab === tab.id && (
            <View style={styles.activeTabIndicator} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render the notification component
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

  // Render character detail section
  const renderCharacterDetail = () => {
    if (!selectedCharacter) return null;
    
    // Calculate feed stats
    const totalFeeds = selectedCharacter.feedHistory?.length || 0;
    const processedFeeds = selectedCharacter.feedHistory?.filter(feed => feed.processed).length || 0;
    const feedPercentage = totalFeeds > 0 ? Math.round((processedFeeds / totalFeeds) * 100) : 0;
    
    // Calculate days in cradle
    const createdAt = selectedCharacter.createdAt;
    const daysInCradle = createdAt 
      ? Math.round((Date.now() - createdAt) / (1000 * 60 * 60 * 24) * 10) / 10
      : 0;
    
    // Determine if character has image generation task pending
    const hasPendingImageTask = selectedCharacter.imageGenerationTaskId && 
                               selectedCharacter.imageGenerationStatus === 'pending';
    
    const hasImageError = selectedCharacter.imageGenerationStatus === 'error';
    
    return (
      <View style={styles.characterDetailSection}>
        <View style={styles.characterDetailCard}>
          {/* Character background */}
          {selectedCharacter.backgroundImage ? (
            <Image 
              source={{ uri: selectedCharacter.backgroundImage }} 
              style={styles.characterDetailBackground} 
              resizeMode="cover"
            />
          ) : (
            <View style={styles.characterDetailBackgroundPlaceholder}>
              <MaterialCommunityIcons name="image-outline" size={40} color="#666" />
            </View>
          )}
          
          {/* Overlay gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
            style={styles.characterDetailGradient}
          >
            {/* Show image generation status if applicable */}
            {(hasPendingImageTask || hasImageError) && (
              <View style={styles.imageGenerationStatusContainer}>
                {hasPendingImageTask ? (
                  <>
                    <ActivityIndicator size="small" color="#FFD700" style={styles.imageStatusIndicator} />
                    <Text style={styles.imageGenerationStatusText}>图像生成进行中...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="alert-circle" size={18} color="#FF4444" style={styles.imageStatusIndicator} />
                    <Text style={styles.imageGenerationStatusText}>图像生成失败</Text>
                  </>
                )}
              </View>
            )}
            
            {/* Character info */}
            <View style={styles.characterDetailInfo}>
              <Text style={styles.characterDetailName}>{selectedCharacter.name}</Text>
              
              <Text style={styles.characterDetailDescription} numberOfLines={2}>
                {selectedCharacter.description || "这是一个摇篮中的AI角色，等待通过投喂数据塑造个性..."}
              </Text>
              
              <View style={styles.characterStatusRow}>
                <View style={styles.characterStatusItem}>
                  <Ionicons name="time-outline" size={16} color="#ddd" />
                  <Text style={styles.characterStatusText}>培育中: {daysInCradle}天</Text>
                </View>
                
                <View style={styles.characterStatusItem}>
                  <MaterialCommunityIcons name="food-apple" size={16} color="#ddd" />
                  <Text style={styles.characterStatusText}>投喂: {processedFeeds}/{totalFeeds}</Text>
                </View>
              </View>
              
              <View style={styles.characterActionButtons}>
                <TouchableOpacity 
                  style={[styles.characterActionButton, styles.viewButton]}
                  onPress={() => setShowFeedModal(true)}
                >
                  <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                  <Text style={styles.characterActionButtonText}>投喂</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.characterActionButton, { backgroundColor: '#F44336' }]}
                  onPress={() => handleDeleteCharacter(selectedCharacter)}
                >
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text style={styles.characterActionButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  // Render main tab content
  const renderMainTab = () => (
    <ScrollView 
      style={styles.tabContent}
      contentContainerStyle={styles.tabPageContent}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={handleRefresh}
          tintColor="#fff" 
          colors={["#fff"]}
        />
      }
    >
      {/* Cradle status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator,
            cradleSettings.enabled ? styles.statusActive : styles.statusInactive
          ]} />
          <Text style={styles.statusText}>
            {cradleSettings.enabled ? '摇篮系统已启用' : '摇篮系统已禁用'}
          </Text>
        </View>
      </View>
      
      {/* Selected character details */}
      {selectedCharacter && renderCharacterDetail()}
      
      {/* Character carousel */}
      <Text style={{
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        paddingHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
      }}>
        角色列表
      </Text>
      
      {/* Render character carousel or empty state */}
      {cradleCharacters.length > 0 ? (
        <CradleCharacterCarousel
          ref={characterCarouselRef}
          characters={cradleCharacters}
          selectedCharacterId={selectedCharacter?.id}
          onSelectCharacter={(character) => setSelectedCharacter(character)}
          onFeedCharacter={(id) => {
            const character = cradleCharacters.find(c => c.id === id);
            if (character) {
              setSelectedCharacter(character);
              setShowFeedModal(true);
            }
          }}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="egg-outline" size={60} color={theme.colors.primary} />
          <Text style={styles.emptyTitle}>没有摇篮角色</Text>
          <Text style={styles.emptyText}>
            创建新的摇篮角色或从已有角色中导入到摇篮系统
          </Text>
          <TouchableOpacity 
            style={styles.createCharacterButton}
            onPress={() => router.push('/pages/create_char_cradle')}
          >
            <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.createCharacterButtonText}>创建摇篮角色</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  // Render import tab content
  const renderImportTab = () => (
    <View style={styles.tabContent}>
      <ScrollView contentContainerStyle={styles.tabPageContent}>
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Ionicons name="cloud-download-outline" size={60} color={theme.colors.primary} />
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 16 }}>
            导入角色到摇篮系统
          </Text>
          <Text style={{ color: '#aaa', textAlign: 'center', marginVertical: 16, lineHeight: 22 }}>
            选择您已创建的角色，将其导入到摇篮系统进行培育和完善
          </Text>
          <TouchableOpacity 
            style={{
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 16,
            }}
            onPress={() => setShowImportModal(true)}
          >
            <Text style={{ color: '#000', fontSize: 16, fontWeight: '600' }}>选择角色导入</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // Render settings tab content
  const renderSettingsTab = () => (
    <View style={styles.tabContent}>
      <CradleSettings 
        isVisible={activeTab === 'settings'}
        onClose={() => setActiveTab('main')}
        isCradleEnabled={cradleSettings.enabled}
        cradleDuration={cradleSettings.duration}
        feedInterval={cradleSettings.feedInterval}
        onUpdateSettings={updateCradleSettings}
        onCradleToggle={(enabled) => updateCradleSettings({ ...cradleSettings, enabled })}
        onDurationChange={(duration) => updateCradleSettings({ ...cradleSettings, duration })}
      />
        
    </View>
  );
  
  // State for API settings visibility
  const [showApiSettings, setShowApiSettings] = useState(false);

  // Render API settings tab content
  const renderApiSettingsTab = () => (
    <View style={styles.tabContent}>
      <CradleApiSettings
        isVisible={activeTab === 'api'}
        onClose={() => setActiveTab('main')}
      />
    </View>
  );

  // Determine which tab content to render based on activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'main':
        return renderMainTab();
      case 'import':
        return renderImportTab();
      case 'settings':
        return renderSettingsTab();
      case 'api':
        return renderApiSettingsTab();
      default:
        return renderMainTab();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.safeArea, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <StatusBar barStyle="light-content" />
      
      {/* Header with tabs */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>摇篮系统</Text>
        </View>
        {renderTabs()}
      </View>
      
      {/* Main content area */}
      <View style={styles.tabContentContainer}>
        {renderTabContent()}
      </View>
      
      {/* Floating create button - only on main tab */}
      {activeTab === 'main' && (
        <TouchableOpacity
          style={styles.floatingCreateButton}
          onPress={() => router.push('/pages/create_char_cradle')}
        >
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      )}
      
      {/* Feed modal - when selectedCharacter exists */}
      {selectedCharacter && (
        <CradleFeedModal
          visible={showFeedModal}
          isVisible={showFeedModal}
          character={selectedCharacter}
          onClose={() => {
            setShowFeedModal(false);
            // Refresh character list after closing modal to show updated feed count
            setTimeout(() => loadCradleCharacters(), 500);
          }}
        />
      )}
      
      {/* Import modal */}
      <ImportToCradleModal
      visible={showImportModal}
        isVisible={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          // Refresh character list after importing to show new characters
          setTimeout(() => loadCradleCharacters(), 500); 
        }}
      />
      
      {/* Notification component */}
      {renderNotification()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#222',
  },
  tabText: {
    color: '#aaa',
    fontSize: 14,
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
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    paddingBottom: 80,
  },
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