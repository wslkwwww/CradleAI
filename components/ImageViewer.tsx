import React, { useState } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImageViewerProps {
  images: string[];
  initialIndex: number;
  isVisible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  initialIndex,
  isVisible,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: images[currentIndex] }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {images.length > 1 && (
          <View style={styles.navigation}>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.prevButton]}
                onPress={() => setCurrentIndex(prev => prev - 1)}
              >
                <Ionicons name="chevron-back" size={30} color="#fff" />
              </TouchableOpacity>
            )}
            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.nextButton]}
                onPress={() => setCurrentIndex(prev => prev + 1)}
              >
                <Ionicons name="chevron-forward" size={30} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height * 0.8,
  },
  navigation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  prevButton: {
    borderTopRightRadius: 25,
    borderBottomRightRadius: 25,
  },
  nextButton: {
    borderTopLeftRadius: 25,
    borderBottomLeftRadius: 25,
  },
});

export default ImageViewer;
