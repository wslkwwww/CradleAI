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
  onSetAsAvatar?: (imageId: string) => void; // Add this new prop
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

const imageSize = (width * 0.75 - 64) / 2; // 2 images per row in the sidebar

const CharacterImageGallerySidebar: React.FC<CharacterImageGallerySidebarProps> = ({
  visible,
  onClose,
  images,
  onToggleFavorite,
  onDelete,
  onSetAsBackground,
  onSetAsAvatar, // Add the new prop here
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
  
  // Add state for image cropping
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageUri, setCropImageUri] = useState<string | null>(null);
  const [pendingAvatarImageId, setPendingAvatarImageId] = useState<string | null>(null);
  
  // Add state variable to track updates and force re-renders
  const [updateCounter, setUpdateCounter] = useState(0);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(Date.now());

  // New state for image regeneration
  const [showRegenerationModal, setShowRegenerationModal] = useState(false);
  const [regenerationImageConfig, setRegenerationImageConfig] = useState<any>(null);

  // New state for tracking downloads
  const [downloadingImages, setDownloadingImages] = useState<Record<string, boolean>>({});

  // Get API key for image editing
  const apiKey = user?.settings?.chat?.characterApiKey || '';
  
  // Create a combined image array that includes initial character images
  const allImages = useMemo(() => {
    console.log(`[图库侧栏] 计算图库内容 (更新计数: ${updateCounter}), 图像数量: ${images.length}`);
    
    let combinedImages = [...images];
    
    // Add character avatar as the first image if it exists and isn't already in the gallery
    if (character.avatar && !images.some(img => img.url === character.avatar || img.localUri === character.avatar)) {
      const avatarImage: CharacterImage = {
        id: `avatar_${character.id}_${lastUpdateTimestamp}`, // Add timestamp for uniqueness
        url: character.avatar,
        localUri: character.avatar,
        characterId: character.id,
        createdAt: character.createdAt || Date.now(),
        isFavorite: false,
        isAvatar: true
      };
      combinedImages.unshift(avatarImage);
    }
    
    // Add background image if it exists and isn't already in the gallery
    if (character.backgroundImage && 
        !images.some(img => img.url === character.backgroundImage || img.localUri === character.backgroundImage) &&
        character.backgroundImage !== character.avatar) {
      const bgImage: CharacterImage = {
        id: `bg_${character.id}_${lastUpdateTimestamp}`, // Add timestamp for uniqueness
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
    
    // Critical fix: Process pending images that actually have a URL
    // This fixes images stuck in pending state even though they're generated
    combinedImages = combinedImages.map(img => {
      // If image is marked as pending but already has a URL/URI, it's actually completed
      if (img.generationStatus === 'pending' && (img.url || img.localUri)) {
        console.log(`[图库侧栏] 发现已有URL的待处理图像，修正状态:`, img.id);
        return {
          ...img,
          generationStatus: 'success',
          // Clear task ID to prevent repeated checking
          generationTaskId: undefined
        };
      }
      return img;
    });
    
    // Also filter out any pending images with missing generationTaskId
    combinedImages = combinedImages.filter(img => 
      !(img.generationStatus === 'pending' && !img.generationTaskId)
    );
    
    // Find and log any remaining pending images
    const pendingImages = combinedImages.filter(img => img.generationStatus === 'pending');
    if (pendingImages.length > 0) {
      console.log(`[图库侧栏] 发现 ${pendingImages.length} 个待处理图像`);
    }
    
    return combinedImages;
  }, [images, character.avatar, character.backgroundImage, updateCounter, lastUpdateTimestamp]);
  
  // Ensure UI refreshes when images or character changes
  useEffect(() => {
    console.log('[图库侧栏] 图像数据已更新, 总数:', images.length);
    
    // Update timestamp to force useMemo recalculation
    setLastUpdateTimestamp(Date.now());
    
    // Increment the update counter to trigger re-renders
    setUpdateCounter(prev => prev + 1);
  }, [images, character.avatar, character.backgroundImage]);
  
  useEffect(() => {
    if (visible) {
      console.log('[图库侧栏] 侧栏变为可见，刷新内容');
      
      // Force refresh when sidebar becomes visible
      setUpdateCounter(prev => prev + 1);
      
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

  // Add this function to ensure each image has a local version
  const ensureLocalImages = async () => {
    if (!images || images.length === 0) return;
    
    // Check for images that have a URL but no local URI
    const imagesNeedingLocalStorage = images.filter(
      img => img.url && (!img.localUri || img.localUri.startsWith('http')) && img.generationStatus !== 'pending'
    );
    
    if (imagesNeedingLocalStorage.length === 0) return;
    
    console.log(`[图库侧栏] 发现 ${imagesNeedingLocalStorage.length} 个图像需要保存到本地`);
    
    // Process each image that needs downloading
    for (const image of imagesNeedingLocalStorage) {
      // Skip if already downloading this image
      if (downloadingImages[image.id]) continue;
      
      setDownloadingImages(prev => ({ ...prev, [image.id]: true }));
      
      try {
        console.log(`[图库侧栏] 正在下载图像: ${image.id}`);
        const localUri = await downloadAndSaveImage(
          image.url,
          image.characterId,
          'gallery'
        );
        
        if (localUri) {
          console.log(`[图库侧栏] 图像已保存到本地: ${localUri}`);
          
          // Update the image with local URI
          const updatedImage = {
            ...image,
            localUri
          };
          
          // Notify parent component of update
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

  // Call the function whenever images change
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
  
  // Modify the handleViewImage function to download if needed
  const handleViewImage = async (image: CharacterImage) => {
    // If image has URL but no local URI, download it first
    if (image.url && (!image.localUri || image.localUri.startsWith('http')) && !downloadingImages[image.id]) {
      setDownloadingImages(prev => ({ ...prev, [image.id]: true }));
      
      try {
        const localUri = await downloadAndSaveImage(
          image.url,
          image.characterId,
          'gallery'
        );
        
        if (localUri) {
          // Update the image with local URI
          const updatedImage = {
            ...image,
            localUri
          };
          
          // Notify parent component of update
          if (onAddNewImage) {
            onAddNewImage(updatedImage);
          }
          
          // Use the local URI for viewing
          setFullImageUri(localUri);
        } else {
          // If download fails, use the remote URL
          setFullImageUri(image.url);
        }
      } catch (error) {
        console.error(`[图库侧栏] 下载图像失败:`, error);
        setFullImageUri(image.localUri || image.url);
      } finally {
        setDownloadingImages(prev => ({ ...prev, [image.id]: false }));
      }
    } else {
      // Use existing URI
      setFullImageUri(image.localUri || image.url);
    }
    
    setShowFullImage(true);
  };

  // Show image options menu
  const showImageOptions = (image: CharacterImage) => {
    setActiveImage(image);
    setShowOptionsMenu(true);
  };

  // Modify the handleSetAsAvatar function to show cropper first
  const handleSetAsAvatar = (imageId: string) => {
    const image = allImages.find(img => img.id === imageId);
    if (image) {
      setCropImageUri(image.localUri || image.url);
      setPendingAvatarImageId(imageId);
      setShowCropper(true);
      setShowOptionsMenu(false);
    }
  };

  // Add handler for crop completion
  const handleCropComplete = (croppedUri: string) => {
    if (pendingAvatarImageId && onSetAsAvatar) {
      onSetAsAvatar(pendingAvatarImageId);
      setShowCropper(false);
      setCropImageUri(null);
      setPendingAvatarImageId(null);
    }
  };

  // Add new function to handle image regeneration
  const handleRegenerateImage = (image: CharacterImage) => {
    // Check if image has tags or generation config
    if (image.generationConfig || (image.tags && (image.tags.positive || image.tags.negative))) {
      // Prepare configuration for regeneration
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
      // No configuration found, show warning
      Alert.alert(
        "无法重新生成",
        "该图像没有关联的生成配置，无法继续重新生成。请使用创建新图像功能。",
        [{ text: "了解", style: "default" }]
      );
    }
  };

  // Add new function to save image to device
  const handleSaveImageToDevice = async (image: CharacterImage) => {
    try {
      // Request permissions first
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

      // Show loading indicator
      Alert.alert("正在保存...", "请等待图片保存完成");
      
      // Download image if it's a remote URL
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
        // Save to media library
        const asset = await MediaLibrary.createAssetAsync(localUri);
        
        // Create album if needed and add to it
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
        
        // Try alternative sharing method if available
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
              key={`gallery-${updateCounter}`} // Add key to force re-render on update
              keyExtractor={(item) => `${item.id}-${updateCounter}`} // Include update counter for unique keys
              numColumns={2}
              contentContainerStyle={styles.galleryContainer}
              extraData={updateCounter} // Make sure FlatList rerenders when this changes
              initialNumToRender={6} // Optimize initial rendering
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
                      // Add loading indicator for downloading images
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
                    
                    {/* Add View button overlay */}
                    <View style={styles.viewButtonOverlay}>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => handleViewImage(item)}
                      >
                        <Ionicons name="eye-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Only show actions for non-pending images */}
                  {item.generationStatus !== 'pending' && !downloadingImages[item.id] && (
                    <View style={styles.imageActions}>
                      {/* Restore the edit button */}
                      <TouchableOpacity
                        style={styles.imageActionButton}
                        onPress={() => handleEdit(item)}
                      >
                        <Ionicons name="brush-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                      
                      {/* Regenerate button - new */}
                      <TouchableOpacity
                        style={[styles.imageActionButton, styles.regenerateButton]}
                        onPress={() => handleRegenerateImage(item)}
                      >
                        <Ionicons name="refresh-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                      
                      {/* Options menu button */}
                      <TouchableOpacity
                        style={styles.imageActionButton}
                        onPress={() => showImageOptions(item)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              onRefresh={() => {
                // Don't trigger refresh operation during loading
                if (isLoading) return;
                
                // Manual refresh handler
                console.log('[图库侧栏] 手动刷新图库');
                setUpdateCounter(prev => prev + 1);
              }}
              refreshing={isLoading}
            />
          )}
        </View>
      </Animated.View>
      
      {/* Image Editor Modal */}
      {selectedImage && (
        <ImageEditorModal
          visible={showEditor}
          onClose={() => setShowEditor(false)}
          image={selectedImage}
          character={character}
          apiKey={apiKey}
          onSuccess={(newImage) => {
            handleEditSuccess(newImage);
            // Force gallery refresh after editing
            setUpdateCounter(prev => prev + 1);
          }}
        />
      )}

      {/* Full Image Viewer Modal */}
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

      {/* Image Options Menu Modal */}
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

                {/* Add Save to Device option */}
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

                {/* Add Share option for platforms that support it */}
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={async () => {
                      const imageUri = activeImage.localUri || activeImage.url;
                      if (imageUri && await Sharing.isAvailableAsync()) {
                        try {
                          // For Android, we need to ensure we have a file:// URI
                          let shareableUri = imageUri;
                          
                          // If it's a remote URL, download first
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

                {/* Add Regenerate option */}
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
                    handleEdit(activeImage);
                    setShowOptionsMenu(false);
                  }}
                >
                  <Ionicons name="brush-outline" size={22} color="#FFF" />
                  <Text style={styles.menuItemText}>编辑图片</Text>
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

      {/* Image Regeneration Modal */}
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
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  imageActionButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
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
  // New styles for the options menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionsMenuContainer: {
    width: '100%',
    backgroundColor: '#333',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32, // 增加底部空间，适应底部导航栏
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
  // Add new styles for pending images and view button
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
  viewButtonOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  viewButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Add new style for regenerate button
  regenerateButton: {
    backgroundColor: 'rgba(138, 43, 226, 0.4)',
  },
});

export default CharacterImageGallerySidebar;