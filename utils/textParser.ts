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
    /<\s*(thinking|think|status|mem|websearch)[^>]*>[\s\S]*?<\/\s*(thinking|think|status|mem|websearch)\s*>/i,
    /<\s*char\s+think[^>]*>[\s\S]*?<\/\s*char\s+think\s*>/i,
    /```[\w]*\n[\s\S]*?```/,  // Markdown code blocks
    /\*\*([\s\S]*?)\*\*/,  // Bold markdown
    /\*[\s\S]*?\*/,      // Italic markdown
    /\[[\s\S]*?\]\([\s\S]*?\)/,  // Markdown links
    /!\[[\s\S]*?\]\((https?:\/\/[\s\S]*?|data:image\/[\s\S]*?)\)/,  // Regular Markdown images with http or data URLs
    /!\[[\s\S]*?\]\(image:[\s\S]*?\)/,  // Custom image:id format
  ];
  
  return complexPatterns.some(pattern => pattern.test(text));
};

// Optimize HTML by applying simplifications before rendering
export const optimizeHtmlForRendering = (html: string): string => {
  if (!html) return '';
  
  // Make sure custom tags are properly formatted
  // Sometimes AI might add spaces in the tags which breaks the parser
  const optimizedHtml = html
    // Fix opening tags (removing unwanted spaces)
    .replace(/<\s*(thinking|think|status|mem|websearch|char-think)(\s+[^>]*)?>/gi, 
             (match, tag, attrs) => `<${tag}${attrs || ''}>`)
    // Fix closing tags (removing unwanted spaces)
    .replace(/<\/\s*(thinking|think|status|mem|websearch|char-think)\s*>/gi, 
             (match, tag) => `</${tag}>`)
    // Ensure proper nesting within custom tags
    .replace(/(<(mem|websearch|thinking|think|status|char-think)>)(.*?)(<\/\2>)/gis,
             (match, openTag, tagName, content, closeTag) => {
               // Make sure content starts with a block element for proper rendering
               if (!content.trim().startsWith('<')) {
                 return `${openTag}<p>${content}</p>${closeTag}`;
               }
               return match;
             });
  
  return optimizedHtml;
};

// Process custom tags before HTML parsing - keep tags intact for react-native-render-html
export const preprocessCustomTags = (html: string): string => {
  if (!html) return '';
  
  // We don't need to convert custom tags to divs anymore
  // Just ensure they're properly formatted XML
  
  // Convert markdown bold to HTML
  let processed = html.replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>');
  
  // Convert markdown italic to HTML
  processed = processed.replace(/\*([\s\S]*?)\*/g, '<i>$1</i>');
  
  return processed;
};
