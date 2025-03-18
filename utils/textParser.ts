interface TextSegment {
  text: string;
  style?: any;
}

export function parseHtmlText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentIndex = 0;

  // 增强的 HTML 标签正则表达式，支持更多标签和属性
  const tagRegex = /<(\/?)(\w+)((?:\s+[a-zA-Z0-9-]+(?:=(?:"[^"]*"|'[^']*'|[^>\s]+))?)*)\s*>(.*?)<\/\2>/gs;
  
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    // 添加标签之前的文本（如果有）
    if (match.index > currentIndex) {
      segments.push({
        text: text.slice(currentIndex, match.index)
      });
    }

    const tagName = match[2].toLowerCase();
    const attributes = match[3];
    const content = match[4];

    const style: any = {};
    
    // 处理不同类型的 HTML 标签
    switch (tagName) {
      case 'font':
        // 提取 color 属性
        const colorMatch = attributes.match(/color=["']?(#[0-9A-Fa-f]{3,8}|[a-zA-Z]+)["']?/);
        if (colorMatch && colorMatch[1]) {
          style.color = colorMatch[1];
        }
        
        // 提取 size 属性
        const sizeMatch = attributes.match(/size=["']?(\d+)["']?/);
        if (sizeMatch && sizeMatch[1]) {
          const size = parseInt(sizeMatch[1]);
          style.fontSize = Math.min(Math.max(size, 1), 7) * 4 + 8; // 将 1-7 的值映射到合理的字体大小
        }

        // 提取 face 属性 (字体)
        const faceMatch = attributes.match(/face=["']?([^"'\s>]+)["']?/);
        if (faceMatch && faceMatch[1]) {
          style.fontFamily = faceMatch[1];
        }
        break;
        
      case 'b':
        style.fontWeight = 'bold';
        break;
        
      case 'i':
        style.fontStyle = 'italic';
        break;
        
      case 'u':
        style.textDecorationLine = 'underline';
        break;
        
      case 's':
      case 'strike':
      case 'del':
        style.textDecorationLine = 'line-through';
        break;
        
      case 'em':
        style.fontStyle = 'italic';
        break;
        
      case 'strong':
        style.fontWeight = 'bold';
        break;
        
      case 'mark':
        style.backgroundColor = 'yellow';
        style.color = 'black';
        break;
        
      case 'small':
        style.fontSize = 12;
        break;
        
      case 'big':
        style.fontSize = 20;
        break;
        
      case 'sub':
        style.fontSize = 10;
        style.lineHeight = 0;
        style.textAlignVertical = 'bottom';
        style.includeFontPadding = false;
        break;
        
      case 'sup':
        style.fontSize = 10;
        style.lineHeight = 0;
        style.textAlignVertical = 'top';
        style.includeFontPadding = false;
        break;
        
      case 'h1':
        style.fontSize = 24;
        style.fontWeight = 'bold';
        style.marginVertical = 10;
        break;
        
      case 'h2':
        style.fontSize = 22;
        style.fontWeight = 'bold';
        style.marginVertical = 8;
        break;
        
      case 'h3':
        style.fontSize = 20;
        style.fontWeight = 'bold';
        style.marginVertical = 6;
        break;
        
      case 'h4':
        style.fontSize = 18;
        style.fontWeight = 'bold';
        style.marginVertical = 4;
        break;
        
      case 'h5':
        style.fontSize = 16;
        style.fontWeight = 'bold';
        style.marginVertical = 2;
        break;
        
      case 'h6':
        style.fontSize = 14;
        style.fontWeight = 'bold';
        style.marginVertical = 1;
        break;
        
      case 'div':
      case 'p':
        // 使用递归解析可能的子标签
        const innerSegments = parseHtmlText(content);
        segments.push(...innerSegments);
        currentIndex = match.index + match[0].length;
        continue; // 跳过添加当前标签，因为我们已经处理了其内容
        
      case 'span':
        // 检查内联样式
        const styleMatch = attributes.match(/style=["'](.*?)["']/);
        if (styleMatch && styleMatch[1]) {
          const styleStr = styleMatch[1];
          
          // 解析颜色
          const colorStyleMatch = styleStr.match(/color:\s*(#[0-9A-Fa-f]{3,8}|[a-zA-Z]+)/);
          if (colorStyleMatch) {
            style.color = colorStyleMatch[1];
          }
          
          // 解析字体粗细
          const fontWeightMatch = styleStr.match(/font-weight:\s*(normal|bold|[1-9]00)/);
          if (fontWeightMatch) {
            style.fontWeight = fontWeightMatch[1];
          }
          
          // 解析字体样式
          const fontStyleMatch = styleStr.match(/font-style:\s*(normal|italic|oblique)/);
          if (fontStyleMatch) {
            style.fontStyle = fontStyleMatch[1];
          }
          
          // 解析文本装饰
          const textDecorationMatch = styleStr.match(/text-decoration:\s*(none|underline|line-through|overline)/);
          if (textDecorationMatch) {
            style.textDecorationLine = textDecorationMatch[1];
          }
          
          // 解析字体大小
          const fontSizeMatch = styleStr.match(/font-size:\s*(\d+)(px|pt|em|rem|%)?/);
          if (fontSizeMatch) {
            const size = parseInt(fontSizeMatch[1]);
            const unit = fontSizeMatch[2] || 'px';
            
            // 简单地将不同单位映射到像素值（粗略近似）
            switch (unit) {
              case 'pt':
                style.fontSize = size * 1.33;
                break;
              case 'em':
              case 'rem':
                style.fontSize = size * 16;
                break;
              case '%':
                style.fontSize = size * 0.16;
                break;
              default:
                style.fontSize = size;
            }
          }
          
          // 解析背景颜色
          const bgColorMatch = styleStr.match(/background-color:\s*(#[0-9A-Fa-f]{3,8}|[a-zA-Z]+)/);
          if (bgColorMatch) {
            style.backgroundColor = bgColorMatch[1];
          }
          
          // 解析字体系列
          const fontFamilyMatch = styleStr.match(/font-family:\s*([^;]+)/);
          if (fontFamilyMatch) {
            style.fontFamily = fontFamilyMatch[1].trim().replace(/['"]/g, '');
          }
          
          // 解析行高
          const lineHeightMatch = styleStr.match(/line-height:\s*(\d+)(px|pt|em|rem|%)?/);
          if (lineHeightMatch) {
            style.lineHeight = parseInt(lineHeightMatch[1]);
          }
          
          // 解析文本对齐
          const textAlignMatch = styleStr.match(/text-align:\s*(left|center|right|justify)/);
          if (textAlignMatch) {
            style.textAlign = textAlignMatch[1];
          }
          
          // 解析字母间距
          const letterSpacingMatch = styleStr.match(/letter-spacing:\s*(\d+)(px|pt|em|rem|%)?/);
          if (letterSpacingMatch) {
            style.letterSpacing = parseInt(letterSpacingMatch[1]);
          }
        }
        break;
        
      // 添加列表项支持
      case 'li':
        style.marginLeft = 20;
        style.marginVertical = 4;
        break;
        
      case 'ul':
        style.marginLeft = 10;
        style.marginVertical = 8;
        break;
        
      case 'ol':
        style.marginLeft = 10;
        style.marginVertical = 8;
        break;
        
      // 添加表格支持
      case 'table':
      case 'tr':
      case 'td':
      case 'th':
        // 不在原生文本标签中处理表格
        break;
        
      // 添加代码块支持
      case 'code':
        style.fontFamily = 'monospace';
        style.backgroundColor = 'rgba(0,0,0,0.05)';
        style.padding = 2;
        break;
        
      case 'pre':
        style.fontFamily = 'monospace';
        style.backgroundColor = 'rgba(0,0,0,0.05)';
        style.padding = 8;
        style.marginVertical = 8;
        break;
    }

    // 对内容进行递归解析，以支持嵌套标签
    let innerContent;
    if (['span', 'b', 'i', 'u', 's', 'strike', 'del', 'em', 'strong', 'mark', 'small', 'big', 'sub', 'sup', 'font', 'code'].includes(tagName)) {
      innerContent = parseHtmlText(content);
    } else {
      innerContent = [{ text: content }];
    }
    
    // 合并样式和内容
    for (const innerSegment of innerContent) {
      segments.push({
        text: innerSegment.text,
        style: { ...innerSegment.style, ...style }
      });
    }

    currentIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (currentIndex < text.length) {
    segments.push({
      text: text.slice(currentIndex)
    });
  }

  return segments;
}

// 添加检测函数 - 判断内容是否包含复杂HTML和需要WebView渲染
export function containsComplexHtml(text: string): boolean {
  // 检查是否包含完整HTML文档结构
  if (text.includes('<!DOCTYPE html>') || 
      text.includes('<html') || 
      (text.includes('<head') && text.includes('<body'))) {
    return true;
  }
  
  // 检查是否包含高级样式表或脚本
  if (text.includes('<style>') || text.includes('<script>')) {
    return true;
  }
  
  // 检查是否包含多媒体元素和交互元素
  if (text.includes('<img') || 
      text.includes('<video') || 
      text.includes('<audio') ||
      text.includes('<button') ||
      text.includes('onclick=') ||
      text.includes('addEventListener') ||
      text.includes('<input') ||
      text.includes('<select')) {
    return true;
  }
  
  // 检查是否包含表格
  if (text.includes('<table') || text.includes('<tr>') || text.includes('<td>')) {
    return true;
  }
  
  // 检查是否包含列表
  if (text.includes('<ul') || text.includes('<ol') || text.includes('<li>')) {
    return true;
  }
  
  // 检查是否包含可折叠内容
  if (text.includes('<details') || text.includes('<summary')) {
    return true;
  }
  
  // 检查CSS类或复杂样式
  if (text.match(/class=["'][^"']+["']/) || 
      text.match(/style=["'][^"']{30,}["']/)) {
    return true;
  }
  
  // 检测是否包含大量HTML标签
  const tagCount = (text.match(/<\/?[a-z][\s\S]*?>/gi) || []).length;
  if (tagCount > 10) {
    return true;
  }
  
  // 检查是否为代码块内容
  if (text.includes('```html') || text.includes('```css') || text.includes('```javascript')) {
    return true;
  }
  
  return false;
}

// 处理代码块
export function extractCodeBlocks(text: string): { codeBlocks: string[], newText: string } {
  const codeBlocks: string[] = [];
  
  // 替换所有代码块为占位符
  const newText = text.replace(/```(html|css|javascript|js)([\s\S]*?)```/g, (match, language, code) => {
    // 保存代码块
    const formattedCode = code.trim().replace(/\n/g, '<br>');
    const htmlContent = language === 'html' ? formattedCode : 
                       `<pre><code class="language-${language}">${formattedCode}</code></pre>`;
    codeBlocks.push(htmlContent);
    
    // 返回占位符
    return `[CODE_BLOCK_${codeBlocks.length - 1}]`;
  });
  
  return { codeBlocks, newText };
}

// 将代码块重新插入到文本中
export function reinsertCodeBlocks(text: string, codeBlocks: string[]): string {
  return text.replace(/\[CODE_BLOCK_(\d+)\]/g, (_, index) => {
    const idx = parseInt(index, 10);
    return idx < codeBlocks.length ? codeBlocks[idx] : '';
  });
}

// 新增函数: 处理纯文本换行和保留空白
export function preserveFormatting(text: string): string {
  // 如果文本不包含HTML标记，确保我们保留换行符和空格
  if (!containsComplexHtml(text) && !text.includes('<')) {
    // 将文本中的换行符转换为 <br> 标签
    return text.replace(/\n/g, '<br>').replace(/  /g, '&nbsp;&nbsp;');
  }
  return text;
}

// Add a new helper function to properly handle code blocks in markdown
export function formatCodeBlocks(text: string): string {
  // If no code blocks, return the original text
  if (!text.includes('```')) {
    return text;
  }

  // Extract code blocks and replace them with placeholders
  const { codeBlocks, newText } = extractCodeBlocks(text);

  // Reinsert code blocks into the text
  return reinsertCodeBlocks(newText, codeBlocks);
}
