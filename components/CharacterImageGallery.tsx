import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CharacterImage, CradleCharacter } from '@/shared/types';
import { theme } from '@/constants/theme';
import ImageEditorModal from './ImageEditorModal';
import { useUser } from '@/constants/UserContext';

interface CharacterImageGalleryProps {
  images: CharacterImage[];
  onToggleFavorite: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onSetAsBackground: (imageId: string) => void;
  isLoading?: boolean;
  character?: CradleCharacter; // Add character prop to pass to the editor
  onAddNewImage?: (newImage: CharacterImage) => void; // Add callback for new images
}

const { width } = Dimensions.get('window');
const imageSize = (width - 48) / 2; // 2 images per row with margins

const CharacterImageGallery: React.FC<CharacterImageGalleryProps> = ({
  images,
  onToggleFavorite,
  onDelete,
  onSetAsBackground,
  isLoading = false,
  character,
  onAddNewImage
}) => {
  const [selectedImage, setSelectedImage] = useState<CharacterImage | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false); // New state for the editor modal
  const { user } = useUser(); // Get user for API key
  
  // Get the API key from user settings
  const apiKey = user?.settings?.chat?.characterApiKey || '';
  
  const handleDelete = (image: CharacterImage) => {
    Alert.alert(
      '删除图像',
      '确定删除此图像吗？此操作无法撤销。',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '删除',
          onPress: () => {
            onDelete(image.id);
            if (selectedImage?.id === image.id) {
              setSelectedImage(null);
              setImageViewerVisible(false);
            }
          },
          style: 'destructive'
        }
      ]
    );
  };
  
  // Add a function to handle opening the editor
  const handleEditImage = (image: CharacterImage) => {
    if (!character) {
      Alert.alert('编辑失败', '无法找到该角色信息，无法编辑图片');
      return;
    }
    
    if (!apiKey) {
      Alert.alert('API密钥缺失', '请在设置中配置有效的Gemini API密钥以使用图像编辑功能');
      return;
    }
    
    setSelectedImage(image);
    setImageViewerVisible(false); // Close the viewer if open
    setTimeout(() => setEditorVisible(true), 300); // Open the editor with a small delay
  };
  
  // Handle the successful edit
  const handleEditSuccess = (newImage: CharacterImage) => {
    if (onAddNewImage) {
      onAddNewImage(newImage);
    }
  };
  
  // Display an empty state when there are no images
  if (images.length === 0 && !isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="image-outline" size={60} color="#555" />
        <Text style={styles.emptyText}>暂无生成的图像</Text>
        <Text style={styles.emptySubText}>点击"生成图片"按钮创建新的角色图像</Text>
      </View>
    );
  }
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>正在加载图像...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Remove gallery title and description as they're now in the main view */}
      
      {/* Render images in a grid */}
      <FlatList
        data={images}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={true} // Enable scrolling within the gallery itself
        nestedScrollEnabled={true} // Allow nested scrolling
        contentContainerStyle={styles.galleryContentContainer}
        renderItem={({ item }) => (
          <View style={styles.imageCard}>
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => {
                setSelectedImage(item);
                setImageViewerVisible(true);
              }}
            >
              <Image 
                source={{ uri: item.localUri || item.url }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              {item.isFavorite && (
                <View style={styles.favoriteOverlay}>
                  <Ionicons name="heart" size={18} color="#FF6B6B" />
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={() => onToggleFavorite(item.id)}
              >
                <Ionicons 
                  name={item.isFavorite ? "heart" : "heart-outline"} 
                  size={18} 
                  color={item.isFavorite ? "#FF6B6B" : "#FFF"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={() => handleEditImage(item)}
              >
                <Ionicons name="brush-outline" size={18} color="#FFF" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={() => onSetAsBackground(item.id)}
              >
                <Ionicons name="copy-outline" size={18} color="#FFF" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={() => handleDelete(item)}
              >
                <Ionicons name="trash-outline" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.imageDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      />
      
      {/* The rest of the component remains the same */}
      {/* Full-screen image viewer modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        {selectedImage && (
          <View style={styles.imageViewerContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setImageViewerVisible(false)}
            >
              <Ionicons name="close-circle" size={36} color="#FFF" />
            </TouchableOpacity>
            
            <Image
              source={{ uri: selectedImage.localUri || selectedImage.url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
            
            <View style={styles.imageViewerActions}>
              <TouchableOpacity
                style={styles.imageViewerButton}
                onPress={() => onToggleFavorite(selectedImage.id)}
              >
                <Ionicons 
                  name={selectedImage.isFavorite ? "heart" : "heart-outline"} 
                  size={24} 
                  color={selectedImage.isFavorite ? "#FF6B6B" : "#FFF"} 
                />
                <Text style={styles.imageViewerButtonText}>
                  {selectedImage.isFavorite ? '取消喜欢' : '标记喜欢'}
                </Text>
              </TouchableOpacity>
              
              {/* Add edit button to viewer */}
              <TouchableOpacity
                style={styles.imageViewerButton}
                onPress={() => {
                  setImageViewerVisible(false);
                  setTimeout(() => handleEditImage(selectedImage), 300);
                }}
              >
                <Ionicons name="brush-outline" size={24} color="#FFF" />
                <Text style={styles.imageViewerButtonText}>编辑图像</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageViewerButton}
                onPress={() => {
                  onSetAsBackground(selectedImage.id);
                  setImageViewerVisible(false);
                }}
              >
                <Ionicons name="copy-outline" size={24} color="#FFF" />
                <Text style={styles.imageViewerButtonText}>设为背景图</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageViewerButton}
                onPress={() => handleDelete(selectedImage)}
              >
                <Ionicons name="trash-outline" size={24} color="#FFF" />
                <Text style={styles.imageViewerButtonText}>删除图像</Text>
              </TouchableOpacity>
            </View>
            
            {/* Show tags if available */}
            {selectedImage.tags && (
              <View style={styles.tagsContainer}>
                <Text style={styles.tagsTitle}>使用的标签</Text>
                <View style={styles.tagsList}>
                  {selectedImage.tags.positive?.map((tag, index) => (
                    <View key={`p-${index}`} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </Modal>
      
      {/* Image Editor Modal */}
      {selectedImage && character && (
        <ImageEditorModal
          visible={editorVisible}
          onClose={() => setEditorVisible(false)}
          character={character}
          image={selectedImage}
          apiKey={apiKey}
          onSuccess={handleEditSuccess}
        />
      )}
    </View>
  );
};

// Update the styles to handle the non-scrollable FlatList better
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222',
  },
  galleryTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  galleryDescription: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  galleryContentContainer: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#222',
    minHeight: 200,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#222',
    minHeight: 200,
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
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
    height: imageSize * 1.5, // Make the image card slightly tall
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
  },
  imageDate: {
    color: '#aaa',
    fontSize: 10,
    textAlign: 'center',
    padding: 4,
    backgroundColor: '#1a1a1a',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '70%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  imageViewerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    width: '100%',
  },
  imageViewerButton: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  imageViewerButtonText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 12,
  },
  tagsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  tagsTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default CharacterImageGallery;
