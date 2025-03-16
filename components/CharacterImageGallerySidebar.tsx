import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CharacterImage, CradleCharacter } from '@/shared/types';
import { theme } from '@/constants/theme';
import ImageEditorModal from './ImageEditorModal';
import { useUser } from '@/constants/UserContext';

const { width, height } = Dimensions.get('window');

interface CharacterImageGallerySidebarProps {
  visible: boolean;
  onClose: () => void;
  images: CharacterImage[];
  onToggleFavorite: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onSetAsBackground: (imageId: string) => void;
  isLoading?: boolean;
  character: CradleCharacter;
  onAddNewImage?: (newImage: CharacterImage) => void;
}

const imageSize = (width * 0.75 - 64) / 2; // 2 images per row in the sidebar

const CharacterImageGallerySidebar: React.FC<CharacterImageGallerySidebarProps> = ({
  visible,
  onClose,
  images,
  onToggleFavorite,
  onDelete,
  onSetAsBackground,
  isLoading = false,
  character,
  onAddNewImage
}) => {
  const slideAnim = useRef(new Animated.Value(width)).current;
  const [selectedImage, setSelectedImage] = React.useState<CharacterImage | null>(null);
  const [showEditor, setShowEditor] = React.useState(false);
  const { user } = useUser();
  
  // Get API key for image editing
  const apiKey = user?.settings?.chat?.characterApiKey || '';
  
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

  const handleDelete = (image: CharacterImage) => {
    // Show confirmation dialog before deleting
    onDelete(image.id);
    setSelectedImage(null);
  };
  
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
          ) : images.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={60} color="#555" />
              <Text style={styles.emptyText}>暂无图片</Text>
              <Text style={styles.emptySubText}>此角色还没有相册图片</Text>
            </View>
          ) : (
            <FlatList
              data={images}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.galleryContainer}
              renderItem={({ item }) => (
                <View style={styles.imageCard}>
                  <TouchableOpacity
                    style={styles.imageContainer}
                    onPress={() => {
                      // Handle image preview
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
                      onPress={() => handleEdit(item)}
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
          onSuccess={handleEditSuccess}
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
  },
  imageDate: {
    color: '#aaa',
    fontSize: 10,
    textAlign: 'center',
    padding: 4,
    backgroundColor: '#1a1a1a',
  },
});

export default CharacterImageGallerySidebar;
