import React, { useState, useRef, useEffect, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface RichTextRendererProps {
  content: string;
  isUserMessage?: boolean;
  maxWidth?: number;
}

const { width } = Dimensions.get('window');
const DEFAULT_MAX_WIDTH = width * 0.92;

/**
 * Component for rendering rich HTML/CSS content in chat messages
 */
const RichTextRenderer: React.FC<RichTextRendererProps> = memo(({
  content,
  isUserMessage = false,
  maxWidth = DEFAULT_MAX_WIDTH
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [webViewHeight, setWebViewHeight] = useState<number>(300);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Add unique key for WebView to prevent re-renders
  const contentKey = useRef(`content-${Date.now()}-${Math.random()}`).current;
  
  // Prevent unnecessary re-renders with content hash
  const contentHash = useRef(hashString(content)).current;

  // Simple string hash function
  function hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  // Check for interactive content
  const hasInteractiveElements = content.includes('<button') || 
                              content.includes('onclick=') || 
                              content.includes('<audio') || 
                              content.includes('<video') ||
                              content.includes('<details') ||
                              content.includes('<summary');

  // Check for complete HTML document
  const isFullHtmlDocument = content.trim().startsWith('<!DOCTYPE html>') || 
                           content.includes('<html') || 
                           (content.includes('<head') && content.includes('<body'));
                           
  // Auto-expand if content has interactive elements or is a full HTML document
  useEffect(() => {
    if ((hasInteractiveElements || isFullHtmlDocument) && initialLoad) {
      setIsExpanded(true);
      setInitialLoad(false);
    }
  }, [hasInteractiveElements, isFullHtmlDocument, initialLoad]);

  // Inject styles for proper rendering and create a full HTML document
  const prepareHtmlContent = (content: string): string => {
    // Check if content is already a full HTML document
    const isFullHtmlDoc = content.trim().startsWith('<!DOCTYPE html>') || 
                          content.includes('<html') || 
                          (content.includes('<head') && content.includes('<body'));
    
    // Fix line breaks in plain text content
    if (!isFullHtmlDoc && !content.includes('<br')) {
      // Replace newlines with <br> tags but only if they aren't already in HTML tags
      content = content.replace(/(?<!\>)(\r?\n|\r)(?!\<)/g, '<br>');
    }

    // Process code blocks to preserve formatting
    content = processCodeBlocks(content);

    if (isFullHtmlDoc) {
      // For full HTML documents, just inject viewport meta and additional styles
      let processedContent = content.replace(
        '<head>',
        `<head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body {
              margin: 0; 
              padding: 8px; 
              font-family: system-ui; 
              color: ${isUserMessage ? '#333' : '#fff'};
              width: 100%;
              overflow-wrap: break-word;
              word-wrap: break-word;
              box-sizing: border-box;
              white-space: pre-wrap;
              line-height: 1.4;
              max-width: 100%;
            }
            /* ...existing styles... */
            pre, code {
              white-space: pre-wrap;
              overflow-x: auto;
              background-color: rgba(0,0,0,0.1);
              padding: 8px;
              border-radius: 4px;
              width: 100%;
              font-family: monospace;
              display: block;
            }
            pre {
              margin: 10px 0;
            }
            code {
              padding: 2px 4px;
            }
            pre code {
              padding: 0;
              background: none;
            }
            .code-block {
              white-space: pre-wrap;
              border-left: 3px solid #4CAF50;
              margin: 8px 0;
              padding-left: 8px;
              font-family: monospace;
              max-width: 100%;
              overflow-x: auto;
            }
            /* ...existing styles... */
          </style>`
      );
      
      return processedContent;
    }

    // For HTML fragments, wrap in a full HTML document
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          body {
            margin: 0; 
            padding: 8px; 
            font-family: system-ui; 
            color: ${isUserMessage ? '#333' : '#fff'};
            width: 100%;
            overflow-wrap: break-word;
            word-wrap: break-word;
            box-sizing: border-box;
            white-space: pre-wrap;
            line-height: 1.4;
            max-width: 100%;
          }
          p, div {
            margin-top: 0.5em;
            margin-bottom: 0.5em;
            white-space: pre-wrap;
          }
          img, video {
            max-width: 100%;
            height: auto;
          }
          pre, code {
            white-space: pre-wrap;
            overflow-x: auto;
            background-color: rgba(0,0,0,0.1);
            padding: 8px;
            border-radius: 4px;
            width: 100%;
            font-family: monospace;
            display: block;
          }
          pre {
            margin: 10px 0;
          }
          code {
            padding: 2px 4px;
          }
          pre code {
            padding: 0;
            background: none;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          td, th {
            border: 1px solid #ddd;
            padding: 4px;
          }
          .music-container, div[class*="container"] {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          br {
            display: block;
            content: "";
            margin-top: 0.5em;
          }
          button, .control-button {
            cursor: pointer !important;
            pointer-events: auto !important;
            touch-action: auto !important;
          }
          .code-block {
            white-space: pre-wrap;
            border-left: 3px solid #4CAF50;
            margin: 8px 0;
            padding-left: 8px;
            font-family: monospace;
            max-width: 100%;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  };

  // Add new function to properly format code blocks in markdown
  const processCodeBlocks = (content: string): string => {
    // Look for markdown code blocks (```)
    return content.replace(/```([^`]+)```/g, (match, p1) => {
      return `<pre class="code-block"><code>${p1.trim()}</code></pre>`;
    });
  };

  // Handle message that needs to be rendered as HTML
  const handleAutoHeight = (event: any) => {
    try {
      // Get content height from injected JavaScript
      const contentHeight = event.nativeEvent.data;
      
      // Parse as number, or use default if invalid
      const height = parseInt(contentHeight);
      if (!isNaN(height) && height > 0) {
        setWebViewHeight(Math.max(height, 50));
      }
    } catch (e) {
      console.error('Error processing WebView height:', e);
    }
  };

  const htmlInjection = `
    // Wait for all resources to load
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          // Enable all interactive elements
          document.querySelectorAll('button, audio, video, details, summary').forEach(function(el) {
            el.style.pointerEvents = 'auto';
            el.style.touchAction = 'auto';
          });
          
          // Report content height
          window.ReactNativeWebView.postMessage(
            Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
          );
        } catch(e) {
          console.error('Height calculation error:', e);
        }
      }, 500);
    });
    
    // Additional listener for dynamic content changes
    document.addEventListener('DOMContentLoaded', function() {
      // Handle details elements
      document.querySelectorAll('details').forEach(function(el) {
        el.addEventListener('toggle', function() {
          setTimeout(function() {
            window.ReactNativeWebView.postMessage(
              Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
            );
          }, 100);
        });
      });
      
      // Add click handlers for interactive elements
      document.addEventListener('click', function(e) {
        setTimeout(function() {
          window.ReactNativeWebView.postMessage(
            Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
          );
        }, 100);
      });
    });
    
    true;
  `;

  // Handle error in WebView rendering
  const handleError = () => {
    console.log('WebView error encountered');
    setHasError(true);
    setIsLoading(false);
  };

  // Handle WebView load completion
  const handleLoadEnd = () => {
    setIsLoading(false);
    // Force recalculation of height after full load
    setTimeout(() => {
      const recalcScript = `
        window.ReactNativeWebView.postMessage(
          Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
        );
      `;
      webViewRef.current?.injectJavaScript(recalcScript);
    }, 500);
  };

  // Show error message if WebView fails
  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={24} color="#ffcc00" />
        <Text style={styles.errorText}>
          无法渲染复杂内容。请尝试查看原始消息。
        </Text>
      </View>
    );
  }
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    // Force recalculation after expanding
    if (!isExpanded) {
      setTimeout(() => {
        const recalcScript = `
          window.ReactNativeWebView.postMessage(
            Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
          );
        `;
        webViewRef.current?.injectJavaScript(recalcScript);
      }, 100);
    }
  };

  return (
    <View style={[styles.container, { width: maxWidth, maxWidth: '95%' }]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3498db" />
          <Text style={styles.loadingText}>Loading content...</Text>
        </View>
      )}
      
      <WebView
        key={`${contentKey}-${contentHash}`}
        ref={webViewRef}
        source={{ html: prepareHtmlContent(content) }}
        style={[
          styles.webView, 
          isLoading ? styles.hidden : null,
          { height: isExpanded ? webViewHeight : Math.min(300, webViewHeight) }
        ]}
        injectedJavaScript={htmlInjection}
        onMessage={handleAutoHeight}
        onError={handleError}
        onLoadEnd={handleLoadEnd}
        scrollEnabled={isExpanded}
        showsVerticalScrollIndicator={isExpanded}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        allowFileAccess={true}
        allowsInlineMediaPlayback={true}
        startInLoadingState={true}
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        mixedContentMode="compatibility"
        cacheEnabled={true}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
      />
      
      {webViewHeight > 300 && (
        <TouchableOpacity style={styles.expandButton} onPress={toggleExpand}>
          <Text style={styles.expandButtonText}>
            {isExpanded ? '收起' : '展开查看更多'}
          </Text>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#3498db" 
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 4,
    marginBottom: 8,
  },
  webView: {
    backgroundColor: 'transparent',
    width: '100%',
    opacity: 0.99,
  },
  hidden: {
    opacity: 0,
    height: 0,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  expandButtonText: {
    color: '#3498db',
    marginRight: 4,
    fontSize: 14,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#ffcc00',
    marginLeft: 8,
    flex: 1,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingText: {
    marginLeft: 8,
    color: '#3498db',
    fontSize: 14,
  },
});

export default RichTextRenderer;
