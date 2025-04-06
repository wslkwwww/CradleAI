import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CharacterImage, CradleCharacter } from '@/shared/types';
import { theme } from '@/constants/theme';
import ImageEditorModal from './ImageEditorModal';
import { useUser } from '@/constants/UserContext';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import ImageRegenerationModal from './ImageRegenerationModal';
import { downloadAndSaveImage } from '@/utils/imageUtils';
const { width, height } = Dimensions.get('window');

interface CharacterImageGallerySidebarProps {
  visible: boolean;
  onClose: () => void;
  images: CharacterImage[];
  onToggleFavorite: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onSetAsBackground: (imageId: string) => void;
  onSetAsAvatar?: (imageId: string) => void;
  isLoading?: boolean;
  character: CradleCharacter;
  onAddNewImage?: (newImage: CharacterImage) => void;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const imageSize = (width * 0.75 - 64) / 2;

const CharacterImageGallerySidebar: React.FC<CharacterImageGallerySidebarProps> = ({
  visible,
  onClose,
  images,
  onToggleFavorite,
  onDelete,
  onSetAsBackground,
  onSetAsAvatar,
  isLoading = false,
  character,
  onAddNewImage
}) => {
  const slideAnim = useRef(new Animated.Value(width)).current;
  const [selectedImage, setSelectedImage] = useState<CharacterImage | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [activeImage, setActiveImage] = useState<CharacterImage | null>(null);
  const { user } = useUser();
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageUri, setCropImageUri] = useState<string | null>(null);
  const [pendingAvatarImageId, setPendingAvatarImageId] = useState<string | null>(null);
  const [updateCounter, setUpdateCounter] = useState(0);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(Date.now());
  const [showRegenerationModal, setShowRegenerationModal] = useState(false);
  const [regenerationImageConfig, setRegenerationImageConfig] = useState<any>(null);
  const [downloadingImages, setDownloadingImages] = useState<Record<string, boolean>>({});
  const apiKey = user?.settings?.chat?.characterApiKey || '';

  const allImages = useMemo(() => {
    let combinedImages = [...images];
    if (character.avatar && !images.some(img => img.url === character.avatar || img.localUri === character.avatar)) {
      const avatarImage: CharacterImage = {
        id: `avatar_${character.id}_${lastUpdateTimestamp}`,
        url: character.avatar,
        localUri: character.avatar,
        characterId: character.id,
        createdAt: character.createdAt || Date.now(),
        isFavorite: false,
        isAvatar: true
      };
      combinedImages.unshift(avatarImage);
    }
    if (
      character.backgroundImage &&
      !images.some(img => img.url === character.backgroundImage || img.localUri === character.backgroundImage) &&
      character.backgroundImage !== character.avatar
    ) {
      const bgImage: CharacterImage = {
        id: `bg_${character.id}_${lastUpdateTimestamp}`,
        url: character.backgroundImage,
        localUri: character.backgroundImage,
        characterId: character.id,
        createdAt: character.createdAt || Date.now(),
        isFavorite: false,
        isDefaultBackground: true,
        isAvatar: false
      };
      combinedImages.unshift(bgImage);
    }
    combinedImages = combinedImages.map(img => {
      if (img.generationStatus === 'pending' && (img.url || img.localUri)) {
        return {
          ...img,
          generationStatus: 'success',
          generationTaskId: undefined
        };
      }
      return img;
    });
    combinedImages = combinedImages.filter(
      img => !(img.generationStatus === 'pending' && !img.generationTaskId)
    );
    return combinedImages;
  }, [images, character.avatar, character.backgroundImage, updateCounter, lastUpdateTimestamp]);

  useEffect(() => {
    setLastUpdateTimestamp(Date.now());
    setUpdateCounter(prev => prev + 1);
  }, [images, character.avatar, character.backgroundImage]);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [visible, slideAnim]);

  const ensureLocalImages = async () => {
    if (!images || images.length === 0) return;
    const imagesNeedingLocalStorage = images.filter(
      img => img.url && (!img.localUri || img.localUri.startsWith('http')) && img.generationStatus !== 'pending'
    );
    if (imagesNeedingLocalStorage.length === 0) return;
    for (const image of imagesNeedingLocalStorage) {
      if (downloadingImages[image.id]) continue;
      setDownloadingImages(prev => ({ ...prev, [image.id]: true }));
      try {
        const localUri = await downloadAndSaveImage(image.url, image.characterId, 'gallery');
        if (localUri) {
          const updatedImage = {
            ...image,
            localUri
          };
          if (onAddNewImage) {
            onAddNewImage(updatedImage);
          }
        }
      } catch (error) {
        console.error(`[图库侧栏] 下载图像失败:`, error);
      } finally {
        setDownloadingImages(prev => ({ ...prev, [image.id]: false }));
      }
    }
  };

  useEffect(() => {
    if (visible) {
      ensureLocalImages();
    }
  }, [visible, images]);

  const handleEdit = (image: CharacterImage) => {
    setSelectedImage(image);
    setShowEditor(true);
  };

  const handleEditSuccess = (newImage: CharacterImage) => {
    if (onAddNewImage) {
      onAddNewImage(newImage);
    }
    setShowEditor(false);
  };

  const handleViewImage = async (image: CharacterImage) => {
    if (image.url && (!image.localUri || image.localUri.startsWith('http')) && !downloadingImages[image.id]) {
      setDownloadingImages(prev => ({ ...prev, [image.id]: true }));
      try {
        const localUri = await downloadAndSaveImage(image.url, image.characterId, 'gallery');
        if (localUri) {
          const updatedImage = {
            ...image,
            localUri
          };
          if (onAddNewImage) {
            onAddNewImage(updatedImage);
          }
          setFullImageUri(localUri);
        } else {
          setFullImageUri(image.url);
        }
      } catch (error) {
        console.error(`[图库侧栏] 下载图像失败:`, error);
        setFullImageUri(image.localUri || image.url);
      } finally {
        setDownloadingImages(prev => ({ ...prev, [image.id]: false }));
      }
    } else {
      setFullImageUri(image.localUri || image.url);
    }
    setShowFullImage(true);
  };

  const showImageOptions = (image: CharacterImage) => {
    setActiveImage(image);
    setShowOptionsMenu(true);
  };

  const handleSetAsAvatar = (imageId: string) => {
    const image = allImages.find(img => img.id === imageId);
    if (image) {
      setCropImageUri(image.localUri || image.url);
      setPendingAvatarImageId(imageId);
      setShowCropper(true);
      setShowOptionsMenu(false);
    }
  };

  const handleCropComplete = (croppedUri: string) => {
    if (pendingAvatarImageId && onSetAsAvatar) {
      onSetAsAvatar(pendingAvatarImageId);
      setShowCropper(false);
      setCropImageUri(null);
      setPendingAvatarImageId(null);
    }
  };

  const handleRegenerateImage = (image: CharacterImage) => {
    if (image.generationConfig || (image.tags && (image.tags.positive || image.tags.negative))) {
      const config = {
        positiveTags: image.generationConfig?.positiveTags || image.tags?.positive || [],
        negativeTags: image.generationConfig?.negativeTags || image.tags?.negative || [],
        artistPrompt: image.generationConfig?.artistPrompt || null,
        customPrompt: image.generationConfig?.customPrompt || '',
        useCustomPrompt: image.generationConfig?.useCustomPrompt || false
      };
      setRegenerationImageConfig(config);
      setShowRegenerationModal(true);
    } else {
      Alert.alert(
        "无法重新生成",
        "该图像没有关联的生成配置，无法继续重新生成。请使用创建新图像功能。",
        [{ text: "了解", style: "default" }]
      );
    }
  };

  const handleSaveImageToDevice = async (image: CharacterImage) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          "权限被拒绝",
          "需要存储权限才能保存图片",
          [{ text: "好的", style: "default" }]
        );
        return;
      }
      const imageUri = image.localUri || image.url;
      if (!imageUri) {
        Alert.alert("错误", "图片URI无效");
        return;
      }
      Alert.alert("正在保存...", "请等待图片保存完成");
      let localUri = imageUri;
      if (imageUri.startsWith('http')) {
        try {
          const fileUri = `${FileSystem.documentDirectory}temp_${Date.now()}.jpg`;
          const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri);
          localUri = downloadResult.uri;
        } catch (downloadError) {
          console.error("下载图片失败:", downloadError);
          Alert.alert(
            "下载失败",
            "无法下载远程图片: " + (downloadError instanceof Error ? downloadError.message : String(downloadError))
          );
          return;
        }
      }
      try {
        const asset = await MediaLibrary.createAssetAsync(localUri);
        let album = await MediaLibrary.getAlbumAsync("AI伙伴");
        if (album === null) {
          await MediaLibrary.createAlbumAsync("AI伙伴", asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        Alert.alert(
          "保存成功",
          "图片已保存到您的相册中的'AI伙伴'相册",
          [{ text: "太好了", style: "default" }]
        );
      } catch (saveError) {
        console.error("保存到媒体库失败:", saveError);
        if (Platform.OS !== 'web' && await Sharing.isAvailableAsync()) {
          try {
            await Sharing.shareAsync(localUri, {
              mimeType: 'image/jpeg',
              dialogTitle: '保存图片'
            });
          } catch (sharingError) {
            console.error("分享图片失败:", sharingError);
            Alert.alert(
              "操作失败",
              "无法保存或分享图片。请尝试截屏保存。"
            );
          }
        } else {
          Alert.alert(
            "保存失败",
            "无法保存图片到相册，请尝试截屏保存。"
          );
        }
      }
    } catch (error) {
      console.error("保存图片失败:", error);
      Alert.alert(
        "保存失败",
        "无法保存图片: " + (error instanceof Error ? error.message : String(error))
      );
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.overlayBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>角色图库</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>正在加载图像...</Text>
            </View>
          ) : allImages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={60} color="#555" />
              <Text style={styles.emptyText}>暂无图片</Text>
              <Text style={styles.emptySubText}>此角色还没有相册图片</Text>
            </View>
          ) : (
            <FlatList
              data={allImages}
              key={`gallery-${updateCounter}`}
              keyExtractor={(item) => `${item.id}-${updateCounter}`}
              numColumns={2}
              contentContainerStyle={styles.galleryContainer}
              extraData={updateCounter}
              initialNumToRender={6}
              maxToRenderPerBatch={10}
              renderItem={({ item }) => (
                <View style={styles.imageCard}>
                  <TouchableOpacity
                    style={styles.imageContainer}
                    onPress={() => handleViewImage(item)}
                  >
                    {item.generationStatus === 'pending' ? (
                      <View style={styles.pendingImageContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.pendingText}>生成中...</Text>
                      </View>
                    ) : downloadingImages[item.id] ? (
                      <View style={styles.pendingImageContainer}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.pendingText}>下载中...</Text>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: item.localUri || item.url }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                        onError={(e) => console.log(`[图库侧栏] 加载图片失败: ${item.id}`, e.nativeEvent.error)}
                      />
                    )}

                    {item.isAvatar && (
                      <View style={styles.imageTypeOverlay}>
                        <Text style={styles.imageTypeText}>头像</Text>
                      </View>
                    )}

                    {item.isDefaultBackground && (
                      <View style={styles.imageTypeOverlay}>
                        <Text style={styles.imageTypeText}>背景</Text>
                      </View>
                    )}

                    {item.isFavorite && (
                      <View style={styles.favoriteOverlay}>
                        <Ionicons name="heart" size={18} color="#FF6B6B" />
                      </View>
                    )}

                    {item.generationStatus !== 'pending' && !downloadingImages[item.id] && (
                      <TouchableOpacity
                        style={styles.optionsButtonOverlay}
                        onPress={() => showImageOptions(item)}
                      >
                        <View style={styles.optionsButton}>
                          <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              onRefresh={() => {
                if (isLoading) return;
                setUpdateCounter(prev => prev + 1);
              }}
              refreshing={isLoading}
            />
          )}
        </View>
      </Animated.View>

      {selectedImage && (
        <ImageEditorModal
          visible={showEditor}
          onClose={() => setShowEditor(false)}
          image={selectedImage}
          character={character}
          apiKey={apiKey}
          onSuccess={(newImage) => {
            handleEditSuccess(newImage);
            setUpdateCounter(prev => prev + 1);
          }}
        />
      )}

      <Modal
        visible={showFullImage}
        transparent={true}
        onRequestClose={() => setShowFullImage(false)}
        animationType="fade"
      >
        <View style={styles.fullImageContainer}>
          <TouchableOpacity
            style={styles.fullImageCloseButton}
            onPress={() => setShowFullImage(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {fullImageUri && (
            <Image
              source={{ uri: fullImageUri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={showOptionsMenu}
        transparent={true}
        onRequestClose={() => setShowOptionsMenu(false)}
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsMenuContainer}>
            <Text style={styles.optionsMenuTitle}>图像选项</Text>

            {activeImage && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleViewImage(activeImage);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons name="eye-outline" size={22} color="#FFF" />
                  <Text style={styles.menuItemText}>查看大图</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onToggleFavorite(activeImage.id);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons
                    name={activeImage.isFavorite ? "heart" : "heart-outline"}
                    size={22}
                    color={activeImage.isFavorite ? "#FF6B6B" : "#FFF"}
                  />
                  <Text style={styles.menuItemText}>
                    {activeImage.isFavorite ? "取消收藏" : "收藏图片"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleEdit(activeImage);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons name="brush-outline" size={22} color="#FFF" />
                  <Text style={styles.menuItemText}>编辑图片</Text>
                </TouchableOpacity>

                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      handleSaveImageToDevice(activeImage);
                      setShowOptionsMenu(false);
                    }}
                  >
                    <Ionicons name="download-outline" size={22} color="#FFF" />
                    <Text style={styles.menuItemText}>保存到相册</Text>
                  </TouchableOpacity>
                )}

                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={async () => {
                      const imageUri = activeImage.localUri || activeImage.url;
                      if (imageUri && await Sharing.isAvailableAsync()) {
                        try {
                          let shareableUri = imageUri;
                          if (imageUri.startsWith('http')) {
                            const fileUri = `${FileSystem.documentDirectory}share_temp_${Date.now()}.jpg`;
                            const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri);
                            shareableUri = downloadResult.uri;
                          }
                          await Sharing.shareAsync(shareableUri, {
                            mimeType: 'image/jpeg',
                            dialogTitle: '分享图片'
                          });
                        } catch (error) {
                          console.error("分享图片失败:", error);
                          Alert.alert("分享失败", "无法分享图片");
                        }
                      } else {
                        Alert.alert("分享功能不可用", "您的设备不支持分享功能");
                      }
                      setShowOptionsMenu(false);
                    }}
                  >
                    <Ionicons name="share-social-outline" size={22} color="#FFF" />
                    <Text style={styles.menuItemText}>分享图片</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleRegenerateImage(activeImage);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons name="refresh-outline" size={22} color="#FFF" />
                  <Text style={styles.menuItemText}>重新生成</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onSetAsBackground(activeImage.id);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons name="copy-outline" size={22} color="#FFF" />
                  <Text style={styles.menuItemText}>设为背景</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleSetAsAvatar(activeImage.id);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons name="person-outline" size={22} color="#FFF" />
                  <Text style={styles.menuItemText}>设为头像</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, styles.deleteMenuItem]}
                  onPress={() => {
                    onDelete(activeImage.id);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                  <Text style={[styles.menuItemText, styles.deleteMenuItemText]}>删除图片</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {showRegenerationModal && character && (
        <ImageRegenerationModal
          visible={showRegenerationModal}
          character={character}
          onClose={() => setShowRegenerationModal(false)}
          onSuccess={(newImage) => {
            if (onAddNewImage) {
              onAddNewImage(newImage);
            }
            setShowRegenerationModal(false);
          }}
          existingImageConfig={regenerationImageConfig}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: width * 0.75,
    height: '100%',
    backgroundColor: '#222',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#282828',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  galleryContainer: {
    padding: 16,
  },
  imageCard: {
    width: imageSize,
    marginHorizontal: 8,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#333',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: imageSize * 1.5,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  favoriteOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  fullImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '90%',
  },
  fullImageCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionsMenuContainer: {
    width: '100%',
    backgroundColor: '#282828',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  optionsMenuTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 16,
  },
  deleteMenuItem: {
    borderBottomWidth: 0,
  },
  deleteMenuItemText: {
    color: '#FF6B6B',
  },
  pendingImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 12,
  },
  imageTypeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  imageTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  optionsButtonOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
  optionsButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CharacterImageGallerySidebar;