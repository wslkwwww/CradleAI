import { StyleProp, TextStyle } from 'react-native';

type TextSegment = {
  text: string;
  style: StyleProp<TextStyle>;
};

// Simple HTML parsing for basic styling in messages
export const parseHtmlText = (text: string): TextSegment[] => {
  if (!text) return [{ text: '', style: {} }];

  // Handle basic tags for simple messages (not complex HTML)
  let currentText = text;
  const segments: TextSegment[] = [];

  // Replace <br> tags with newlines
  currentText = currentText.replace(/<br\s*\/?>/g, '\n');

  // Replace basic HTML tags with styled text segments
  while (currentText.length > 0) {
    let boldMatch = currentText.match(/<b>(.*?)<\/b>/);
    let italicMatch = currentText.match(/<i>(.*?)<\/i>/);
    let firstMatch = null;
    let matchStyle = {};
    let matchLength = 0;

    // Find the first occurring tag
    if (boldMatch && (!italicMatch || boldMatch.index! < italicMatch.index!)) {
      firstMatch = boldMatch;
      matchStyle = { fontWeight: 'bold' };
      matchLength = 7; // <b></b> total length
    } else if (italicMatch) {
      firstMatch = italicMatch;
      matchStyle = { fontStyle: 'italic' };
      matchLength = 7; // <i></i> total length
    }

    if (firstMatch && firstMatch.index !== undefined) {
      // Add text before the tag
      if (firstMatch.index > 0) {
        segments.push({
          text: currentText.substring(0, firstMatch.index),
          style: {},
        });
      }

      // Add the styled text
      segments.push({
        text: firstMatch[1],
        style: matchStyle,
      });

      // Update currentText to continue processing
      currentText = currentText.substring(firstMatch.index + firstMatch[0].length);
    } else {
      // No more tags, add remaining text
      segments.push({
        text: currentText,
        style: {},
      });
      break;
    }
  }

  return segments;
};

// Check if text contains complex HTML that should be rendered with the HTML renderer
export const containsComplexHtml = (text: string): boolean => {
  if (!text) return false;
  
  // Look for specific HTML patterns that would benefit from rich rendering
  const complexPatterns = [
    /<(div|p|ul|ol|li|img|a|details|summary|h[1-6]|table|pre|code|blockquote)\b/i,
    /<(b|i|span|strong|em|mark|sub|sup|del|ins)\b[^>]*style=/i,
    /<table|<tr|<td|<th/i,
    /<br\s*\/>\s*<br/i,  // Multiple line breaks
    /style\s*=\s*["'][^"']*["']/i, // Style attributes
    /class\s*=\s*["'][^"']*["']/i, // Class attributes
    // More flexible patterns for custom tags
    /<\s*(thinking|think|status|mem|websearch)[^>]*>([\s\S]*?)<\/\s*(thinking|think|status|mem|websearch)\s*>/i,
    /<\s*char\s+think[^>]*>([\s\S]*?)<\/\s*char\s+think\s*>/i,
    /```[\w]*\n[\s\S]*?```/,  // Markdown code blocks
    /\*\*([\s\S]*?)\*\*/,  // Bold markdown
    /\*[\s\S]*?\*/,      // Italic markdown
    /\[[\s\S]*?\]\([\s\S]*?\)/,  // Markdown links
    /!\[[\s\S]*?\]\((https?:\/\/[\s\S]*?|data:image\/[\s\S]*?)\)/,  // Regular Markdown images with http or data URLs
    /!\[[\s\S]*?\]\(image:[\s\S]*?\)/,  // Custom image:id format
  ];
  
  return complexPatterns.some(pattern => pattern.test(text));
};

// Check if text contains custom tags like <details> and <summary>
export const containsCustomTags = (text: string): boolean => {
  if (!text) return false;
  
  const customTags = [
    /<details/i,
    /<summary/i,
    /<section/i,
    /<article/i,
    /<aside/i,
    /<figure/i,
    /<figcaption/i,
    /<mem/i,            // Add new custom tags
    /<websearch/i,      // Add new custom tags
  ];
  
  return customTags.some(pattern => pattern.test(text));
};

// Extract code blocks to preserve them during HTML processing
export const extractCodeBlocks = (text: string): { processedText: string, codeBlocks: { language: string; content: string }[] } => {
  const codeBlocks: { language: string; content: string }[] = [];
  const codeBlockRegex = /```(\w*)\s*\n([\s\S]*?)```/g;
  
  // Replace code blocks with placeholders
  const processedText = text.replace(codeBlockRegex, (match, lang, codeContent) => {
    const language = lang || 'text';
    const placeholder = `[[CODE_BLOCK_${codeBlocks.length}]]`;
    codeBlocks.push({ language, content: codeContent.trim() });
    return placeholder;
  });
  
  return { processedText, codeBlocks };
};

// Reinsert code blocks back into the text
export const reinsertCodeBlocks = (text: string, codeBlocks: { language: string; content: string }[]): string => {
  let result = text;
  
  for (let i = 0; i < codeBlocks.length; i++) {
    const placeholder = `[[CODE_BLOCK_${i}]]`;
    const { language, content } = codeBlocks[i];
    result = result.replace(placeholder, `\`\`\`${language}\n${content}\`\`\``);
  }
  
  return result;
};

// Optimize HTML by applying simplifications before rendering
export const optimizeHtmlForRendering = (html: string): string => {
  let optimized = html;
  
  // Extract code blocks first to preserve them
  const { processedText, codeBlocks } = extractCodeBlocks(optimized);
  optimized = processedText;
  
  // Remove script tags and their contents
  optimized = optimized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their contents
  optimized = optimized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove event handlers (onClick, onLoad, etc)
  optimized = optimized.replace(/ on\w+="[^"]*"/gi, '');
  optimized = optimized.replace(/ on\w+='[^']*'/gi, '');
  
  // Replace deprecated tags
  optimized = optimized.replace(/<font([^>]*)>/gi, '<span$1>');
  optimized = optimized.replace(/<\/font>/gi, '</span>');
  
  // Normalize self-closing tags
  optimized = optimized.replace(/<(br|hr|img)([^/>]*[^/])>/gi, '<$1$2 />');
  
  // Reinsert code blocks
  optimized = reinsertCodeBlocks(optimized, codeBlocks);
  
  return optimized;
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
  
  // Add new custom tags for memory and websearch
  // Convert <mem> tags with various spacing/formatting
  processed = processed.replace(
    /<\s*mem[^>]*>([\s\S]*?)<\/\s*mem\s*>/gi, 
    '<div class="character-memory">$1</div>'
  );
  
  // Convert <websearch> tags with various spacing/formatting
  processed = processed.replace(
    /<\s*websearch[^>]*>([\s\S]*?)<\/\s*websearch\s*>/gi, 
    '<div class="websearch-result">$1</div>'
  );
    
  // Convert markdown bold to HTML
  processed = processed.replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>');
  
  // Convert markdown italic to HTML
  processed = processed.replace(/\*([\s\S]*?)\*/g, '<i>$1</i>');
  
  // Remove excessive logging
  // console.log("After preprocessing:", processed.substring(0, 100));
  
  return processed;
};
