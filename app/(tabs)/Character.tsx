import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import  RelationshipGraph  from '@/components/RelationshipGraph';
import  MessageBox  from '@/components/MessageBox';
import { getCharacterById } from '@/services/character-service';

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
const COLOR_BUTTON = '#1a237e';      // Starry night blue
const COLOR_ACCENT = '#333333';      // Dark accent
const COLOR_TEXT = '#FFFFFF';        // White text

const CharactersScreen: React.FC = () => {
  const { characters, isLoading, deleteCharacters, addCharacter, updateCharacter } = useCharacters();
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

  // useEffect(() => {
  //   console.log('Characters from Context:', characters);
  // }, [characters]);

  const handleCreate = () => {
    router.push('/pages/create_char');
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
          const cacheUri = FileSystem.cacheDirectory + presetResult.assets[0].name;
          
          await FileSystem.copyAsync({
            from: fileUri,
            to: cacheUri
          });

          const presetJson = await CharacterImporter.importPresetForCharacter(cacheUri, 'temp');

          // 构建带有所有必需数据的对象
          const completeData = {
            roleCard: importedData.roleCard,
            worldBook: importedData.worldBook,
            preset: presetJson,
            avatar: result.assets[0].uri
          };

          // 使用 localStorage 临时存储数据，而不是通过路由参数
          await AsyncStorage.setItem(
            'temp_import_data',
            JSON.stringify(completeData)
          );

          // 简单跳转，不携带大量数据
          router.push('/pages/create_char?mode=import');

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

  // Add floating buttons for actions
  const renderFloatingButtons = () => {
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
        
        {/* View Mode Toggle Button */}
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={handleToggleViewMode}
        >
          <MaterialIcons 
            name={viewMode === VIEW_MODE_SMALL ? "grid-on" : "view-agenda"} 
            size={24} 
            color="#282828" 
          />
        </TouchableOpacity>

        {/* Relationship Graph Button - navigates to dedicated page */}
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={handleRelationshipGraphPress}
        >
          <MaterialIcons name="bubble-chart" size={24} color="#282828" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={handleExport}
        >
          <Ionicons name="cloud-download-outline" size={24} color="#282828" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={handleImport}
        >
          <Ionicons name="cloud-upload-outline" size={24} color="#282828" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={handleCreate}
        >
          <Ionicons name="person-add-outline" size={24} color="#282828" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR_BACKGROUND} />

      {isLoading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <FlatList
          data={characters}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={viewMode === VIEW_MODE_SMALL ? 2 : 1} // Adjust columns based on view mode
          contentContainerStyle={styles.listContainer}
          key={viewMode} // Add this to force re-render when view mode changes
        />
      )}

      {renderFloatingButtons()}
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
}

const styles = StyleSheet.create<Styles>({
  safeArea: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
  },
  header: {
    height: Platform.OS === 'ios' ? 90 : 90,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 47,
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
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
    backgroundColor: 'rgba(255, 224, 195, 0.9)',
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
});

export default CharactersScreen;
function rgb(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}


