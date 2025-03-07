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
        }
        break;
    }

    // 对内容进行递归解析，以支持嵌套标签
    let innerContent;
    if (['span', 'b', 'i', 'u', 's', 'strike', 'del', 'em', 'strong', 'mark', 'small', 'big', 'sub', 'sup', 'font'].includes(tagName)) {
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
