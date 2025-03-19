**目标:**

使用 `react-native-render-html` 在 React Native 消息条组件中渲染丰富的 HTML/CSS 内容，同时最大程度地提高 App 的性能、健壮性并避免 Bug。

**提示词:**

**1. 组件设计与结构：**

*   **模块化设计:** 将 HTML 渲染逻辑封装到一个独立的、可复用的组件中，例如 `HtmlMessage`。
*   **Props 定义:** 明确定义 `HtmlMessage` 组件的 props，包括 HTML 内容 (类型为 string)、默认样式、以及任何需要传递给渲染器的配置。
*   **避免全局状态：** 尽量避免在 `HtmlMessage` 组件中使用全局状态或副作用，以确保组件的可预测性和可测试性。

**2. HTML 内容处理：**

*   **输入验证与清理:** 使用 `DOMPurify` 或类似的库，对传入的 HTML 内容进行验证和清理，移除潜在的恶意代码，防止 XSS 攻击。
*   **限制 HTML 大小:** 设置 HTML 内容的最大长度限制，避免渲染过大的 HTML 字符串导致性能问题。
*   **错误处理:** 在 HTML 解析和渲染过程中，捕获并处理任何可能发生的错误，例如无效的 HTML 标签或 CSS 属性。

**3. 样式处理：**

*   **CSS in JS:** 使用 CSS in JS 库（例如 `styled-components` 或 `emotion`）来管理 `react-native-render-html` 组件的样式，提高性能和可维护性。
*   **默认样式：** 提供一套合理的默认样式，确保即使 HTML 内容没有提供样式，也能正常显示。
*   **可配置的样式：** 允许通过 props 自定义样式，以便根据不同的消息类型或主题进行调整。
*   **避免使用 `!important`:** 尽量避免在样式中使用 `!important`，因为它会降低样式的可维护性。

**4. 性能优化：**

*   **`React.memo`:** 使用 `React.memo` 对 `HtmlMessage` 组件进行包裹，避免不必要的重新渲染。
*   **`useMemo`:** 使用 `useMemo` 对 `react-native-render-html` 的 `source` prop 进行缓存，避免每次渲染都重新解析 HTML 内容。
*   **Virtualized Lists:** 如果在列表中渲染多个包含 HTML 的消息，使用 `FlatList` 或 `SectionList` 等虚拟化列表组件来提高性能。
*   **图片优化：** 如果 HTML 内容包含图片，使用 `react-native-fast-image` 或类似的库进行图片优化，例如缓存、懒加载和缩放。
*   **自定义渲染器:** 对于复杂的 HTML 结构，可以自定义渲染器来优化渲染性能。
*   **避免频繁更新：** 避免频繁更新 HTML 内容，例如在用户输入时实时渲染 HTML。

**5. 健壮性与兼容性：**

*   **异常处理:** 使用 `try...catch` 语句捕获可能发生的异常，并进行适当的处理，例如显示错误信息或回退到默认的渲染方式。
*   **版本兼容性:** 确保 `react-native-render-html` 和其他依赖库的版本与你的 React Native 版本兼容。
*   **跨平台测试:** 在 iOS 和 Android 设备上进行充分的测试，确保 HTML 内容在不同平台上都能正常显示。
*   **使用 TypeScript：** 使用 TypeScript 来进行类型检查，避免类型错误导致的 Bug。

**6. 测试与调试：**

*   **单元测试:** 编写单元测试来验证 `HtmlMessage` 组件的各个功能是否正常工作。
*   **集成测试:** 编写集成测试来验证 `HtmlMessage` 组件与其他组件的集成是否正确。
*   **使用 React DevTools:** 使用 React DevTools 来分析组件的性能瓶颈。
*   **使用 `console.log`:** 在代码中添加 `console.log` 语句来输出变量的值，以便你可以跟踪代码的执行流程。

**7. 文档与维护：**

*   **编写清晰的文档:** 编写清晰的文档，描述 `HtmlMessage` 组件的使用方法、props 定义和配置选项。
*   **代码注释：** 在代码中添加清晰的注释，解释代码的逻辑和实现细节。
*   **定期更新依赖库：** 定期更新 `react-native-render-html` 和其他依赖库，以获取最新的功能和 Bug 修复。

**示例代码片段 (使用 `react-native-render-html` 和 `styled-components`):**

```typescript
import React, { useMemo } from 'react';
import styled from 'styled-components/native';
import RenderHtml from 'react-native-render-html';
import DOMPurify from 'dompurify-js';

interface Props {
    html: string;
    defaultFontSize?: number;
}

const StyledHtmlContainer = styled.View`
    /*  添加容器样式  */
`;

const HtmlMessage: React.FC<Props> = React.memo(({ html, defaultFontSize = 16 }) => {
    const cleanedHtml = useMemo(() => DOMPurify.sanitize(html), [html]);

    const source = useMemo(() => ({ html: cleanedHtml }), [cleanedHtml]);

    return (
        <StyledHtmlContainer>
            <RenderHtml
                source={source}
                contentWidth={300} // 根据实际情况调整
                defaultTextProps={{ style: { fontSize: defaultFontSize } }}
                tagsStyles={{
                    p: { fontSize: defaultFontSize },
                    // 添加其他标签的默认样式
                }}
            />
        </StyledHtmlContainer>
    );
});

export default HtmlMessage;
```