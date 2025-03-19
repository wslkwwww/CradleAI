import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { parseHtmlToReactNative } from '@/utils/htmlParser';

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

  // SafeImage handler
  const handleImagePress = useCallback((url: string) => {
    if (onImagePress) {
      onImagePress(url);
    }
  }, [onImagePress]);

  // Parse HTML and render React Native components
  const renderContent = useCallback(() => {
    try {
      // Remove excessive logging
      // console.log("RichTextRenderer rendering HTML:", html.substring(0, 100));
      
      // Use the HTML parser utility to convert HTML to React Native components
      const content = parseHtmlToReactNative(html, {
        baseStyle,
        handleLinkPress,
        handleImagePress,
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
  }, [html, baseStyle, handleLinkPress, handleImagePress, maxImageHeight]);

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
