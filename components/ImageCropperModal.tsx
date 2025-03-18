import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
interface ImageCropperModalProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onCropComplete: (croppedUri: string) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  visible,
  imageUri,
  onClose,
  onCropComplete,
}) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropSize] = useState(Math.min(SCREEN_WIDTH - 80, 300));
  const [isLoading, setIsLoading] = useState(false);
  
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const lastOffset = useRef({ x: 0, y: 0 });

  // Add state to track current values
  const [currentPanValue, setCurrentPanValue] = useState({ x: 0, y: 0 });
  const [currentScale, setCurrentScale] = useState(1);

  // Set up listeners for animated values
  useEffect(() => {
    const panXListener = pan.x.addListener(({ value }) => setCurrentPanValue(prev => ({ ...prev, x: value })));
    const panYListener = pan.y.addListener(({ value }) => setCurrentPanValue(prev => ({ ...prev, y: value })));
    const scaleListener = scale.addListener(({ value }) => setCurrentScale(value));

    return () => {
      pan.x.removeListener(panXListener);
      pan.y.removeListener(panYListener);
      scale.removeListener(scaleListener);
    };
  }, []);

  // Get image dimensions when loaded
  React.useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (width, height) => {
        const scaleFactor = cropSize / Math.max(width, height);
        setImageSize({
          width: width * scaleFactor,
          height: height * scaleFactor
        });
      });
    }
  }, [imageUri]);

  // Pan responder for drag and pinch gestures
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: () => {
        lastOffset.current = {
          x: currentPanValue.x,
          y: currentPanValue.y
        };
      },

      onPanResponderMove: (e, gestureState) => {
        // Calculate bounds to keep image within crop frame
        const maxX = (imageSize.width * currentScale - cropSize) / 2;
        const maxY = (imageSize.height * currentScale - cropSize) / 2;
        
        let newX = lastOffset.current.x + gestureState.dx;
        let newY = lastOffset.current.y + gestureState.dy;
        
        // Constrain movement
        newX = Math.min(Math.max(newX, -maxX), maxX);
        newY = Math.min(Math.max(newY, -maxY), maxY);
        
        pan.setValue({ x: newX, y: newY });
      },

      onPanResponderRelease: () => {
        lastOffset.current = currentPanValue;
      }
    })
  ).current;

  const handleCrop = async () => {
    try {
      setIsLoading(true);
      
      // Calculate crop parameters based on current pan and scale values
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
        Image.getSize(imageUri, (w, h) => {
          resolve({ width: w, height: h });
        });
      });

      const imageScale = imageSize.width / width;
      const cropX = (width / 2) - ((cropSize / 2 - currentPanValue.x) / imageScale);
      const cropY = (height / 2) - ((cropSize / 2 - currentPanValue.y) / imageScale);
      const cropWidth = cropSize / imageScale;

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropWidth,
              height: cropWidth,
            },
          },
        ],
        {
          format: ImageManipulator.SaveFormat.PNG,
          compress: 1,
        }
      );

      onCropComplete(result.uri);
      onClose();
    } catch (error) {
      console.error("裁剪失败:", error);
      Alert.alert("提示", "裁剪失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>调整头像</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.cropContainer}>
            {/* Crop frame */}
            <View style={[styles.cropFrame, { width: cropSize, height: cropSize }]}>
              {/* Image container */}
              <Animated.View
                {...panResponder.panHandlers}
                style={[{
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { scale: scale }
                  ]
                }]}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: imageSize.width,
                    height: imageSize.height
                  }}
                  resizeMode="contain"
                />
              </Animated.View>
              
              {/* Crop grid overlay */}
              <View style={styles.cropOverlay} pointerEvents="none">
                <View style={styles.cropGridRow}>
                  <View style={styles.cropGridCell} />
                  <View style={styles.cropGridCell} />
                  <View style={styles.cropGridCell} />
                </View>
                <View style={styles.cropGridRow}>
                  <View style={styles.cropGridCell} />
                  <View style={styles.cropGridCell} />
                  <View style={styles.cropGridCell} />
                </View>
                <View style={styles.cropGridRow}>
                  <View style={styles.cropGridCell} />
                  <View style={styles.cropGridCell} />
                  <View style={styles.cropGridCell} />
                </View>
              </View>
            </View>
            
            <Text style={styles.helpText}>
              拖动调整裁剪区域
            </Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={handleCrop}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={[styles.buttonText, styles.primaryButtonText]}>确定</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cropContainer: {
    padding: 20,
    alignItems: 'center',
  },
  previewFrame: {
    width: 200,
    height: 200,
    borderRadius: 100, // Make it circular
    overflow: 'hidden',
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
  },
  helpText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  primaryButton: {
    backgroundColor: 'rgb(255, 224, 195)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  primaryButtonText: {
    color: '#000',
  },
  cropFrame: {
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  cropGridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  cropGridCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default ImageCropperModal;
