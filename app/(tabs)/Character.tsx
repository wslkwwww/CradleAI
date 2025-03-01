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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { Character } from '@/shared/types';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { CharacterImporter } from '@/utils/CharacterImporter';
import { useUser } from '@/constants/UserContext';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RelationshipGraph } from '@/components/RelationshipGraph';
import { MessageBox } from '@/components/MessageBox';
import { getCharacterById } from '@/services/character-service';

// ... (CharacterCard 组件和常量) ...
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 250) / 2; // 考虑间距 (16 * 2 + 8 * 2)
const CARD_HEIGHT = CARD_WIDTH * 1.5;
const AVATAR_SIZE = CARD_WIDTH * 0.6;

const COLOR_BACKGROUND = '#282828';  // 深色背景
const COLOR_CARD_BG = '#333333';     // 深色卡片背景
const COLOR_BUTTON = '#1a237e';      // 星空蓝
const COLOR_ACCENT = '#333333';      // 深色强调
const COLOR_TEXT = '#FFFFFF';        // 白色文字

const CharacterCard = React.memo(({ item, isManaging, isSelected, onSelect, onPress }: {
  item: Character;
  isManaging: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPress: (id: string) => void;
}) => {
  // 添加调试日志
  // console.log('Rendering character card:', {
  //   id: item.id,
  //   name: item.name,
  //   hasAvatar: !!item.avatar
  // });

  return (
    <TouchableOpacity
      style={[styles.card, isManaging ? styles.manageCard : {}]} // 添加管理模式下的样式
      onPress={() => onPress(item.id)}
      onLongPress={() => onSelect(item.id)} // 长按选择
    >
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

      <Image
        source={
          item.avatar
            ? { uri: item.avatar }
            : require('@/assets/images/default-avatar.png')
        }
        style={styles.avatar}
        defaultSource={require('@/assets/images/default-avatar.png')}
      />
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );
});

const CharactersScreen: React.FC = () => {
  const { characters, isLoading, deleteCharacters, addCharacter, updateCharacter } = useCharacters();
  const { user } = useUser();
  const router = useRouter();
  const [isManaging, setIsManaging] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  // New states for relationship view
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


    const renderItem = useMemo(() => ({ item }: { item: any }) => {
        return (
            <CharacterCard
                item={item}
                isManaging={isManaging}
                isSelected={selectedCharacters.includes(item.id)}
                onSelect={toggleSelectCharacter}
                onPress={handleCharacterPress}
            />
        );
    }, [isManaging, selectedCharacters, toggleSelectCharacter, handleCharacterPress]);

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

   const deleteButtonWidth = animatedValue.interpolate({
    inputRange: [0, 1], // 输入范围：0 到 1
    outputRange: [0, 80], // 输出范围：0 到 80 (按钮的宽度)  可以根据实际需要调整
  });

  // 添加加载状态监听
  // useEffect(() => {
  //   if (!isLoading) {
  //     console.log('Characters loaded:', characters.map(c => ({
  //       id: c.id,
  //       name: c.name,
  //       hasAvatar: !!c.avatar
  //     })));
  //   }
  // }, [isLoading, characters]);

  // Add new function to handle relationship button press
  const handleRelationshipPress = () => {
    if (selectedCharacters.length !== 1) {
      Alert.alert(
        '选择一个角色',
        '请先选择一个角色以查看关系图谱',
        [{ text: '确定', onPress: () => setIsManaging(true) }]
      );
      return;
    }
    
    setSelectedCharacterId(selectedCharacters[0]);
    setShowRelationshipModal(true);
  };

  // Function to handle character update from relationship components
  const handleCharacterUpdate = (updatedCharacter: Character) => {
    updateCharacter(updatedCharacter);
  };

  // Close the relationship modal
  const handleCloseRelationshipModal = () => {
    setShowRelationshipModal(false);
    setSelectedCharacterId(null);
    setRelationshipView('graph');
    // Reset the selection when done
    setSelectedCharacters([]);
    setIsManaging(false);
  };

  // Add a new floating button for relationships
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
        
        {/* New Relationship Button */}
        <TouchableOpacity 
          style={[
            styles.floatingButton, 
            selectedCharacters.length === 1 && styles.highlightButton
          ]} 
          onPress={handleRelationshipPress}
        >
          <FontAwesome name="group" size={24} color="#282828" />
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
          numColumns={2}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Render updated floating buttons */}
      {renderFloatingButtons()}
      
      {/* Relationship Modal */}
      <Modal
        visible={showRelationshipModal}
        animationType="slide"
        onRequestClose={handleCloseRelationshipModal}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={handleCloseRelationshipModal}
            >
              <Ionicons name="close" size={24} color="#282828" />
            </TouchableOpacity>
            
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  relationshipView === 'graph' && styles.activeTabButton
                ]}
                onPress={() => setRelationshipView('graph')}
              >
                <Text style={[
                  styles.tabText,
                  relationshipView === 'graph' && styles.activeTabText
                ]}>关系图谱</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  relationshipView === 'messages' && styles.activeTabButton
                ]}
                onPress={() => setRelationshipView('messages')}
              >
                <Text style={[
                  styles.tabText,
                  relationshipView === 'messages' && styles.activeTabText
                ]}>消息盒子</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Modal Content */}
          {selectedCharacterId && (
            <View style={styles.modalContent}>
              {relationshipView === 'graph' ? (
                <RelationshipGraph
                  character={getCharacterById(characters, selectedCharacterId)!}
                  onUpdateCharacter={handleCharacterUpdate}
                  allCharacters={characters}
                />
              ) : (
                <MessageBox
                  character={getCharacterById(characters, selectedCharacterId)!}
                  onUpdateCharacter={handleCharacterUpdate}
                />
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
  },
  header: {
    height: Platform.OS === 'ios' ? 90 : 90, // 确保高度与其他页面一致
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 47,

    backgroundColor: 'rgba(40, 40, 40, 0.95)',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // 为底部按钮留出空间
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-evenly',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: COLOR_CARD_BG,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  manageCard: {
    borderColor: rgb(255, 224, 195),
    borderWidth: 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLOR_TEXT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
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
    top: 8,          // 调整到卡片边缘
    left: 8,         // 调整到卡片边缘
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
  // New styles for relationship functionality
  highlightButton: {
    backgroundColor: 'rgb(255, 190, 159)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
  },
  modalHeader: {
    flexDirection: 'column',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 20,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 224, 195, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
  },
  activeTabButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.9)',
  },
  tabText: {
    color: '#AAAAAA',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#282828',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
  },
});

export default CharactersScreen;
function rgb(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}
