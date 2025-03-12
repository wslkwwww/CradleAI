# VNDB API 服务使用指南

本文档提供了如何使用 VNDB API 服务的详细说明，包括文件结构、接口规范和返回结果的格式，以便开发者能够方便地集成和使用此服务。

## 1. 文件结构

VNDB API 服务的文件结构如下：

```
f:\my-app\src\services\vndb\
├── index.ts          // 导出所有功能，主入口点
├── vndbClient.ts     // VNDB API 客户端实现
├── types.ts          // 类型定义
└── logger.ts         // 日志服务
```

## 2. 快速开始

### 导入服务

```typescript
// 方法 1: 使用默认客户端实例
import { defaultClient as vndb } from '@/src/services/vndb';

// 方法 2: 创建新的客户端实例
import { VNDBClient } from '@/src/services/vndb';
const myVndbClient = new VNDBClient();

// 导入类型 (如需要)
import { VNDBCharacter, CharacterQueryOptions } from '@/src/services/vndb';
```

### 基本使用示例

```typescript
// 按ID查询角色
const character = await vndb.getCharacterById('c1');
console.log(`找到角色: ${character?.name}`);

// 搜索角色
const searchResults = await vndb.searchCharacters('Saber', { results: 5 });
console.log(`找到 ${searchResults.results.length} 个角色`);

// 使用过滤条件查询角色
const filteredCharacters = await vndb.getCharacters({
  bloodType: 'a',
  sex: 'f',
  results: 5
});
```

## 3. 核心 API 参考

### VNDBClient 类

#### 创建实例

```typescript
// 使用默认客户端
import { defaultClient as vndb } from '@/src/services/vndb';

// 或创建自定义客户端
import { VNDBClient, VNDBLogger } from '@/src/services/vndb';
const logger = new VNDBLogger('自定义上下文');
const client = new VNDBClient(logger);
```

#### 方法概览

| 方法名 | 描述 | 参数 | 返回值 |
|-------|------|------|-------|
| `verifyAuth()` | 验证认证令牌是否有效 | 无 | `Promise<boolean>` |
| `getCharacters(options)` | 查询角色信息 | `CharacterQueryOptions` | `Promise<VNDBCharacterResponse>` |
| `getCharacterById(id, fields?)` | 根据ID获取单个角色 | `string, string[]?` | `Promise<VNDBCharacter \| null>` |
| `searchCharacters(term, options?)` | 按名称搜索角色 | `string, CharacterQueryOptions` | `Promise<VNDBCharacterResponse>` |
| `getCharacterTraits(id)` | 获取角色特征 | `string` | `Promise<VNDBCharacter \| null>` |
| `getAllCharacters(options)` | 分页获取所有角色 | `CharacterQueryOptions` | `Promise<VNDBCharacterResponse>` |

## 4. 接口规范详解

### CharacterQueryOptions 接口

用于指定角色查询的选项。

```typescript
interface CharacterQueryOptions {
  id?: string;                      // 角色ID
  search?: string;                  // 搜索词
  role?: string;                    // 角色定位
  bloodType?: string;               // 血型 (a, b, ab, o)
  sex?: string;                     // 性别 (m, f, b)
  sexSpoil?: string;                // 具有剧透的性别信息
  gender?: string;                  // 性别认同
  genderSpoil?: string;             // 具有剧透的性别认同
  height?: number | null;           // 身高(cm)
  weight?: number | null;           // 体重(kg)
  bust?: number | null;             // 胸围(cm)
  waist?: number | null;            // 腰围(cm)
  hips?: number | null;             // 臀围(cm)
  cup?: string | null;              // 罩杯尺寸
  age?: number | null;              // 年龄
  trait?: string | [string, number]; // 特征ID或[特征ID,剧透级别]
  dtrait?: string | [string, number]; // 直接特征
  birthday?: [number, number] | null; // 生日[月,日]
  seiyuu?: any;                     // 声优过滤器
  vn?: any;                         // 视觉小说过滤器
  fields?: string[];                // 返回字段
  sort?: string;                    // 排序字段
  reverse?: boolean;                // 是否倒序
  results?: number;                 // 每页结果数
  page?: number;                    // 页码
  count?: boolean;                  // 是否返回总数
}
```

### 返回结果接口

#### VNDBCharacterResponse

```typescript
interface VNDBCharacterResponse {
  results: VNDBCharacter[];        // 角色结果数组
  more: boolean;                   // 是否有更多结果
  count?: number;                  // 结果总数(如果请求了)
  compact_filters?: string;        // 压缩的过滤器字符串
  normalized_filters?: any[];      // 标准化的过滤器
}
```

#### VNDBCharacter

```typescript
interface VNDBCharacter {
  id: string;                      // 角色ID
  name?: string;                   // 角色名称
  original?: string | null;        // 原始名称
  aliases?: string[];              // 别名列表
  description?: string | null;     // 角色描述
  image?: {                        // 角色图片
    id?: string;                   
    url?: string;                  // 图片URL
    dims?: number[];               // 图片尺寸
  } | null;
  blood_type?: string | null;      // 血型
  height?: number | null;          // 身高(cm)
  weight?: number | null;          // 体重(kg)
  bust?: number | null;            // 胸围(cm)
  waist?: number | null;           // 腰围(cm)
  hips?: number | null;            // 臀围(cm)
  cup?: string | null;             // 罩杯尺寸
  age?: number | null;             // 年龄
  birthday?: [number, number] | null; // 生日[月,日]
  sex?: [string | null, string | null] | null; // 性别[表面性别,真实性别]
  vns?: VNDBCharacterVN[];         // 出现的视觉小说列表
  traits?: VNDBCharacterTrait[];   // 角色特征列表
}
```

## 5. 高级用法示例

### 使用多种过滤条件查询

```typescript
// 查询特定年龄范围和血型的女性角色
const characters = await vndb.getCharacters({
  sex: 'f',
  bloodType: 'ab',
  age: 18,
  results: 10
});
```

### 构建自定义过滤器

```typescript
// 使用高级过滤器构建复杂查询
const customFilter = ["and",
  ["sex", "=", "f"],
  ["or",
    ["blood_type", "=", "a"],
    ["blood_type", "=", "b"]
  ],
  ["age", ">=", 20]
];

const response = await vndb.getCharacters({
  filters: customFilter,
  fields: ['id', 'name', 'image', 'age'],
  results: 15
});
```

### VN作品过滤

```typescript
// 查找出现在高分VN中的角色
const characters = await vndb.getCharacters({
  vn: ["and",
    ["rating", ">", 8.0],
    ["olang", "=", "ja"]
  ],
  results: 20
});
```

## 6. 错误处理

服务中的所有方法都会抛出标准化的错误对象：

```typescript
interface VNDBError {
  code: number;       // HTTP状态码
  message: string;    // 错误描述
  details?: any;      // 额外的错误详情
}
```

推荐使用 try/catch 处理可能的错误：

```typescript
try {
  const character = await vndb.getCharacterById('c1');
  // 处理结果
} catch (error) {
  console.error(`查询失败: ${error.message}`);
  // 适当地处理错误
}
```

## 7. 日志记录

服务包含详细的日志记录功能，可以帮助调试和跟踪API请求：

```typescript
import { VNDBLogger, LogLevel } from '@/src/services/vndb';

// 创建自定义日志记录器
const logger = new VNDBLogger('MyComponent');
logger.info('开始查询角色');
logger.error('查询失败', error);
```

日志级别包括：DEBUG, INFO, WARN, ERROR

## 8. 注意事项

1. **令牌限制**：使用的API令牌有请求频率限制，每5分钟最多200个请求。
2. **数据缓存**：考虑在客户端缓存常用查询结果，以减少API调用。
3. **字段选择**：只请求必要的字段，以提高性能和减少数据传输。
4. **错误处理**：总是处理可能的错误响应，特别是网络问题和API限制。

## 9. 代码示例：集成到组件中

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { defaultClient as vndb } from '@/src/services/vndb';
import { VNDBCharacter } from '@/src/services/vndb/types';

const CharacterProfile = ({ characterId }) => {
  const [character, setCharacter] = useState<VNDBCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCharacter = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await vndb.getCharacterById(characterId);
        setCharacter(result);
      } catch (err) {
        setError(err.message || '获取角色信息失败');
      } finally {
        setLoading(false);
      }
    };

    fetchCharacter();
  }, [characterId]);

  if (loading) return <Text>加载中...</Text>;
  if (error) return <Text>错误: {error}</Text>;
  if (!character) return <Text>未找到角色</Text>;

  return (
    <View>
      <Text>名称: {character.name}</Text>
      {character.original && <Text>原名: {character.original}</Text>}
      {character.age && <Text>年龄: {character.age}</Text>}
      {/* 渲染其他角色信息 */}
    </View>
  );
};

export default CharacterProfile;
```

## 10. 参考资源

- [完整的VNDB API文档](https://api.vndb.org/kana)
- [VNDB网站](https://vndb.org/)

---

*最后更新: 2025年3月*
