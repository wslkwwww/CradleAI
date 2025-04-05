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
  ViewStyle,
  TextStyle,
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
import CreateChar from '@/app/pages/create_char';
import CradleCreateForm from '@/components/CradleCreateForm';
import { theme } from '@/constants/theme';

const VIEW_MODE_SMALL = 'small';
const VIEW_MODE_LARGE = 'large';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);
const LARGE_CARD_WIDTH = width - 32;
const LARGE_CARD_HEIGHT = LARGE_CARD_WIDTH * (16 / 9);

const COLOR_BACKGROUND = '#282828';
const COLOR_CARD_BG = '#333333';
const COLOR_BUTTON = 'rgb(255, 224, 195)';
const COLOR_TEXT = '#FFFFFF';

const CharactersScreen: React.FC = () => {
  const { characters, isLoading, setIsLoading, deleteCharacters } = useCharacters();
  const router = useRouter();
  const [isManaging, setIsManaging] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'small' | 'large'>(VIEW_MODE_LARGE);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [creationType, setCreationType] = useState<'manual' | 'auto' | 'import'>('manual');

  const handleManage = () => {
    setIsManaging((prevIsManaging) => !prevIsManaging);
    setSelectedCharacters([]);
    if (showAddMenu) {
      setShowAddMenu(false);
    }
  };

  const handleAddPress = () => {
    setShowAddMenu(!showAddMenu);
    if (isManaging) {
      setIsManaging(false);
    }
  };

  const handleCreateManual = () => {
    setShowAddMenu(false);
    setCreationType('manual');
    setShowCreationModal(true);
  };

  const handleCreateAuto = () => {
    setShowAddMenu(false);
    setCreationType('auto');
    setShowCreationModal(true);
  };

  const handleImport = async () => {
    setShowAddMenu(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const presetResult = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (!presetResult.assets || !presetResult.assets[0]) {
          throw new Error('未选择预设文件');
        }

        const importedData = await CharacterImporter.importFromPNG(result.assets[0].uri);
        const fileUri = presetResult.assets[0].uri;
        const cacheUri = `${FileSystem.cacheDirectory}${presetResult.assets[0].name}`;

        await FileSystem.copyAsync({
          from: fileUri,
          to: cacheUri,
        });

        const presetJson = await CharacterImporter.importPresetForCharacter(cacheUri, 'temp');

        const completeData = {
          roleCard: importedData.roleCard,
          worldBook: importedData.worldBook,
          preset: presetJson,
          avatar: result.assets[0].uri,
          replaceDefaultPreset: true,
        };

        await AsyncStorage.setItem('temp_import_data', JSON.stringify(completeData));

        setCreationType('manual');
        setShowCreationModal(true);
      }
    } catch (error) {
      console.error('[Character Import] Error:', error);
      Alert.alert('导入失败', error instanceof Error ? error.message : '未知错误');
    }
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

  const handleDelete = async () => {
    if (selectedCharacters.length === 0) {
      Alert.alert('未选中', '请选择要删除的角色。');
      return;
    }

    Alert.alert('删除角色', `确定要删除选中的 ${selectedCharacters.length} 个角色吗？`, [
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
    ]);
  };

  const renderItem = useMemo(
    () => ({ item }: { item: any }) => (
      <CharacterCard
        item={item}
        isManaging={isManaging}
        isSelected={selectedCharacters.includes(item.id)}
        onSelect={toggleSelectCharacter}
        onPress={handleCharacterPress}
        viewMode={viewMode}
      />
    ),
    [isManaging, selectedCharacters, toggleSelectCharacter, handleCharacterPress, viewMode]
  );

  const keyExtractor = useMemo(() => (item: any) => item.id, []);

  const renderAddMenu = () => {
    if (!showAddMenu) return null;

    return (
      <View style={styles.addMenuContainer}>
        <TouchableOpacity style={styles.addMenuItem} onPress={handleCreateManual}>
          <Ionicons name="create-outline" size={20} color="#282828" />
          <Text style={styles.addMenuItemText}>手动创建</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addMenuItem} onPress={handleCreateAuto}>
          <Ionicons name="color-wand-outline" size={20} color="#282828" />
          <Text style={styles.addMenuItemText}>自动创建</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addMenuItem} onPress={handleImport}>
          <Ionicons name="cloud-upload-outline" size={20} color="#282828" />
          <Text style={styles.addMenuItemText}>导入</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCreationModal = () => {
    if (!showCreationModal) return null;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={showCreationModal}
        onRequestClose={() => setShowCreationModal(false)}
      >
        <SafeAreaView style={styles.creationModalContainer}>
          <View style={styles.creationModalHeader}>
            <Text style={styles.creationModalTitle}>
              {creationType === 'manual'
                ? '手动创建角色'
                : creationType === 'auto'
                ? '自动创建角色'
                : '导入角色'}
            </Text>
            <TouchableOpacity onPress={() => setShowCreationModal(false)}>
              <Ionicons name="close" size={24} color={COLOR_TEXT} />
            </TouchableOpacity>
          </View>

          <View style={styles.creationModalContent}>
            {creationType === 'manual' && (
              <CreateChar
                activeTab={'basic'}
                creationMode="manual"
                allowTagImageGeneration={true}
                onClose={() => setShowCreationModal(false)}
              />
            )}
            {creationType === 'auto' && (
              <CradleCreateForm embedded={true} onClose={() => setShowCreationModal(false)} />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderDeleteButton = () => {
    if (!isManaging) return null;

    return (
      <TouchableOpacity style={[styles.floatingButton, styles.deleteButton]} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={24} color="#282828" />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={COLOR_BACKGROUND} />
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>角色管理</Text>
            <View style={styles.headerButtons}></View>
          </View>
        </View>
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR_BACKGROUND} />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>角色管理</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={handleAddPress}>
              <Ionicons name="add" size={24} color={COLOR_BUTTON} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, isManaging && styles.activeHeaderButton]}
              onPress={handleManage}
            >
              <FontAwesome name="wrench" size={20} color={isManaging ? '#282828' : COLOR_BUTTON} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {renderAddMenu()}

      <FlatList
        data={characters}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={viewMode === VIEW_MODE_SMALL ? 2 : 1}
        contentContainerStyle={styles.listContainer}
        key={viewMode}
      />

      {renderCreationModal()}

      {renderDeleteButton()}
    </SafeAreaView>
  );
};

const CharacterCard: React.FC<{
  item: Character;
  isManaging: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPress: (id: string) => void;
  viewMode: 'small' | 'large';
}> = React.memo(({ item, isManaging, isSelected, onSelect, onPress, viewMode }) => {
  const isLargeView = viewMode === VIEW_MODE_LARGE;

  const cardStyle = isLargeView
    ? {
        width: LARGE_CARD_WIDTH,
        height: LARGE_CARD_HEIGHT,
        marginBottom: 16,
      }
    : {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        margin: 8,
      };

  return (
    <TouchableOpacity
      style={[styles.card, cardStyle, isManaging && styles.manageCard]}
      onPress={() => onPress(item.id)}
      onLongPress={() => onSelect(item.id)}
    >
      <Image
        source={
          item.avatar
            ? { uri: item.avatar }
            : require('@/assets/images/default-avatar.png')
        }
        style={styles.cardBackground}
        defaultSource={require('@/assets/images/default-avatar.png')}
      />

      <View style={styles.cardOverlay}>
        <Text style={styles.cardName}>{item.name}</Text>
      </View>

      {isManaging && (
        <TouchableOpacity
          style={[styles.checkboxContainer, isSelected && styles.checkboxSelected]}
          onPress={() => onSelect(item.id)}
        >
          {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

import { ImageStyle } from 'react-native';

interface Styles {
  safeArea: ViewStyle;
  header: ViewStyle;
  headerContent: ViewStyle;
  headerTitle: TextStyle;
  headerButtons: ViewStyle;
  headerButton: ViewStyle;
  activeHeaderButton: ViewStyle;
  listContainer: ViewStyle;
  card: ViewStyle;
  manageCard: ViewStyle;
  cardBackground: ImageStyle;
  cardOverlay: ViewStyle;
  cardName: TextStyle;
  checkboxContainer: ViewStyle;
  checkboxSelected: ViewStyle;
  floatingButton: ViewStyle;
  deleteButton: ViewStyle;
  loader: ViewStyle;
  addMenuContainer: ViewStyle;
  addMenuItem: ViewStyle;
  addMenuItemText: TextStyle;
  creationModalContainer: ViewStyle;
  creationModalHeader: ViewStyle;
  creationModalTitle: TextStyle;
  creationModalContent: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
  safeArea: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
  },
  header: {
    backgroundColor: '#333333',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 224, 195, 0.2)',
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'rgb(255, 224, 195)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeHeaderButton: {
    backgroundColor: COLOR_BUTTON,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
    alignItems: 'flex-start',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  manageCard: {
    borderColor: 'rgb(255, 224, 195)',
    borderWidth: 2,
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  cardName: {
    color: COLOR_TEXT,
    fontSize: 16,
    fontWeight: '500',
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
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deleteButton: {
    backgroundColor: theme.colors.danger,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMenuContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 62 : 102,
    right: 16,
    backgroundColor: COLOR_BUTTON,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 20,
    padding: 4,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  addMenuItemText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#282828',
  },
  creationModalContainer: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
  },
  creationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 224, 195, 0.2)',
  },
  creationModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLOR_BUTTON,
  },
  creationModalContent: {
    flex: 1,
  },
});

export default CharactersScreen;


