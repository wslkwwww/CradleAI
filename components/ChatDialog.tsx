import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  TextInput,
  StatusBar,
  KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview'; // Add WebView import
import * as Clipboard from 'expo-clipboard'; // 添加 Clipboard 导入
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import { Message, ChatDialogProps, User } from '@/shared/types';
import { Ionicons, MaterialIcons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { parseHtmlText, containsComplexHtml, optimizeHtmlForRendering } from '@/utils/textParser';
import { Audio } from 'expo-av'; // 新增
import RichTextRenderer from '@/components/RichTextRenderer';
import ImageManager from '@/utils/ImageManager';
import {
  synthesizeWithCosyVoice,
  synthesizeWithDoubao,
  synthesizeWithMinimax,
  UnifiedTTSRequest,
  UnifiedTTSResponse,
} from '@/services/unified-tts';
import { useDialogMode } from '@/constants/DialogModeContext';
import { DeviceEventEmitter } from 'react-native';
import Markdown from 'react-native-markdown-display';
import TextEditorModal from './common/TextEditorModal';
import Slider from '@react-native-community/slider';
import type { RenderFunction, ASTNode } from 'react-native-markdown-display';
import { useRouter } from 'expo-router';
import { Character } from '@/shared/types';
import * as FileSystem from 'expo-file-system';
import { ChatUISettings } from '@/app/pages/chat-ui-settings';
import AudioCacheManager from '@/utils/AudioCacheManager';

// Default UI settings in case the file isn't loaded
const DEFAULT_UI_SETTINGS: ChatUISettings = {
  // Regular mode
  regularUserBubbleColor: 'rgb(255, 224, 195)',
  regularUserBubbleAlpha: 0.95,
  regularBotBubbleColor: 'rgb(68, 68, 68)',
  regularBotBubbleAlpha: 0.85,
  regularUserTextColor: '#333333',
  regularBotTextColor: '#ffffff',
  
  // Background focus mode
  bgUserBubbleColor: 'rgb(255, 224, 195)',
  bgUserBubbleAlpha: 0.95,
  bgBotBubbleColor: 'rgb(68, 68, 68)',
  bgBotBubbleAlpha: 0.9,
  bgUserTextColor: '#333333',
  bgBotTextColor: '#ffffff',
  
  // Visual novel mode
  vnDialogColor: 'rgb(0, 0, 0)',
  vnDialogAlpha: 0.7,
  vnTextColor: '#ffffff',
  
  // Global sizes
  bubblePaddingMultiplier: 1.0,
  textSizeMultiplier: 1.0,
  
  // Markdown styles - matching current ChatDialog defaults
  markdownHeadingColor: '#ff79c6',
  markdownCodeBackgroundColor: '#111',
  markdownCodeTextColor: '#fff',
  markdownQuoteColor: '#d0d0d0',
  markdownQuoteBackgroundColor: '#111',
  markdownLinkColor: '#3498db',
  markdownBoldColor: '#ff79c6',
  markdownTextColor: '#fff', // 新增
  markdownTextScale: 1.0,
  markdownCodeScale: 1.0
};

// Hook to load UI settings
function useChatUISettings() {
  const [settings, setSettings] = useState<ChatUISettings>(DEFAULT_UI_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fileHash, setFileHash] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const settingsFile = `${FileSystem.documentDirectory}chat_ui_settings.json`;

    async function loadSettingsAndHash() {
      try {
        const fileInfo = await FileSystem.getInfoAsync(settingsFile);
        if (fileInfo.exists) {
          const fileContent = await FileSystem.readAsStringAsync(settingsFile);
          const loadedSettings = JSON.parse(fileContent);
          // 计算简单hash
          const hash = String(fileContent.length) + '_' + String(fileContent.split('').reduce((a, b) => a + b.charCodeAt(0), 0));
          if (isMounted) {
            setSettings(loadedSettings);
            setFileHash(hash);
          }
        } else {
          if (isMounted) {
            setSettings(DEFAULT_UI_SETTINGS);
            setFileHash(null);
          }
        }
      } catch (error) {
        if (isMounted) setSettings(DEFAULT_UI_SETTINGS);
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }

    loadSettingsAndHash();

    // 定时检测文件内容变化
    interval = setInterval(async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(settingsFile);
        if (fileInfo.exists) {
          const fileContent = await FileSystem.readAsStringAsync(settingsFile);
          const hash = String(fileContent.length) + '_' + String(fileContent.split('').reduce((a, b) => a + b.charCodeAt(0), 0));
          if (hash !== fileHash) {
            setSettings(JSON.parse(fileContent));
            setFileHash(hash);
          }
        }
      } catch {}
    }, 1000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { settings, isLoaded };
}

// Add new interface for generated image
interface GeneratedImage {
  id: string;
  prompt: string;
  timestamp: number;
}

interface ExtendedChatDialogProps extends ChatDialogProps {
  messageMemoryState?: Record<string, string>;
  regeneratingMessageId?: string | null;
  user?: User | null;
  isHistoryModalVisible?: boolean;
  setHistoryModalVisible?: (visible: boolean) => void;
  onShowFullHistory?: () => void;
  onEditAiMessage?: (messageId: string, aiIndex: number, newContent: string) => void;
  onDeleteAiMessage?: (messageId: string, aiIndex: number) => void;
  onEditUserMessage?: (messageId: string, messageIndex: number, newContent: string) => void;
  onDeleteUserMessage?: (messageId: string, messageIndex: number) => void;
  onRegenerateMessage?: (messageId: string, messageIndex: number) => void;
  showMemoryButton?: boolean;
  isMemoryPanelVisible?: boolean;
  onToggleMemoryPanel?: () => void;
  onLoadMore?: () => void; // 新增
  loadingMore?: boolean;   // 新增
  hasMore?: boolean;       // 新增
  generatedImages?: GeneratedImage[]; // 新增：生成的图片列表
  onDeleteGeneratedImage?: (imageId: string) => void; // 新增：删除生成图片的回调
}

const { width, height } = Dimensions.get('window');
const MAX_WIDTH = Math.min(width * 0.88, 500);
const MIN_PADDING = 8;
const RESPONSIVE_PADDING = Math.max(MIN_PADDING, width * 0.02);
const MAX_IMAGE_HEIGHT = Math.min(300, height * 0.4);
const DEFAULT_IMAGE_WIDTH = Math.min(240, width * 0.6);
const DEFAULT_IMAGE_HEIGHT = Math.min(360, height * 0.5);
const AVATAR_SIZE = Math.max(Math.min(width * 0.075, 30), 24);
const BUTTON_SIZE = width < 360 ? 28 : 32;
const BUTTON_ICON_SIZE = width < 360 ? 16 : 18;
const BUTTON_MARGIN = width < 360 ? 3 : 6;

const getImageDisplayStyle = (imageInfo?: any) => {
  let width = DEFAULT_IMAGE_WIDTH;
  let height = DEFAULT_IMAGE_HEIGHT;
  if (imageInfo && imageInfo.originalPath) {
    if (imageInfo.width && imageInfo.height) {
      const maxW = 260;
      const maxH = MAX_IMAGE_HEIGHT;
      const ratio = imageInfo.width / imageInfo.height;
      if (ratio > 1) {
        width = maxW;
        height = Math.round(maxW / ratio);
      } else {
        height = maxH;
        width = Math.round(maxH * ratio);
      }
    } else {
      width = 208;
      height = 304;
    }
  }
  return {
    width,
    height,
    maxWidth: Math.min(320, width * 0.8),
    maxHeight: MAX_IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 42, 42, 0.5)',
    alignSelf: 'center' as const,
  };
};

// 已知标签白名单
const KNOWN_TAGS = [
  'img', 'thinking', 'think', 'mem', 'status', 'StatusBlock', 'statusblock',
  'summary', 'details',
  'p', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 'br', 'hr', 'ul', 'ol', 'li',
  'table', 'tr', 'td', 'th', 'thead', 'tbody', 'blockquote',
  'pre', 'code', 'mark', 'figure', 'figcaption', 'video', 'audio',
  'source', 'section', 'article', 'aside', 'nav', 'header', 'footer'
  ,'style', 'script', 'html', 'body', 'head', 'meta', 'link', 'title','doctype' 
];

// 移除未知标签，仅保留内容
function stripUnknownTags(html: string): string {
  if (!html) return '';
  // 匹配所有成对标签（支持下划线、数字、-）
  let result = html.replace(/<([a-zA-Z0-9_\-]+)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
    // 保证大小写不敏感
    if (KNOWN_TAGS.map(t => t.toLowerCase()).includes(tag.toLowerCase())) {
      // 已知标签，保留
      return match;
    }
    // 未知标签，递归处理内容
    return stripUnknownTags(content);
  });
  // 匹配所有单个未知标签（自闭合或未闭合）
  result = result.replace(/<([a-zA-Z0-9_\-]+)(\s[^>]*)?>/g, (match, tag) => {
    if (KNOWN_TAGS.map(t => t.toLowerCase()).includes(tag.toLowerCase())) {
      return match;
    }
    // 未知单标签，移除
    return '';
  });
  return result;
}

// 新增：检测是否包含结构性标签但不是完整HTML页面
const STRUCTURAL_TAGS = [
  'source', 'section', 'article', 'aside', 'nav', 'header', 'footer',
  'style', 'script', 'html', 'body', 'head', 'meta', 'link', 'title', 'doctype'
];

// 检查文本是否包含结构性标签
function containsStructuralTags(text: string): boolean {
  return STRUCTURAL_TAGS.some(tag => {
    // 检查开头或结尾有这些标签，或中间有这些标签
    const regex = new RegExp(`<${tag}[\\s>]|</${tag}>|<!DOCTYPE`, 'i');
    return regex.test(text);
  });
}

// 检查是否为完整HTML页面
function isFullHtmlPage(text: string): boolean {
  return /^\s*(<!DOCTYPE html|<html)/i.test(text);
}

// 自动补全为完整HTML结构
function autoWrapHtmlIfNeeded(text: string): string {
  if (isFullHtmlPage(text)) return text;
  if (containsStructuralTags(text)) {
    // 包裹为完整HTML页面
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>内容预览</title>
  <style>
    body { background: #222; color: #f8f8f2; font-family: 'Helvetica', 'Arial', sans-serif; margin: 0; padding: 1em; }
    img, video { max-width: 100%; border-radius: 5px; }
    pre, code { background: #111; color: #fff; border-radius: 4px; padding: 0.2em 0.4em; }
  </style>
</head>
<body>
${text}
</body>
</html>`;
  }
  return text;
}

// 修改 isWebViewContent 检查，增强判断，检查三重反引号中的HTML内容或结构性标签
const isWebViewContent = (text: string): boolean => {
  // 检查直接以 <!DOCTYPE html> 或 <html 开头的内容
  if (isFullHtmlPage(text)) {
    return true;
  }
  // 检查是否有包含在三重反引号中的HTML内容
  const codeBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && isFullHtmlPage(codeBlockMatch[1])) {
    return true;
  }
  // 检查是否包含结构性标签
  if (containsStructuralTags(text)) {
    return true;
  }
  if (codeBlockMatch && containsStructuralTags(codeBlockMatch[1])) {
    return true;
  }
  return false;
};

// 新增：提取被三重反引号包裹的HTML内容
function extractHtmlFromCodeBlock(text: string): string {
  if (!text) return '';
  
  // 检查是否有三重反引号包裹的HTML内容
  const codeBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    // 检查提取的内容是否为HTML页面
    if (isFullHtmlPage(content) || containsStructuralTags(content)) {
      return content;
    }
  }
  
  // 如果没有找到三重反引号包裹的HTML，返回原始文本
  return text;
}

// 修改 enhanceHtmlWithMarkdown，支持混合 html、markdown、css 的完整渲染
const enhanceHtmlWithMarkdown = (raw: string): string => {
  // 1. 提取三重反引号包裹的代码块
  const codeBlockRegex = /```([a-zA-Z]*)\s*([\s\S]*?)```/g;
  let htmlBlocks: string[] = [];
  let markdownBlocks: string[] = [];
  let cssBlocks: string[] = [];
  let otherBlocks: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // 2. 遍历所有代码块，分类
  while ((match = codeBlockRegex.exec(raw)) !== null) {
    const [full, lang, content] = match;
    if (lang.trim().toLowerCase() === 'html') {
      htmlBlocks.push(content);
    } else if (lang.trim().toLowerCase() === 'css') {
      cssBlocks.push(content);
    } else if (lang.trim().toLowerCase() === 'markdown' || lang.trim() === '') {
      markdownBlocks.push(content);
    } else {
      otherBlocks.push(content);
    }
    lastIndex = codeBlockRegex.lastIndex;
  }

  // 3. 提取三重反引号之外的内容（如纯文本/markdown/HTML）
  let rest = raw.replace(codeBlockRegex, '').trim();

  // 4. 合成最终 HTML
  let htmlContent = '';
  // 优先完整 html 页面
  if (htmlBlocks.length > 0) {
    htmlContent = htmlBlocks.join('\n');
  } else if (/^\s*(<!DOCTYPE html|<html)/i.test(rest)) {
    htmlContent = rest;
    rest = '';
  }

  // 合并 markdown 内容
  let markdownContent = '';
  if (markdownBlocks.length > 0) {
    markdownContent = markdownBlocks.join('\n\n');
  }
  // rest 里如果还有 markdown，也合并
  if (rest) {
    markdownContent += '\n' + rest;
  }

  // 合并 css 内容
  let cssContent = '';
  if (cssBlocks.length > 0) {
    cssContent = cssBlocks.join('\n');
  }

  // 5. 构造最终 HTML 页面
  // 如果有完整 html 页面，插入 markdown 渲染和 css
  if (htmlContent) {
    // 注入 style
    let htmlWithCss = htmlContent.replace(
      /<\/head>/i,
      `<style>
        .markdown-content { color: #fff !important; } /* 强制白色字体 */
        ${cssContent}
      </style>
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      </head>`
    );
    // 注入 markdown 渲染容器
    if (markdownContent.trim()) {
      htmlWithCss = htmlWithCss.replace(
        /<\/body>/i,
        `<div id="markdown-content" class="markdown-content"></div>
        <script>
          document.getElementById('markdown-content').innerHTML = marked.parse(\`${markdownContent.replace(/`/g, '\\`')}\`);
        </script>
        </body>`
      );
    }
    return htmlWithCss;
  }

  // 否则，自动包裹为完整 html 页面
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>内容预览</title>
  <style>
    body { background: #222; color: #f8f8f2; font-family: 'Helvetica', 'Arial', sans-serif; margin: 0; padding: 1em; }
    img, video { max-width: 100%; border-radius: 5px; }
    pre, code { background: #111; color: #fff; border-radius: 4px; padding: 0.2em 0.4em; }
    .markdown-content { color: #fff !important; line-height: 1.6; margin: 1em 0; padding: 1em; background-color: rgba(40, 42, 54, 0.8); border-radius: 8px; font-family: 'Helvetica', 'Arial', sans-serif; }
    .markdown-content h1, .markdown-content h2, .markdown-content h3 { color: #ff79c6; }
    .markdown-content code { background: rgba(20, 22, 34, 0.8); padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
    .markdown-content pre { background: rgba(20, 22, 34, 0.8); padding: 1em; border-radius: 5px; overflow-x: auto; }
    .markdown-content blockquote { border-left: 4px solid #ff79c6; padding-left: 1em; color: #d0d0d0; }
    .markdown-content img { max-width: 100%; border-radius: 5px; }
    ${cssContent}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <div id="markdown-content" class="markdown-content"></div>
  <script>
    document.getElementById('markdown-content').innerHTML = marked.parse(\`${markdownContent.replace(/`/g, '\\`')}\`);
  </script>
</body>
</html>`;
};

const ChatHistoryModal = memo(function ChatHistoryModal({
  visible,
  messages,
  onClose,
  selectedCharacter,
  user,
}: {
  visible: boolean;
  messages: Message[];
  onClose: () => void;
  selectedCharacter?: Character | null;
  user?: User | null;
}) {
  const flatListRef = useRef<FlatList<Message>>(null);

  // 只在打开时自动滚动到底部
  useEffect(() => {
    if (visible && flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: false });
        } catch {}
      }, 100);
    }
  }, [visible, messages.length]);

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isUser = item.sender === 'user';
      const showTime =
        index === 0 ||
        (index > 0 &&
          new Date(item.timestamp || 0).getMinutes() !==
            new Date(messages[index - 1]?.timestamp || 0).getMinutes());
      return (
        <View key={item.id} style={styles.historyMessageContainer}>
          {showTime && item.timestamp && (
            <Text style={styles.historyTimeText}>
              {new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          )}
          <View
            style={[
              styles.historyMessage,
              isUser ? styles.historyUserMessage : styles.historyBotMessage,
            ]}
          >
            <Text
              style={[
                styles.historyMessageText,
                isUser
                  ? styles.historyUserMessageText
                  : styles.historyBotMessageText,
              ]}
            >
              {item.text}
            </Text>
          </View>
        </View>
      );
    },
    [messages]
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.historyModalContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.historyModalContent}
          contentContainerStyle={{ paddingBottom: 40 }}
          initialNumToRender={30}
          maxToRenderPerBatch={20}
          windowSize={21}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 30,
            right: 24,
            zIndex: 100,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 18,
            padding: 8,
          }}
          onPress={onClose}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

// Add ImageMessage component to render generated images
const ImageMessage = memo(function ImageMessage({
  imageId,
  prompt,
  timestamp,
  onOpenFullscreen,
  onSave,
  onShare,
  onDelete, // 新增：删除图片回调
}: {
  imageId: string;
  prompt: string;
  timestamp: number;
  onOpenFullscreen: (imageId: string) => void;
  onSave: (imageId: string) => void;
  onShare: (imageId: string) => void;
  onDelete: (imageId: string) => void; // 新增：删除图片回调
}) {
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // 新增：删除确认状态
  const [isPromptExpanded, setIsPromptExpanded] = useState(false); // Default collapsed

  useEffect(() => {
    const loadImageInfo = async () => {
      try {
        setIsLoading(true);
        // Use the static method directly
        const info = await ImageManager.getImageInfo(imageId);
        if (info) {
          setImagePath(info.originalPath);
        }
      } catch (error) {
        console.error('[ImageMessage] Error loading image info:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadImageInfo();
  }, [imageId]);

  const formattedTime = useMemo(() => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [timestamp]);

  // 新增：处理删除确认
  const handleDeletePress = () => {
    setShowDeleteConfirm(true);
  };

  // 新增：取消删除
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // 新增：确认删除
  const handleConfirmDelete = () => {
    onDelete(imageId);
    setShowDeleteConfirm(false);
  };

  if (isLoading) {
    return (
      <View style={styles.imageMessageContainer}>
        <View style={styles.imageMessageLoading}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.imageMessageLoadingText}>加载图片中...</Text>
        </View>
      </View>
    );
  }

  if (!imagePath) {
    return (
      <View style={styles.imageMessageContainer}>
        <View style={styles.imageMessageError}>
          <Ionicons name="alert-circle-outline" size={32} color="#e74c3c" />
          <Text style={styles.imageMessageErrorText}>无法加载图片</Text>
          {/* 新增：删除按钮 */}
          <TouchableOpacity
            style={[
              styles.imageMessageAction,
              { marginTop: 12, alignSelf: 'center' }
            ]}
            onPress={handleDeletePress}
          >
            <Ionicons name="trash-outline" size={22} color="#e74c3c" />
            <Text style={{ color: '#e74c3c', marginLeft: 6, fontSize: 15 }}>删除</Text>
          </TouchableOpacity>
        </View>
        {/* 删除确认弹窗 */}
        <Modal
          visible={showDeleteConfirm}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.deleteConfirmModalContainer}>
            <View style={styles.deleteConfirmModalContent}>
              <Text style={styles.deleteConfirmTitle}>删除图片</Text>
              <Text style={styles.deleteConfirmText}>确定要删除这张图片吗？</Text>
              <View style={styles.deleteConfirmButtons}>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, styles.deleteConfirmCancelButton]}
                  onPress={handleCancelDelete}
                >
                  <Text style={styles.deleteConfirmButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, styles.deleteConfirmDeleteButton]}
                  onPress={handleConfirmDelete}
                >
                  <Text style={[styles.deleteConfirmButtonText, { color: '#fff' }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.imageMessageContainer}>
      <TouchableOpacity 
        style={[
          styles.imageMessageHeader,
          isPromptExpanded ? styles.imageMessageHeaderExpanded : styles.imageMessageHeaderCollapsed
        ]}
        onPress={() => setIsPromptExpanded(!isPromptExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.imageMessagePromptContainer}>
          {isPromptExpanded ? (
            <Text style={styles.imageMessagePrompt} numberOfLines={3}>{prompt}</Text>
          ) : (
            <Text style={styles.imageMessagePromptCollapsed} numberOfLines={1}>
              {prompt.length > 20 ? prompt.substring(0, 20) + '...' : prompt}
            </Text>
          )}
          <View style={styles.imageMessageHeaderRight}>
            <Text style={styles.imageMessageTime}>{formattedTime}</Text>
            <Ionicons 
              name={isPromptExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#aaa" 
              style={{marginLeft: 8}}
            />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[
          styles.imageMessageContent,
          isPromptExpanded ? styles.imageMessageContentSmaller : styles.imageMessageContentLarger
        ]}
        onPress={() => onOpenFullscreen(imageId)}
        activeOpacity={0.9}
      >
        <Image 
          source={{ uri: imagePath }} 
          style={styles.imageMessageImage}
          resizeMode="contain"
        />
      </TouchableOpacity>
      <View style={styles.imageMessageActions}>
        <TouchableOpacity 
          style={styles.imageMessageAction}
          onPress={() => onOpenFullscreen(imageId)}
        >
          <Ionicons name="expand-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.imageMessageAction}
          onPress={() => onSave(imageId)}
        >
          <Ionicons name="download-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.imageMessageAction}
          onPress={() => onShare(imageId)}
        >
          <Ionicons name="share-social-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.imageMessageAction, { marginLeft: 8 }]}
          onPress={handleDeletePress}
        >
          <Ionicons name="trash-outline" size={22} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      {/* 删除确认弹窗 */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.deleteConfirmModalContainer}>
          <View style={styles.deleteConfirmModalContent}>
            <Text style={styles.deleteConfirmTitle}>删除图片</Text>
            <Text style={styles.deleteConfirmText}>确定要删除这张图片吗？</Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, styles.deleteConfirmCancelButton]}
                onPress={handleCancelDelete}
              >
                <Text style={styles.deleteConfirmButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, styles.deleteConfirmDeleteButton]}
                onPress={handleConfirmDelete}
              >
                <Text style={[styles.deleteConfirmButtonText, { color: '#fff' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

// Add new VisualNovelImageDisplay component after the ImageMessage component
const VisualNovelImageDisplay = memo(function VisualNovelImageDisplay({
  images,
  onOpenFullscreen,
  onSave,
  onShare,
  onDelete,
}: {
  images: GeneratedImage[];
  onOpenFullscreen: (imageId: string) => void;
  onSave: (imageId: string) => void;
  onShare: (imageId: string) => void;
  onDelete: (imageId: string) => void;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false); // Default collapsed

  // Load the current image
  useEffect(() => {
    const loadImage = async () => {
      if (!images.length) return;
      
      try {
        setIsLoading(true);
        const currentImage = images[currentImageIndex];
        const info = await ImageManager.getImageInfo(currentImage.id);
        
        if (info) {
          setImagePath(info.originalPath);
        } else {
          setImagePath(null);
        }
      } catch (error) {
        console.error('[VisualNovelImageDisplay] Error loading image:', error);
        setImagePath(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadImage();
  }, [images, currentImageIndex]);

  // If no images, don't render anything
  if (!images.length) return null;

  const currentImage = images[currentImageIndex];
  const formattedTime = new Date(currentImage.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <View style={styles.vnImageDisplayContainer}>
      {/* Collapsible prompt area */}
      <TouchableOpacity 
        style={[
          styles.vnImageDisplayHeader, 
          isPromptExpanded ? styles.vnImageDisplayHeaderExpanded : styles.vnImageDisplayHeaderCollapsed
        ]}
        onPress={() => setIsPromptExpanded(!isPromptExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.vnImageDisplayPromptContainer}>
          {isPromptExpanded ? (
            <Text style={styles.vnImageDisplayPrompt} numberOfLines={3}>
              {currentImage.prompt}
            </Text>
          ) : (
            <Text style={styles.vnImageDisplayPromptCollapsed} numberOfLines={1}>
              {currentImage.prompt.length > 20 ? 
                currentImage.prompt.substring(0, 20) + '...' : 
                currentImage.prompt}
            </Text>
          )}
          <View style={styles.vnImageDisplayHeaderRight}>
            <Text style={styles.vnImageDisplayTime}>{formattedTime}</Text>
            <Ionicons 
              name={isPromptExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#aaa" 
              style={{marginLeft: 8}}
            />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[
          styles.vnImageDisplayContent,
          isPromptExpanded ? styles.vnImageDisplayContentSmaller : styles.vnImageDisplayContentLarger
        ]}
        onPress={() => onOpenFullscreen(currentImage.id)}
        activeOpacity={0.9}
      >
        {isLoading ? (
          <View style={styles.vnImageDisplayLoading}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.vnImageDisplayLoadingText}>加载图片中...</Text>
          </View>
        ) : !imagePath ? (
          <View style={styles.vnImageDisplayError}>
            <Ionicons name="alert-circle-outline" size={32} color="#e74c3c" />
            <Text style={styles.vnImageDisplayErrorText}>无法加载图片</Text>
          </View>
        ) : (
          <Image 
            source={{ uri: imagePath }} 
            style={styles.vnImageDisplayImage}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>

      <View style={styles.vnImageDisplayActions}>
        {images.length > 1 && (
          <View style={styles.vnImageDisplayPagination}>
            <TouchableOpacity
              style={[
                styles.actionCircleButton,
                { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent' },
                currentImageIndex === 0 && styles.vnImageDisplayPaginationButtonDisabled
              ]}
              onPress={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
              disabled={currentImageIndex === 0}
            >
              <Ionicons 
                name="chevron-back" 
                size={BUTTON_ICON_SIZE} 
                color={currentImageIndex === 0 ? "#666" : "#fff"} 
              />
            </TouchableOpacity>
            <Text style={styles.vnImageDisplayPaginationText}>
              {currentImageIndex + 1} / {images.length}
            </Text>
            <TouchableOpacity
              style={[
                styles.actionCircleButton,
                { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent' },
                currentImageIndex === images.length - 1 && styles.vnImageDisplayPaginationButtonDisabled
              ]}
              onPress={() => setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1))}
              disabled={currentImageIndex === images.length - 1}
            >
              <Ionicons 
                name="chevron-forward" 
                size={BUTTON_ICON_SIZE} 
                color={currentImageIndex === images.length - 1 ? "#666" : "#fff"} 
              />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.vnImageDisplayActionButtons}>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
            ]}
            onPress={() => onOpenFullscreen(currentImage.id)}
          >
            <Ionicons name="expand-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
            ]}
            onPress={() => onSave(currentImage.id)}
          >
            <Ionicons name="download-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
            ]}
            onPress={() => onShare(currentImage.id)}
          >
            <Ionicons name="share-social-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
            ]}
            onPress={() => onDelete(currentImage.id)}
          >
            <Ionicons name="trash-outline" size={BUTTON_ICON_SIZE} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// Add new ImagesCarousel component after the VisualNovelImageDisplay component
const ImagesCarousel = memo(function ImagesCarousel({
  images,
  onOpenFullscreen,
  onSave,
  onShare,
  onDelete,
  mode,
}: {
  images: GeneratedImage[];
  onOpenFullscreen: (imageId: string) => void;
  onSave: (imageId: string) => void;
  onShare: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  mode: string; // normal or background-focus
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false); // Default collapsed
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load the current image
  useEffect(() => {
    const loadImage = async () => {
      if (!images.length) return;
      
      try {
        setIsLoading(true);
        const currentImage = images[currentImageIndex];
        const info = await ImageManager.getImageInfo(currentImage.id);
        
        if (info) {
          setImagePath(info.originalPath);
        } else {
          setImagePath(null);
        }
      } catch (error) {
        console.error('[ImagesCarousel] Error loading image:', error);
        setImagePath(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadImage();
  }, [images, currentImageIndex]);

  // If no images, don't render anything
  if (!images.length) return null;

  const currentImage = images[currentImageIndex];
  const formattedTime = new Date(currentImage.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Handle delete confirmation
  const handleDeletePress = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleConfirmDelete = () => {
    onDelete(currentImage.id);
    setShowDeleteConfirm(false);
  };

  const containerStyle = mode === 'background-focus' 
    ? [styles.imagesCarouselContainer, styles.imagesCarouselBackgroundFocus]
    : styles.imagesCarouselContainer;

  return (
    <View style={containerStyle}>
      {/* Header with prompt and timestamp */}
      <TouchableOpacity 
        style={[
          styles.imagesCarouselHeader, 
          isPromptExpanded ? styles.imagesCarouselHeaderExpanded : styles.imagesCarouselHeaderCollapsed
        ]}
        onPress={() => setIsPromptExpanded(!isPromptExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.imagesCarouselPromptContainer}>
          {isPromptExpanded ? (
            <Text style={styles.imagesCarouselPrompt} numberOfLines={3}>
              {currentImage.prompt}
            </Text>
          ) : (
            <Text style={styles.imagesCarouselPromptCollapsed} numberOfLines={1}>
              {currentImage.prompt.length > 20 ? 
                currentImage.prompt.substring(0, 20) + '...' : 
                currentImage.prompt}
            </Text>
          )}
          <View style={styles.imagesCarouselHeaderRight}>
            <Text style={styles.imagesCarouselTime}>{formattedTime}</Text>
            <Ionicons 
              name={isPromptExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#aaa" 
              style={{marginLeft: 8}}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Image content */}
      <TouchableOpacity 
        style={[
          styles.imagesCarouselContent,
          mode === 'background-focus' && styles.imagesCarouselContentBackgroundFocus
        ]}
        onPress={() => onOpenFullscreen(currentImage.id)}
        activeOpacity={0.9}
      >
        {isLoading ? (
          <View style={styles.imagesCarouselLoading}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.imagesCarouselLoadingText}>加载图片中...</Text>
          </View>
        ) : !imagePath ? (
          <View style={styles.imagesCarouselError}>
            <Ionicons name="alert-circle-outline" size={32} color="#e74c3c" />
            <Text style={styles.imagesCarouselErrorText}>无法加载图片</Text>
          </View>
        ) : (
          <Image 
            source={{ uri: imagePath }} 
            style={styles.imagesCarouselImage}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>

      {/* Controls */}
      <View style={[
        styles.imagesCarouselControls,
        mode === 'background-focus' && {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          paddingVertical: 10,
          zIndex: 30,
        }
      ]}>
        {images.length > 1 && (
          <View style={styles.imagesCarouselPagination}>
            <TouchableOpacity
              style={[
                styles.actionCircleButton,
                { width: BUTTON_SIZE, height: BUTTON_SIZE },
                mode === 'background-focus' && { 
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: BUTTON_SIZE / 2,
                },
                currentImageIndex === 0 && styles.imagesCarouselPaginationButtonDisabled
              ]}
              onPress={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
              disabled={currentImageIndex === 0}
            >
              <Ionicons 
                name="chevron-back" 
                size={BUTTON_ICON_SIZE} 
                color={currentImageIndex === 0 ? "#666" : "#fff"} 
              />
            </TouchableOpacity>
            <Text style={[
              styles.imagesCarouselPaginationText,
              mode === 'background-focus' && { fontSize: 14, fontWeight: 'bold' }
            ]}>
              {currentImageIndex + 1} / {images.length}
            </Text>
            <TouchableOpacity
              style={[
                styles.actionCircleButton,
                { width: BUTTON_SIZE, height: BUTTON_SIZE },
                mode === 'background-focus' && { 
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: BUTTON_SIZE / 2,
                },
                currentImageIndex === images.length - 1 && styles.imagesCarouselPaginationButtonDisabled
              ]}
              onPress={() => setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1))}
              disabled={currentImageIndex === images.length - 1}
            >
              <Ionicons 
                name="chevron-forward" 
                size={BUTTON_ICON_SIZE} 
                color={currentImageIndex === images.length - 1 ? "#666" : "#fff"} 
              />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.imagesCarouselActions}>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { 
                width: BUTTON_SIZE, 
                height: BUTTON_SIZE, 
                marginLeft: 8,
                ...(mode === 'background-focus' ? {
                  padding: 8,
                  marginHorizontal: 6
                } : {})
              }
            ]}
            onPress={() => onOpenFullscreen(currentImage.id)}
          >
            <Ionicons name="expand-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { 
                width: BUTTON_SIZE, 
                height: BUTTON_SIZE, 
                marginLeft: 8,
                ...(mode === 'background-focus' ? {
                  padding: 8,
                  marginHorizontal: 6
                } : {})
              }
            ]}
            onPress={() => onSave(currentImage.id)}
          >
            <Ionicons name="download-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { 
                width: BUTTON_SIZE, 
                height: BUTTON_SIZE, 
                marginLeft: 8,
                ...(mode === 'background-focus' ? {
                  padding: 8,
                  marginHorizontal: 6
                } : {})
              }
            ]}
            onPress={() => onShare(currentImage.id)}
          >
            <Ionicons name="share-social-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionCircleButton,
              { 
                width: BUTTON_SIZE, 
                height: BUTTON_SIZE, 
                marginLeft: 8,
                ...(mode === 'background-focus' ? {
                  padding: 8,
                  marginHorizontal: 6
                } : {})
              }
            ]}
            onPress={handleDeletePress}
          >
            <Ionicons name="trash-outline" size={BUTTON_ICON_SIZE} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.deleteConfirmModalContainer}>
          <View style={styles.deleteConfirmModalContent}>
            <Text style={styles.deleteConfirmTitle}>删除图片</Text>
            <Text style={styles.deleteConfirmText}>确定要删除这张图片吗？</Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, styles.deleteConfirmCancelButton]}
                onPress={handleCancelDelete}
              >
                <Text style={styles.deleteConfirmButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, styles.deleteConfirmDeleteButton]}
                onPress={handleConfirmDelete}
              >
                <Text style={[styles.deleteConfirmButtonText, { color: '#fff' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

// Add new interface for combined message/image items
interface CombinedItem {
  id: string;
  type: 'message' | 'image';
  message?: Message;
  image?: GeneratedImage;
  timestamp: number;
}

const ChatDialog: React.FC<ExtendedChatDialogProps> = ({
  messages,
  style,
  selectedCharacter,
  onRegenerateMessage,
  onScrollPositionChange,
  regeneratingMessageId = null,
  user = null,
  isHistoryModalVisible = false,
  setHistoryModalVisible,
  onEditAiMessage,
  onDeleteAiMessage,
  onEditUserMessage,
  onDeleteUserMessage,
  onLoadMore,
  loadingMore,
  hasMore,
  generatedImages = [], // 新增：生成的图片列表
  onDeleteGeneratedImage, // 新增：删除生成图片的回调
}) => {
  // Get safe area insets for proper spacing
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList<CombinedItem>>(null);
  const fadeAnim = useSharedValue(0);
  const translateAnim = useSharedValue(0);
  const dot1Scale = useSharedValue(1);
  const dot2Scale = useSharedValue(1);
  const dot3Scale = useSharedValue(1);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [fullscreenImageId, setFullscreenImageId] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [ratedMessages, setRatedMessages] = useState<Record<string, boolean>>({});
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // 新增：图片信息缓存
  const [imageInfoCache, setImageInfoCache] = useState<Record<string, any>>({});
  
  // 使用 AudioCacheManager 替代原有的音频状态管理
  const audioCacheManager = useMemo(() => AudioCacheManager.getInstance(), []);
  const [audioStates, setAudioStates] = useState<Record<string, {
    isLoading: boolean;
    hasAudio: boolean;
    isPlaying: boolean;
    isComplete: boolean;
    error: string | null;
  }>>({});

  const { mode, visualNovelSettings, updateVisualNovelSettings, isHistoryModalVisible: contextHistoryModalVisible, setHistoryModalVisible: contextSetHistoryModalVisible } = useDialogMode();

  // 判断是否等待AI回复：最后一条消息是用户消息且没有后续bot消息
  const isWaitingForAI = useMemo(() => {
    if (!messages.length) return false;
    const last = messages[messages.length - 1];
    return last.sender === 'user';
  }, [messages]);

  // Load UI settings
  const { settings: uiSettings, isLoaded: uiSettingsLoaded } = useChatUISettings();

  // 这里假设通过window.__topBarVisible传递（如需更优雅方案可通过props传递）
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  useEffect(() => {
    // 使用 DeviceEventEmitter 替代 EventRegister 监听全局事件
    const handler = (visible: boolean) => setIsTopBarVisible(visible);
    const subscription = DeviceEventEmitter.addListener('topBarVisibilityChanged', handler);
    return () => {
      subscription.remove();
    };
  }, []);
  // 判断是否为最后一条消息
  const isLastMessage = (index: number) => {
    // const visibleMessages = getVisibleMessages();
    return index === visibleMessages.length - 1;
  };
  // 新增：视觉小说展开/收起状态和背景透明度
  const [vnExpanded, setVnExpanded] = useState(false);
  const [vnBgAlpha, setVnBgAlpha] = useState(() => {
    return uiSettings.vnDialogAlpha;
  });
  const [showAlphaSlider, setShowAlphaSlider] = useState(false);

  // 修复类型错误：不要用 TouchableOpacity 作为类型
  const alphaBtnRef = useRef<any>(null);
  const [alphaBtnLayout, setAlphaBtnLayout] = useState<{x: number, y: number, width: number, height: number}>({x: 0, y: 0, width: 0, height: 0});

  // 视觉小说对话框头部高度和底部actions高度
  const VN_HEADER_HEIGHT = vnExpanded ? 0 : 58; // 展开时无header
  const VN_ACTIONS_HEIGHT = 62; // actions区高度
  const VN_VERTICAL_PADDING = 30; // 上下padding和margin

  // 计算文本区最大高度
  const getVNTextMaxHeight = () => {
    if (vnExpanded) {
      // Expanded: adjust for keyboard when visible
      // Subtract keyboard height, header, actions, vertical padding, and safe margin for input
      const keyboardAdjustment = keyboardVisible ? keyboardHeight : 0;
      return height - (VN_HEADER_HEIGHT + VN_ACTIONS_HEIGHT + VN_VERTICAL_PADDING + 160 + keyboardAdjustment);
    }
    // Collapsed: fixed height or adjust for small screens with keyboard
    const keyboardAdjustment = keyboardVisible ? keyboardHeight * 0.5 : 0; // Use partial adjustment when collapsed
    return Math.max(100, 220 - keyboardAdjustment); // Ensure minimum height of 100
  };

  // Update getCollapsedAbsTop to adjust position when keyboard is visible
  const getCollapsedAbsTop = () => {
    // Parameters for position calculation
    const chatInputHeight = 120; 
    const minDialogHeight = 240;
    const spacing = 30; // Extra spacing
    const safeAreaBottom = 24; // Safe area for iPhones with notch
    
    // Adjust calculation when keyboard is visible
    if (keyboardVisible) {
      // Move dialog up when keyboard is visible, but keep it at a reasonable position
      const keyboardAdjustment = keyboardHeight * 0.8; // Use 80% of keyboard height for adjustment
      const calculatedTop = height - chatInputHeight - minDialogHeight - spacing - safeAreaBottom - keyboardAdjustment;
      
      // Ensure it's not too high or too low
      const minTop = height * 0.1; // Allow it to go higher when keyboard is visible
      const maxTop = height - minDialogHeight - keyboardHeight - spacing;
      return Math.min(Math.max(calculatedTop, minTop), maxTop);
    }
    
    // Original calculation for when keyboard is not visible
    const calculatedTop = height - chatInputHeight - minDialogHeight - spacing - safeAreaBottom;
    
    // Ensure it's not too high (minimum distance from top is 30%)
    const minTop = height * 0.3;
    return Math.max(calculatedTop, minTop);
  };

  // 同步 visualNovelSettings.backgroundColor 和 vnBgAlpha
  useEffect(() => {
    const match = visualNovelSettings.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?/);
    if (match && match[4]) setVnBgAlpha(parseFloat(match[4]));
  }, [visualNovelSettings.backgroundColor]);

  // 调整背景色
  const getVnBgColor = () => {
    const color = uiSettings.vnDialogColor;
    const rgb = parseColor(color);
    return rgb ? `rgba(${rgb.join(',')},${vnBgAlpha})` : `rgba(0,0,0,${vnBgAlpha})`;
  };

  const handleAlphaChange = (alpha: number) => {
    setVnBgAlpha(alpha);
    // 更新 visualNovelSettings
    const color = uiSettings.vnDialogColor;
    const rgb = parseColor(color);
    const newColor = rgb ? `rgba(${rgb.join(',')},${alpha})` : `rgba(0,0,0,${alpha})`;
    updateVisualNovelSettings({ backgroundColor: newColor });
  };

  // 新增：HEX 转 RGB 的辅助函数
  const hexToRgb = (hex: string): [number, number, number] | null => {
    // 移除 # 前缀
    const cleanHex = hex.replace('#', '');
    
    // 支持 3 位和 6 位 HEX
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      return [r, g, b];
    } else if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return [r, g, b];
    }
    
    return null;
  };

  // 新增：解析颜色的辅助函数，支持 RGB 和 HEX 格式
  const parseColor = (color: string): [number, number, number] | null => {
    if (!color) return null;
    
    // 检查是否为 HEX 格式
    if (color.startsWith('#')) {
      return hexToRgb(color);
    }
    
    // 检查是否为 RGB 格式
    const rgbMatch = color.match(/\d+/g);
    if (rgbMatch && rgbMatch.length >= 3) {
      return [parseInt(rgbMatch[0]), parseInt(rgbMatch[1]), parseInt(rgbMatch[2])];
    }
    
    return null;
  };

  function getTextStyle(isUser: boolean) {
  // 兼容三种模式
  if (mode === 'normal') {
    return {
      color: isUser ? uiSettings.regularUserTextColor : uiSettings.regularBotTextColor,
      fontSize: Math.min(Math.max(14, width * 0.04), 16) * uiSettings.textSizeMultiplier,
    };
  } else if (mode === 'background-focus') {
    return {
      color: isUser ? uiSettings.bgUserTextColor : uiSettings.bgBotTextColor,
      fontSize: Math.min(Math.max(14, width * 0.04), 16) * uiSettings.textSizeMultiplier,
    };
  } else if (mode === 'visual-novel') {
    return {
      color: uiSettings.vnTextColor,
      fontSize: 16 * uiSettings.textSizeMultiplier,
    };
  }
  return {};
}

function getBubbleStyle(isUser: boolean) {
  if (mode === 'normal') {
    const color = isUser ? uiSettings.regularUserBubbleColor : uiSettings.regularBotBubbleColor;
    const alpha = isUser ? uiSettings.regularUserBubbleAlpha : uiSettings.regularBotBubbleAlpha;
    const rgb = parseColor(color);
    if (rgb && rgb.length >= 3) {
      return { backgroundColor: `rgba(${rgb.join(',')},${alpha})` };
    }
    // 如果解析失败，对于bot消息提供回退颜色，用户消息返回空对象使用默认渐变
    if (!isUser) {
      return { backgroundColor: `rgba(68, 68, 68, 0.85)` }; // 回退到默认bot颜色
    }
    return {}; // 用户消息使用默认渐变
  } else if (mode === 'background-focus') {
    const color = isUser ? uiSettings.bgUserBubbleColor : uiSettings.bgBotBubbleColor;
    const alpha = isUser ? uiSettings.bgUserBubbleAlpha : uiSettings.bgBotBubbleAlpha;
    const rgb = parseColor(color);
    if (rgb && rgb.length >= 3) {
      return { backgroundColor: `rgba(${rgb.join(',')},${alpha})` };
    }
    // 如果解析失败，对于bot消息提供回退颜色，用户消息返回空对象使用默认渐变
    if (!isUser) {
      return { backgroundColor: `rgba(68, 68, 68, 0.9)` }; // 回退到默认bot颜色，背景强调模式稍微深一点
    }
    return {}; // 用户消息使用默认渐变
  }
  return {};
}

function getBubblePadding() {
  return (RESPONSIVE_PADDING + 4) * uiSettings.bubblePaddingMultiplier;
}

  useEffect(() => {
    if (selectedCharacter?.id && selectedCharacter.id !== currentConversationId) {
      setCurrentConversationId(selectedCharacter.id);
    }
  }, [selectedCharacter?.id, currentConversationId]);

  useEffect(() => {
    if (messages.length > 0 && mode !== 'visual-novel') {
      const timer = setTimeout(() => {
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToEnd({ animated: false });
          } catch (e) {}
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, mode]);

  const handleScroll = (event: any) => {
    const yOffset = event.nativeEvent.contentOffset.y;
    if (currentConversationId) {
      setScrollPositions(prev => ({
        ...prev,
        [currentConversationId]: yOffset
      }));
      if (onScrollPositionChange) {
        onScrollPositionChange(currentConversationId, yOffset);
      }
    }
  };

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 300 });
    translateAnim.value = withTiming(0, { duration: 300 });
  }, [messages, fadeAnim, translateAnim]);

  const messagesAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
      transform: [{ translateY: translateAnim.value }]
    };
  });

  const animateDots = () => {
    const setupDotAnimation = (dotScale: Animated.SharedValue<number>, delay: number) => {
      dotScale.value = withDelay(
        delay,
        withSequence(
          withTiming(1.5, { duration: 300 }),
          withTiming(1, { duration: 300 })
        )
      );
    };

    setupDotAnimation(dot1Scale, 0);
    setupDotAnimation(dot2Scale, 200);
    setupDotAnimation(dot3Scale, 400);

    const interval = setInterval(() => {
      setupDotAnimation(dot1Scale, 0);
      setupDotAnimation(dot2Scale, 200);
      setupDotAnimation(dot3Scale, 400);
    }, 1200);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    const cleanup = animateDots();
    return cleanup;
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }]
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }]
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot3Scale.value }]
  }));

  // 新增：在组件初始化时加载音频缓存状态
  useEffect(() => {
    const loadAudioStates = async () => {
      try {
        // 1. 先获取当前内存中的状态
        const cachedStates = audioCacheManager.getAllAudioStates();
        setAudioStates(cachedStates);

        // 2. 获取当前对话的所有bot消息ID
        const botMessageIds = messages
          .filter(msg => msg.sender === 'bot' && !msg.isLoading)
          .map(msg => msg.id);

        if (botMessageIds.length > 0) {
          // 3. 检查这些消息是否有缓存的音频文件，并更新状态
          await audioCacheManager.initializeAudioStatesForMessages(botMessageIds);
          
          // 4. 重新获取更新后的状态
          const updatedStates = audioCacheManager.getAllAudioStates();
          setAudioStates(updatedStates);
          
          console.log(`[ChatDialog] Loaded audio states for ${botMessageIds.length} bot messages`);
        }
      } catch (error) {
        console.error('[ChatDialog] Failed to load audio states:', error);
      }
    };

    // 只在有有效对话ID时才加载音频状态
    if (selectedCharacter?.id) {
      loadAudioStates();
    }
  }, [audioCacheManager, selectedCharacter?.id]); // 只依赖会话ID，当切换对话时重新检查

  // 新增：当消息加载完成后，单独检查新消息的音频状态
  useEffect(() => {
    const checkNewMessagesAudio = async () => {
      if (!selectedCharacter?.id || messages.length === 0) return;

      try {
        const botMessageIds = messages
          .filter(msg => msg.sender === 'bot' && !msg.isLoading)
          .map(msg => msg.id);

        if (botMessageIds.length > 0) {
          // 只检查当前没有音频状态的消息
          const uncheckedIds = botMessageIds.filter(id => !audioStates[id]);
          
          if (uncheckedIds.length > 0) {
            console.log(`[ChatDialog] Checking audio for ${uncheckedIds.length} new messages`);
            await audioCacheManager.initializeAudioStatesForMessages(uncheckedIds);
            
            const updatedStates = audioCacheManager.getAllAudioStates();
            setAudioStates(updatedStates);
          }
        }
      } catch (error) {
        console.error('[ChatDialog] Failed to check new messages audio:', error);
      }
    };

    // 延迟执行，避免在消息加载过程中频繁触发
    const timeoutId = setTimeout(checkNewMessagesAudio, 500);
    return () => clearTimeout(timeoutId);
  }, [messages.length, selectedCharacter?.id, audioCacheManager]); // 依赖消息数量而不是整个messages数组

  // 新增：同步音频状态变化
  const updateAudioState = useCallback((messageId: string, state: {
    isLoading?: boolean;
    hasAudio?: boolean;
    isPlaying?: boolean;
    isComplete?: boolean;
    error?: string | null;
  }) => {
    audioCacheManager.updateAudioState(messageId, state);
    setAudioStates(prev => ({
      ...prev,
      [messageId]: {
        ...prev[messageId] || {
          isLoading: false,
          hasAudio: false,
          isPlaying: false,
          isComplete: false,
          error: null
        },
        ...state
      }
    }));
  }, [audioCacheManager]);

const handleTTSButtonPress = async (messageId: string, text: string) => {
  try {
    // 获取当前会话ID
    const conversationId = selectedCharacter?.id || 'default';
    
    // 1. 读取角色 ttsConfig
    const ttsConfig = selectedCharacter?.ttsConfig;
    let provider = ttsConfig?.provider;

    updateAudioState(messageId, {
      isLoading: true,
      error: null
    });

    let result: UnifiedTTSResponse | null = null;

    if (provider === 'cosyvoice') {
      // 新实现：自动传递 templateId，交由 unified-tts 处理 source_audio/source_transcript
      const templateId = ttsConfig?.cosyvoice?.templateId || '';
      const instruction = ttsConfig?.cosyvoice?.instruction || '';
      result = await synthesizeWithCosyVoice(text, undefined, templateId);
    } else if (provider === 'doubao') {
      const voiceType = ttsConfig?.doubao?.voiceType || '';
      const emotion = ttsConfig?.doubao?.emotion || '';
      result = await synthesizeWithDoubao(text, voiceType, emotion);
    } else if (provider === 'minimax') {
      const voiceId = ttsConfig?.minimax?.voiceId || '';
      const emotion = ttsConfig?.minimax?.emotion || '';
      result = await synthesizeWithMinimax(text, voiceId, emotion);
    } else {
      const voiceType = selectedCharacter?.voiceType || '';
      result = await synthesizeWithDoubao(text, voiceType, '');
    }

    // 处理 audioPath 字段并使用 AudioCacheManager 缓存
    if (result?.success && result.data?.audioPath) {
      try {
        // 使用 AudioCacheManager 缓存音频文件
        const cachedPath = await audioCacheManager.cacheAudioFile(
          messageId,
          conversationId,
          result.data.audioPath
        );

        updateAudioState(messageId, {
          isLoading: false,
          hasAudio: true,
          error: null
        });

        console.log(`[ChatDialog] Audio cached for message ${messageId} at ${cachedPath}`);
      } catch (cacheError) {
        console.error('[ChatDialog] Failed to cache audio:', cacheError);
        updateAudioState(messageId, {
          isLoading: false,
          hasAudio: false,
          error: 'Failed to cache audio'
        });
      }
    } else {
      updateAudioState(messageId, {
        isLoading: false,
        hasAudio: false,
        error: result?.error || '无法生成语音'
      });
      Alert.alert('语音生成失败', result?.error || '无法生成语音，请稍后再试。');
    }
  } catch (error) {
    console.error('Failed to generate TTS:', error);
    updateAudioState(messageId, {
      isLoading: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
    Alert.alert('语音生成失败', '无法生成语音，请稍后再试。');
  }
};

  const handlePlayAudio = async (messageId: string) => {
    try {
      // 使用 AudioCacheManager 获取音频实例
      const sound = await audioCacheManager.getAudioSound(messageId);
      if (!sound) {
        throw new Error('No audio available');
      }

      const currentState = audioStates[messageId] || {
        isLoading: false,
        hasAudio: true,
        isPlaying: false,
        isComplete: false,
        error: null
      };

      // 停止其它正在播放的音频
      await audioCacheManager.stopAllAudio();
      // 更新所有音频状态为停止状态
      const updatedStates = { ...audioStates };
      Object.keys(updatedStates).forEach(id => {
        if (id !== messageId && updatedStates[id].isPlaying) {
          updatedStates[id] = { ...updatedStates[id], isPlaying: false };
          audioCacheManager.updateAudioState(id, { isPlaying: false });
        }
      });
      setAudioStates(updatedStates);

      // 切换播放/暂停
      if (currentState.isPlaying) {
        await sound.pauseAsync();
        updateAudioState(messageId, { isPlaying: false });
      } else {
        // 监听播放结束
        sound.setOnPlaybackStatusUpdate(async status => {
          if (status.isLoaded && status.didJustFinish) {
            updateAudioState(messageId, {
              isPlaying: false,
              isComplete: true
            });
          }
        });
        await sound.replayAsync();
        updateAudioState(messageId, {
          isPlaying: true,
          isComplete: false
        });
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      updateAudioState(messageId, {
        isPlaying: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      Alert.alert('播放失败', '无法播放语音，请稍后再试。');
    }
  };

  // 组件卸载时清理当前会话的音频（可选，如果想要跨会话保留可以移除这个）
  useEffect(() => {
    return () => {
      // 不再需要清理，因为音频会持久化保存
      // 如果需要清理当前会话的音频，可以调用：
      // if (selectedCharacter?.id) {
      //   audioCacheManager.clearConversationAudio(selectedCharacter.id);
      // }
    };
  }, []);

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        <Image
          source={
            selectedCharacter?.avatar
              ? { uri: String(selectedCharacter.avatar) }
              : require('@/assets/images/default-avatar.png')
          }
          style={styles.emptyStateAvatar}
        />
        <Text style={styles.emptyStateTitle}>
          {selectedCharacter
            ? `开始与 ${selectedCharacter.name} 的对话`
            : '选择一个角色开始对话'}
        </Text>
        <Text style={styles.emptyStateSubtitle}>
          {selectedCharacter
            ? '发送一条消息，开始聊天吧！'
            : '点击左上角菜单选择角色'}
        </Text>
      </View>
    );
  };

  const renderTimeGroup = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return (
      <View style={styles.timeGroup}>
        <Text style={styles.timeText}>{`${hours}:${minutes}`}</Text>
      </View>
    );
  };

  const containsCustomTags = (text: string): boolean => {
    return /(<\s*(thinking|think|status|mem|websearch|char-think|StatusBlock|statusblock|font)[^>]*>[\s\S]*?<\/\s*(thinking|think|status|mem|websearch|char-think|StatusBlock|statusblock|font)\s*>)/i.test(text);
  };

  // 新增：缓存图片信息的函数
  const getCachedImageInfo = useCallback((imageId: string) => {
    if (imageInfoCache[imageId]) {
      return imageInfoCache[imageId];
    }
    
    try {
      const imageInfo = ImageManager.getImageInfo(imageId);
      setImageInfoCache(prev => ({
        ...prev,
        [imageId]: imageInfo
      }));
      return imageInfo;
    } catch (error) {
      console.error(`[ChatDialog] Error getting image info for ${imageId}:`, error);
      setImageInfoCache(prev => ({
        ...prev,
        [imageId]: null
      }));
      return null;
    }
  }, [imageInfoCache]);

  // 清除过期的图片缓存
  useEffect(() => {
    const imageIds = new Set<string>();
    
    // 收集当前消息中的所有图片ID
    messages.forEach(message => {
      const imageIdRegex = /!\[(.*?)\]\(image:([^\s)]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = imageIdRegex.exec(message.text)) !== null) {
        imageIds.add(match[2]);
      }
    });
    
    // 清除不再使用的图片缓存
    setImageInfoCache(prev => {
      const newCache: Record<string, any> = {};
      Array.from(imageIds).forEach(id => {
        if (prev[id] !== undefined) {
          newCache[id] = prev[id];
        }
      });
      return newCache;
    });
  }, [messages]);

  // 修改处理消息内容的函数，应用文本样式和缓存图片信息
  const processMessageContent = useCallback((text: string, isUser: boolean, opts?: { isHtmlPagePlaceholder?: boolean }) => {
    // 新增：如果是HTML页面占位，直接显示占位文本
    if (opts?.isHtmlPagePlaceholder) {
      return (
        <Text style={[
          isUser ? styles.userMessageText : styles.botMessageText,
          getTextStyle(isUser)
        ]}>
          [页面消息]
        </Text>
      );
    }

    if (!text || text.trim() === '') {
      return (
        <Text style={[
          isUser ? styles.userMessageText : styles.botMessageText,
          getTextStyle(isUser)
        ]}>
          (Empty message)
        </Text>
      );
    }

    if (containsCustomTags(text) || /<\/?[a-z][^>]*>/i.test(text)) {
      // 渲染前先移除未知标签
      const cleanedText = stripUnknownTags(text);
      return (
        <RichTextRenderer
          html={optimizeHtmlForRendering(cleanedText)}
          baseStyle={[isUser ? styles.userMessageText : styles.botMessageText, getTextStyle(isUser)]}
          onImagePress={(url) => setFullscreenImage(url)}
          maxImageHeight={MAX_IMAGE_HEIGHT}
        />
      );
    }

    // Enhanced check for Markdown code blocks with triple backticks
    const codeBlockPattern = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const hasCodeBlock = codeBlockPattern.test(text);
    
    const markdownPattern = /(^|\n)(\s{0,3}#|```|>\s|[*+-]\s|\d+\.\s|\|.*\|)/;
    if (hasCodeBlock || markdownPattern.test(text)) {
      return (
        <View style={{ width: '100%' }}>
          <Markdown
            style={{
              body: {
                ...(isUser ? styles.userMessageText : styles.botMessageText),
                color: uiSettings.markdownTextColor, // 应用自定义颜色
              },
              text: {
                ...(isUser ? styles.userMessageText : styles.botMessageText),
                color: uiSettings.markdownTextColor, // 应用自定义颜色
              },
              // Enhanced code block styling with UI settings
              code_block: { 
                backgroundColor: uiSettings.markdownCodeBackgroundColor,
                color: uiSettings.markdownCodeTextColor,
                borderRadius: 6,
                padding: 12,
                fontSize: 14 * uiSettings.markdownCodeScale,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                marginVertical: 10,
              },
              code_block_text: {
                backgroundColor: uiSettings.markdownCodeBackgroundColor,
                color: uiSettings.markdownCodeTextColor,
                fontSize: 14 * uiSettings.markdownCodeScale,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                padding: 0,
              },
              fence: {
                backgroundColor: uiSettings.markdownCodeBackgroundColor,
                borderRadius: 6,
                marginVertical: 10,
                width: '100%',
              },
              fence_code: {
                backgroundColor: uiSettings.markdownCodeBackgroundColor,
                color: uiSettings.markdownCodeTextColor,
                borderRadius: 6,
                padding: 12,
                fontSize: 14 * uiSettings.markdownCodeScale,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                width: '100%',
              },
              fence_code_text: {
                backgroundColor: uiSettings.markdownCodeBackgroundColor,
                color: uiSettings.markdownCodeTextColor,
                fontSize: 14 * uiSettings.markdownCodeScale,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                padding: 0,
              },
              heading1: { 
                fontSize: 24 * uiSettings.markdownTextScale, 
                fontWeight: 'bold', 
                marginVertical: 10,
                color: uiSettings.markdownHeadingColor 
              },
              heading2: { 
                fontSize: 22 * uiSettings.markdownTextScale, 
                fontWeight: 'bold', 
                marginVertical: 8,
                color: uiSettings.markdownHeadingColor
              },
              heading3: { 
                fontSize: 20 * uiSettings.markdownTextScale, 
                fontWeight: 'bold', 
                marginVertical: 6,
                color: uiSettings.markdownHeadingColor
              },
              heading4: { 
                fontSize: 18 * uiSettings.markdownTextScale, 
                fontWeight: 'bold', 
                marginVertical: 5,
                color: uiSettings.markdownHeadingColor
              },
              heading5: { 
                fontSize: 16 * uiSettings.markdownTextScale, 
                fontWeight: 'bold', 
                marginVertical: 4,
                color: uiSettings.markdownHeadingColor
              },
              heading6: { 
                fontSize: 14 * uiSettings.markdownTextScale, 
                fontWeight: 'bold', 
                marginVertical: 3,
                color: uiSettings.markdownHeadingColor
              },
              bullet_list: { marginVertical: 6 },
              ordered_list: { marginVertical: 6 },
              list_item: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
              blockquote: { 
                backgroundColor: uiSettings.markdownQuoteBackgroundColor, 
                borderLeftWidth: 4, 
                borderLeftColor: '#aaa', 
                padding: 8, 
                marginVertical: 6 
              },
              blockquote_text: {
                color: uiSettings.markdownQuoteColor,
              },
              table: { borderWidth: 1, borderColor: '#666', marginVertical: 8 },
              th: { backgroundColor: '#444', color: '#fff', fontWeight: 'bold', padding: 6 },
              tr: { borderBottomWidth: 1, borderColor: '#666' },
              td: { padding: 6, color: '#fff' },
              hr: { borderBottomWidth: 1, borderColor: '#aaa', marginVertical: 8 },
              link: { color: uiSettings.markdownLinkColor, textDecorationLine: 'underline' },
              strong: { color: uiSettings.markdownBoldColor, fontWeight: 'bold' },
              em: { 
              color: uiSettings.markdownTextColor, 
              fontStyle: 'italic',
              fontSize: Math.min(Math.max(14, width * 0.04), 16) * uiSettings.markdownTextScale
             },
              image: { width: 220, height: 160, borderRadius: 8, marginVertical: 8, alignSelf: 'center' },
            }}
            onLinkPress={(url: string) => {
              if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
                if (typeof window !== 'undefined') {
                  window.open(url, '_blank');
                } else {
                  setFullscreenImage(url);
                }
                return true;
              }
              return false;
            }}
            rules={{
              fence: (
                node: ASTNode,
                children: React.ReactNode[],
                parent: ASTNode[],
                styles: any
              ) => {
                return (
                  <View key={node.key} style={styles.code_block}>
                    <Text style={styles.code_block_text}>
                      {node.content || ''}
                    </Text>
                  </View>
                );
              }
            }}
          >
            {text}
          </Markdown>
        </View>
      );
    }

    const rawImageMarkdownRegex = /!\[(.*?)\]\(image:([a-zA-Z0-9\-_]+)\)/;
    const rawImageMatch = text.trim().match(rawImageMarkdownRegex);

    if (rawImageMatch) {
      const alt = rawImageMatch[1] || "图片";
      const imageId = rawImageMatch[2];

      const imageInfo = getCachedImageInfo(imageId);
      const imageStyle = getImageDisplayStyle(imageInfo);

      if (imageInfo) {
        return (
          <View style={styles.imageWrapper}>
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => handleOpenFullscreenImage(imageId)}
            >
              <Image
                source={{ uri: imageInfo.originalPath }}
                style={imageStyle}
                resizeMode="contain"
                onError={(e) => console.error(`Error loading image: ${e.nativeEvent.error}`, imageInfo.originalPath)}
              />
            </TouchableOpacity>
            <Text style={styles.imageCaption}>{alt}</Text>
          </View>
        );
      } else {
        console.error(`No image info found for ID: ${imageId}`);
        return (
          <View style={styles.imageError}>
            <Ionicons name="alert-circle" size={36} color="#e74c3c" />
            <Text style={styles.imageErrorText}>图片无法加载 (ID: {imageId.substring(0, 8)}...)</Text>
          </View>
        );
      }
    }

    const hasCustomTags = (
      /<\s*(thinking|think|status|mem|websearch)[^>]*>([\s\S]*?)<\/\s*(thinking|think|status|mem|websearch)\s*>/i.test(text) ||
      /<\s*char\s+think\s*>([\s\S]*?)<\/\s*char\s+think\s*>/i.test(text)
    );

    const hasMarkdown = /```[\w]*\s*([\s\S]*?)```/.test(text) ||
                     /!\[[\s\S]*?\]\([\s\S]*?\)/.test(text) ||
                     /\*\*([\s\S]*?)\*\*/.test(text) ||
                     /\*([\s\S]*?)\*/.test(text);

    const hasHtml = /<\/?[a-z][^>]*>/i.test(text);

    const imageIdRegex = /!\[(.*?)\]\(image:([^\s)]+)\)/g;
    let match: RegExpExecArray | null;
    const matches: { alt: string, id: string }[] = [];

    while ((match = imageIdRegex.exec(text)) !== null) {
      matches.push({
        alt: match[1] || "图片",
        id: match[2]
      });
    }

    if (matches.length > 0) {
      console.log(`[ChatDialog] Found ${matches.length} image references in message`);
      return (
        <View>
          {matches.map((img, idx) => {
            console.log(`[ChatDialog] Processing image ${idx+1}/${matches.length}, ID: ${img.id.substring(0, 8)}...`);
            const imageInfo = getCachedImageInfo(img.id);
            const imageStyle = getImageDisplayStyle(imageInfo);
            if (imageInfo) {
              console.log(`[ChatDialog] Image info found, path: ${imageInfo.originalPath}`);
              return (
                <TouchableOpacity 
                  key={img.id + '-' + idx}
                  style={styles.imageWrapper}
                  onPress={() => handleOpenFullscreenImage(img.id)}
                >
                  <Image
                    source={{ uri: imageInfo.originalPath }}
                    style={imageStyle}
                    resizeMode="contain"
                    onError={(e) => console.error(`Error loading image: ${e.nativeEvent.error}`, imageInfo.originalPath)}
                  />
                  <Text style={styles.imageCaption}>{img.alt}</Text>
                </TouchableOpacity>
              );
            } else {
              console.error(`[ChatDialog] No image info found for ID: ${img.id}`);
              return (
                <View key={idx} style={styles.imageError}>
                  <Ionicons name="alert-circle" size={36} color="#e74c3c" />
                  <Text style={styles.imageErrorText}>图片无法加载 (ID: {img.id.substring(0, 8)}...)</Text>
                </View>
              );
            }
          })}
        </View>
      );
    }

    const imageMarkdownRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+|image:[^\s)]+)\)/g;
    let urlMatches: { alt: string, url: string }[] = [];

    imageMarkdownRegex.lastIndex = 0;

    while ((match = imageMarkdownRegex.exec(text)) !== null) {
      urlMatches.push({
        alt: match[1] || "图片",
        url: match[2]
      });
    }

    if (urlMatches.length > 0) {
      return (
        <View>
          {urlMatches.map((img, idx) => {
            const isImageId = img.url.startsWith('image:');
            const isDataUrl = img.url.startsWith('data:');
            const isLargeDataUrl = isDataUrl && img.url.length > 100000;

            // Handle image: prefix (local image ID)
            if (isImageId) {
              const imageId = img.url.substring(6); // Remove 'image:' prefix
              const imageInfo = getCachedImageInfo(imageId);
              const imageStyle = getImageDisplayStyle(imageInfo);
              
              if (imageInfo) {
                return (
                  <TouchableOpacity 
                    key={idx}
                    style={styles.imageWrapper}
                    onPress={() => handleOpenFullscreenImage(imageId)}
                  >
                    <Image
                      source={{ uri: imageInfo.originalPath }}
                      style={imageStyle}
                      resizeMode="contain"
                      onError={(e) => console.error(`Error loading image: ${e.nativeEvent.error}`, imageInfo.originalPath)}
                    />
                    <Text style={styles.imageCaption}>{img.alt}</Text>
                  </TouchableOpacity>
                );
              } else {
                console.error(`No image info found for ID: ${imageId}`);
                return (
                  <View key={idx} style={styles.imageError}>
                    <Ionicons name="alert-circle" size={36} color="#e74c3c" />
                    <Text style={styles.imageErrorText}>图片无法加载 (ID: {imageId.substring(0, 8)}...)</Text>
                  </View>
                );
              }
            }

            if (isLargeDataUrl) {
              return (
                <View key={idx} style={styles.imageWrapper}>
                  <TouchableOpacity
                    style={styles.imageDataUrlWarning}
                    onPress={() => setFullscreenImage(img.url)}
                  >
                    <Ionicons name="image" size={36} color="#999" />
                    <Text style={styles.imageDataUrlWarningText}>
                      {img.alt} (点击查看)
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }

            return (
              <TouchableOpacity 
                key={idx}
                style={styles.imageWrapper}
                onPress={() => setFullscreenImage(img.url)}
              >
                <Image
                  source={{ uri: img.url }}
                  style={styles.messageImage}
                  resizeMode="contain"
                  onError={(e) => console.error(`Error loading image URL: ${e.nativeEvent.error}`)}
                />
                <Text style={styles.imageCaption}>{img.alt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    const linkRegex = /\[(.*?)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g;
    let linkMatches: { text: string, url: string }[] = [];

    while ((match = linkRegex.exec(text)) !== null) {
      linkMatches.push({
        text: match[1],
        url: match[2]
      });
    }

    if (linkMatches.length > 0) {
      return (
        <View>
          {linkMatches.map((link, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.linkButton}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open(link.url, '_blank');
                } else {
                  setFullscreenImage(link.url);
                }
              }}
            >
              <Ionicons name="link" size={16} color="#3498db" style={styles.linkIcon} />
              <Text style={styles.linkText}>{link.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return renderMessageText(text, isUser);
  }, [getCachedImageInfo, uiSettings, getTextStyle, containsCustomTags, stripUnknownTags, optimizeHtmlForRendering, getImageDisplayStyle]);

  const renderMessageText = (text: string, isUser: boolean) => {
    const segments = parseHtmlText(text);
    return (
      <Text style={[
        isUser ? styles.userMessageText : styles.botMessageText,
        getTextStyle(isUser)
      ]}>
        {segments.map((segment, index) => (
          <Text key={index} style={[segment.style, getTextStyle(isUser)]}>
            {segment.text}
          </Text>
        ))}
      </Text>
    );
  };

// 新增：根据消息id获取其在完整messages中的真实index
function getRealMessageIndexById(messages: Message[], id: string): number {
  return messages.findIndex(m => m.id === id);
}

// 修改 getAiMessageIndex：始终基于完整 messages 计算
const getAiMessageIndex = (realIndex: number): number => {
  const message = messages[realIndex];
  if (message?.metadata?.aiIndex !== undefined) {
    return message.metadata.aiIndex;
  }
  let aiMessageCount = 0;
  for (let i = 0; i <= realIndex; i++) {
    if (messages[i].sender === 'bot' && !messages[i].isLoading) {
      aiMessageCount++;
    }
  }
  return aiMessageCount - 1;
};

  const renderTTSButtons = (message: Message) => {
    if (message.sender !== 'bot' || message.isLoading) return null;
    const audioState = audioStates[message.id] || {
      isLoading: false,
      hasAudio: false,
      isPlaying: false,
      isComplete: false,
      error: null
    };
    const isVisualNovel = mode === 'visual-novel';

    if (audioState.isLoading) {
      return (
        <View style={[
          styles.actionCircleButton,
          { width: BUTTON_SIZE, height: BUTTON_SIZE, marginRight: BUTTON_MARGIN }
        ]}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      );
    }
    if (audioState.hasAudio) {
      return (
        <TouchableOpacity
          style={[
            styles.actionCircleButton,
            audioState.isPlaying && styles.actionCircleButtonActive,
            { width: BUTTON_SIZE, height: BUTTON_SIZE, marginRight: BUTTON_MARGIN }
          ]}
          onPress={() => handlePlayAudio(message.id)}
        >
          <Ionicons
            name={audioState.isPlaying ? "pause" : audioState.isComplete ? "refresh" : "play"}
            size={BUTTON_ICON_SIZE}
            color="#fff"
          />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[
          styles.actionCircleButton,
          { width: BUTTON_SIZE, height: BUTTON_SIZE, marginRight: BUTTON_MARGIN }
        ]}
        onPress={() => handleTTSButtonPress(message.id, message.text)}
      >
        <Ionicons name="volume-high" size={BUTTON_ICON_SIZE} color="#fff" />
      </TouchableOpacity>
    );
  };

  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editModalText, setEditModalText] = useState('');
  const [editTargetMsgId, setEditTargetMsgId] = useState<string | null>(null);
  const [editTargetAiIndex, setEditTargetAiIndex] = useState<number>(-1);

  const handleEditButton = (message: Message, messageIndex: number, isUser: boolean) => {
    setEditModalText(message.text);
    setEditTargetMsgId(message.id);
    setEditTargetAiIndex(messageIndex);
    setEditModalVisible(true);
  };

  const handleDeleteButton = (message: Message, messageIndex: number, isUser: boolean) => {
    Alert.alert(
      isUser ? '删除用户消息' : '删除AI消息',
      isUser
        ? '确定要删除该用户消息吗？'
        : '确定要删除该AI消息吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            if (isUser) {
              if (typeof onDeleteUserMessage === 'function') onDeleteUserMessage(message.id, messageIndex);
            } else {
              if (typeof onDeleteAiMessage === 'function') onDeleteAiMessage(message.id, messageIndex);
            }
          }
        }
      ]
    );
  };

  // 1. 用 useMemo 缓存 visibleMessages，避免每次渲染都新建数组
  const visibleMessages = React.useMemo(() => {
    const filtered = messages.filter(
      m => !(m.sender === 'user' && m.metadata && m.metadata.isContinue === true)
    );
    if (mode === 'visual-novel') return messages;
    if (isHistoryModalVisible) return messages;
    return messages.slice(-30);
  }, [messages, mode, isHistoryModalVisible]);

// 新增：缓存 combinedItems，避免每次都新建对象，key 保持稳定
const combinedItems = useMemo(() => {
  if (mode === 'visual-novel') {
    return visibleMessages.map(message => ({
      type: 'message' as const,
      message,
      timestamp: message.timestamp || 0,
      id: message.id, // 增加 id 字段
    }));
  }
  
  // First, separate message items into two groups: user messages being loaded and regular messages
  const userLoadingMessages: CombinedItem[] = [];
  const regularMessages: CombinedItem[] = [];
  
  visibleMessages.forEach(message => {
    const item = {
      type: 'message' as const,
      message,
      timestamp: message.timestamp || 0,
      id: message.id,
    };
    
    // Separate the last user message that's waiting for AI response
    if (message.sender === 'user' && isWaitingForAI && message.id === visibleMessages[visibleMessages.length - 1].id) {
      userLoadingMessages.push(item);
    } else {
      regularMessages.push(item);
    }
  });
  
  // For normal and background-focus modes, we want:
  // 1. Regular messages (sorted by timestamp)
  // 2. User loading message (if any) at the end
  
  // Regular messages sorted by timestamp (no image items in the new version)
  const combined = [...regularMessages].sort((a, b) => a.timestamp - b.timestamp);
  
  // Always append user loading messages at the end
  return [...combined, ...userLoadingMessages];
  
  // eslint-disable-next-line
}, [visibleMessages, mode, isWaitingForAI]);

  // 处理图片相关操作
  const handleOpenFullscreenImage = useCallback((imageId: string) => {
    if (imageId) {
      setFullscreenImageId(imageId);
      const imageInfo = ImageManager.getImageInfo(imageId);

      if (imageInfo) {
        setFullscreenImage(imageInfo.originalPath);
        setImageLoading(false);
      } else {
        setFullscreenImage(null);
        Alert.alert('错误', '无法加载图片');
      }
    }
  }, []);

  const handleSaveGeneratedImage = useCallback(async (imageId: string) => {
    try {
      const result = await ImageManager.saveToGallery(imageId);
      Alert.alert(result.success ? '成功' : '错误', result.message);
    } catch (error) {
      console.error('[ChatDialog] Error saving image:', error);
      Alert.alert('错误', '保存图片失败');
    }
  }, []);

  const handleShareGeneratedImage = useCallback(async (imageId: string) => {
    try {
      const shared = await ImageManager.shareImage(imageId);
      if (!shared) {
        Alert.alert('错误', '分享功能不可用');
      }
    } catch (error) {
      console.error('[ChatDialog] Error sharing image:', error);
      Alert.alert('错误', '分享图片失败');
    }
  }, []);

  const handleDeleteGeneratedImage = useCallback((imageId: string) => {
    if (onDeleteGeneratedImage) {
      onDeleteGeneratedImage(imageId);
    }
  }, [onDeleteGeneratedImage]);

  const renderMessageContent = (message: Message, isUser: boolean, index: number) => {
    // 常规/背景强调模式下，遇到完整HTML页面只显示占位
    const isHtmlPage = isWebViewContent(message.text);
    if ((mode !== 'visual-novel') && isHtmlPage) {
      return (
        <Animated.View 
          style={[
            styles.messageContent,
            isUser ? styles.userMessageContent : styles.botMessageContent,
            message.isLoading && styles.loadingMessage
          ]}
        >
          {!isUser && (
            <Image
              source={
                selectedCharacter?.avatar
                  ? { uri: String(selectedCharacter.avatar) }
                  : require('@/assets/images/default-avatar.png')
              }
              style={[styles.messageAvatar, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}
            />
          )}
          <View style={isUser ? styles.userMessageWrapper : styles.botMessageTextContainer}>
            {processMessageContent(message.text, isUser, { isHtmlPagePlaceholder: true })}
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View 
        style={[
          styles.messageContent,
          isUser ? styles.userMessageContent : styles.botMessageContent,
          message.isLoading && styles.loadingMessage
               ]}
      >
        {!isUser && (
          <Image
            source={
              selectedCharacter?.avatar
                ? { uri: String(selectedCharacter.avatar) }
                : require('@/assets/images/default-avatar.png')
            }
            style={[styles.messageAvatar, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}
          />
        )}
        {isUser ? (
          // 用户消息 - 添加复制按钮
          <View style={[styles.userMessageWrapper, {maxWidth: MAX_WIDTH}]}>
            {user?.avatar && (
              <Image
                source={{ uri: String(user.avatar) }}
                style={[styles.userMessageAvatar, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}
              />
            )}
            <View style={styles.userMessageBubbleContainer}>
              {mode === 'normal' || mode === 'background-focus' ? (
                <LinearGradient
                  colors={[
                    uiSettings.regularUserBubbleColor.replace('rgb', 'rgba').replace(')', `,${uiSettings.regularUserBubbleAlpha})`),
                    uiSettings.regularUserBubbleColor.replace('rgb', 'rgba').replace(')', `,${uiSettings.regularUserBubbleAlpha - 0.05})`)
                  ]}
                  style={[
                    styles.userGradient, 
                    { borderRadius: 18, borderTopRightRadius: 4 },
                    { padding: getBubblePadding(), paddingHorizontal: getBubblePadding() + 4 }
                  ]}
                >
                  {processMessageContent(message.text, true)}
                </LinearGradient>
              ) : (
                <View style={[
                  styles.userGradient,
                  getBubbleStyle(true),
                  { borderRadius: 18, borderTopRightRadius: 4 },
                  { padding: getBubblePadding(), paddingHorizontal: getBubblePadding() + 4 }
                ]}>
                  {processMessageContent(message.text, true)}
                </View>
              )}
              {/* 用户消息操作按钮 */}
              <View style={styles.userMessageActionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionCircleButton,
                    { width: BUTTON_SIZE, height: BUTTON_SIZE, marginTop: BUTTON_MARGIN }
                  ]}
                  onPress={() => copyMessageText(message.text)}
                >
                  <Ionicons name="copy-outline" size={BUTTON_ICON_SIZE} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          // AI消息 - 带操作按钮
          <View style={[
            styles.botMessageTextContainer, 
            getBubbleStyle(false),
            {maxWidth: MAX_WIDTH},
            { 
              padding: getBubblePadding(), 
              paddingHorizontal: getBubblePadding() + 4,
              paddingTop: getBubblePadding() + 8,
              paddingBottom: getBubblePadding() + 4 // Reduce bottom padding for actions container
            }
          ]}>
            {message.isLoading ? (
              <View style={styles.loadingContainer}>
                <Animated.View style={[styles.loadingDot, dot1Style]} />
                <Animated.View style={[styles.loadingDot, dot2Style]} />
                <Animated.View style={[styles.loadingDot, dot3Style]} />
              </View>
            ) : (
              <>
                {processMessageContent(message.text, false)}
                {/* AI消息操作按钮放在内部，但有明确的分隔 */}
                <View style={styles.botMessageActionsContainer}>
                  {renderMessageActions(message, index)}
                </View>
              </>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  const renderMessageActions = (message: Message, visibleIndex: number) => {
    if (message.isLoading || message.sender !== 'bot') return null;
    
    const isBot = message.sender === 'bot' && !message.isLoading;
    const isAutoMessage = !!message.metadata?.isAutoMessageResponse;
    const isRegenerating = regeneratingMessageId === message.id;
    // 用完整 messages 找到真实 index
    const realIndex = getRealMessageIndexById(messages, message.id);
    const aiIndex = getAiMessageIndex(realIndex);

    // --- 判断是否为first_mes ---
    let isFirstMes = false;
    if (message.metadata?.isFirstMes) {
      isFirstMes = true;
    } else if (
      selectedCharacter &&
      selectedCharacter.jsonData
    ) {
      try {
        const characterData = JSON.parse(selectedCharacter.jsonData);
        if (
          characterData.roleCard?.first_mes &&
          message.text === characterData.roleCard.first_mes
        ) {
          isFirstMes = true;
        }
      } catch (e) {
        // ignore
      }
    }

    // 机器人消息的操作按钮
    return (
      <View style={styles.messageActionsRow}>
        <View style={styles.messageActionsLeft}>
          {!isAutoMessage && renderTTSButtons(message)}
          {/* 复制按钮放在左侧 */}
          <TouchableOpacity
            style={[
              styles.actionCircleButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: BUTTON_MARGIN }
            ]}
            onPress={() => copyMessageText(message.text)}
          >
            <Ionicons name="copy-outline" size={BUTTON_ICON_SIZE} color="#888" />
          </TouchableOpacity>
        </View>
        <View style={styles.messageActionsRight}>
          {/* AI 消息操作按钮 */}
          {!isAutoMessage && !isFirstMes && (
            <>
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: BUTTON_MARGIN }
                ]}
                onPress={() => handleEditButton(message, aiIndex, false)}
                disabled={!!regeneratingMessageId}
              >
                <Ionicons name="create-outline" size={BUTTON_ICON_SIZE} color={regeneratingMessageId ? "#999999" : "#f1c40f"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: BUTTON_MARGIN }
                ]}
                onPress={() => handleDeleteButton(message, aiIndex, false)}
                disabled={!!regeneratingMessageId}
              >
                <Ionicons name="trash-outline" size={BUTTON_ICON_SIZE} color={regeneratingMessageId ? "#999999" : "#e74c3c"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  isRegenerating && styles.actionCircleButtonActive,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: BUTTON_MARGIN }
                ]}
                disabled={isRegenerating || !!regeneratingMessageId}
                onPress={() => onRegenerateMessage && onRegenerateMessage(message.id, aiIndex)}
              >
                {isRegenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={BUTTON_ICON_SIZE}
                    color={regeneratingMessageId ? "#999999" : "#3498db"}
                  />
                )}
              </TouchableOpacity>
            </>
          )}
          {/* 最后一条消息显示log跳转按钮 */}
          {isLastMessage(visibleIndex) && (
            <TouchableOpacity
              style={[
                styles.actionCircleButton,
                { width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: BUTTON_MARGIN }
              ]}
              onPress={() => router.push('/pages/log')}
              accessibilityLabel="查看请求日志"
            >
              <Ionicons name="document-text-outline" size={BUTTON_ICON_SIZE} color="#4a6fa5" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };


  // Handle fullscreen image operations
  const handleSaveImage = async () => {
    try {
      if (fullscreenImageId) {
        const result = await ImageManager.saveToGallery(fullscreenImageId);
        Alert.alert(result.success ? '成功' : '错误', result.message);
      } else if (fullscreenImage) {
        const result = await ImageManager.saveToGallery(fullscreenImage);
        Alert.alert(result.success ? '成功' : '错误', result.message);
      }
    } catch (error) {
      Alert.alert('错误', '保存图片失败');
    }
  };

  const handleShareImage = async () => {
    try {
      let success = false;

      if (fullscreenImageId) {
        success = await ImageManager.shareImage(fullscreenImageId);
      } else if (fullscreenImage) {
        success = await ImageManager.shareImage(fullscreenImage);
      }

      if (!success) {
        Alert.alert('错误', '分享功能不可用');
      }
    } catch (error) {
      Alert.alert('错误', '分享图片失败');
    }
  };

  // Update the renderVisualNovelDialog function to include the VisualNovelImageDisplay component
  const renderVisualNovelDialog = () => {
    const lastMessage = messages.length > 0
      ? messages[messages.length - 1]
      : null;
    if (!lastMessage || !selectedCharacter) return null;

    // Check if there are generated images to display
    const hasGeneratedImages = generatedImages && generatedImages.length > 0;
    const shouldUseAbsolute = !vnExpanded && hasGeneratedImages;

    // Modify the collapsedStackStyle to account for keyboard
    const collapsedStackStyle = shouldUseAbsolute
      ? {
          position: 'absolute' as const,
          left: 0,
          right: 0,
          top: getCollapsedAbsTop(),
          bottom: keyboardVisible ? keyboardHeight : 0, // Adjust bottom based on keyboard
          zIndex: 1,
          flexDirection: 'column' as const,
          alignItems: 'stretch' as const,
          justifyContent: 'flex-end' as const,
          pointerEvents: 'box-none' as const,
        }
      : [
          styles.visualNovelDialogStack,
          keyboardVisible && { bottom: keyboardHeight } // Add bottom adjustment when keyboard is visible
        ];

    const showUserMessage =
      lastMessage.sender === 'user' ||
      (lastMessage.sender === 'bot' && lastMessage.isLoading && messages.length >= 2 && messages[messages.length - 2].sender === 'user');

    let displayName, displayAvatar, displayText;
    if (showUserMessage) {
      const userMsg = lastMessage.sender === 'user'
        ? lastMessage
        : messages[messages.length - 2];
      displayName = selectedCharacter?.customUserName;
      displayAvatar = user?.avatar ? { uri: String(user.avatar) } : require('@/assets/images/default-avatar.png');
      displayText = userMsg?.text || '';
    } else {
      displayName = selectedCharacter.name;
      displayAvatar = selectedCharacter.avatar ? { uri: String(selectedCharacter.avatar) } : require('@/assets/images/default-avatar.png');
      displayText = lastMessage.text;
    }

    const aiIndex = lastMessage.metadata?.aiIndex !== undefined
      ? lastMessage.metadata.aiIndex
      : messages.filter(m => m.sender === 'bot' && !m.isLoading).length - 1;

    const isUser = showUserMessage;
    const isRegenerating = regeneratingMessageId === lastMessage.id;

    // Enhance shouldRenderAsWebView judgment
    const shouldRenderAsWebView = !isUser && !lastMessage.isLoading && (
      isWebViewContent(displayText) || 
      displayText.match(/```(?:html)?\s*<!DOCTYPE\s+html[\s\S]*?```/i) ||
      displayText.match(/```(?:html)?\s*<html[\s\S]*?```/i)
    );

    // Check if first_mes
    let isFirstMes = false;
    if (lastMessage.metadata?.isFirstMes) {
      isFirstMes = true;
    } else if (
      selectedCharacter &&
      selectedCharacter.jsonData
    ) {
      try {
        const characterData = JSON.parse(selectedCharacter.jsonData);
        if (
          characterData.roleCard?.first_mes &&
          lastMessage.text === characterData.roleCard.first_mes
        ) {
          isFirstMes = true;
        }
      } catch (e) {
        // ignore
      }
    }

    // 新增：定义 generatedImages 区域高度
     const VN_IMAGE_AREA_HEIGHT = hasGeneratedImages ? 220 : 0;

    // 关键：收起且无图片时吸底，否则普通布局
    const vnContainerStyle = vnExpanded
      ? [
          styles.visualNovelContainer,
          styles.visualNovelContainerExpanded,
          { backgroundColor: getVnBgColor() },
          keyboardVisible && { bottom: keyboardHeight } // Add when keyboard is visible
        ]
      : [
          styles.visualNovelContainer,
          !hasGeneratedImages
            ? [
                styles.visualNovelContainerCollapsedAbs, 
                { top: getCollapsedAbsTop() }
              ]
            : styles.visualNovelContainerCollapsed,
          {
            backgroundColor: getVnBgColor(),
            maxHeight: height - 10 - VN_IMAGE_AREA_HEIGHT - 16 - (keyboardVisible ? keyboardHeight : 0),
            minHeight: Math.min(200, height - (keyboardVisible ? keyboardHeight + 50 : 50)),
            marginTop: hasGeneratedImages ? 8 : 0,
          }
        ];
    // --- 关键修改结束 ---

    return (
    // 关键：收起且有图片时整体绝对定位
    <View style={shouldUseAbsolute ? collapsedStackStyle : styles.visualNovelDialogStack}>
      {hasGeneratedImages && !vnExpanded && (
        <Animated.View 
          entering={FadeIn.duration(400)} 
          style={styles.vnImageDisplayOuter}
        >
          <VisualNovelImageDisplay
            images={generatedImages}
            onOpenFullscreen={handleOpenFullscreenImage}
            onSave={handleSaveGeneratedImage}
            onShare={handleShareGeneratedImage}
            onDelete={handleDeleteGeneratedImage}
          />
        </Animated.View>
      )}

      {/* 关键：这里用 vnContainerStyle */}
      <Animated.View 
        entering={FadeIn.duration(350)}
        style={vnContainerStyle}
      >
        {/* Rest of the existing visual novel dialog code... */}
        
        {/* Right top: background transparency button */}
        <View style={styles.visualNovelAlphaButtonFixed}>
          <TouchableOpacity
            ref={ref => { alphaBtnRef.current = ref }}
            style={[
              styles.visualNovelHeaderButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent' }
            ]}
            onLayout={e => setAlphaBtnLayout(e.nativeEvent.layout)}
            onPress={() => setShowAlphaSlider(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="color-filter-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Left bottom: expand/collapse button */}
        <View style={styles.visualNovelExpandButtonFixed}>
          <TouchableOpacity
            style={[
              styles.visualNovelHeaderButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent' }
            ]}
            onPress={() => setVnExpanded(v => !v)}
          >
            <Ionicons name={vnExpanded ? "chevron-down" : "chevron-up"} size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* History button still in top right, avoid overlap, place inside top */}
        <View style={styles.visualNovelHistoryButtonFixed}>
          <TouchableOpacity
            style={[
              styles.visualNovelHeaderButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent' }
            ]}
            onPress={() => setHistoryModalVisible && setHistoryModalVisible(true)}
          >
            <Ionicons name="time-outline" size={BUTTON_ICON_SIZE} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Transparency adjustment pad, absolute position to the right of transparency button */}
        {showAlphaSlider && (
          <View
            style={[
              styles.visualNovelAlphaSliderContainer,
              {
                top: alphaBtnLayout.y,
                left: alphaBtnLayout.x + alphaBtnLayout.width + 8,
                right: undefined,
                maxWidth: width - (alphaBtnLayout.x + alphaBtnLayout.width + 24),
              }
            ]}
          >
            <Text style={styles.visualNovelAlphaLabel}>背景透明度: {(vnBgAlpha * 100).toFixed(0)}%</Text>
            <Slider
              style={{ width: 140, height: 32 }}
              minimumValue={0.2}
              maximumValue={1}
              step={0.01}
              value={vnBgAlpha}
              minimumTrackTintColor="#FFD580"
              maximumTrackTintColor="#888"
              thumbTintColor="#FFD580"
              onValueChange={handleAlphaChange}
            />
          </View>
        )}
        {/* Don't show avatar and name when expanded */}
        {!vnExpanded && (
          <View style={styles.visualNovelHeader}>
            <Image
              source={displayAvatar}
              style={styles.visualNovelAvatar}
            />
            <Text style={[
              styles.visualNovelCharacterName,
              { color: visualNovelSettings.textColor }
            ]}>
              {displayName}
            </Text>
          </View>
        )}
          
        {/* WebView content replaces ScrollView when appropriate */}
        {shouldRenderAsWebView ? (
          <View style={[
            styles.visualNovelWebViewContainer,
            { 
              height: getVNTextMaxHeight(),
              marginTop: vnExpanded ? 8 : 0,
            }
          ]}>
            <WebView
              style={[styles.visualNovelWebView, { width: '100%', height: '100%' }]} // 修改这里
              originWhitelist={['*']}
              source={{ 
                html: enhanceHtmlWithMarkdown(extractHtmlFromCodeBlock(displayText)) // Use enhanced processing function
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={false}
              injectedJavaScript={`
                // Make content fit mobile viewport
                document.querySelector('meta[name="viewport"]')?.remove();
                var meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
                document.getElementsByTagName('head')[0].appendChild(meta);
                true;
              `}
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.webViewLoadingText}>加载中...</Text>
                </View>
              )}
            />
          </View>
        ) : vnExpanded ? (
          // 展开模式：使用 ScrollView 包装文本内容
          <ScrollView
            style={[
              styles.visualNovelTextContainer,
              {
                maxHeight: getVNTextMaxHeight(),
                marginBottom: 0,
                marginTop: 8,
              }
            ]}
            contentContainerStyle={{ 
              flexGrow: 1,
              paddingBottom: 20, // 底部留出一些空间
            }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <View style={styles.visualNovelTextWrapper}>
              {containsComplexHtml(displayText) || /<\/?[a-z][^>]*>/i.test(displayText) ? (
                <RichTextRenderer 
                  html={optimizeHtmlForRendering(stripUnknownTags(displayText))}
                  baseStyle={{ 
                    color: visualNovelSettings.textColor,
                    fontFamily: visualNovelSettings.fontFamily,
                    fontSize: 16,
                    lineHeight: 22
                  }}
                  onImagePress={(url) => setFullscreenImage(url)}
                  maxImageHeight={MAX_IMAGE_HEIGHT}
                />
              ) : (
                <Text style={[
                  styles.visualNovelText,
                  { 
                    fontFamily: visualNovelSettings.fontFamily, 
                    color: visualNovelSettings.textColor 
                  }
                ]}>
                  {displayText}
                </Text>
              )}
            </View>
          </ScrollView>
        ) : (
          // 收起模式：保持原有的 ScrollView（无变化）
          <ScrollView
            style={[
              styles.visualNovelTextContainer,
              {
                maxHeight: getVNTextMaxHeight(),
                marginBottom: 0,
                marginTop: 0,
              }
            ]}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={styles.visualNovelTextWrapper}>
              {containsComplexHtml(displayText) || /<\/?[a-z][^>]*>/i.test(displayText) ? (
                <RichTextRenderer 
                  html={optimizeHtmlForRendering(stripUnknownTags(displayText))}
                  baseStyle={{ 
                    color: visualNovelSettings.textColor,
                    fontFamily: visualNovelSettings.fontFamily,
                    fontSize: 16,
                    lineHeight: 22
                  }}
                  onImagePress={(url) => setFullscreenImage(url)}
                  maxImageHeight={MAX_IMAGE_HEIGHT}
                />
              ) : (
                <Text style={[
                  styles.visualNovelText,
                  { 
                    fontFamily: visualNovelSettings.fontFamily, 
                    color: visualNovelSettings.textColor 
                  }
                ]}>
                  {displayText}
                </Text>
              )}
            </View>
          </ScrollView>
        )}
        
        <View style={styles.visualNovelActions}>
          {/* Volume button */}
          {!isUser && !lastMessage.isLoading && (
            <>
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginRight: BUTTON_MARGIN }
                ]}
                onPress={() => renderTTSButtons(lastMessage)?.props?.onPress?.()}
                disabled={renderTTSButtons(lastMessage)?.props?.disabled}
              >
                <Ionicons
                  name="volume-high"
                  size={BUTTON_ICON_SIZE}
                  color="#fff"
                />
              </TouchableOpacity>
            </>
          )}
          {/* 复制按钮 - 对所有消息都显示 */}
          <TouchableOpacity
            style={[
              styles.actionCircleButton,
              { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginRight: BUTTON_MARGIN }
            ]}
            onPress={() => copyMessageText(displayText)}
          >
            <Ionicons
              name="copy-outline"
              size={BUTTON_ICON_SIZE}
              color="#fff"
            />
          </TouchableOpacity>
          {/* Left of volume button: regenerate, edit, delete buttons (AI messages only, non-first_mes), show regardless of expanded or collapsed */}
          {!isUser && !lastMessage.isLoading && !isFirstMes && (
            <View style={styles.visualNovelActionRow}>
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
                ]}
                onPress={() => {
                  handleEditButton(lastMessage, aiIndex, false);
                }}
                disabled={!!regeneratingMessageId}
              >
                <Ionicons name="create-outline" size={BUTTON_ICON_SIZE} color={regeneratingMessageId ? "#999999" : "#f1c40f"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
                ]}
                onPress={() => {
                  Alert.alert(
                    '删除AI消息',
                    '确定要删除该AI消息及其对应的用户消息吗？',
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '删除',
                        style: 'destructive',
                        onPress: () => {
                          if (onDeleteAiMessage) onDeleteAiMessage(lastMessage.id, aiIndex);
                        }
                      }
                    ]
                  );
                }}
                disabled={!!regeneratingMessageId}
              >
                <Ionicons name="trash-outline" size={BUTTON_ICON_SIZE} color={regeneratingMessageId ? "#999999" : "#e74c3c"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  isRegenerating && styles.actionCircleButtonActive,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
                ]}
                disabled={isRegenerating || !!regeneratingMessageId}
                onPress={() => onRegenerateMessage && onRegenerateMessage(lastMessage.id, aiIndex)}
              >

                {isRegenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={BUTTON_ICON_SIZE}
                    color={regeneratingMessageId ? "#999999" : "#3498db"}
                  />
                )}
              </TouchableOpacity>
              {/* Add: log jump button in visual novel mode */}
              <TouchableOpacity
                style={[
                  styles.actionCircleButton,
                  { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
                ]}
                onPress={() => router.push('/pages/log')}
                accessibilityLabel="查看请求日志"
              >
                <Ionicons name="document-text-outline" size={BUTTON_ICON_SIZE} color="#4a6fa5" />
              </TouchableOpacity>
            </View>
          )}
          {/* Also show log button for non-AI messages (like user messages) */}
          {((isUser || lastMessage.isLoading) && (
            <TouchableOpacity
              style={[
                styles.actionCircleButton,
                { width: BUTTON_SIZE, height: BUTTON_SIZE, backgroundColor: 'transparent', marginLeft: 8 }
              ]}
              onPress={() => router.push('/pages/log')}
              accessibilityLabel="查看请求日志"
            >
              <Ionicons name="document-text-outline" size={BUTTON_ICON_SIZE} color="#4a6fa5" />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

  // Previous image handling functions have been consolidated

  // 添加辅助函数来判断是否显示时间组
  const shouldShowTimeGroup = (item: Message, index: number) => {
    // 不显示刚发送的用户消息的时间
    if (item.sender === 'user' && item.isLoading === true) return false;
    return index === 0 || index % 5 === 0 ||
      (index > 0 && new Date(item.timestamp || 0).getHours() !==
        new Date(visibleMessages[index - 1]?.timestamp || 0).getHours());
  };

  // 渲染消息项
  const renderItem = useCallback(({ item, index }: { item: CombinedItem; index: number }) => {
    if (item.type === 'message' && item.message) {
      const message = item.message;
      const isUser = message.sender === 'user';
      // 判断是否为最后一条消息且等待AI回复
      const isLastUser = isUser && index === combinedItems.length - 1 && isWaitingForAI;

      // 只对最后一条消息做 entering 动画，其余不做
      const enteringAnimation = (index === combinedItems.length - 1)
        ? FadeIn.duration(300)
        : undefined;
      
      // 计算是否显示时间组
      const showTimeGroup = index === 0 || 
        (index > 0 && 
         (combinedItems[index - 1].timestamp === undefined || 
          new Date(item.timestamp).getHours() !== new Date(combinedItems[index - 1].timestamp).getHours()));

      return (
        <View style={styles.messageWrapper}>
          <View style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.botMessageContainer,
          ]}>
            {renderMessageContent(message, isUser, index)}
            {/* 最后一条用户消息右侧显示 loading indicator */}
            {isLastUser && (
              <View style={{ justifyContent: 'center', marginRight: 8 ,marginTop: 2 }}>
                <ActivityIndicator size="small" color="#bbb" />
              </View>
            )}
          </View>
        </View>
      );
    }
    
    // 默认返回空视图
    return null;
  }, [
    messages, 
    regeneratingMessageId, 
    audioStates, 
    ratedMessages, 
    isWaitingForAI,
    combinedItems,
    renderTimeGroup,
    renderMessageContent
  ]);
// 修改 keyExtractor，避免用 Math.random
const keyExtractor = useCallback((item: CombinedItem) => {
  if (item.type === 'image' && item.image) {
    return `image-${item.image.id}`;
  } else if (item.type === 'message' && item.message) {
    return `message-${item.message.id}`;
  }
  // fallback
  return String(item.id || '');
}, []);

  // FlatList onScroll 监听顶部
  const handleFlatListScroll = useCallback((event: any) => {
    if (event.nativeEvent.contentOffset.y <= 0 && hasMore && !loadingMore) {
      // 滚动到顶部，触发加载更多
      if (onLoadMore) onLoadMore();
    }
    handleScroll(event); // 保持原有滚动处理
  }, [onLoadMore, hasMore, loadingMore, handleScroll]);

  // Add keyboard state tracking
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // 新增：复制消息文本功能
  const copyMessageText = useCallback(async (text: string) => {
    try {
      // 移除HTML标签和特殊标记，保留纯文本
      let cleanText = text
        .replace(/<[^>]*>/g, '') // 移除HTML标签
        .replace(/!\[(.*?)\]\([^)]+\)/g, '$1') // 移除图片markdown，保留alt文本
        .replace(/\[(.*?)\]\([^)]+\)/g, '$1') // 移除链接markdown，保留链接文本
        .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
        .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
        .replace(/`([^`]+)`/g, '$1') // 移除行内代码标记
        .replace(/```[\s\S]*?```/g, '[代码块]') // 替换代码块为标识
        .trim();
      
      await Clipboard.setStringAsync(cleanText);
      // 简单的成功提示
      Alert.alert('复制成功', '消息文本已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      Alert.alert('复制失败', '无法复制消息文本');
    }
  }, []);
  
  // Add keyboard event listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  return (
    <>
      {mode === 'visual-novel' ? (
        <>
          <View style={[styles.container, style, styles.backgroundFocusContainer]} />
          {renderVisualNovelDialog()}
          {/* 历史消息 Modal */}
          <ChatHistoryModal
            visible={!!isHistoryModalVisible}
            messages={messages}
            onClose={() => setHistoryModalVisible && setHistoryModalVisible(false)}
            selectedCharacter={selectedCharacter}
            user={user}
          />
        </>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            {visibleMessages.length === 0 ? (
              <ScrollView
                style={[
                  styles.container, 
                  style,
                  mode === 'background-focus' && styles.backgroundFocusContainer
                ]}
                contentContainerStyle={[
                  styles.emptyContent,
                  mode === 'background-focus' && styles.backgroundFocusPadding
                ]}
              >
                {renderEmptyState()}
              </ScrollView>
            ) : (
              <>
                {/* Render carousel in background-focus mode in the top half */}
                {mode === 'background-focus' && generatedImages.length > 0 && (
                  <View style={[
                    styles.backgroundFocusImagesContainer,
                    { 
                      // Calculate top padding based on safe area insets and TopBar visibility
                      paddingTop: isTopBarVisible 
                        ? insets.top + 10 // TopBar visible: use safe area inset + small buffer
                        : Math.max(StatusBar.currentHeight || 0, 10) // TopBar hidden: use status bar height or minimal padding
                    }
                  ]}>
                    <ImagesCarousel
                      images={generatedImages}
                      onOpenFullscreen={handleOpenFullscreenImage}
                      onSave={handleSaveGeneratedImage}
                      onShare={handleShareGeneratedImage}
                      onDelete={handleDeleteGeneratedImage}
                      mode={mode}
                    />
                  </View>
                )}
                
                <FlatList
                  ref={flatListRef}
                  data={combinedItems}
                  renderItem={renderItem}
                  keyExtractor={keyExtractor}
                  style={[
                    styles.container, 
                    style,
                    mode === 'background-focus' && styles.backgroundFocusContainer
                  ]}
                  contentContainerStyle={[
                    styles.content,
                    mode === 'background-focus' && styles.backgroundFocusPadding
                  ]}
                  onScroll={handleFlatListScroll}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={true}
                  ListHeaderComponent={
                    <>
                      {/* Show carousel in normal mode at the top of the list */}
                      {mode === 'normal' && generatedImages.length > 0 && (
                        <ImagesCarousel
                          images={generatedImages}
                          onOpenFullscreen={handleOpenFullscreenImage}
                          onSave={handleSaveGeneratedImage}
                          onShare={handleShareGeneratedImage}
                          onDelete={handleDeleteGeneratedImage}
                          mode={mode}
                        />
                      )}
                      {hasMore && loadingMore ? (
                        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text style={{ color: '#fff', marginTop: 4, fontSize: 13 }}>加载更多消息...</Text>
                        </View>
                      ) : hasMore ? (
                        <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                          <Text style={{ color: '#bbb', fontSize: 12 }}>上滑加载更多</Text>
                        </View>
                      ) : null}
                    </>
                  }
                  ListFooterComponent={() => <View style={styles.endSpacer} />}
                  initialNumToRender={20}
                  maxToRenderPerBatch={10}
                  windowSize={21}
                  removeClippedSubviews={Platform.OS !== 'web'}
                  automaticallyAdjustContentInsets={false}
                  keyboardShouldPersistTaps="handled"
                />
              </>
            )}
          </View>
          {/* 历史消息 Modal */}
          <ChatHistoryModal
            visible={!!isHistoryModalVisible}
            messages={messages}
            onClose={() => setHistoryModalVisible && setHistoryModalVisible(false)}
            selectedCharacter={selectedCharacter}
            user={user}
          />
        </>
      )}
      
      <Modal
        visible={!!fullscreenImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setFullscreenImage(null);
          setFullscreenImageId(null);
        }}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity 
            style={styles.fullscreenCloseButton}
            onPress={() => {
              setFullscreenImage(null);
              setFullscreenImageId(null);
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          {imageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.imageLoadingText}>加载原始图片...</Text>
            </View>
          )}
          
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
                   )}
          
          <View style={styles.imageActionButtons}>
            <TouchableOpacity
              style={styles.imageActionButton}
              onPress={handleSaveImage}
            >
              <Ionicons name="download" size={24} color="#fff" />
              <Text style={styles.imageActionButtonText}>保存</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.imageActionButton}
              onPress={handleShareImage}
            >
              <Ionicons name="share" size={24} color="#fff" />
              <Text style={styles.imageActionButtonText}>分享</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TextEditorModal
        isVisible={editModalVisible}
        initialText={editModalText}
        title="编辑消息内容"
        placeholder="请输入新的消息内容"
        onClose={() => setEditModalVisible(false)}
        onSave={(newText) => {
          if (!newText.trim()) {
            Alert.alert('内容不能为空');
            return;
          }
          if (editTargetMsgId && editTargetAiIndex >= 0) {
            // 判断当前编辑的是AI消息还是用户消息
            const editingMsg = messages.find(m => m.id === editTargetMsgId);
            if (editingMsg?.sender === 'bot') {
              if (onEditAiMessage) onEditAiMessage(editTargetMsgId, editTargetAiIndex, newText);
            } else if (editingMsg?.sender === 'user') {
              if (onEditUserMessage) onEditUserMessage(editTargetMsgId, editTargetAiIndex, newText);
            }
            setEditModalVisible(false);
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingVertical: RESPONSIVE_PADDING + 8,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  messagesContainer: {
    paddingHorizontal: 12,
  },
  messageWrapper: {
    marginBottom: Math.max(12, height * 0.02),
    width: '100%',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    paddingRight: RESPONSIVE_PADDING,
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
    paddingLeft: RESPONSIVE_PADDING,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#444',
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '100%',
    minHeight: 40,
    marginHorizontal: RESPONSIVE_PADDING,
    alignSelf: 'center',
    position: 'relative',
  },
  userMessageContent: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botMessageContent: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  userMessageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    position: 'relative',
    minHeight: 40,
  },
  userMessageActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginRight: 4,
  },
  userGradient: {
    padding: RESPONSIVE_PADDING + 4,
    paddingHorizontal: RESPONSIVE_PADDING + 8,
  },
  userMessageText: {
    color: '#333',
    fontSize: Math.min(Math.max(14, width * 0.04), 16),
  },
  botMessageTextContainer: {
    backgroundColor: 'rgba(68, 68, 68, 0.85)',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: RESPONSIVE_PADDING + 4,
    paddingHorizontal: RESPONSIVE_PADDING + 8,
    width: '100%',
    paddingTop: RESPONSIVE_PADDING + 12,
    paddingBottom: RESPONSIVE_PADDING + 4, // Reduce bottom padding
    maxWidth: '98%',
    marginTop: AVATAR_SIZE / 2,
  },
  botMessageText: {
    color: '#fff',
    fontSize: Math.min(Math.max(14, width * 0.04), 16),
 
  },
  loadingMessage: {
    minWidth: 80,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 24,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#bbb',
    marginHorizontal: 2,
    opacity: 0.7,
  },
  timeGroup: {
    alignItems: 'center',
    marginVertical: RESPONSIVE_PADDING,
  },
  timeText: {
    color: '#ddd',
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: '#bbb',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  endSpacer: {
    height: 40,
  },
  imageWrapper: {
    marginVertical: 8,
    alignItems: 'center',
  },
  messageImage: {
    width: '100%',
    height: 200,
    maxHeight: MAX_IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 42, 42, 0.5)',
  },
  imageCaption: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
    textAlign: 'center',
  },
  imageDataUrlWarning: {
    backgroundColor: 'rgba(51, 51, 51, 0.8)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  imageDataUrlWarningText: {
    color: '#ddd',
    fontSize: 14,
    marginTop: 8,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkIcon: {
    marginRight: 8,
  },
  linkText: {
    color: '#3498db',
    textDecorationLine: 'underline',
    fontSize: 16,
  },
  richContentWrapper: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 4,
    marginBottom: 5,
  },
  memoryIndicatorContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  memoryIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryTooltip: {
    position: 'absolute',
    top: 25,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    width: 150,
    zIndex: 100,
  },
  memoryTooltipText: {
    color: 'white',
    fontSize: 12,
  },
  imageError: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 20,
    borderRadius: 8,
    marginVertical: 8,
  },
  imageErrorText: {
    color: '#e74c3c',
    marginTop: 8,
    textAlign: 'center',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  imageLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  imageActionButtons: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  imageActionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageActionButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  backgroundFocusContainer: {
    position: 'absolute',
    top: '50%', // Start from 50% down
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '50%',
    zIndex: 1, // Ensure messages are below the images
  },
  backgroundFocusPadding: {
    paddingTop: 20,
  },
  visualNovelHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    zIndex: 20,
  },
  visualNovelHeaderLeftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  visualNovelHeaderButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: BUTTON_SIZE / 2,
    padding: 0,
    margin: 0,
  },
  visualNovelExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  visualNovelExpandText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  visualNovelAlphaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visualNovelAlphaSliderContainer: {
    position: 'absolute',
    zIndex: 99,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: 180,
  },
  visualNovelAlphaLabel: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 6,
  },
  visualNovelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  visualNovelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  visualNovelCharacterName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  visualNovelTextContainer: {
    minHeight: 60,
    marginBottom: 8,
  },
  visualNovelTextWrapper: {
    marginBottom: 8,
  },
  visualNovelText: {
    fontSize: 16,
    lineHeight: 22,
  },
  visualNovelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
  },
  visualNovelActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  visualNovelActionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  visualNovelRateButtons: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  visualNovelRateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  visualNovelRateButtonActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  visualNovelTTSContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto',
  },
  visualNovelTTSButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  visualNovelTTSButtonWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visualNovelTTSButtonActive: {
    backgroundColor: '#FFD580',
  },
  visualNovelTTSButtonEnhanced: {
    backgroundColor: '#FFD580',
  },
  visualNovelTTSEnhancerIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  historyModalContent: {
    flex: 1,
    padding: 16,
  },
  historyMessageContainer: {
    marginBottom: 16,
  },
  historyTimeText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  historyMessage: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
    fontSize: 16,
  },
  historyUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 224, 195, 0.85)',
  },
  historyBotMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(68, 68, 68, 0.85)',
  },
  historyUserMessageText: {
    color: '#333',
  },
  historyMessageText: {
    fontSize: 16,
  },
  historyBotMessageText: {
    color: '#fff',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageContainer: {
    width: '100%',
  },
  regeneratingButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.6)',
    width: 36,
    height: 36,
  },
  visualNovelRegeneratingButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.6)',
  },
  messageAvatar: {
    position: 'absolute',
    left: 10,
    top: -15,
    zIndex: 2,
    backgroundColor: '#444',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  userMessageAvatar: {
    position: 'absolute',
    right: -15,
    top: -15,
    zIndex: 2,
    backgroundColor: '#444',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  visualNovelTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 20,
    gap: 12,
  },
  visualNovelWebViewContainer: {
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
 },
  visualNovelWebView: {
    flex: 1,
    backgroundColor: 'transparent',
      width: '100%',   
    height: '100%',   
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  webViewLoadingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 14,
  },
    // Add or update code block related styles
  codeBlock: {
    backgroundColor: '#111',
    padding: 10,
    borderRadius: 6,
    marginVertical: 8,
    width: '100%',
  },
  codeText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  visualNovelAlphaButtonFixed: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 30,
  },
  visualNovelExpandButtonFixed: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    zIndex: 30,
  },
  visualNovelHistoryButtonFixed: {
    position: 'absolute',
    top: 10,
    right: 60,
    zIndex: 30,
  },
    messageActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: BUTTON_MARGIN,
    width: '100%',
    minHeight: BUTTON_SIZE,
  },
  messageActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  messageActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  actionCircleButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 4,
  },
  actionCircleButtonActive: {
    backgroundColor: 'rgba(255,224,195,0.85)',
  },
  // Image message styles
  imageGroupContainer: {
    marginVertical: 10,
    width: '100%',
  },
  imageMessageContainer: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageMessageHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageMessageHeaderExpanded: {
    paddingVertical: 12,
  },
  imageMessageHeaderCollapsed: {
    paddingVertical: 6,
  },
  imageMessagePromptContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageMessagePrompt: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  imageMessagePromptCollapsed: {
    color: '#ddd',
    fontSize: 12,
    flex: 1,
  },
  imageMessageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  imageMessageTime: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 8,
  },
  imageMessageContent: {
    width: '100%',
    height: 300,
    backgroundColor: '#111',
  },
  imageMessageContentSmaller: {
    height: 250,
  },
  imageMessageContentLarger: {
    height: 320,
  },
  imageMessageImage: {
    width: '100%',
    height: '100%',
  },
  imageMessageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  imageMessageAction: {
    padding: 8,
    marginHorizontal: 4,
  },
  imageMessageLoading: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  imageMessageLoadingText: {
    color: '#fff',
    marginTop: 12,
  },
  imageMessageError: {
    width: '100%',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  imageMessageErrorText: {
    color: '#e74c3c',
    marginTop: 8,
  },
  loadingMoreContainer: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingMoreText: {
    color: '#888',
    marginLeft: 8,
  },
  loadMoreButton: {
    padding: 12,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
    marginHorizontal: 16,
  },
  loadMoreButtonText: {
    color: '#ddd',
  },
  deleteConfirmModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteConfirmModalContent: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
  },
  deleteConfirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff',
  },
  deleteConfirmText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#ddd',
    textAlign: 'center',
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  deleteConfirmButton: {
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    flex: 1,
    alignItems: 'center',
  },
  deleteConfirmCancelButton: {
    backgroundColor: '#555',
  },
  deleteConfirmDeleteButton: {
    backgroundColor: '#e74c3c',
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  vnImageDisplayContainer: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  vnImageDisplayHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  vnImageDisplayHeaderExpanded: {
    paddingVertical: 12,
  },
  vnImageDisplayHeaderCollapsed: {
    paddingVertical: 6,
  },
  vnImageDisplayPromptContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vnImageDisplayPrompt: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  vnImageDisplayPromptCollapsed: {
    color: '#ddd',
    fontSize: 12,
    flex: 1,
  },
  vnImageDisplayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  vnImageDisplayTime: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 8,
  },
  vnImageDisplayContent: {
    width: '100%',
    height: 300,
    backgroundColor: '#111',
  },
  vnImageDisplayContentSmaller: {
    height: 250,
  },
  vnImageDisplayContentLarger: {
    height: 320,
  },
  vnImageDisplayImage: {
    width: '100%',
    height: '100%',
  },
  vnImageDisplayActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
    vnImageDisplayAction: {
     padding: 8,
     marginHorizontal: 4,
   },
   vnImageDisplayActionButton: {
     padding: 8,
     marginHorizontal: 4,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     borderRadius: 20,
     width: 40,
     height: 40,
     justifyContent: 'center',
     alignItems: 'center',
   },
   vnImageDisplayLoading: {
     width: '100%',
     height: 200,
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: '#222',
   },
   vnImageDisplayLoadingText: {
     color: '#fff',
     marginTop: 12,
   },
   vnImageDisplayError: {
     width: '100%',
     height: 150,
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: '#222',
   },
   vnImageDisplayErrorText: {
     color: '#e74c3c',
     marginTop: 8,
   },
   vnImageDisplayPagination: {
     flexDirection: 'row',
     alignItems: 'center',
     marginRight: 8,
   },
   vnImageDisplayPaginationButton: {
     padding: 4,
     borderRadius: 4,
     marginHorizontal: 2,
   },
   vnImageDisplayPaginationButtonDisabled: {
     backgroundColor: '#666',
   },
   vnImageDisplayPaginationText: {
     color: '#fff',
     fontSize: 12,
     marginHorizontal: 4,
   },
   vnImageDisplayActionButtons: {
     flexDirection: 'row',
     alignItems: 'center',
     marginLeft: 8,
   },
   // 添加新样式
   botMessageActionsContainer: {
     marginTop: 8, // Add top margin for separation
     padding: 6, // Add padding
     borderTopWidth: 1, // Add top border
     borderTopColor: 'rgba(255, 255, 255, 0.1)', // Light border color
     flexDirection: 'row',
     justifyContent: 'flex-end',
     alignItems: 'center',
   },
     visualNovelDialogStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0, // This will be adjusted when keyboard is visible
    zIndex: 1, // Keep only this zIndex
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  vnImageDisplayOuter: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 0,
    zIndex: 12,
  },
  visualNovelContainer: {
    // 公共部分
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  visualNovelContainerExpanded: {
    // 展开时绝对定位铺满
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    margin: 0,
    borderRadius: 0,
    zIndex: 20,
  },
  visualNovelContainerCollapsed: {
    // 收起时普通布局（有图片时）
    position: 'relative',
    borderRadius: 16,
    marginTop: 0,
    zIndex: 10,
  },
  visualNovelContainerCollapsedAbs: {
    // 收起且无图片时吸底
    position: 'absolute',
    left: 0,
    right: 0,
    // top 将通过内联样式动态设置
    bottom: 0,
    marginBottom: 0,
    borderRadius: 16,
    zIndex: 1, // 保证低于 ChatInput
  },
  // 新增：用户消息相关样式
  userMessageBubbleContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flex: 1,
  },
  // ImagesCarousel styles
  imagesCarouselContainer: {
    marginVertical: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  imagesCarouselBackgroundFocus: {
    marginTop: 20,
    height: '90%', // Use most of the available space in background-focus mode
    maxHeight: height * 0.42, // Limit maximum height
  },

  backgroundFocusImagesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%', // Use slightly higher percentage to ensure pagination controls are visible
    zIndex: 20, // Higher z-index to ensure it's above the message list
    justifyContent: 'center',
    // Base padding removed - will be set dynamically in the component
  },
  imagesCarouselHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  imagesCarouselHeaderExpanded: {
    paddingVertical: 12,
  },
  imagesCarouselHeaderCollapsed: {
    paddingVertical: 6,
  },
  imagesCarouselPromptContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imagesCarouselPrompt: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  imagesCarouselPromptCollapsed: {
    color: '#ddd',
    fontSize: 12,
    flex: 1,
  },
  imagesCarouselHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  imagesCarouselTime: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 8,
  },
  imagesCarouselContent: {
    width: '100%',
    height: 240,
    backgroundColor: '#111',
  },
  // 确保在背景强调模式下，内容区域足够高以显示完整图片
  imagesCarouselContentBackgroundFocus: {
    height: '70%',
  },
  imagesCarouselImage: {
    width: '100%',
    height: '100%',
  },
  imagesCarouselControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  imagesCarouselPagination: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imagesCarouselPaginationButtonDisabled: {
    opacity: 0.5,
  },
  imagesCarouselPaginationText: {
    color: '#fff',
    fontSize: 12,
    marginHorizontal: 8,
  },
  imagesCarouselActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imagesCarouselLoading: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  imagesCarouselLoadingText: {
    color: '#fff',
    marginTop: 12,
  },
  imagesCarouselError: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  imagesCarouselErrorText: {
    color: '#e74c3c',
    marginTop: 8,
  },
});
export default ChatDialog;