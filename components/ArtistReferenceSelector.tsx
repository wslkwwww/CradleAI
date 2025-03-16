import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import artistData from '@/app/data/v4-artist.json';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { getArtistImageSource } from '@/utils/artistImageMapper';

// Get screen dimensions for responsive layout
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGES_PER_ROW = 2;
const IMAGE_MARGIN = 8;
const IMAGE_WIDTH = (SCREEN_WIDTH - 32 - (IMAGE_MARGIN * 2 * IMAGES_PER_ROW)) / IMAGES_PER_ROW;

interface ArtistImage {
  image_filename: string;
  artist_prompt: string;
  gender: string;
}

interface ArtistReferenceSelectorProps {
  selectedGender: 'male' | 'female' | 'other';
  onSelectArtist: (artistPrompt: string) => void;
  selectedArtistPrompt: string | null;
}

const ArtistReferenceSelector: React.FC<ArtistReferenceSelectorProps> = ({ 
  selectedGender, 
  onSelectArtist,
  selectedArtistPrompt
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ArtistImage | null>(null);
  const [showAllGenders, setShowAllGenders] = useState(false);

  // Filter artist data by gender - MODIFIED to use showAllGenders flag
  const filteredArtists = showAllGenders 
    ? artistData 
    : artistData.filter(artist => selectedGender === 'other' || artist.gender === selectedGender);

  // Find the currently selected artist image based on prompt
  React.useEffect(() => {
    if (selectedArtistPrompt) {
      const selected = artistData.find(artist => artist.artist_prompt === selectedArtistPrompt);
      if (selected) {
        setSelectedImage(selected);
      }
    } else {
      setSelectedImage(null);
    }
  }, [selectedArtistPrompt]);

  const handleSelectArtist = (artist: ArtistImage) => {
    setSelectedImage(artist);
    onSelectArtist(artist.artist_prompt);
    setModalVisible(false);
    console.log(`[摇篮角色创建] 选择画师风格: ${artist.artist_prompt}`);
  };

  const clearSelection = () => {
    setSelectedImage(null);
    onSelectArtist('');
    console.log(`[摇篮角色创建] 清除画师风格选择`);
  };

  // Helper function to render gender badge
  const renderGenderBadge = (gender: string) => {
    if (!showAllGenders) return null;
    
    return (
      <View style={[
        styles.genderBadge,
        { backgroundColor: gender === 'female' ? 'rgba(255, 105, 180, 0.7)' : 'rgba(0, 156, 255, 0.7)' }
      ]}>
        <Text style={styles.genderBadgeText}>
          {gender === 'female' ? '女' : '男'}
        </Text>
      </View>
    );
  };

  // Helper function to get a display name for an artist prompt
  const getArtistDisplayName = (prompt: string): string => {
    if (!prompt) return '';
    
    // Extract the first artist name for display
    const match = prompt.match(/artist:([a-zA-Z0-9_]+)/);
    if (match && match[1]) {
      return `画师风格: ${match[1]}`;
    }
    
    // If no match, just return a generic label
    return "自定义画师风格";
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>画风参考</Text>
      
      {selectedImage ? (
        <View style={styles.selectedImageContainer}>
          <Image 
            source={getArtistImageSource(selectedImage.image_filename)} 
            style={styles.selectedImage}
            defaultSource={require('@/assets/images/image-placeholder.png')}
            resizeMode="contain"
          />
          <View style={styles.selectedImageInfo}>
            <Text style={styles.selectedImageText}>已选择画风参考</Text>
            <TouchableOpacity 
              onPress={clearSelection}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#ff4444" />
              <Text style={styles.clearButtonText}>清除选择</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.selectButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="image-outline" size={24} color="#aaa" />
          <Text style={styles.selectButtonText}>选择画风参考</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择画风参考</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Add a filter toggle for all genders */}
            <View style={styles.filterToggleContainer}>
              <TouchableOpacity 
                style={[
                  styles.filterButton, 
                  !showAllGenders && styles.activeFilterButton
                ]}
                onPress={() => setShowAllGenders(false)}
              >
                <Text style={[
                  styles.filterButtonText,
                  !showAllGenders && styles.activeFilterText
                ]}>
                  {selectedGender === 'female' ? '女性画风' : '男性画风'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.filterButton, 
                  showAllGenders && styles.activeFilterButton
                ]}
                onPress={() => setShowAllGenders(true)}
              >
                <Text style={[
                  styles.filterButtonText,
                  showAllGenders && styles.activeFilterText
                ]}>
                  全部画风
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Display how many images are available */}
            <Text style={styles.resultCountText}>
              共 {filteredArtists.length} 个画风参考
            </Text>
            
            <FlatList
              data={filteredArtists}
              numColumns={2}
              keyExtractor={(item) => item.image_filename}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.artistImageContainer}
                  onPress={() => handleSelectArtist(item)}
                >
                  <View style={styles.imageWrapper}>
                    <Image 
                      source={getArtistImageSource(item.image_filename)}
                      style={styles.artistImage}
                      defaultSource={require('@/assets/images/image-placeholder.png')}
                      resizeMode="cover"
                    />
                    {renderGenderBadge(item.gender)}
                  </View>
                  <View style={styles.artistPromptLabel}>
                    <Text style={styles.artistPromptText} numberOfLines={1}>
                      {getArtistDisplayName(item.artist_prompt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.artistList}
              ListEmptyComponent={
                <View style={styles.noImagesContainer}>
                  <Text style={styles.noImagesText}>
                    没有找到匹配当前性别的参考图片
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // Add new styles
  noImagesContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImagesText: {
    color: '#aaa',
    textAlign: 'center',
  },
  artistPromptLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 6,
  },
  artistPromptText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  
  // New styles for gender filter options
  filterToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
  },
  activeFilterButton: {
    backgroundColor: 'rgba(74, 144, 226, 0.8)',
  },
  filterButtonText: {
    color: '#aaa',
    fontSize: 14,
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  resultCountText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    padding: 8,
  },
  genderBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  genderBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Existing styles with updated dimensions
  container: {
    marginVertical: 16,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  selectButtonText: {
    color: '#aaa',
    marginLeft: 8,
  },
  selectedImageContainer: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#222',
  },
  selectedImageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  selectedImageText: {
    color: '#fff',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ff4444',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: '#282828',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
  },
  artistList: {
    padding: 8,
  },
  artistImageContainer: {
    flex: 1,
    margin: IMAGE_MARGIN,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#333',
    width: IMAGE_WIDTH,
    height: IMAGE_WIDTH,
    position: 'relative',
  },
  artistImage: {
    width: '100%',
    height: '100%',
  },
});

export default ArtistReferenceSelector;
