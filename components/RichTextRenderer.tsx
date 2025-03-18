import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const contentRef = useRef<string>(content);
  const [key, setKey] = useState<number>(0); // Add a key for forced re-renders
  const heightUpdateCountRef = useRef(0);
  const lastHeightRef = useRef(0);

  // Check if content is a complete HTML document
  const isCompleteHtmlDoc = content.includes('<!DOCTYPE html>') || content.includes('<html');
  
  // Prevent unnecessary re-renders when content hasn't changed
  useEffect(() => {
    if (contentRef.current !== content) {
      contentRef.current = content;
      setKey(prevKey => prevKey + 1);
      // Reset height update counter when content changes
      heightUpdateCountRef.current = 0;
    }
  }, [content]);

  // Process content before rendering
  const processedContent = React.useMemo(() => {
    try {
      // If it's a complete HTML document, return it as is
      if (isCompleteHtmlDoc) {
        return content;
      }
      
      // Process content with special XML-like tags before code blocks
      let formattedContent = content;
      
      // Handle custom XML-like tags by wrapping them in proper div elements with styling
      const customTagsRegex = /<(char\s*think|story|dialogue|narration|system)>([\s\S]*?)<\/\1>/g;
      formattedContent = formattedContent.replace(customTagsRegex, (match, tagName, content) => {
        // Add appropriate styling based on tag name
        let className = tagName.replace(/\s+/g, '-').toLowerCase();
        let style = "";
        
        // Preserve line breaks in content by converting \n to <br>
        const formattedInnerContent = content.replace(/\n/g, '<br>');
        
        switch(className) {
          case 'char-think':
            style = "font-style:italic; color:#6a5acd; background-color:rgba(0,0,0,0.05); padding:8px; border-left:3px solid #6a5acd; margin:8px 0;";
            break;
          case 'story':
            style = "color:#3cb371; background-color:rgba(0,0,0,0.05); padding:8px; border-left:3px solid #3cb371; margin:8px 0;";
            break;
          case 'dialogue':
            style = "color:#ff7f50; margin:8px 0;";
            break;
          case 'narration':
            style = "font-style:italic; color:#888; margin:8px 0;";
            break;
          case 'system':
            style = "color:#d3d3d3; background-color:rgba(0,0,0,0.2); padding:8px; font-family:monospace; margin:8px 0;";
            break;
          default:
            style = "margin:8px 0;";
        }
        
        return `<div class="${className}" style="${style}">${formattedInnerContent}</div>`;
      });
      
      // Process code blocks next
      formattedContent = formatCodeBlocks(formattedContent);
      
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
    // If content is already a complete HTML document, sanitize it
    if (isCompleteHtmlDoc) {
      // First completely remove any scripts that could cause reflows
      let modifiedContent = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- scripts removed -->');
      
      // Remove any animation styles
      modifiedContent = modifiedContent.replace(/@keyframes[\s\S]*?{[\s\S]*?}/gi, '');
      modifiedContent = modifiedContent.replace(/animation:[\s\S]*?;/gi, 'animation: none !important;');
      
      // Make HTML static by removing all event listeners
      modifiedContent = modifiedContent.replace(/on\w+="[^"]*"/g, '');
      modifiedContent = modifiedContent.replace(/on\w+='[^']*'/g, '');
      
      // Remove all meta refreshes
      modifiedContent = modifiedContent.replace(/<meta[^>]*refresh[^>]*>/gi, '');

      // Add a wrapper meta tag for viewport control
      if (!modifiedContent.includes('<meta name="viewport"')) {
        modifiedContent = modifiedContent.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">');
      }

      // Add our content sizing script and styles
      return modifiedContent.replace('</head>', `
        <style>
          /* Disable all animations and transitions */
          * {
            animation: none !important;
            -webkit-animation: none !important;
            transition: none !important;
            -webkit-transition: none !important;
            animation-play-state: paused !important;
            -webkit-animation-play-state: paused !important;
          }
          
          /* Force all content to fit width */
          * {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          
          /* Image sizing */
          img {
            max-width: 100% !important;
            height: auto !important;
          }
          
          /* Container limits */
          body, div, section, article {
            max-width: 100% !important;
            overflow-x: hidden !important;
          }
        </style>
        <script>
          function sendHeight() {
            const height = document.body.scrollHeight;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height }));
          }
          
          // Send height after DOM content loads
          document.addEventListener('DOMContentLoaded', () => {
            // Add max-width to any elements missing it
            document.querySelectorAll('*').forEach(el => {
              el.style.maxWidth = '100%';
            });
            
            // Allow height to stabilize
            setTimeout(sendHeight, 300);
          });
          
          // Send height again after all resources load
          window.addEventListener('load', () => {
            // Wait a bit longer for any delayed rendering
            setTimeout(sendHeight, 500);
          });
        </script>
      </head>`);
    } else {
      // Regular content wrapped in our custom HTML template
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
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
              width: ${maxWidth}px;
              overflow-x: hidden;
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
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #555;
              padding: 8px;
              text-align: left;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            a {
              color: #3498db;
              word-break: break-all;
            }
            details {
              margin: 8px 0;
              width: 100%;
            }
            summary {
              cursor: pointer;
              user-select: none;
            }
            audio {
              width: 100%;
              margin-top: 10px;
            }
            /* Specific styles for custom XML-like tags */
            .char-think {
              font-style: italic;
              color: #6a5acd;
              background-color: rgba(0,0,0,0.05);
              padding: 8px;
              border-left: 3px solid #6a5acd;
              margin: 8px 0;
              display: block;
            }
            .story {
              color: #3cb371;
              background-color: rgba(0,0,0,0.05);
              padding: 8px;
              border-left: 3px solid #3cb371;
              margin: 8px 0;
              display: block;
            }
            .dialogue {
              color: #ff7f50;
              margin: 8px 0;
              display: block;
            }
            .narration {
              font-style: italic;
              color: #888;
              margin: 8px 0;
              display: block;
            }
            .system {
              color: #d3d3d3;
              background-color: rgba(0,0,0,0.2);
              padding: 8px;
              font-family: monospace;
              margin: 8px 0;
              display: block;
            }
            /* Style exceptions for pre/code */
            pre, code {
              white-space: pre-wrap !important;
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
            // Send height info to React Native
            function sendHeight() {
              const height = document.body.scrollHeight;
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height }));
            }

            // Send height after content loads
            document.addEventListener('DOMContentLoaded', function() {
              setTimeout(sendHeight, 100);
            });

            // Send height after all resources finish loading
            window.addEventListener('load', function() {
              // Set up listener for images loading
              document.querySelectorAll('img').forEach(img => {
                img.onload = sendHeight;
                img.onerror = sendHeight;
              });
              
              // Final height update
              setTimeout(sendHeight, 500);
            });
          </script>
        </body>
        </html>
      `;
    }
  }, [processedContent, isUserMessage, maxWidth, isCompleteHtmlDoc, content]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height') {
        // Increment the update counter
        heightUpdateCountRef.current += 1;
        
        // Only consider height changes if:
        // 1. We're still in the first few updates (initial rendering)
        // 2. The height change is significant (more than 20px)
        const heightDiff = Math.abs(data.height - lastHeightRef.current);
        const shouldUpdateHeight = 
          heightUpdateCountRef.current <= 3 || 
          heightDiff > 20;
        
        if (shouldUpdateHeight) {
          // Add small buffer and ensure minimum height
          const newHeight = Math.max(data.height + 10, 40);
          lastHeightRef.current = data.height;
          setContentHeight(newHeight);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setIsLoading(false);
    setError('Failed to load content');
  }, []);

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
          key={key}
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={[
            styles.webView, 
            { height: contentHeight }
          ]}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          originWhitelist={['*']}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          javaScriptEnabled={true}
          domStorageEnabled={false}
          mediaPlaybackRequiresUserAction={true}
          allowsInlineMediaPlayback={true}
          startInLoadingState={true}
          renderLoading={() => <></>}
          containerStyle={{ backgroundColor: 'transparent' }}
          cacheEnabled={false}
          textZoom={100}
          userAgent={Platform.select({
            ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ReactNativeWebView',
            android: 'Mozilla/5.0 (Linux; Android 10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/105.0.5195.79 Mobile Safari/537.36 ReactNativeWebView',
            default: 'ReactNativeWebView'
          })}
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
