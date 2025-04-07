import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { parseHtmlToReactNative } from '@/utils/htmlParser';
import ImageManager from '@/utils/ImageManager';

interface RichTextRendererProps {
  html: string;
  baseStyle?: any;
  onImagePress?: (url: string) => void;
  onLinkPress?: (url: string) => void;
  maxImageHeight?: number;
}

const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  html,
  baseStyle = {},
  onImagePress,
  onLinkPress,
  maxImageHeight = 300,
}) => {
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});

  // Add validation for empty content
  if (!html || html.trim() === '') {
    console.warn('Empty HTML content passed to RichTextRenderer');
    return <Text style={[styles.emptyText, baseStyle]}>(No content)</Text>;
  }

  // SafeURL handler for links
  const handleLinkPress = useCallback((url: string) => {
    // Check URL protocol for safety
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
      console.warn('Blocked unsafe URL protocol:', url);
      return;
    }

    // Use custom handler if provided
    if (onLinkPress) {
      onLinkPress(url);
      return;
    }

    // Default link handling
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          console.warn('Cannot open URL:', url);
        }
      })
      .catch((err) => console.error('Error opening URL:', err));
  }, [onLinkPress]);

  // SafeImage handler with error handling
  const handleImagePress = useCallback((url: string) => {
    console.log('Image pressed in RichTextRenderer:', url);
    
    // Check if it's a special image:id format
    if (url.startsWith('image:')) {
      const imageId = url.substring(6); // Remove "image:" prefix
      const imageInfo = ImageManager.getImageInfo(imageId);
      
      if (imageInfo) {
        console.log('Found image info for ID:', imageId);
        // Use thumbnail path for preview and original for full view
        if (onImagePress) {
          onImagePress(imageInfo.originalPath);
        }
        return;
      } else {
        console.error('No image info found for ID:', imageId);
      }
    }
    
    if (onImagePress) {
      onImagePress(url);
    }
  }, [onImagePress]);

  // Image error handler
  const handleImageError = useCallback((url: string) => {
    console.error('Failed to load image:', url);
    setImageLoadErrors(prev => ({
      ...prev,
      [url]: true
    }));
  }, []);

  // Parse HTML and render React Native components
  const renderContent = useCallback(() => {
    try {
      // Process special image:id format in the HTML
      let processedHtml = html;
      const imageIdRegex = /src="image:([^"]+)"/g;
      
      processedHtml = processedHtml.replace(imageIdRegex, (match, imageId) => {
        const imageInfo = ImageManager.getImageInfo(imageId);
        if (imageInfo) {
          return `src="${imageInfo.thumbnailPath}" data-original="${imageInfo.originalPath}" data-image-id="${imageId}"`;
        }
        return match; // Keep original if no info found
      });
      
      // Use the HTML parser utility to convert HTML to React Native components
      const content = parseHtmlToReactNative(processedHtml, {
        baseStyle,
        handleLinkPress,
        handleImagePress,
        handleImageError,
        imageLoadErrors,
        maxImageHeight,
      });
      
      // If parseHtmlToReactNative returns null or undefined
      if (!content) {
        throw new Error('Failed to parse HTML content');
      }
      
      return content;
    } catch (error) {
      console.error('Error rendering HTML content:', error);
      // Fallback rendering for error cases
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorHeader}>
            <Ionicons name="alert-circle" size={20} color="#e74c3c" />
            <Text style={styles.errorText}>Error rendering content</Text>
          </View>
          <Text style={[styles.rawText, baseStyle]}>
            {html.length > 300 ? html.substring(0, 300) + '...' : html}
          </Text>
        </View>
      );
    }
  }, [html, baseStyle, handleLinkPress, handleImagePress, handleImageError, imageLoadErrors, maxImageHeight]);

  return <View style={styles.container}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  errorContainer: {
    padding: 10,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 5,
    marginVertical: 5,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginLeft: 8,
  },
  rawText: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 14,
    padding: 8,
  },
});

export default RichTextRenderer;
