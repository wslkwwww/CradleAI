import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  Dimensions,
  SafeAreaView,
  Animated,
  StatusBar,
  Platform,
  Modal,
  Switch,
  ViewStyle,
  TextStyle,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { Character } from '@/shared/types';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { CharacterImporter } from '@/utils/CharacterImporter';
import { useUser } from '@/constants/UserContext';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CreateChar from '@/app/pages/create_char';
import CradleCreateForm from '@/components/CradleCreateForm';
import RelationshipGraphPage from '../pages/relationship-graph';
// Add WebView import for rich text rendering support
import { WebView } from 'react-native-webview';

// Add view mode constants
const VIEW_MODE_SMALL = 'small';
const VIEW_MODE_LARGE = 'large';

// Import constants
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // Consider padding and gap
const CARD_HEIGHT = CARD_WIDTH * 1.5;
const AVATAR_SIZE = CARD_WIDTH * 0.6;

// Large card dimensions
const LARGE_CARD_WIDTH = width - 32; // Full width minus padding
const LARGE_CARD_HEIGHT = LARGE_CARD_WIDTH * 0.6; // 5:3 aspect ratio

const COLOR_BACKGROUND = '#282828';  // Dark background
const COLOR_CARD_BG = '#333333';     // Dark card background
const COLOR_BUTTON = 'rgb(255, 224, 195)';  // Updated to use specified color
const COLOR_ACCENT = '#333333';      // Dark accent
const COLOR_TEXT = '#FFFFFF';        // White text

// Define tab constants
const TABS = [
  { id: 'cards', title: '角色卡' },
  { id: 'create', title: '创建' },
  { id: 'relationships', title: '关系图' }
];

// Define creation mode constants
const CREATION_MODES = {
  MANUAL: 'manual',
  AUTO: 'auto',
};

const CharactersScreen: React.FC = () => {
  const { characters, isLoading, setIsLoading, deleteCharacters, addCharacter, updateCharacter } = useCharacters();
  const { user } = useUser();
  const router = useRouter();
  const [isManaging, setIsManaging] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  // Add state for card view mode
  const [viewMode, setViewMode] = useState<'small' | 'large'>(VIEW_MODE_SMALL);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [relationshipView, setRelationshipView] = useState<'graph' | 'messages'>('graph');

  // New states for tabbed interface
  const [activeTab, setActiveTab] = useState<string>('cards');
  const [creationMode, setCreationMode] = useState<'manual' | 'auto'>('manual');
  const [activeSidebarItem, setActiveSidebarItem] = useState<string>('basic');

  // Add state for repair notification
  const [showRepairNotice, setShowRepairNotice] = useState(false);



  // Add a function to manually load characters
  const loadCharacters = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  // useEffect(() => {
  //   console.log('Characters from Context:', characters);
  // }, [characters]);

  const handleCreate = () => {
    setActiveTab('create');
    // Always set to manual mode when first opening the create tab
    setCreationMode('manual');
    setActiveSidebarItem('basic');
  };

  useEffect(() => {
    // 根据 isManaging 的变化启动动画
    Animated.timing(animatedValue, {
      toValue: isManaging ? 1 : 0, // isManaging 为 true 时，值为 1，否则为 0
      duration: 100, // 动画持续时间 300ms
      useNativeDriver: false, // 使用 JS 驱动，因为我们要控制 width
    }).start();
  }, [isManaging, animatedValue]);

  const handleManage = () => {
    setIsManaging((prevIsManaging) => !prevIsManaging);
    setSelectedCharacters([]);
  };

  // Modify the handleImport function to properly handle preset replacement
  const handleImport = async () => {
    try {
      // 1. 选择角色图片
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        try {
          // 2. 先提示用户选择预设文件
          const presetResult = await DocumentPicker.getDocumentAsync({
            type: 'application/json',
            copyToCacheDirectory: true
          });

          if (!presetResult.assets || !presetResult.assets[0]) {
            throw new Error('未选择预设文件');
          }

          // 修改数据传递方式
          const importedData = await CharacterImporter.importFromPNG(result.assets[0].uri);
          const fileUri = presetResult.assets[0].uri;
          const cacheUri = `${FileSystem.cacheDirectory}${presetResult.assets[0].name}`;
          
          await FileSystem.copyAsync({
            from: fileUri,
            to: cacheUri
          });

          const presetJson = await CharacterImporter.importPresetForCharacter(cacheUri, 'temp');

          // 构建带有所有必需数据的对象
          const completeData = {
            roleCard: importedData.roleCard,
            worldBook: importedData.worldBook,
            preset: presetJson, // This now contains the complete preset
            avatar: result.assets[0].uri,
            replaceDefaultPreset: true // Flag to indicate preset should replace defaults
          };

          // 使用 localStorage 临时存储数据，而不是通过路由参数
          await AsyncStorage.setItem(
            'temp_import_data',
            JSON.stringify(completeData)
          );

          // 切换到创建标签页并选择常规模式
          setActiveTab('create');
          setCreationMode('manual');
          setActiveSidebarItem('basic');

        } catch (error) {
          console.error('[Character Import] Error:', error);
          Alert.alert('导入失败', error instanceof Error ? error.message : '未知错误');
        }
      }
    } catch (error) {
      console.error('[Character Import] Error:', error);
      Alert.alert('错误', '选择文件失败');
    }
  };

  const handleExport = () => {
    console.log('Export character');
  };

  const handleCharacterPress = (id: string) => {
    if (!isManaging) {
      router.push(`/pages/character-detail?id=${id}`);
    }
  };

  const toggleSelectCharacter = (id: string) => {
    setSelectedCharacters((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((charId) => charId !== id)
        : [...prevSelected, id]
    );
  };

  // Add a function to navigate to relationship graph page
  const handleRelationshipGraphPress = () => {
    router.push('/pages/relationship-graph');
  };

  // Add function to toggle view mode
  const handleToggleViewMode = () => {
    setViewMode(prevMode => prevMode === VIEW_MODE_SMALL ? VIEW_MODE_LARGE : VIEW_MODE_SMALL);
  };

  const renderItem = useMemo(() => ({ item }: { item: any }) => {
    return (
      <CharacterCard
        item={item}
        isManaging={isManaging}
        isSelected={selectedCharacters.includes(item.id)}
        onSelect={toggleSelectCharacter}
        onPress={handleCharacterPress}
        viewMode={viewMode}
      />
    );
  }, [isManaging, selectedCharacters, toggleSelectCharacter, handleCharacterPress, viewMode]);

  const keyExtractor = useMemo(() => (item: any) => item.id, []);

  const handleDelete = async () => {
    if (selectedCharacters.length === 0) {
      Alert.alert('未选中', '请选择要删除的角色。');
      return;
    }

    Alert.alert(
      '删除角色',
      `确定要删除选中的 ${selectedCharacters.length} 个角色吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteCharacters(selectedCharacters);
            setSelectedCharacters([]);
            setIsManaging(false);
          },
        },
      ]
    );
  };

  // Modify renderFloatingButtons to include import button
  const renderFloatingButtons = () => {
    // Only show floating buttons in the character cards tab
    if (activeTab !== 'cards') return null;
    
    return (
      <View style={styles.floatingButtonsContainer}>
        {isManaging && (
          <TouchableOpacity 
            style={[styles.floatingButton, styles.deleteButton]} 
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={24} color="#282828" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.floatingButton, isManaging && styles.activeButton]} 
          onPress={handleManage}
        >
          <FontAwesome name="wrench" size={24} color="#282828" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={handleImport}
        >
          <Ionicons name="cloud-upload-outline" size={24} color="#282828" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render character cards tab content
  const renderCharacterCardsTab = () => {
    if (isLoading) {
      return <ActivityIndicator size="large" color="#fff" style={styles.loader} />;
    }

    return (
      <>
        <FlatList
          data={characters}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={viewMode === VIEW_MODE_SMALL ? 2 : 1} // Adjust columns based on view mode
          contentContainerStyle={styles.listContainer}
          key={viewMode} // Add this to force re-render when view mode changes
        />
        {renderFloatingButtons()}
      </>
    );
  };

  // Modify the renderCreationModeSelection function to use a bookmark style instead of large buttons


  // Modify the renderCreationContent function to properly position the mode tabs
  // Render character creation content
  const renderCreationContent = () => {
    return (
      <View style={styles.creationContentContainer}>
        {/* Render appropriate component based on mode */}
        {creationMode === 'manual' ? (
          <CreateChar 
            activeTab={activeSidebarItem as 'basic' | 'advanced'} 
            creationMode="manual"
            allowTagImageGeneration={true} // Enable tag-based generation in manual mode
          />
        ) : (
          <CradleCreateForm
            embedded={true}
            onClose={() => {
              // Switch back to cards tab when closed
              setActiveTab('cards');
            }}
          />
        )}
      </View>
    );
  };

  // Modify the main content rendering to include relationship graph
  const renderMainContent = () => {
    switch (activeTab) {
      case 'cards':
        return renderCharacterCardsTab();
      case 'create':
        return (
          <View style={styles.createTabContainer}>
            {renderCreationContent()}
          </View>
        );
      case 'relationships':
        return <RelationshipGraphPage />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR_BACKGROUND} />
      
      {/* Header with title and tabs */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>角色管理</Text>
        </View>
        <View style={styles.tabsContainer}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.activeTabText
                ]}
              >
                {tab.title}
              </Text>
              {activeTab === tab.id && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main content area */}
      <View style={styles.mainContainer}>
        {renderMainContent()}
      </View>

      {/* Conditionally show the mode toggle in left sidebar */}
      {activeTab === 'create' && (
        <View style={styles.sidebarModeToggleContainer}>
          <TouchableOpacity 
            style={styles.sidebarModeToggle} 
            onPress={() => setCreationMode(creationMode === 'manual' ? 'auto' : 'manual')}
          >
            <View style={[
              styles.sidebarToggleTrack, 
              creationMode === 'auto' && styles.sidebarToggleTrackActive
            ]}>
              <View style={[
                styles.sidebarToggleThumb,
                creationMode === 'auto' && styles.sidebarToggleThumbActive
              ]}>
                <Ionicons 
                  name={creationMode === 'manual' ? "create-outline" : "color-wand-outline"} 
                  size={16} 
                  color={creationMode === 'manual' ? "#000" : "#000"} 
                />
              </View>
            </View>
            <Text style={styles.sidebarToggleText}>
              {creationMode === 'manual' ? '手动' : '自动'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add repair notification */}
      {showRepairNotice && (
        <View style={styles.repairNotification}>
          <Text style={styles.repairNotificationText}>
            修复了角色数据不一致问题，重新加载...
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// Define CharacterCard as a separate component with viewMode prop
const CharacterCard: React.FC<{
  item: Character;
  isManaging: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPress: (id: string) => void;
  viewMode: 'small' | 'large';
}> = React.memo(({ item, isManaging, isSelected, onSelect, onPress, viewMode }) => {
  // Determine if we're in large view mode
  const isLargeView = viewMode === VIEW_MODE_LARGE;
  
  // Card styles based on view mode
  const cardStyle = isLargeView ? {
    width: LARGE_CARD_WIDTH,
    height: LARGE_CARD_HEIGHT,
    marginBottom: 16,
  } : {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    margin: 8,
  };
  
  // Avatar size based on view mode
  const avatarSize = isLargeView ? 60 : AVATAR_SIZE;
  
  return (
    <TouchableOpacity
      style={[
        styles.card, 
        cardStyle,
        isManaging && styles.manageCard,
        isLargeView && styles.largeCard,
      ]}
      onPress={() => onPress(item.id)}
      onLongPress={() => onSelect(item.id)}
    >
      {/* Background image for large view */}
      {isLargeView && item.avatar && (
        <Image
          source={{ uri: item.avatar }}
          style={styles.cardBackground}
          defaultSource={require('@/assets/images/default-avatar.png')}
        />
      )}
      
      {/* Management checkbox */}
      {isManaging && (
        <TouchableOpacity
          style={[
            styles.checkboxContainer,
            isSelected && styles.checkboxSelected,
          ]}
          onPress={() => onSelect(item.id)}
        >
          {isSelected && <Ionicons name="checkmark" size={16} color="white"/>}
        </TouchableOpacity>
      )}

      {/* Avatar for small view or overlay elements for large view */}
      {isLargeView ? (
        <View style={styles.largeCardContent}>
          <Text style={styles.largeCardName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.largeCardDescription} numberOfLines={2}>
              {item.description.substring(0, 80)}{item.description.length > 80 ? '...' : ''}
            </Text>
          )}
        </View>
      ) : (
        <>
          <Image
            source={
              item.avatar
                ? { uri: item.avatar }
                : require('@/assets/images/default-avatar.png')
            }
            style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
            defaultSource={require('@/assets/images/default-avatar.png')}
          />
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        </>
      )}
    </TouchableOpacity>
  );
});

// Define style types
import { ImageStyle } from 'react-native';

interface Styles {
  safeArea: ViewStyle;
  header: ViewStyle;
  headerTitleContainer: ViewStyle;
  headerTitle: TextStyle;
  tabsContainer: ViewStyle;
  tab: ViewStyle;
  activeTab: ViewStyle;
  tabText: TextStyle;
  activeTabText: TextStyle;
  activeTabIndicator: ViewStyle;
  mainContainer: ViewStyle;
  listContainer: ViewStyle;
  card: ViewStyle;
  manageCard: ViewStyle;
  largeCard: ViewStyle;
  cardBackground: ImageStyle;
  avatar: ImageStyle;
  cardName: TextStyle;
  largeCardContent: ViewStyle;
  largeCardName: TextStyle;
  largeCardDescription: TextStyle;
  checkboxContainer: ViewStyle;
  checkboxSelected: ViewStyle;
  floatingButtonsContainer: ViewStyle;
  floatingButton: ViewStyle;
  activeButton: ViewStyle;
  deleteButton: ViewStyle;
  createTabContainer: ViewStyle;
  modeTabs: ViewStyle;
  modeTab: ViewStyle;
  activeModeTab: ViewStyle;
  modeTabText: TextStyle;
  activeModeTabText: TextStyle;
  creationContentContainer: ViewStyle;
  sidebar: ViewStyle;
  sidebarItem: ViewStyle;
  activeSidebarItem: ViewStyle;
  creationMainContent: ViewStyle;
  loader: ViewStyle;
  repairNotification: ViewStyle;
  repairNotificationText: TextStyle;
  modeToggleContainer: ViewStyle;
  modeToggle: ViewStyle;
  toggleTrack: ViewStyle;
  toggleTrackActive: ViewStyle;
  toggleThumb: ViewStyle;
  toggleThumbActive: ViewStyle;
  toggleText: TextStyle;
  sidebarModeToggleContainer: ViewStyle;
  sidebarModeToggle: ViewStyle;
  sidebarToggleTrack: ViewStyle;
  sidebarToggleTrackActive: ViewStyle;
  sidebarToggleThumb: ViewStyle;
  sidebarToggleThumbActive: ViewStyle;
  sidebarToggleText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  safeArea: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
  },

  header: {
    backgroundColor: '#333333',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'rgb(255, 224, 195)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 224, 195, 0.2)',
    height: 36, // Make tabs smaller
  },
  tab: {
    flex: 1,
    paddingVertical: 8, // Reduce vertical padding
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    // Remove background color
  },
  tabText: {
    color: '#aaa',
    fontSize: 14,
  },
  activeTabText: {
    color: 'rgb(255, 224, 195)', // Change to cream color
    fontWeight: '500',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: 'rgb(255, 224, 195)', // Change to cream color
  },
  mainContainer: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // Leave space for bottom buttons
    alignItems: 'flex-start',
  },
  card: {
    backgroundColor: COLOR_CARD_BG,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  manageCard: {
    borderColor: 'rgb(255, 224, 195)',
    borderWidth: 2,
  },
  avatar: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLOR_TEXT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  cardName: {
    color: COLOR_TEXT,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLOR_BUTTON,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  checkboxSelected: {
    backgroundColor: COLOR_BUTTON,
  },
  floatingButtonsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  floatingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLOR_BUTTON,  // Updated to use the standardized color
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeButton: {
    backgroundColor: '#FF4444',
  },
  deleteButton: {
    backgroundColor: '#FF4444',
  },
  // Styles for large card view
  largeCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  largeCardContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  largeCardName: {
    color: COLOR_TEXT,
    fontSize: 24,
    fontWeight: 'bold',
  },
  largeCardDescription: {
    color: COLOR_TEXT,
    fontSize: 14,
    marginTop: 8,
  },
  // New styles for create tab
  createTabContainer: {
    flex: 1,
    backgroundColor: '#282828',
    position: 'relative',  // Added to support absolute positioning of modeTabs
  },
  // Replace the modeSelectionContainer with a more compact modeTabs
  modeTabs: {
    position: 'absolute',
    right: 0,
    top: 20,
    zIndex: 10,
    flexDirection: 'column',
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeModeTab: {
    backgroundColor: 'rgb(255, 224, 195)',
  },
  modeTabText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#aaa',
  },
  activeModeTabText: {
    color: '#000',
    fontWeight: '500',
  },
  creationContentContainer: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative', // This allows absolute positioning of the toggle
  },
  sidebar: {
    width: 50, // Reduced sidebar width
    backgroundColor: 'white',
    paddingTop: 20,
    alignItems: 'center',
  },
  sidebarItem: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  activeSidebarItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderLeftColor: '#FFD700',
  },
  // Remove sidebarItemText styles as we're removing the text
  creationMainContent: {
    flex: 1,
  },
  loader: {
    marginTop: 40,
  },
  repairNotification: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  repairNotificationText: {
    color: '#fff',
    fontSize: 14,
  },
  // Remove original toggle styles that were in the content area
  modeToggleContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderRadius: 20,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTrack: {
    width: 46,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
    backgroundColor: '#FFD700',
  },
  toggleText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  // New styles for sidebar mode toggle
  sidebarModeToggleContainer: {
    position: 'absolute',
    left: 0,
    bottom: 64, // Position above save button
    width: 80,
    alignItems: 'center',
    paddingVertical: 16,
  },
  sidebarModeToggle: {
    alignItems: 'center',
  },
  sidebarToggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 2,
  },
  sidebarToggleTrackActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  sidebarToggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarToggleThumbActive: {
    transform: [{ translateX: 16 }],
    backgroundColor: '#FFD700',
  },
  sidebarToggleText: {
    color: '#fff',
    marginTop: 4,
    fontSize: 12,
  },
});

export default CharactersScreen;
function rgb(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}


