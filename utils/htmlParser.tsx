import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as htmlParser from 'react-native-html-parser';
import CodeBlockRenderer from '@/components/CodeBlockRenderer';
import ImageManager from '@/utils/ImageManager';

// Define the supported HTML tags and CSS properties as per requirements
const SUPPORTED_TAGS = [
  'div', 'p', 'br', 'b', 'i', 'span', 'ul', 'ol', 'li', 'img', 'a', 'details', 'summary',
  // Add custom tags
  'thinking', 'think', 'status', 'char', 'mem', 'websearch',
  // Add more HTML5 tags
  'section', 'article', 'header', 'footer', 'nav', 'aside', 'figure', 'figcaption',
  'code', 'pre', 'blockquote', 'em', 'strong', 'mark', 'small', 'del', 'ins', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

// Define a type for the node structure from HTML parser
interface HtmlNode {
  nodeName: string;
  nodeType: number;
  nodeValue: string | null;
  attributes?: Record<string, string>;
  childNodes?: HtmlNode[];
}

// Convert CSS string to React Native style object
const convertCssToStyle = (cssString: string): any => {
  if (!cssString) return {};
  
  const styles: any = {};
  
  // Extract style properties
  const cssProperties = cssString.split(';');
  
  cssProperties.forEach(property => {
    const trimmedProperty = property.trim();
    if (!trimmedProperty) return;
    
    const [key, value] = trimmedProperty.split(':').map(str => str.trim());
    if (!key || !value) return;
    
    // Convert kebab-case to camelCase
    const camelCaseKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
    
    // Handle specific CSS properties
    switch (camelCaseKey) {
      case 'color':
        styles.color = value;
        break;
      case 'backgroundColor':
      case 'background':
        styles.backgroundColor = value;
        break;
      case 'fontSize':
        // Convert px to numbers
        const fontSize = parseInt(value);
        if (!isNaN(fontSize)) {
          styles.fontSize = fontSize;
        }
        break;
      case 'fontWeight':
        styles.fontWeight = value;
        break;
      case 'fontStyle':
        styles.fontStyle = value;
        break;
      case 'textAlign':
        styles.textAlign = value;
        break;
      case 'lineHeight':
        const lineHeight = parseInt(value);
        if (!isNaN(lineHeight)) {
          styles.lineHeight = lineHeight;
        }
        break;
      case 'padding':
      case 'paddingTop':
      case 'paddingRight':
      case 'paddingBottom':
      case 'paddingLeft':
        const padding = parseInt(value);
        if (!isNaN(padding)) {
          styles[camelCaseKey] = padding;
        }
        break;
      case 'margin':
      case 'marginTop':
      case 'marginRight':
      case 'marginBottom':
      case 'marginLeft':
        const margin = parseInt(value);
        if (!isNaN(margin)) {
          styles[camelCaseKey] = margin;
        }
        break;
      case 'width':
      case 'height':
        // Handle percentages
        if (value.endsWith('%')) {
          styles[camelCaseKey] = value;
        } else {
          const size = parseInt(value);
          if (!isNaN(size)) {
            styles[camelCaseKey] = size;
          }
        }
        break;
      case 'border':
        // Parse basic border properties
        if (value.includes('px')) {
          const [width, style, color] = value.split(' ');
          const borderWidth = parseInt(width);
          if (!isNaN(borderWidth)) {
            styles.borderWidth = borderWidth;
            styles.borderStyle = style === 'solid' ? 'solid' : 'dotted';
            styles.borderColor = color;
          }
        }
        break;
      case 'borderRadius':
        const radius = parseInt(value);
        if (!isNaN(radius)) {
          styles.borderRadius = radius;
        }
        break;
      case 'display':
        styles.display = value === 'flex' ? 'flex' : value;
        break;
      case 'flexDirection':
        styles.flexDirection = value;
        break;
      case 'justifyContent':
        styles.justifyContent = value;
        break;
      case 'alignItems':
        styles.alignItems = value;
        break;
      case 'gap':
        const gap = parseInt(value);
        if (!isNaN(gap)) {
          styles.gap = gap;
        }
        break;
      // Add more properties as needed
    }
  });
  
  return styles;
};

// Handle Markdown code blocks extraction and conversion
const extractMarkdownCodeBlocks = (html: string): { htmlWithCodeBlocks: string, codeBlocks: Array<{id: string, language: string, code: string}> } => {
  const codeBlocks: Array<{id: string, language: string, code: string}> = [];
  
  // Replace ```language\ncode``` blocks with placeholders
  const htmlWithCodeBlocks = html.replace(/```(.*?)\n([\s\S]*?)```/g, (match, language, code) => {
    const id = `code-block-${codeBlocks.length}`;
    codeBlocks.push({ 
      id, 
      language: language.trim() || 'text',
      code: code.trim()
    });
    return `<pre id="${id}" class="code-block"></pre>`;
  });
  
  return { htmlWithCodeBlocks, codeBlocks };
};

// Process custom tags before HTML parsing - with more flexible regex patterns
const preprocessCustomTags = (html: string): string => {
  if (!html) return '';
  
  let processed = html;
  
  // Remove excessive logging
  // console.log("htmlParser preprocessing HTML:", html.substring(0, 100));
  
  // More flexible regex patterns for custom tags
  // Convert <thinking> tags with various spacing/formatting
  processed = processed.replace(
    /<\s*thinking[^>]*>([\s\S]*?)<\/\s*thinking\s*>/gi, 
    '<div class="character-thinking">$1</div>'
  );
  
  // Convert <think> tags with various spacing/formatting
  processed = processed.replace(
    /<\s*think[^>]*>([\s\S]*?)<\/\s*think\s*>/gi, 
    '<div class="character-thinking">$1</div>'
  );
  
  // Convert <char think> tags with various spacing/formatting
  processed = processed.replace(
    /<\s*char\s+think[^>]*>([\s\S]*?)<\/\s*char\s+think\s*>/gi, 
    '<div class="character-thinking">$1</div>'
  );
  
  // Convert <status> tags with various spacing/formatting
  processed = processed.replace(
    /<\s*status[^>]*>([\s\S]*?)<\/\s*status\s*>/gi, 
    '<div class="character-status">$1</div>'
  );
    
  // Convert markdown bold to HTML
  processed = processed.replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>');
  
  // Convert markdown italic to HTML
  processed = processed.replace(/\*([\s\S]*?)\*/g, '<i>$1</i>');
  
  // Remove excessive logging
  // console.log("After preprocessing:", processed.substring(0, 100));
  
  return processed;
};

// Create normalized JSON structure from HTML content
const parseHtmlToJson = (html: string): any[] => {
  try {
    if (!html || html.trim() === '') {
      // console.warn("Empty HTML content passed to parseHtmlToJson");
      return [{ type: 'text', content: html || '' }];
    }
    
    // Remove excessive logging
    // console.log("parseHtmlToJson input:", html.substring(0, 100));
    
    // Process markdown and custom tags first
    let processedHtml = preprocessCustomTags(html);
    
    // Handle markdown code blocks before HTML parsing
    const { htmlWithCodeBlocks, codeBlocks } = extractMarkdownCodeBlocks(processedHtml);
    
    // Make sure HTML has a proper structure with html, head and body elements
    let sanitizedHtml = htmlWithCodeBlocks;
    
    // Check if content doesn't already have proper HTML structure
    if (!sanitizedHtml.includes('<html>') && !sanitizedHtml.includes('<body>')) {
      // Wrap with valid HTML structure
      sanitizedHtml = `<html><head></head><body>${sanitizedHtml}</body></html>`;
    }
    
    // Basic HTML sanitization to prevent XSS
    sanitizedHtml = sanitizeHtml(sanitizedHtml);
    
    // Parse the sanitized HTML to DOM
    const parser = new htmlParser.DOMParser();
    const document = parser.parseFromString(sanitizedHtml, 'text/html');
    
    // Extract the body content
    const body = document.getElementsByTagName('body')[0];
    
    if (!body) {
      console.warn('No body element found after sanitization, using fallback parsing');
      // Fallback to simpler structure if body tag is still missing
      return [{ type: 'text', content: processedHtml }];
    }
    
    try {
      const parser = new htmlParser.DOMParser();
      const document = parser.parseFromString(sanitizedHtml, 'text/html');
      
      // Extract the body content
      const body = document.getElementsByTagName('body')[0];
      
      if (!body) {
        console.warn("No body element found in parsed HTML");
        return [{ type: 'text', content: sanitizedHtml }];
      }
      
      // Convert DOM structure to our normalized JSON format
      const jsonNodes = nodeToJson(body);
      
      // Reinsert code blocks
      return reinsertCodeBlocks(jsonNodes, codeBlocks);
    } catch (parseError) {
      console.error("Error parsing HTML DOM:", parseError);
      return [{ type: 'text', content: sanitizedHtml }];
    }
  } catch (error) {
    console.error('Error in parseHtmlToJson:', error);
    return [{ type: 'text', content: html || '' }];
  }
};

// Reinsert code blocks into the parsed JSON tree
const reinsertCodeBlocks = (jsonNodes: any[], codeBlocks: Array<{id: string, language: string, code: string}>): any[] => {
  // Clone the nodes to avoid mutating the original
  const result = [...jsonNodes];
  
  // Function to recursively process nodes
  const processNodes = (nodes: any[]): any[] => {
    return nodes.map(node => {
      // If this is a tag node
      if (node.type === 'tag') {
        // Check if it's a code block placeholder
        if (node.name === 'pre' && node.attributes.class === 'code-block' && node.attributes.id) {
          const blockId = node.attributes.id;
          const codeBlock = codeBlocks.find(block => block.id === blockId);
          
          if (codeBlock) {
            return {
              type: 'code-block',
              language: codeBlock.language,
              code: codeBlock.code
            };
          }
        }
        
        // Otherwise process its children recursively
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: processNodes(node.children)
          };
        }
      }
      
      return node;
    });
  };
  
  return processNodes(result);
};

const sanitizeHtml = (html: string): string => {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/ on\w+="[^"]*"/g, '');
  sanitized = sanitized.replace(/ on\w+='[^']*'/g, '');
  
  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove svg tags
  sanitized = sanitized.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  
  // Remove audio/video tags
  sanitized = sanitized.replace(/<(audio|video)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  
  // Process custom tags: <think> or <thinking>
  sanitized = sanitized.replace(/<thinking>([\s\S]*?)<\/thinking>/gi, '<div class="character-thinking">$1</div>');
  sanitized = sanitized.replace(/<think>([\s\S]*?)<\/think>/gi, '<div class="character-thinking">$1</div>');
  
  // Process <char think> tags
  sanitized = sanitized.replace(/<char\s+think>([\s\S]*?)<\/char\s+think>/gi, '<div class="character-thinking">$1</div>');
  
  // Process <status> tags
  sanitized = sanitized.replace(/<status>([\s\S]*?)<\/status>/gi, '<div class="character-status">$1</div>');
  
  // Process new custom tags
  sanitized = sanitized.replace(/<mem>([\s\S]*?)<\/mem>/gi, '<div class="character-memory">$1</div>');
  sanitized = sanitized.replace(/<websearch>([\s\S]*?)<\/websearch>/gi, '<div class="websearch-result">$1</div>');
  
  return sanitized;
};

const nodeToJson = (node: any): any[] => {
  if (!node) return [];
  
  const result: any[] = [];
  
  // Process child nodes
  if (node.childNodes) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const childNode = node.childNodes.item(i);
      
      // Text node
      if (childNode.nodeType === 3) { // Text node
        const text = childNode.nodeValue?.trim();
        if (text) {
          result.push({ type: 'text', content: text });
        }
      } 
      // Element node
      else if (childNode.nodeType === 1) { // Element node
        const tagName = childNode.nodeName.toLowerCase();
        
        // Check if this is a supported tag
        if (SUPPORTED_TAGS.includes(tagName)) {
          const attributes: Record<string, string> = {};
          
          // Extract attributes
          if (childNode.attributes) {
            for (let j = 0; j < childNode.attributes.length; j++) {
              const attr = childNode.attributes.item(j);
              attributes[attr.name] = attr.value;
            }
          }
          
          // Get style from attributes
          const style = attributes.style || '';
          
          // Recursive call for children
          const children = nodeToJson(childNode);
          
          result.push({
            type: 'tag',
            name: tagName,
            attributes,
            style,
            children
          });
        } else {
          // Unsupported tag - process its children
          const children = nodeToJson(childNode);
          result.push(...children);
        }
      }
    }
  }
  
  return result;
};

// Component to render collapsible sections (details/summary)
const CollapsibleSection = ({ summary, children }: { summary: React.ReactNode, children: React.ReactNode }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  return (
    <View style={styles.collapsibleContainer}>
      <TouchableOpacity 
        style={styles.collapsibleHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Ionicons 
          name={isExpanded ? "chevron-down" : "chevron-forward"} 
          size={16} 
          color="#fff" 
          style={styles.collapsibleIcon}
        />
        <View style={styles.summaryContainer}>
          {summary}
        </View>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.collapsibleContent}>
          {children}
        </View>
      )}
    </View>
  );
};

// Component to render character thinking sections
const ThinkingSection = ({ children }: { children: React.ReactNode }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  return (
    <View style={styles.thinkingContainer}>
      <TouchableOpacity 
        style={styles.thinkingHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Ionicons 
          name={isExpanded ? "chevron-down" : "chevron-forward"} 
          size={16} 
          color="#aaa" 
          style={styles.thinkingIcon}
        />
        <Text style={styles.thinkingTitle}>
          思考过程
        </Text>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.thinkingContent}>
          <Text style={styles.thinkingText}>{React.isValidElement(children) ? children : String(children)}</Text>
        </View>
      )}
    </View>
  );
};

// Add component to render character memory sections
const MemorySection = ({ children }: { children: React.ReactNode }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  return (
    <View style={styles.memoryContainer}>
      <TouchableOpacity 
        style={styles.memoryHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Ionicons 
          name={isExpanded ? "chevron-down" : "chevron-forward"} 
          size={16} 
          color="#5e8ec6" 
          style={styles.memoryIcon}
        />
        <Text style={styles.memoryTitle}>
          记忆内容
        </Text>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.memoryContent}>
          <Text style={styles.memoryText}>{React.isValidElement(children) ? children : String(children)}</Text>
        </View>
      )}
    </View>
  );
};

// Add component to render websearch results
const WebsearchSection = ({ children }: { children: React.ReactNode }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  return (
    <View style={styles.websearchContainer}>
      <TouchableOpacity 
        style={styles.websearchHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Ionicons 
          name={isExpanded ? "chevron-down" : "chevron-forward"} 
          size={16} 
          color="#4caf50" 
          style={styles.websearchIcon}
        />
        <Text style={styles.websearchTitle}>
          搜索结果
        </Text>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.websearchContent}>
          <Text style={styles.websearchText}>{React.isValidElement(children) ? children : String(children)}</Text>
        </View>
      )}
    </View>
  );
};

// Component to render character status sections
const StatusSection = ({ children }: { children: React.ReactNode }) => {
  return (
    <View style={styles.statusContainer}>
      {/* Pass children directly to allow HTML/CSS rendering */}
      {children}
    </View>
  );
};

// Helper function to extract and process image IDs from markdown syntax
const processImageMarkdown = (
  text: string,
  handleImagePress: (url: string) => void,
  maxImageHeight: number
): React.ReactNode[] => {
  const components: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentIndex = 0;

  // First, handle our custom image:id format
  const imageIdRegex = /!\[(.*?)\]\(image:([^\s)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = imageIdRegex.exec(text)) !== null) {
    // Add text before the image
    if (match.index > lastIndex) {
      components.push(
        <Text key={`text-${currentIndex}`} style={styles.text}>
          {text.substring(lastIndex, match.index)}
        </Text>
      );
      currentIndex++;
    }

    const alt = match[1] || 'Image';
    const imageId = match[2];
    const imageInfo = ImageManager.getImageInfo(imageId);

    if (imageInfo) {
      components.push(
        <View key={`image-${currentIndex}`} style={styles.imageWrapper}>
          <TouchableOpacity onPress={() => handleImagePress(imageInfo.originalPath)}>
            <Image
              source={{ uri: imageInfo.thumbnailPath }}
              style={[styles.image, { height: Math.min(300, maxImageHeight) }]}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.imageCaption}>{alt}</Text>
        </View>
      );
    } else {
      components.push(
        <View key={`image-error-${currentIndex}`} style={styles.imageErrorContainer}>
          <Ionicons name="alert-circle" size={24} color="#e74c3c" />
          <Text style={styles.imageErrorText}>图片无法加载 (ID: {imageId.substring(0, 8)}...)</Text>
        </View>
      );
    }

    lastIndex = match.index + match[0].length;
    currentIndex++;
  }

  // Then handle regular image URLs
  const regularImageRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g;

  while ((match = regularImageRegex.exec(text)) !== null) {
    // Skip if this match starts before the last processed position
    if (match.index < lastIndex) continue;
    
    // Add text before the image
    if (match.index > lastIndex) {
      components.push(
        <Text key={`text-${currentIndex}`} style={styles.text}>
          {text.substring(lastIndex, match.index)}
        </Text>
      );
      currentIndex++;
    }

    const alt = match[1] || 'Image';
    const url = match[2];

    components.push(
      <View key={`image-${currentIndex}`} style={styles.imageWrapper}>
        <TouchableOpacity onPress={() => handleImagePress(url)}>
          <Image
            source={{ uri: url }}
            style={[styles.image, { height: Math.min(300, maxImageHeight) }]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.imageCaption}>{alt}</Text>
      </View>
    );

    lastIndex = match.index + match[0].length;
    currentIndex++;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    components.push(
      <Text key={`text-${currentIndex}`} style={styles.text}>
        {text.substring(lastIndex)}
      </Text>
    );
  }

  return components;
};

// Function to convert the JSON structure to React Native components
const jsonToReactNative = (
  jsonNodes: any[], 
  options: {
    baseStyle?: any,
    handleLinkPress?: (url: string) => void,
    handleImagePress?: (url: string) => void,
    maxImageHeight?: number,
    nestLevel?: number
  }
): React.ReactNode => {
  const { 
    baseStyle = {}, 
    handleLinkPress, 
    handleImagePress,
    maxImageHeight = 300,
    nestLevel = 0
  } = options;
  
  if (!jsonNodes || jsonNodes.length === 0) return null;
  
  return jsonNodes.map((node, index) => {
    // Handle text nodes
    if (node.type === 'text') {
      const content = node.content || '';
      // Check for markdown image patterns (both our custom format and standard URLs)
      if (content.includes('![') && (content.includes('](image:') || content.includes('](http'))) {
        return processImageMarkdown(content, handleImagePress || (() => {}), maxImageHeight);
      }
      
      return (
        <Text key={`text-${index}`} style={[styles.text, baseStyle]}>
          {node.content}
        </Text>
      );
    }
    
    // Handle code block nodes
    if (node.type === 'code-block') {
      return (
        <CodeBlockRenderer
          key={`code-${index}`}
          code={node.code}
          language={node.language}
          darkMode={true}
        />
      );
    }
    
    // Handle element nodes
    if (node.type === 'tag') {
      const nodeStyle = node.style ? convertCssToStyle(node.style) : {};
      const combinedStyle = { ...baseStyle, ...nodeStyle };
      
      // Process children recursively
      const children = node.children ? 
        jsonToReactNative(node.children, { 
          ...options, 
          baseStyle: combinedStyle,
          nestLevel: nestLevel + 1
        }) : null;
      
      switch (node.name) {
        case 'div':
        case 'p':
          if (node.attributes && node.attributes.class === 'character-thinking') {
            // Extract the text content from children for thinking sections
            let thinkingText = '';
            const extractText = (nodes: any[]): string => {
              if (!nodes) return '';
              return nodes.map(n => {
                if (n.type === 'text') return n.content;
                if (n.type === 'tag' && n.children) return extractText(n.children);
                return '';
              }).join(' ');
            };
            
            if (node.children) {
              thinkingText = extractText(node.children);
            }
            
            return (
              <ThinkingSection key={`thinking-${index}`}>
                {thinkingText || children}
              </ThinkingSection>
            );
          } else if (node.attributes && node.attributes.class === 'character-memory') {
            // Extract the text content from children for memory sections
            let memoryText = '';
            const extractText = (nodes: any[]): string => {
              if (!nodes) return '';
              return nodes.map(n => {
                if (n.type === 'text') return n.content;
                if (n.type === 'tag' && n.children) return extractText(n.children);
                return '';
              }).join(' ');
            };
            
            if (node.children) {
              memoryText = extractText(node.children);
            }
            
            return (
              <MemorySection key={`memory-${index}`}>
                {memoryText || children}
              </MemorySection>
            );
          } else if (node.attributes && node.attributes.class === 'websearch-result') {
            // Extract the text content from children for websearch sections
            let websearchText = '';
            const extractText = (nodes: any[]): string => {
              if (!nodes) return '';
              return nodes.map(n => {
                if (n.type === 'text') return n.content;
                if (n.type === 'tag' && n.children) return extractText(n.children);
                return '';
              }).join(' ');
            };
            
            if (node.children) {
              websearchText = extractText(node.children);
            }
            
            return (
              <WebsearchSection key={`websearch-${index}`}>
                {websearchText || children}
              </WebsearchSection>
            );
          } else if (node.attributes && node.attributes.class === 'character-status') {
            return (
              <StatusSection key={`status-${index}`}>
                {children}
              </StatusSection>
            );
          } else {
            return (
              <View key={`${node.name}-${index}`} style={[styles.paragraph, nodeStyle]}>
                {children}
              </View>
            );
          }
        
        case 'br':
          return <Text key={`br-${index}`}>{"\n"}</Text>;
        
        case 'b':
          return (
            <Text key={`b-${index}`} style={[styles.bold, nodeStyle]}>
              {children}
            </Text>
          );
        
        case 'i':
          return (
            <Text key={`i-${index}`} style={[styles.italic, nodeStyle]}>
              {children}
            </Text>
          );
        
        case 'span':
          return (
            <Text key={`span-${index}`} style={[nodeStyle]}>
              {children}
            </Text>
          );
        
        case 'ul':
          return (
            <View key={`ul-${index}`} style={[styles.list, nodeStyle]}>
              {children}
            </View>
          );
        
        case 'ol':
          return (
            <View key={`ol-${index}`} style={[styles.list, nodeStyle]}>
              {node.children ? node.children.map((child: any, childIndex: number) => {
                if (child.name === 'li') {
                  // FIX: Add proper type checking and casting for React.ReactElement
                  const renderedChild = jsonToReactNative([child], options);
                  if (renderedChild && Array.isArray(renderedChild) && renderedChild.length > 0 && React.isValidElement(renderedChild[0])) {
                    return React.cloneElement(
                      renderedChild[0] as React.ReactElement,
                      { key: `ol-li-${childIndex}`, index: childIndex + 1 }
                    );
                  }
                  return null;
                }
                return jsonToReactNative([child], options);
              }) : null}
            </View>
          );
        
        case 'li':
          const isOrderedList = node.attributes && node.attributes.index !== undefined;
          const bulletOrNumber = isOrderedList ? 
            `${node.attributes.index}. ` : // Numbered list
            '• '; // Bullet list
          
          return (
            <View key={`li-${index}`} style={[styles.listItem, nodeStyle]}>
              <Text style={styles.listItemBullet}>{bulletOrNumber}</Text>
              <View style={styles.listItemContent}>
                {children}
              </View>
            </View>
          );
        
        case 'img':
          const source = node.attributes && node.attributes.src ? { uri: node.attributes.src } : null;
          const alt = node.attributes && node.attributes.alt ? node.attributes.alt : 'Image';
          
          if (!source) {
            return (
              <View key={`img-placeholder-${index}`} style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={24} color="#999" />
                <Text style={styles.imagePlaceholderText}>Image not available</Text>
              </View>
            );
          }
          
          const imageHeight = node.attributes && node.attributes.height ? 
            parseInt(node.attributes.height) : Math.min(200, maxImageHeight);
          
          return (
            <TouchableOpacity
              key={`img-${index}`}
              onPress={() => handleImagePress && handleImagePress(node.attributes.src)}
              activeOpacity={0.8}
            >
              <Image
                source={source}
                style={[
                  styles.image,
                  { height: imageHeight },
                  nodeStyle
                ]}
                resizeMode="contain"
              />
              {alt && alt !== 'Image' && (
                <Text style={styles.imageCaption}>{alt}</Text>
              )}
            </TouchableOpacity>
          );
        
        case 'a':
          const url = node.attributes && node.attributes.href ? node.attributes.href : '#';
          
          return (
            <TouchableOpacity
              key={`a-${index}`}
              onPress={() => handleLinkPress && handleLinkPress(url)}
              activeOpacity={0.6}
            >
              <Text style={[styles.link, nodeStyle]}>
                {children}
              </Text>
            </TouchableOpacity>
          );
          
        case 'details':
          // Find summary node
          const summaryNode = node.children?.find((child: any) => child.name === 'summary');
          // FIX: Add proper type checking for summary content
          let summaryContent: React.ReactNode = <Text style={styles.summaryText}>Details</Text>;
          
          if (summaryNode) {
            const renderedSummary = jsonToReactNative([summaryNode], options);
            if (renderedSummary && Array.isArray(renderedSummary) && renderedSummary.length > 0) {
              summaryContent = renderedSummary;
            }
          }
          
          // Filter out summary from details content
          // FIX: Ensure proper typing and null checking for details content
          const filteredChildren = node.children
            ?.filter((child: any) => child.name !== 'summary') || [];
            
          const detailsContent = filteredChildren.map((child: any, i: number) => {
            const renderedChild = jsonToReactNative([child], options);
            if (renderedChild && Array.isArray(renderedChild) && renderedChild.length > 0) {
              return renderedChild;
            }
            return null;
          });
          
          return (
            <CollapsibleSection
              key={`details-${index}`}
              summary={summaryContent}
            >
              {detailsContent}
            </CollapsibleSection>
          );
          
        case 'summary':
          return (
            <Text key={`summary-${index}`} style={[styles.summaryText, nodeStyle]}>
              {children}
            </Text>
          );
          
        // Add cases for additional HTML5 tags
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          const headerStyleMap = {
            h1: { fontSize: 24, fontWeight: 'bold', marginVertical: 10 },
            h2: { fontSize: 22, fontWeight: 'bold', marginVertical: 8 },
            h3: { fontSize: 20, fontWeight: 'bold', marginVertical: 6 },
            h4: { fontSize: 18, fontWeight: 'bold', marginVertical: 5 },
            h5: { fontSize: 16, fontWeight: 'bold', marginVertical: 4 },
            h6: { fontSize: 14, fontWeight: 'bold', marginVertical: 3 }
          };
          
          return (
            <Text 
              key={`heading-${index}`} 
              style={[
                styles.heading, 
                headerStyleMap[node.name as keyof typeof headerStyleMap],
                nodeStyle
              ]}
            >
              {children}
            </Text>
          );
          
        case 'blockquote':
          return (
            <View key={`blockquote-${index}`} style={[styles.blockquote, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'code':
          return (
            <Text key={`code-${index}`} style={[styles.code, nodeStyle]}>
              {children}
            </Text>
          );
          
        case 'pre':
          return (
            <View key={`pre-${index}`} style={[styles.pre, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'table':
          return (
            <View key={`table-${index}`} style={[styles.table, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'thead':
          return (
            <View key={`thead-${index}`} style={[styles.thead, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'tbody':
          return (
            <View key={`tbody-${index}`} style={[styles.tbody, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'tr':
          return (
            <View key={`tr-${index}`} style={[styles.tr, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'th':
          return (
            <View key={`th-${index}`} style={[styles.th, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'td':
          return (
            <View key={`td-${index}`} style={[styles.td, nodeStyle]}>
              {children}
            </View>
          );
          
        case 'hr':
          return <View key={`hr-${index}`} style={[styles.hr, nodeStyle]} />;
          
        default:
          // Handle other tags as generic containers
          return (
            <View key={`generic-${node.name}-${index}`} style={nodeStyle}>
              {children}
            </View>
          );
      }
    }
    
    return null;
  });
};

// Main function to parse HTML and convert to React Native components
export const parseHtmlToReactNative = (
  html: string, 
  options: {
    baseStyle?: any,
    handleLinkPress?: (url: string) => void,
    handleImagePress?: (url: string) => void,
    handleImageError?: (url: string) => void,
    imageLoadErrors?: Record<string, boolean>,
    maxImageHeight?: number
  } = {}
): React.ReactNode => {
  const {
    baseStyle = {},
    handleLinkPress,
    handleImagePress,
    handleImageError,
    imageLoadErrors = {},
    maxImageHeight = 300,
  } = options;

  // Very basic implementation to handle image tags
  // In a real implementation, you'd want to use a proper HTML parser
  
  // Handle image tags specifically
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  const components: React.ReactNode[] = [];
  
  let lastIndex = 0;
  let match;
  
  // Reset lastIndex to start from the beginning
  imgRegex.lastIndex = 0;
  
  while ((match = imgRegex.exec(html)) !== null) {
    // Add text before the image
    if (match.index > lastIndex) {
      const textSegment = html.substring(lastIndex, match.index);
      if (textSegment.trim()) {
        components.push(
          <Text key={`text-${lastIndex}`} style={baseStyle}>
            {textSegment}
          </Text>
        );
      }
    }
    
    // Extract image URL
    const imageUrl = match[1];
    
    // Special handling for image:id format
    const isImageId = imageUrl.startsWith('image:');
    
    // Add error handling for image loading
    if (imageLoadErrors[imageUrl]) {
      // Show error state for failed images
      components.push(
        <View key={`img-error-${match.index}`} style={styles.imageError}>
          <Ionicons name="alert-circle" size={24} color="#e74c3c" />
          <Text style={styles.imageErrorText}>图片加载失败</Text>
        </View>
      );
    } else {
      // Extract alt text if available
      const altMatch = match[0].match(/alt="([^"]+)"/);
      const altText = altMatch ? altMatch[1] : '图片';
      
      // Wrap image in TouchableOpacity if handleImagePress is provided
      const imageComponent = (
        <View key={`img-${match.index}`} style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { maxHeight: maxImageHeight }]}
            resizeMode="contain"
            onError={() => handleImageError && handleImageError(imageUrl)}
          />
          {altText && <Text style={styles.imageCaption}>{altText}</Text>}
        </View>
      );
      
      if (handleImagePress) {
        components.push(
          <TouchableOpacity 
            key={`img-touch-${match.index}`}
            onPress={() => handleImagePress(imageUrl)}
          >
            {imageComponent}
          </TouchableOpacity>
        );
      } else {
        components.push(imageComponent);
      }
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last image
  if (lastIndex < html.length) {
    const remainingText = html.substring(lastIndex);
    if (remainingText.trim()) {
      components.push(
        <Text key={`text-${lastIndex}`} style={baseStyle}>
          {remainingText}
        </Text>
      );
    }
  }
  
  // If no images found, just return the text
  if (components.length === 0) {
    return <Text style={baseStyle}>{html}</Text>;
  }
  
  return <>{components}</>;
};

// Check if HTML content contains complex structures that need rich rendering
export const containsComplexHtml = (text: string): boolean => {
  if (!text) return false;
  
  const complexPatterns = [
    /<(div|p|ul|ol|li|img|a|details|summary)\b/i,
    /<(b|i|span)\b[^>]*style=/i,
    /<br\s*\/?>/i,
    /<(thinking|think|status)\b/i,
    /<char\s+think>/i,
    /```[\w]*\n[\s\S]*?```/,  // Markdown code blocks
    /\*\*[\s\S]*?\*\*/,        // Bold markdown
    /\*[\s\S]*?\*/,            // Italic markdown
    /!\[[\s\S]*?\]\([\s\S]*?\)/,  // Markdown images
  ];
  
  return complexPatterns.some(pattern => pattern.test(text));
};

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    color: '#fff',
  },
  paragraph: {
    marginBottom: 10,
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  list: {
    marginVertical: 8,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  listItemBullet: {
    marginRight: 8,
    fontSize: 16,
    color: '#fff',
  },
  listItemContent: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  imageCaption: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  link: {
    color: '#3498db',
    textDecorationLine: 'underline',
  },
  collapsibleContainer: {
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  collapsibleIcon: {
    marginRight: 8,
  },
  summaryContainer: {
    flex: 1,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  collapsibleContent: {
    padding: 12,
  },
  // Add styles for additional HTML5 tags
  heading: {
    color: '#fff',
    marginBottom: 10,
  },
  blockquote: {
    paddingLeft: 10,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: 4,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    color: '#f8f8f8',
  },
  pre: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 6,
    marginVertical: 10,
    overflow: 'scroll',
  },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 10,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  thead: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tbody: {},
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
  },
  th: {
    flex: 1,
    padding: 8,
    fontWeight: 'bold',
  },
  td: {
    flex: 1,
    padding: 8,
  },
  hr: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 10,
    width: '100%',
  },
  thinkingContainer: {
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  thinkingHeader: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  thinkingIcon: {
    marginRight: 8,
  },
  thinkingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#aaa',
  },
  thinkingContent: {
    padding: 12,
  },
  // Add this new style for thinking text
  thinkingText: {
    fontStyle: 'italic',
    color: '#bbb',
    fontSize: 15,
    lineHeight: 22,
  },
  statusContainer: {
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
  },
  errorContainer: {
    padding: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 4,
    marginVertical: 4,
  },
  // Add new styles for memory and websearch sections
  memoryContainer: {
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(73, 125, 189, 0.15)', // Blue-tinted background for memory
    overflow: 'hidden',
  },
  memoryHeader: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(73, 125, 189, 0.25)', // Slightly darker blue header
  },
  memoryIcon: {
    marginRight: 8,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5e8ec6', // Blue text for memory
  },
  memoryContent: {
    padding: 12,
  },
  memoryText: {
    fontStyle: 'italic',
    color: '#7fa6d6', // Lighter blue for memory text
    fontSize: 15,
    lineHeight: 22,
  },
  
  websearchContainer: {
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)', // Green-tinted background for websearch
    overflow: 'hidden',
  },
  websearchHeader: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)', // Slightly darker green header
  },
  websearchIcon: {
    marginRight: 8,
  },
  websearchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4caf50', // Green text for websearch
  },
  websearchContent: {
    padding: 12,
  },
  websearchText: {
    color: '#86c288', // Lighter green for websearch text
    fontSize: 15,
    lineHeight: 22,
  },
  
  imageWrapper: {
    marginVertical: 8,
    alignItems: 'center',
  },
  imageErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  imageErrorText: {
    marginLeft: 8,
    color: '#e74c3c',
    fontSize: 14,
  },
  imageContainer: {
    width: '100%',
    marginVertical: 8,
  },
  imageError: {
    width: '100%',
    height: 100,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
