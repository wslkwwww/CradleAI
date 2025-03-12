**VNDB API：查询角色信息的开发者指南**

本指南旨在帮助开发者使用 VNDB API 有效地查询角色信息，特别是如何结合使用过滤器 (filters) 和字段 (fields) 来获取所需的数据。

**1. 理解过滤器 (Filters) 和字段 (Fields)**

*   **过滤器 (Filters):** 用于指定查询的条件，缩小结果范围。 可以理解为 SQL 查询中的 `WHERE` 子句。

*   **字段 (Fields):** 用于指定返回哪些数据属性（字段）。 可以理解为 SQL 查询中的 `SELECT` 子句。


## 用户认证

用户需要打开他们的“我的个人资料”表单并转到“应用程序”选项卡来获取令牌。

令牌看起来像 xxxx-xxxxx-xxxxx-xxxx-xxxxx-xxxxx-xxxx，其中每个 x 代表一个小写 z-base-32 字符。中间的破折号是可选的。

令牌可以使用带有 Token 类型的 Authorization 标头包含在 API 请求中

当前可用的鉴权和令牌为：
```
Authorization: Token sino-ydi9x-qwye1-zk4e-beido-5ya9p-b7et
```
如果令牌无效，则返回 HTTP 401 错误。可以使用 GET /authinfo 终端节点来验证令牌并从中提取信息。

## API 结构

搜索和获取数据库条目是通过自定义查询格式进行的。 查询以 POST 请求发送，但我希望在 QUERY HTTP 方法获得更多软件支持后也能支持它。

**查询格式**

查询是一个 JSON 对象，如下所示：

```json
{
  "filters": [],
  "fields": "",
  "sort": "id",
  "reverse": false,
  "results": 10,
  "page": 1,
  "user": null,
  "count": false,
  "compact_filters": false,
  "normalized_filters": false
}
```

所有成员都是可选的，默认值如上所示。

*   **filters**

    用于确定要获取哪些数据库项的过滤器，请参阅下面的“过滤器”部分。

*   **fields**

    字符串。以逗号分隔的列表，用于指定要为每个数据库项获取的字段。可以使用点表示法来选择嵌套的 JSON 对象，例如，“image.url” 将选择 image 对象内的 url 字段。可以使用括号选择多个嵌套字段，例如，“image{id,url,dims}” 等效于 “image.id, image.url, image.dims”。

    必须显式提及每个感兴趣的字段，不支持通配符匹配。 这同样适用于嵌套对象，在上面的示例中，如果列出 image 而没有子字段，则会出错。

    顶级的 id 字段始终默认选择，无需在此列表中提及。

*   **sort**

    用于排序的字段。 支持的值取决于查询的数据类型，并单独记录。

*   **reverse**

    设置为 true 以按降序排序。

*   **results**

    每页的结果数，最多 100 个。 如果您根本不关心结果，而只想验证查询或获取计数、compact_filters 或 normalized_filters，也可以将其设置为 0。

*   **page**

    要请求的页码，从 1 开始。另请参阅下面的分页注意事项。

*   **user**

    用户 ID。 此字段主要用于 POST /ulist，但它也设置了用于视觉小说 “label” 过滤器的默认用户 ID。 默认为当前经过身份验证的用户。

*   **count**

    响应是否应包含 count 字段（见下文）。 如果不需要计数，应避免使用此选项，因为它会产生相当大的性能影响。

*   **compact_filters**

    响应是否应包含 compact_filters 字段（见下文）。

*   **normalized_filters**

    响应是否应包含 normalized_filters 字段（见下文）。

**响应格式**

```json
{
  "results": [],
  "more": false,
  "count": 1,
  "compact_filters": "",
  "normalized_filters": [],
}
```

*   **results**

    表示查询结果的对象数组。

*   **more**

    如果为 true，则使用递增的页码重复查询将产生更多结果。 这种分页形式比使用 count 字段更经济。

*   **count**

    仅当查询包含 "count": true 时才存在。 指示与给定过滤器匹配的条目总数。

*   **compact_filters**

    仅当查询包含 "compact_filters": true 时才存在。 这是查询中给出的过滤器的紧凑字符串表示形式。

*   **normalized_filters**

    仅当查询包含 "normalized_filters": true 时才存在。 这是查询中给出的过滤器的标准化 JSON 表示形式。

**过滤器**

简单的谓词表示为包含过滤器名称、运算符和值的三元素 JSON 数组，例如 `[ "id", "=", "v17" ]`。 所有过滤器都接受（不）等式运算符 `=` 和 `!=`。 支持排序的过滤器也接受 `>=`, `>`, `<=` 和 `<`。 每个数据库项类型的接受的过滤器名称和值的完整列表如下记录。

简单的谓词可以使用 and/or 谓词组合成更大的查询。 这些表示为 JSON 数组，其中第一个元素是 "and" 或 "or"，后跟两个或多个其他谓词。

以下是一个更复杂的视觉小说过滤器的完整示例（截至撰写本文时，它实际上与数据库中的任何内容都不匹配）：

```json
[ "and"
, [ "or"
  , [ "lang", "=", "en" ]
  , [ "lang", "=", "de" ]
  , [ "lang", "=", "fr" ]
  ]
, [ "olang", "!=", "ja" ]
, [ "release", "=", [ "and"
    , [ "released", ">=", "2020-01-01" ]
    , [ "producer", "=", [ "id", "=", "p30" ] ]
    ]
  ]
]
```

除了上面的 JSON 格式之外，过滤器也可以表示为更紧凑的字符串。 此表示形式用于高级搜索 Web 界面 的 URL 中，并且也被接受为 “filters” 字段的值。 由于实际使用紧凑字符串表示形式有点令人烦恼，因此此 API 可以在这两种表示形式之间进行转换，因此您可以自由地将过滤器从网站复制到 API，反之亦然。

上面示例的紧凑表示形式是 "03132gen2gde2gfr3hjaN180272_0c2vQN6830u"，可以在 Web UI 中看到它的实际效果。 以下命令会将该字符串转换回上面的 JSON：

```bash
curl https://api.vndb.org/kana/vn --header 'Content-Type: application/json' --data '{
    "filters": "03132gen2gde2gfr3hjaN180272_0c2vQN6830u",
    "normalized_filters": true
}'
```

请注意，该网站上的高级搜索编辑 UI 不支持所有过滤器类型，对于不支持的过滤器，您将看到一个“无法识别的过滤器”块。 这些是相当无害的，过滤器仍然有效。

**过滤器标志**

以下标志用于描述一些常见的过滤器属性:

| 标志 | 描述 |
|------|------|
| o | 可以使用排序运算符（如 > 和 <） |
| n | 接受 null 作为值 |
| m | 单个条目可匹配多个值。例如,同时支持英语和日语的视觉小说会同时匹配 `["lang","=","en"]` 和 `["lang","=","ja"]` |
| i | 反转或否定此过滤器(如将 '=' 改为 '!=' 或 '>' 改为 '<=')并不总是等同于反转匹配条目。这通常意味着过滤器还有其他隐含条件(如信息必须已知),具体细节因过滤器而异 |

小心将布尔代数应用于带有 ‘m’ 或 ‘i’ 标志的过滤器，结果可能不直观。 例如，搜索与 `["or",["minage","=",0],["minage","!=",0]]` 匹配的版本不会找到数据库中的所有版本，而只会找到那些 minage 字段已知的版本。 关于未知或缺失信息的具体语义通常取决于过滤器的实现方式，并且可能会发生变化。








查询角色全部信息的策略

## 查询角色信息的过滤器和字段

“sort” 的可接受值为：id、name、searchrank。

**过滤器选项:**

| 过滤器名称 | 标志 | 说明 |
|-----------|------|------|
| id | o | vndbid |
| search | m | 字符串搜索 |
| role | m | 字符串，见vns.role字段。当嵌套在视觉小说过滤器中使用时，匹配特定视觉小说的角色。否则，匹配任何关联视觉小说的角色 |
| blood_type | | 字符串 |
| sex | | 字符串 |
| sex_spoil | | 字符串 |
| gender | | 字符串 |
| gender_spoil | | 字符串 |
| height | o,n,i | 整数，厘米 |
| weight | o,n,i | 整数，千克 |
| bust | o,n,i | 整数，厘米 |
| waist | o,n,i | 整数，厘米 |
| hips | o,n,i | 整数，厘米 |
| cup | o,n,i | 字符串，罩杯尺寸 |
| age | o,n,i | 整数 |
| trait | m | 应用于此角色的特征，也匹配父特征。详见下文 |
| dtrait | m | 直接应用于此角色的特征，不匹配父特征。详见下文 |
| birthday | n | 两个整数的数组，月和日。日期可以为0以查找特定月份的生日角色 |
| seiyuu | m | 匹配由匹配的声优配音的角色。声优信息实际上是特定于视觉小说的，但此过滤器当前在视觉小说过滤器内嵌套时不与父条目相关联 |
| vn | m | 匹配与视觉小说过滤器描述的视觉小说相关联的角色 |

**过滤器规则:** `trait` 和 `dtrait` 过滤器接受纯特性 ID 或包含特性 ID 和最大剧透级别的两元素数组。它们的工作方式类似于视觉小说的标签过滤器，只是特性没有评级。

**可用的字段值:**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | vndbid |
| name | string | 角色名称 |
| original | string | 原始脚本中的名称,可能为null |
| aliases | array | 字符串数组形式的别名 |
| description | string | 可能包含格式代码的描述,可能为null |
| image.* | object | 图像相关字段,可能为null |
| blood_type | string | 血型("a","b","ab","o"),可能为null |
| height | integer | 身高(厘米),可能为null |
| weight | integer | 体重(千克),可能为null |
| bust | integer | 胸围(厘米),可能为null |
| waist | integer | 腰围(厘米),可能为null |
| hips | integer | 臀围(厘米),可能为null |
| cup | string | 罩杯尺寸,可能为null |
| age | integer | 年龄,可能为null |
| birthday | array | 月和日的数组,可能为null |
| sex | array | 性别信息数组,包含表面性别和真实性别 |
| vns | array | 角色出现的视觉小说信息数组 |
| vns.spoiler | integer | 剧透等级 |
| vns.role | string | 角色定位(main/primary/side/appears) |
| vns.* | - | 其他视觉小说相关字段 |
| traits | array | 特征数组 |
| traits.spoiler | integer | 特征的剧透等级(0-2) |
| traits.lie | boolean | 是否为谎言特征 |
| traits.* | - | 其他特征相关字段 |

`trait` 和 `dtrait` 过滤器接受纯特性 ID 或包含特性 ID 和最大剧透级别的两元素数组。 它们的工作方式类似于视觉小说的标签过滤器，只是特性没有评级。

**字段**

*   **id**

    vndbid。

*   **name**

    字符串。

*   **original**

    字符串，可能为 null，原始脚本中的名称。

*   **aliases**

    字符串数组。

*   **description**

    字符串，可能为 null，可能包含格式代码。

*   **image.\***

    对象，可能为 null，与图像视觉小说字段相同的子字段。（除了缩略图和 thumbnail_dims，因为角色图像当前始终限制为 256x300px，但将来可能会更改）。

*   **blood_type**

    字符串，可能为 null，“a”，“b”，“ab” 或 “o”。

*   **height**

    整数，可能为 null，厘米。

*   **weight**

    整数，可能为 null，千克。

*   **bust**

    整数，可能为 null，厘米。

*   **waist**

    整数，可能为 null，厘米。

*   **hips**

    整数，可能为 null，厘米。

*   **cup**

    字符串，可能为 null，“AAA”，“AA” 或字母表中的任何单个字母。

*   **age**

    整数，可能为 null，年。

*   **birthday**

    可能为 null，否则为两个整数的数组：分别为月和日。

*   **sex**

    可能为 null，否则为两个字符串的数组：角色的明显（非剧透）性别和角色的真实（剧透）性别。 可能的值为 null，“m”，“f”，“b”（表示 “两者”）或 “n”（无性）。

*   **vns**

    对象数组，此角色出现的视觉小说。 相同的视觉小说可能会以不同的发行版列出多次；每个发行版的剧透等级和角色可能不同。

*   **vns.spoiler**

    整数。

*   **vns.role**

    字符串，“main” 代表主角，“primary” 代表主要角色，“side” 或 “appears”。

*   **vns.\***

    此处提供了所有视觉小说字段。

*   **vns.release.\***

    对象，通常为 null，此角色出现的特定发行版。 此处提供了所有发行版字段。

*   **traits**

    对象数组，可能为空。

*   **traits.spoiler**

    整数，0、1 或 2，剧透等级。

*   **traits.lie**

    布尔值。

*   **traits.\***

    此处提供了所有特性字段。





## 实践：查询角色信息

*   **查询角色的全部信息**

    VNDB API 要求你明确列出需要返回的字段。 因此，要获取角色的全部信息，你需要列出所有可用的字段。

    **步骤：**

    1.  **查阅官方文档:**  仔细阅读前文关于"字段"的描述，以及所有可用的字段，包括一级字段和嵌套字段。  注意：
        *   `id` 字段总是默认返回，无需显式指定。
        *   对于嵌套字段 (例如 `image.url`)，你需要使用点符号来指定。
        *   使用 `image{id,url,dims}` 语法可以简化对嵌套对象的多个字段的选择，相当于 `image.id, image.url, image.dims`。

    2.  **构建查询:**  将所有字段列入 `fields` 字符串中，并用逗号分隔。  以下是一个示例：

    ```json
    {
      "filters": [], // 没有筛选条件，获取所有角色
      "fields": "name,original,aliases,description,image{id,url,dims},blood_type,height,weight,bust,waist,hips,cup,age,birthday,sex,vns{spoiler,role,vn},traits{spoiler,lie,trait}" // 列出所有字段
    }
    ```

    **说明：**

    *   `filters: []` 表示没有筛选条件，获取所有角色。 如果你需要筛选特定角色（例如，基于 `id`），可以在 `filters` 中添加筛选条件。
    *   `fields` 字段包含了所有需要返回的字段。  请确保根据文档更新此列表，以包含所有你需要的字段。
    *   `vns{spoiler,role,vn}`和`traits{spoiler,lie,trait}` 是一个简化嵌套对象的写法, 确保大括号中的属性存在。
    *   你可能需要使用分页来获取所有角色，因为 API 可能会限制单次返回的结果数量。

**3. 完整代码例子 (curl):**
```bash
curl https://api.vndb.org/kana/character \
  --header "Content-Type: application/json" \
  --data '{
    "filters": [],
    "fields": "name,original,aliases,description,image{id,url,dims},blood_type,height,weight,bust,waist,hips,cup,age,birthday,sex,vns{spoiler,role,vn},traits{spoiler,lie,trait}",
    "results": 25
  }'
```
这个例子会请求返回25个角色的全部信息，你可以自己调整`results`的数量。



*   **在过滤的情况下，查询角色信息**

筛选与 rating 大于 10 的 Visual Novel 相关联的角色，并且返回这些角色的 name 和 original 字段，最多返回 15 个角色。
```
{
  "sort": "name",///以名称排序
  "filters": [
    [
      "vn",
      "=",
      [
        ["rating", ">", 10] ///与 rating 大于 10 的 Visual Novel 相关联
      ]
    ]
  ],
  "fields": "name,original", ///返回这些角色的 name 和 original 字段
  "results": 15  ///最多返回 15 个角色
}
```

**4. 重要提示**

*   **速率限制:**  VNDB API 有速率限制，不保证服务的稳定性或适用性。每 5 分钟最多 200 个请求，以及每分钟最多 1 秒的执行时间。超过 3 秒的请求将被中止。这些限制对于大多数应用程序来说已经足够，但如果仍然过于限制。请确保你的开发能够处理速率限制错误，并适当地控制请求频率。
*   **字段含义:** 仔细阅读每个字段的文档说明，了解其含义和可能的值。

**5. 高级技巧**
*分页：* 如果你预期会返回大量数据，请使用分页功能逐步获取数据，避免一次性请求过多数据导致服务器压力过大。
```json
{
    "filters": [],
    "fields": "name,original,aliases,description,image{id,url,dims},blood_type,height,weight,bust,waist,hips,cup,age,birthday,sex,vns{spoiler,role,vn},traits{spoiler,lie,trait}",
    "results": 25,
    "page": 1
}
```
然后每次page增加1，直到`more`的值为false。




## HTTP 响应代码

成功的响应总是返回 `200 OK` 以及一个 JSON 响应体，或者对于 `DELETE/PATCH` 请求，返回 `204 No Content`。 但是，可能会发生错误。 错误响应代码通常后跟 `text/plain` 或 `text/html` 响应体。 以下是您可能会遇到的错误代码的非详尽列表：

| 代码  | 原因                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 400   | 无效的请求体或查询，随附的错误消息应该会指出问题所在。                                                                               |
| 401   | 无效的身份验证令牌。                                                                                                    |
| 404   | 无效的 API 路径或 HTTP 方法                                                                                          |
| 429   | 受到速率限制                                                                                                      |
| 500   | 服务器错误，如果此问题持续存在，通常表示存在错误                                                                                       |
| 502   | 服务器宕机，应该是暂时的                                                                                                   |

## 提示和故障排除

**“选择了太多数据”**

服务器会粗略估计它在响应您的查询时将生成的 JSON 键的数量，如果该估计值超过某个阈值（即，如果预计响应相当大），则会抛出错误。 此估计完全基于 "fields" 和 "results" 参数，因此您可以通过选择更少的字段或更少的结果来解决此错误。

**标识符列表**

如果您有一个（可能很大）想要获取的数据库标识符列表，那么在一个 API 调用中获取 100 个条目比进行 100 个单独的 API 调用更快更有效。 只需创建一个包含标识符的过滤器，如以下示例所示：

```bash
curl https://api.vndb.org/kana/vn --header 'Content-Type: application/json' --data '{
  "fields": "title",
  "filters": ["or"
     , ["id","=","v1"]
     , ["id","=","v2"]
     , ["id","=","v3"]
     , ["id","=","v4"]
     , ["id","=","v5"] ],
  "results": 100
}'
```

不要在单个查询中添加超过 100 个标识符。 您尤其要避免多次发送相同的标识符列表，但 "page" 数字更高，另请参见下一点。

**分页**

虽然 API 支持通过 "page" 参数进行分页，但这通常不是检索大量条目的最有效方式。 默认情况下，结果按 "id" 排序，因此您也可以通过过滤此字段来实现分页。 例如，如果您收到的最后一个条目的 id 为 "v123"，您可以通过过滤 `["id",">","v123"]` 来获取下一页。

当按其他字段排序时，这种方法往往效果不佳，因此在这种情况下，基于 "page" 的分页通常仍然是更好的解决方案。

**随机条目**

一般来说，以高性能的方式从数据库中获取随机条目非常具有挑战性。 以下是一种可以在 API 中使用的方法：首先获取最高的数据库标识符，然后选择介于 1 和最高标识符之间的随机数（包括两者），然后获取具有该 id 或最接近的递增 id 的条目，例如：

```bash
curl https://api.vndb.org/kana/vn --header 'Content-Type: application/json' --data '{
    "sort": "id",
    "reverse": true,
    "results": 1
}'
```

然后，假设您随机选择了 id v4567：

```bash
curl https://api.vndb.org/kana/vn --header 'Content-Type: application/json' --data '{
    "filters": [ "id", ">=", "v4567" ],
    "fields": "title",
    "results": 1
}'
```

第一个查询的结果可以被缓存。 如果您想缩小选择范围，可以向两个查询添加其他过滤器。 由于存在 id 间隙，此方法在其选择中略有偏差，但您很可能不需要完全统一的随机选择。