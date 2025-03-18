import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { formatCodeBlocks, preserveFormatting } from '@/utils/textParser';

interface RichTextRendererProps {
  content: string;
  isUserMessage?: boolean;
  maxWidth?: number;
}

const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  isUserMessage = false,
  maxWidth = 300
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState(100);
  const webViewRef = useRef<WebView>(null);

  // Check if content is a complete HTML document
  const isCompleteHtmlDoc = content.includes('<!DOCTYPE html>') || content.includes('<html');
  
  // Process content before rendering
  const processedContent = React.useMemo(() => {
    try {
      // If it's a complete HTML document, return it as is
      if (isCompleteHtmlDoc) {
        return content;
      }
      
      // Process code blocks first
      let formattedContent = formatCodeBlocks(content);
      
      // If the content doesn't have HTML tags but has newlines, preserve formatting
      if (!formattedContent.includes('<') && formattedContent.includes('\n')) {
        formattedContent = preserveFormatting(formattedContent);
      }
      
      return formattedContent;
    } catch (error) {
      console.error('Error processing content:', error);
      return content;
    }
  }, [content, isCompleteHtmlDoc]);

  // Construct HTML with appropriate styles
  const htmlContent = React.useMemo(() => {
    // If content is already a complete HTML document, just make minor adjustments
    if (isCompleteHtmlDoc) {
      // Insert our height measurement script into the existing HTML
      return content.replace('</body>', `
        <script>
          function updateHeight() {
            const height = Math.max(document.body.scrollHeight, document.body.offsetHeight);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height }));
          }
          
          document.addEventListener('DOMContentLoaded', function() {
            updateHeight();
            
            // Add listeners to all details elements
            const detailsElements = document.querySelectorAll('details');
            detailsElements.forEach(detail => {
              detail.addEventListener('toggle', function() {
                setTimeout(updateHeight, 50);
              });
            });
          });
          
          window.addEventListener('load', function() {
            updateHeight();
            
            const images = document.querySelectorAll('img');
            images.forEach(img => {
              if (img.complete) {
                updateHeight();
              } else {
                img.addEventListener('load', updateHeight);
                img.addEventListener('error', updateHeight);
              }
            });
            
            // Make sure audio elements are visible and working
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
              audio.style.width = '100%';
              audio.style.marginTop = '10px';
              audio.controls = true;
              audio.addEventListener('loadedmetadata', updateHeight);
            });
          });
          
          // Initial height update
          updateHeight();
          
          // Handle buttons and interactive elements
          document.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON') {
              // Try to execute any onclick handlers
              updateHeight();
            }
          });
          
          // Additional listener for dynamic content changes
          const observer = new MutationObserver(updateHeight);
          observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            characterData: true
          });
        </script>
      </body>`);
    } else {
      // Regular content wrapped in our custom HTML template
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
            
            :root {
              color-scheme: ${isUserMessage ? 'light' : 'dark'};
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 16px;
              line-height: 1.5;
              padding: 4px 0;
              margin: 0;
              color: ${isUserMessage ? '#333' : '#fff'};
              background-color: transparent;
              overflow-wrap: break-word;
              word-wrap: break-word;
              word-break: break-word;
              width: ${maxWidth}px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            pre, code {
              font-family: monospace;
              white-space: pre-wrap;
              background-color: rgba(0, 0, 0, 0.1);
              padding: 8px;
              border-radius: 4px;
              overflow-x: auto;
              width: 100%;
              box-sizing: border-box;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 8px 0;
            }
            th, td {
              border: 1px solid #555;
              padding: 8px;
              text-align: left;
            }
            a {
              color: #3498db;
            }
            details {
              margin: 8px 0;
            }
            summary {
              cursor: pointer;
              user-select: none;
            }
            audio {
              width: 100%;
              margin-top: 10px;
            }
            .music-container {
              max-width: 100% !important;
              margin: 10px auto !important;
            }
            /* Fix word wrapping for all elements */
            * {
              overflow-wrap: break-word;
              word-wrap: break-word;
              word-break: break-word;
              max-width: 100%;
              box-sizing: border-box;
            }
            /* Ensure buttons are visible */
            button {
              padding: 8px 12px;
              margin: 4px;
              background-color: rgba(255, 255, 255, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 4px;
              color: inherit;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          ${processedContent}
          <script>
            // This script helps determine the proper height for the WebView
            function updateHeight() {
              const height = Math.max(document.body.scrollHeight, document.body.offsetHeight);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height }));
            }
            
            // Add event listeners for interactive elements like details
            document.addEventListener('DOMContentLoaded', function() {
              updateHeight();
              
              // Add listeners to all details elements
              const detailsElements = document.querySelectorAll('details');
              detailsElements.forEach(detail => {
                detail.addEventListener('toggle', function() {
                  setTimeout(updateHeight, 50); // Give time for animation
                });
              });

              // Make sure audio elements are visible and working
              const audioElements = document.querySelectorAll('audio');
              audioElements.forEach(audio => {
                audio.style.width = '100%';
                audio.style.marginTop = '10px';
                audio.controls = true;
                audio.addEventListener('loadedmetadata', updateHeight);
              });
            });
            
            // Update height when images load
            window.addEventListener('load', function() {
              updateHeight();
              
              // Add listeners to all images
              const images = document.querySelectorAll('img');
              images.forEach(img => {
                if (img.complete) {
                  updateHeight();
                } else {
                  img.addEventListener('load', updateHeight);
                  img.addEventListener('error', updateHeight);
                }
              });
            });

            // Handle buttons and interactive elements
            document.addEventListener('click', function(e) {
              if (e.target.tagName === 'BUTTON') {
                // Try to execute any onclick handlers
                updateHeight();
              }
            });
            
            // Additional listener for dynamic content changes
            const observer = new MutationObserver(updateHeight);
            observer.observe(document.body, { 
              childList: true, 
              subtree: true,
              attributes: true,
              characterData: true
            });
            
            // Initial height update
            updateHeight();
          </script>
        </body>
        </html>
      `;
    }
  }, [processedContent, isUserMessage, maxWidth, isCompleteHtmlDoc, content]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height') {
        // Add a small buffer to ensure no cut-off
        const newHeight = Math.max(data.height + 20, 40); // Ensure minimum height
        setContentHeight(newHeight);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setIsLoading(false);
    setError('Failed to load content');
  };

  return (
    <View style={[styles.container, { maxWidth: maxWidth }]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
      
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={[styles.webView, { height: contentHeight }]}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          originWhitelist={['*']}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false} // Allow autoplay of media
          allowsInlineMediaPlayback={true} // Enable inline media playback
          startInLoadingState={true}
          renderLoading={() => <></>}
          containerStyle={{ backgroundColor: 'transparent' }}
          // Set custom user agent to ensure proper rendering
          userAgent={Platform.select({
            ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ReactNativeWebView',
            android: 'Mozilla/5.0 (Linux; Android 10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/105.0.5195.79 Mobile Safari/537.36 ReactNativeWebView',
            default: 'ReactNativeWebView'
          })}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          // Prevent any navigation away from the content
          onShouldStartLoadWithRequest={(request) => {
            // Only allow initial load and about:blank
            return request.url === 'about:blank' || request.url.startsWith('data:') || !request.url.includes('://');
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webView: {
    width: '100%',
    backgroundColor: 'transparent',
    opacity: 0.99, // Fix for Android transparency issues
  },
  loadingContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  errorText: {
    padding: 10,
    color: '#e74c3c',
    textAlign: 'center',
  }
});

export default RichTextRenderer;
