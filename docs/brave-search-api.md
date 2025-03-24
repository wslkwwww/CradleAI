## Brave Web Search API 和 Brave Local Search API 概述

**简介:** 介绍 Brave Web Search API 和 Brave Local Search API，并提供了使用示例。

**1. Brave Web Search API**

*   **简介:** Brave Web Search API 是一个 REST API，用于查询 Brave 搜索引擎并返回网页搜索结果。

*   **使用方法:**
    *   需要订阅 API 才能获得 API 密钥 (即使是免费计划也需要订阅)。
    *   使用 API 密钥通过 REST 请求查询 Brave 搜索引擎。

*   **Endpoint:**
    *   `https://api.search.brave.com/res/v1/web/search`

*   **CURL 请求示例:**

    ```bash
    curl -s --compressed "https://api.search.brave.com/res/v1/web/search?q=brave+search" \
      -H "Accept: application/json" \
      -H "Accept-Encoding: gzip" \
      -H "X-Subscription-Token: <YOUR_API_KEY>"
    ```

*   **详细信息:**  有关可用参数和预期响应的更多信息，请参阅以下页面：

    *   Query Parameters
    *   Request Headers
    *   Response Headers
    *   Response Objects
    *   WebSearchApiResponse model

**2. Brave Local Search API**

*   **简介:** Brave Local Search API 为位置搜索结果提供信息增强。

*   **访问权限:** 只有 Pro 计划可以访问 Local API。

*   **Endpoint:**

    *   **获取位置信息 (包括图片和相关网页结果):** `https://api.search.brave.com/res/v1/local/pois`
        *   支持批量获取，一次请求最多可以获取 20 个位置的额外信息。
    *   **获取位置的 AI 生成描述:** `https://api.search.brave.com/res/v1/local/descriptions`

*   **使用方法:**
    1.  首先向 Web Search API 发送包含位置相关信息的查询请求。
    2.  如果查询返回位置列表，则每个位置结果都有一个 `id` 字段（临时 ID）。
    3.  可以使用此 `id` 字段通过 Local Search API 获取有关该位置的额外信息。

*   **CURL 请求示例:**

    *   **Web Search API (获取位置列表):**

        ```bash
        curl -s --compressed "https://api.search.brave.com/res/v1/web/search?q=greek+restaurants+in+san+francisco" \
          -H "Accept: application/json" \
          -H "Accept-Encoding: gzip" \
          -H "X-Subscription-Token: <YOUR_API_KEY>"
        ```

        **位置结果示例:**

        ```json
        {
          "locations": {
            "results": [
              {
                "id": "1520066f3f39496780c5931d9f7b26a6",
                "title": "Pangea Banquet Mediterranean Food"
              },
              {
                "id": "d00b153c719a427ea515f9eacf4853a2",
                "title": "Park Mediterranean Grill"
              },
              {
                "id": "4b943b378725432aa29f019def0f0154",
                "title": "The Halal Mediterranean Co."
              }
            ]
          }
        }
        ```

    *   **Local Search API (获取位置额外信息):**

        ```bash
        curl -s --compressed "https://api.search.brave.com/res/v1/local/pois?ids=1520066f3f39496780c5931d9f7b26a6&ids=d00b153c719a427ea515f9eacf4853a2" \
          -H "accept: application/json" \
          -H "Accept-Encoding: gzip" \
          -H "x-subscription-token: <YOUR_API_KEY>"
        ```

    *   **Local Search API (获取位置的 AI 生成描述):**

        ```bash
        curl -s --compressed "https://api.search.brave.com/res/v1/local/descriptions?ids=1520066f3f39496780c5931d9f7b26a6&ids=d00b153c719a427ea515f9eacf4853a2" \
          -H "accept: application/json" \
          -H "Accept-Encoding: gzip" \
          -H "x-subscription-token: <YOUR_API_KEY>"
        ```


## Brave Web Search API 和 Brave Local Search API 的 Query Parameters

### Web Search API

**简介:** This table lists the query parameters supported by the Web Search API. Some are required, but most are optional.

| Parameter         | Required | Type         | Default    | Description |
|------------------|----------|--------------|------------|-------------|
| `q`              | true     | string       |            | The user's search query term. Query can not be empty. Maximum of 400 characters and 50 words in the query. |
| `country`        | false    | string       | `CN`       | The search query country, where the results come from. The country string is limited to 2 character country codes of supported countries. For a list of supported values, see . |
| `search_lang`    | false    | string       | `zh-hans`       | The search language preference. The 2 or more character language code for which the search results are provided. For a list of possible values |
| `ui_lang`        | false    | string       | `zh-CN`    | User interface language preferred in response. Usually of the format '`<language_code>-<country_code>`'. |
| `count`          | false    | number       | `20`       | The number of search results returned in response. The maximum is 20. The actual number delivered may be less than requested. Combine this parameter with offset to paginate search results. |
| `offset`         | false    | number       | `0`        | The zero based offset that indicates number of search results per page (count) to skip before returning the result. The maximum is 9. The actual number delivered may be less than requested based on the query. |
| `safesearch`     | false    | string       | `moderate` | Filters search results for adult content. The following values are supported: `off`: No filtering is done. `moderate`: Filters explicit content. `strict`: Drops all adult content from search results. |
| `freshness`      | false    | string       |            | Filters search results by when they were discovered. Values: `pd` (24h), `pw` (7d), `pm` (31d), `py` (365d), or date range like `2022-04-01to2022-07-30`. |
| `text_decorations`| false    | bool         | `1`        | Whether display strings should include decoration markers. |
| `spellcheck`     | false    | bool         | `1`        | Whether to spellcheck provided query. Modified query can be found in `altered` key from response model. |
| `result_filter`  | false    | string       |            | Comma delimited string of result types to include (discussions, faq, infobox, news, query, summarizer, videos, web, locations). |
| `goggles_id`     | false    | string       |            | (Deprecated) Custom re-ranking ID. Use `goggles` parameter instead. |
| `goggles`        | false    | string       |            | Custom re-ranking URL or definition. 
| `units`          | false    | string       |            | Measurement units (`metric` or `imperial`). Defaults based on search country. |
| `extra_snippets` | false    | bool         |            | Get up to 5 additional excerpt alternatives. Available in Free AI and higher plans. |
| `summary`        | false    | bool         |            | Enables summary key generation in web search results. |

### Local Search API

**简介:** This table lists the query parameters supported by the Local Search API. Some are required, but most are optional.

| Parameter    | Required | Type         | Default    | Description |
|-------------|----------|--------------|------------|-------------|
| `ids`       | true     | list[string] |            | Unique identifier for locations. Maximum 20 ids per request. |
| `search_lang`| false    | string       | `zh-hans`       | Search language preference.. |
| `ui_lang`   | false    | string       | `zh-CN`    | UI language preferred in response. . |
| `units`     | false    | string       |            | Measurement units (`metric` or `imperial`). Defaults based on search country. |

## Brave Web Search API 和 Local Search API 请求头

以下表格列出了 Web Search API 和 Local Search API 支持的请求头。大多数请求头是可选的，但请注意，在请求头中发送更多信息（例如客户端位置）将改善搜索结果。

**Web Search API 请求头**

| 请求头             | 必填 | 名称           | 描述                                                                                                                                                           |
| ------------------ | ---- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accept             | 否   | Accept         | 默认支持的媒体类型是 `application/json`。                                                                                                                     |
| Accept-Encoding    | 否   | Accept Encoding | 支持的压缩类型是 `gzip`。                                                                                                                                      |
| Api-Version        | 否   | Web Search API Version | 要使用的 Brave Web Search API 版本。格式为 YYYY-MM-DD。 默认使用最新版本，旧版本可以在 API Changelog 中找到。                                                                                                    |
| Cache-Control      | 否   | Cache Control  | 默认情况下，搜索将返回缓存的 Web 搜索结果。要禁止缓存，请将 `Cache-Control` 请求头设置为 `no-cache`。这目前是尽力而为。                                                                      |
| User-Agent         | 否   | User Agent     | 发送请求的客户端的 User-Agent。 搜索可以使用 User-Agent 根据发送请求的客户端提供不同的体验。                                                                                                      |
|                    |      |                | User-Agent 应遵循每个平台上常用的浏览器 User-Agent 字符串。 有关管理 User-Agent 的更多信息，请参阅 RFC 9110。                                                                                         |
|                    |      |                | **User-Agent 字符串示例（按平台）:**                                                                                                                              |
|                    |      |                | *   Android: `Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36`                     |
|                    |      |                | *   iOS: `Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1`           |
|                    |      |                | *   macOS: `Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/`                                                    |
|                    |      |                | *   Windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/`                                                       |
| X-Loc-Lat          | 否   | Latitude       | 客户端地理位置的纬度，以度为单位，用于提供相关的本地结果。 纬度必须大于等于 -90.0 度且小于等于 +90.0 度。                                                                                         |
| X-Loc-Long         | 否   | Longitude      | 客户端地理位置的经度，以度为单位，用于提供相关的本地结果。 经度必须大于等于 -180.0 度且小于等于 +180.0 度。                                                                                       |
| X-Loc-Timezone     | 否   | Timezone       | 客户端设备的 IANA 时区，例如 `America/New_York`。                                                                                                                   |
|                    |      |                | 有关 IANA 时区和位置映射的完整列表，请参阅 [IANA Database](https://www.iana.org/time-zones) 和 [Geonames Database](https://www.geonames.org/)。                              |
| X-Loc-City         | 否   | City Name      | 客户端城市的通用名称。                                                                                                                                          |
| X-Loc-State        | 否   | State Code     | 代表客户端州/地区的代码，最多可以包含 3 个字符。                                                                                                                      |
|                    |      |                | 该地区是 ISO 3166-2 代码的第一级细分（最广泛或最不具体）。                                                                                                               |
| X-Loc-State-Name   | 否   | State Name     | 客户端州/地区的名称。                                                                                                                                            |
|                    |      |                | 该地区是 ISO 3166-2 代码的第一级细分（最广泛或最不具体）。                                                                                                               |
| X-Loc-Country      | 否   | Country Code   | 客户端国家的双字母代码。                                                                                                                                          |
|                    |      |                | 有关国家代码列表，请参阅 [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)。                                                                       |
| X-Loc-Postal-Code  | 否   | Postal Code    | 客户端位置的邮政编码。                                                                                                                                          |
| X-Subscription-Token | 是   | Authentication token | 用于验证请求的已订阅计划的密钥。可以从 [API Keys](链接不存在) 获取。                                                                                                                   |

**Local Search API 请求头**

| 请求头             | 必填 | 名称           | 描述                                                                                                                                                           |
| ------------------ | ---- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accept             | 否   | Accept         | 默认支持的媒体类型是 `application/json`。                                                                                                                     |
| Accept-Encoding    | 否   | Accept Encoding | 支持的压缩类型是 `gzip`。                                                                                                                                      |
| Api-Version        | 否   | Web Search API Version | 要使用的 Brave Web Search API 版本。格式为 YYYY-MM-DD。 默认使用最新版本，旧版本可以在 API Changelog 中找到。                                                                                                    |
| Cache-Control      | 否   | Cache Control  | 默认情况下，搜索将返回缓存的 Web 搜索结果。要禁止缓存，请将 `Cache-Control` 请求头设置为 `no-cache`。这目前是尽力而为。                                                                      |
| User-Agent         | 否   | User Agent     | 发送请求的客户端的 User-Agent。 搜索可以使用 User-Agent 根据发送请求的客户端提供不同的体验。                                                                                                      |
|                    |      |                | User-Agent 应遵循每个平台上常用的浏览器 User-Agent 字符串。 有关管理 User-Agent 的更多信息，请参阅 RFC 9110。                                                                                         |
|                    |      |                | **User-Agent 字符串示例（按平台）:**                                                                                                                              |
|                    |      |                | *   Android: `Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36`                     |
|                    |      |                | *   iOS: `Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1`           |
|                    |      |                | *   macOS: `Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/`                                                    |
|                    |      |                | *   Windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/`                                                       |
| X-Subscription-Token | 是   | Authentication token | 用于验证请求的已订阅计划的密钥。可以从 [API Keys](链接不存在) 获取。                                                                                                                   |

**总结:**

*   **必填项:**  `X-Subscription-Token` 是 Web Search API 和 Local Search API 中**唯一**的必填请求头。
*   **改进结果:**  提供地理位置信息 (例如 `X-Loc-Lat`, `X-Loc-Long`, `X-Loc-Country` 等) 可以改善搜索结果，使其更贴近用户所在地区。
*   **User-Agent:**  提供合适的 `User-Agent` 可以帮助 API 针对不同客户端提供优化体验。
*   **缓存控制:**  可以使用 `Cache-Control: no-cache` 来强制 API 不返回缓存结果，但效果可能不是百分之百。
*   **API 版本:**  可以使用 `Api-Version`  来指定要使用的 API 版本，默认为最新版本。


## Brave Image Search API

**简介:** Brave Image Search API 是一个 REST API，用于查询图片搜索结果。

*   **Endpoint:**
    *   `https://api.search.brave.com/res/v1/images/search`

*   **授权要求:**
    *   需要订阅 API 才能获得 API 密钥 (即使是免费计划也需要订阅)
    *   在 API Keys 部分获取密钥

*   **CURL 请求示例:**

    ```bash
    curl -s --compressed "https://api.search.brave.com/res/v1/images/search?q=munich&safesearch=strict&count=20&search_lang=en&country=us&spellcheck=1" \
      -H "Accept: application/json" \
      -H "Accept-Encoding: gzip" \
      -H "X-Subscription-Token: <YOUR_API_KEY>"
    ```

*   **支持参数:** 支持 Web Search API 的通用参数，如：
    *   `q` - 搜索查询词
    *   `safesearch` - 安全搜索级别
    *   `count` - 返回结果数量
    *   `search_lang` - 搜索语言
    *   `country` - 搜索国家/地区
    *   `spellcheck` - 拼写检查

*   **请求头要求:** 与 Web Search API 相同，支持通用请求头如：
    *   Accept
    *   Accept-Encoding
    *   X-Subscription-Token (必需)


## Brave Image Search API Query Parameters

**简介:** This part details the query parameters available for the Brave Search Image Search API. While the `q` parameter is mandatory, the rest are optional and offer fine-grained control over your search results.

| Parameter   | Required | Type    | Default | Description                                                                                                                                                                                  |
| :---------- | :------- | :------ | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`         | **Yes**  | String  |         | **The user's search query.**  Cannot be empty. Maximum length: 400 characters or 50 words.                                                                                                  |
| `country`   | No       | String  | `US`    | **The country where the search results originate.**  Must be a 2-character country code (e.g., `US`, `GB`, `DE`).  See the [Country Codes](#country-codes) section for a list of supported values. |
| `search_lang` | No       | String  | `en`    | **The preferred language for the search results.**  Must be a 2-or-more character language code (e.g., `en`, `fr`, `de`). See the [Language Codes](#language-codes) section for supported values.   |
| `count`     | No       | Number  | `50`    | **The number of search results to return.**  Maximum: `100`. The API might return fewer results than requested.                                                                            |
| `safesearch`  | No       | String  | `strict`| **Filters for adult content.**  Valid options:  `off` (no filtering), `strict` (removes adult content).                                                                                                 |
| `spellcheck`  | No       | Boolean | `1`     | **Enables spellchecking for the query.**  If enabled (`1` or `true`), the spellchecked query will be used for the search, and the corrected query can be found in the `altered` key of the response. |

## Brave Image Search API Request Headers

下表列出了图片搜索 API 支持的请求头，其中大部分是可选的。

| 请求头 | 必需 | 名称 | 描述 |
|--------|------|------|------|
| Accept | 否 | Accept | 默认支持的媒体类型是 `application/json`。 |
| Accept-Encoding | 否 | Accept Encoding | 支持的压缩类型是 `gzip`。 |
| Api-Version | 否 | Web Search API Version | 要使用的 Brave Web Search API 版本。格式为 `YYYY-MM-DD`。默认使用最新版本，以前的版本可以在 API 变更日志中找到。 |
| Cache-Control | 否 | Cache Control | 默认情况下，搜索将返回缓存的 Web 搜索结果。要防止缓存，请将 `Cache-Control` 标头设置为 `no-cache`。目前这是尽最大努力完成的。 |
| User-Agent | 否 | User Agent | 发送请求的客户端的用户代理。搜索可以利用用户代理根据发送请求的客户端提供不同的体验。 |
| | | | **用户代理字符串示例（按平台）：** |
| | | | • Android: `Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36` |
| | | | • iOS: `Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1` |
| | | | • macOS: `Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/` |
| | | | • Windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/` |
| X-Subscription-Token | 是 | Authentication token | 用于验证请求的订阅计划的密钥令牌。可以从 API 密钥中获取。 |

## Brave Search response object

**简介:** 这份文档是关于各种API响应对象的参考，对于理解API返回的数据结构和字段含义非常重要。开发者可以根据这些定义来解析和使用API返回的数据。 涵盖了Web搜索、本地搜索、图片、视频、新闻、产品等多种类型的搜索结果，以及各种辅助信息，如评分、评论、营业时间、地理位置等。

**1. WebSearchApiResponse (网络搜索API响应)**

*   **描述：** 成功的Web搜索API请求的顶级响应模型。根据订阅的计划、查询相关性或应用的`result_filter`查询参数，响应将包含相关的键。API也可能根据无效的订阅密钥和速率限制事件返回错误响应。
*   **字段：**
    *   `type` (字符串):  **必需**。Web搜索API结果的类型。值始终为"search"。
    *   `discussions` (Discussions): 可选。从与查询相关的论坛帖子中聚合的讨论群组。
    *   `faq` (FAQ): 可选。与搜索查询相关的常见问题。
    *   `infobox` (GraphInfobox): 可选。以信息框形式显示的可聚合的实体信息。
    *   `locations` (Locations): 可选。与位置敏感查询相关的兴趣点(POI)。
    *   `mixed` (MixedResponse): 可选。搜索结果的首选排名顺序。
    *   `news` (News): 可选。与查询相关的新闻结果。
    *   `query` (Query): 可选。搜索查询字符串及其用于搜索的修改。
    *   `videos` (Videos): 可选。与查询相关的视频。
    *   `web` (Search): 可选。与查询相关的Web搜索结果。
    *   `summarizer` (Summarizer): 可选。用于获取查询摘要结果的摘要键。
    *   `rich` (RichCallbackInfo): 可选。富媒体结果的回调信息。

**2. LocalPoiSearchApiResponse (本地兴趣点搜索API响应)**

*   **描述：** 成功的本地搜索API请求的顶级响应模型，用于获取位置的额外信息。 响应将包含与请求中的ID相对应的位置结果列表。在请求的ID过多、无效的订阅密钥和速率限制事件等情况下，API也可能返回错误响应。访问本地搜索API需要订阅Pro计划。
*   **字段：**
    *   `type` (字符串):  **必需**。本地兴趣点搜索API结果的类型。值始终为"local_pois"。
    *   `results` (LocationResult列表): 可选。与请求中的ID匹配的位置结果。

**3. LocalDescriptionsSearchApiResponse (本地描述搜索API响应)**

*   **描述：** 成功的本地搜索API请求的顶级响应模型，用于获取位置的AI生成的描述。 响应包括与请求中的ID相对应的生成的描述列表。在请求的ID过多、无效的订阅密钥和速率限制事件等情况下，API也可能返回错误响应。访问本地搜索API需要订阅Pro计划。
*   **字段：**
    *   `type` (字符串):  **必需**。本地描述搜索API结果的类型。值始终为"local_descriptions"。
    *   `results` (LocationDescription列表): 可选。与请求中的ID匹配的位置描述。

**4. Query (查询)**

*   **描述：** 表示围绕请求的查询收集的信息的模型。
*   **字段：**
    *   `original` (字符串):  **必需**。原始查询。
    *   `show_strict_warning` (布尔值): 可选。是否因为安全搜索而限制了响应，但查询还有更多内容可用。
    *   `altered` (字符串): 可选。执行搜索时更改后的查询。
    *   `safesearch` (布尔值): 可选。是否启用了安全搜索。
    *   `is_navigational` (布尔值): 可选。查询是否为导航到域的查询。
    *   `is_geolocal` (布尔值): 可选。查询是否具有位置相关性。
    *   `local_decision` (字符串): 可选。是否确定查询对位置敏感。
    *   `local_locations_idx` (整数): 可选。位置的索引。
    *   `is_trending` (布尔值): 可选。查询是否为热门查询。
    *   `is_news_breaking` (布尔值): 可选。查询是否具有相关的新闻突发文章。
    *   `ask_for_location` (布尔值): 可选。查询是否需要位置信息才能获得更好的结果。
    *   `language` (Language): 可选。从查询中收集的语言信息。
    *   `spellcheck_off` (布尔值): 可选。是否关闭了拼写检查器。
    *   `country` (字符串): 可选。使用的国家/地区。
    *   `bad_results` (布尔值): 可选。查询是否存在不良结果。
    *   `should_fallback` (布尔值): 可选。查询是否应使用回退。
    *   `lat` (字符串): 可选。与查询关联的收集到的位置纬度。
    *   `long` (字符串): 可选。与查询关联的收集到的位置经度。
    *   `postal_code` (字符串): 可选。收集到的邮政编码。
    *   `city` (字符串): 可选。收集到的城市。
    *   `state` (字符串): 可选。收集到的州。
    *   `header_country` (字符串): 可选。请求来源的国家/地区。
    *   `more_results_available` (布尔值): 可选。对于给定的查询，是否有更多结果可用。
    *   `custom_location_label` (字符串): 可选。附加到查询的任何自定义位置标签。
    *   `reddit_cluster` (字符串): 可选。与查询关联的任何Reddit群组。

**5. Discussions (讨论)**

*   **描述：** 表示与查询相关的讨论群组的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。标识讨论群组的类型。当前值始终为"search"。
    *   `results` (DiscussionResult列表):  **必需**。讨论结果的列表。
    *   `mutated_by_goggles` (布尔值):  **必需**。讨论结果是否由Goggle更改。默认为False。

**6. DiscussionResult (SearchResult) (讨论结果)**

*   **描述：** 讨论结果。 这些是与搜索查询相关的论坛帖子和讨论。
*   **字段：**
    *   `type` (字符串):  **必需**。讨论结果类型标识符。值始终为"discussion"。
    *   `data` (ForumData): 可选。相关论坛帖子的丰富聚合数据。

**7. ForumData (论坛数据)**

*   **描述：** 定义来自讨论论坛的结果。
*   **字段：**
    *   `forum_name` (字符串):  **必需**。论坛的名称。
    *   `num_answers` (整数): 可选。帖子的答案数。
    *   `score` (字符串): 可选。帖子在论坛上的得分。
    *   `title` (字符串):  **必需**。帖子在论坛上的标题。
    *   `question` (字符串):  **必需**。帖子在论坛上的标题。
    *   `top_comment` (字符串):  **必需**。帖子在论坛上的标题。

**8. FAQ (常见问题)**

*   **描述：** 与搜索查询词相关的常见问题。
*   **字段：**
    *   `type` (字符串):  **必需**。FAQ结果类型标识符。值始终为"faq"。
    *   `results` (QA列表):  **必需**。与查询相关的聚合问题答案结果列表。

**9. QA (问答)**

*   **描述：** 问题答案结果。
*   **字段：**
    *   `question` (字符串):  **必需**。提出的问题。
    *   `answer` (字符串):  **必需**。问题的答案。
    *   `title` (字符串):  **必需**。帖子的标题。
    *   `url` (字符串):  **必需**。指向帖子的URL。
    *   `meta_url` (MetaUrl): 可选。有关URL的聚合信息。

**10. MetaUrl (元URL)**

*   **描述：** 关于URL的聚合信息
*   **字段：**
    *   `scheme` (字符串): **必需**。从URL提取的协议方案。
    *   `netloc` (字符串): **必需**。从URL提取的网络位置部分。
    *   `hostname` (字符串): 可选。从URL提取的小写域名。
    *   `favicon` (字符串): **必需**。用于URL的favicon。
    *   `path` (字符串): **必需**。URL的层次结构路径，用作显示字符串。

**11. Search (搜索)**

*   **描述：** 表示Web搜索结果集合的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。标识Web搜索结果的类型。值始终为"search"。
    *   `results` (SearchResult列表):  **必需**。搜索结果的列表。
    *   `family_friendly` (布尔值):  **必需**。结果是否适合家庭。

**12. SearchResult (Result) (搜索结果)**

*   **描述：** 有关与查询相关的Web搜索结果的聚合信息。
*   **字段：**
    *   `type` (字符串):  **必需**。标识Web搜索结果的类型。值始终为"search_result"。
    *   `subtype` (字符串):  **必需**。用于标识 Web 搜索结果类型的子类型。"generic"
    *   `is_live` (布尔值):  **必需**。Web搜索结果当前是否有效。默认值为False。
    *   `deep_results` (DeepResult): 可选。有关Web搜索结果的收集信息。
    *   `schemas` (列表[列表]): 可选。从页面提取的模式（结构化数据）列表。这些模式尝试遵循schema.org，并将返回我们可以从HTML中提取的任何可以放入这些模型中的内容。
    *   `meta_url` (MetaUrl): 可选。与Web搜索结果关联的URL的聚合信息。
    *   `thumbnail` (Thumbnail): 可选。Web搜索结果的缩略图。
    *   `age` (字符串): 可选。表示Web搜索结果年龄的字符串。
    *   `language` (字符串):  **必需**。Web搜索结果中的主要语言。
    *   `location` (LocationResult): 可选。如果查询与餐厅相关，则为位置详细信息。
    *   `video` (VideoData): 可选。与Web搜索结果关联的视频。
    *   `movie` (MovieData): 可选。与Web搜索结果关联的电影。
    *   `faq` (FAQ): 可选。与Web搜索结果关联的任何常见问题。
    *   `qa` (QAPage): 可选。与Web搜索结果页面关联的任何问答信息。
    *   `book` (Book): 可选。与Web搜索结果页面关联的任何图书信息。
    *   `rating` (Rating): 可选。为Web搜索结果页面找到的评分。
    *   `article` (Article): 可选。为Web搜索结果页面找到的文章。
    *   `product` (ProductReview): 可选。在Web搜索结果页面上找到的主要产品和评论。
    *   `product_cluster` (ProductReview列表): 可选。在Web搜索结果页面上找到的产品和评论列表。
    *   `cluster_type` (字符串): 可选。表示群集的类型。该值可以是product_cluster。
    *   `cluster` (Result列表): 可选。Web搜索结果列表。
    *   `creative_work` (CreativeWork): 可选。在Web搜索结果上找到的创意作品的聚合信息。
    *   `music_recording` (MusicRecording): 可选。在Web搜索结果上找到的音乐录音的聚合信息。
    *   `review` (Review): 可选。在Web搜索结果上找到的评论的聚合信息。
    *   `software` (Software): 可选。在Web搜索结果页面上找到的软件产品的聚合信息。
    *   `recipe` (Recipe): 可选。在Web搜索结果页面上找到的食谱的聚合信息。
    *   `organization` (Organization): 可选。在Web搜索结果页面上找到的组织的聚合信息。
    *   `content_type` (字符串): 可选。与搜索结果页面关联的内容类型。
    *   `extra_snippets` (字符串列表): 可选。Web搜索结果的其他备用代码段的列表。

**13. Result (结果)**

*   **描述：** 表示Web搜索结果的模型。
*   **字段：**
    *   `title` (字符串):  **必需**。网页的标题。
    *   `url` (字符串):  **必需**。提供页面的URL。
    *   `is_source_local` (布尔值):  **必需**。
    *   `is_source_both` (布尔值):  **必需**。
    *   `description` (字符串): 可选。网页的描述。
    *   `page_age` (字符串): 可选。表示网页年龄的日期。
    *   `page_fetched` (字符串): 可选。表示上次提取网页的时间的日期。
    *   `profile` (Profile): 可选。与网页关联的配置文件。
    *   `language` (字符串): 可选。网页的语言分类。
    *   `family_friendly` (布尔值):  **必需**。网页是否适合家庭。

**14. AbstractGraphInfobox (Result) (抽象图形信息框)**

*   **描述：** 从知识图谱中共享实体的聚合信息。
*   **字段：**
    *   `type` (字符串):  **必需**。信息框结果类型标识符。值始终为"infobox"。
    *   `position` (整数):  **必需**。搜索结果页面上的位置。
    *   `label` (字符串): 可选。与实体关联的任何标签。
    *   `category` (字符串): 可选。实体的类别分类。
    *   `long_desc` (字符串): 可选。实体的较长描述。
    *   `thumbnail` (Thumbnail): 可选。与实体关联的缩略图。
    *   `attributes` (字符串列表列表): 可选。有关实体的属性列表。
    *   `profiles` (Profile列表 | DataProvider列表): 可选。与实体关联的配置文件。
    *   `website_url` (字符串): 可选。与实体相关的官方网站。
    *   `ratings` (Rating列表): 可选。给予实体的任何评级。
    *   `providers` (DataProvider列表): 可选。实体的数据源列表。
    *   `distance` (Unit): 可选。表示与实体相关的数量的单位。
    *   `images` (Thumbnail列表): 可选。与实体相关的图像列表。
    *   `movie` (MovieData): 可选。与实体相关的任何电影数据。 仅当结果是电影时才会显示。

**15. GenericInfobox (AbstractGraphInfobox) (通用信息框)**

*   **描述：** 来自知识图谱的通用实体的聚合信息。
*   **字段：**
    *   `subtype` (字符串):  **必需**。信息框子类型标识符。值始终为"generic"。
    *   `found_in_urls` (字符串列表): 可选。找到实体的URL列表。

**16. EntityInfobox (AbstractGraphInfobox) (实体信息框)**

*   **描述：** 来自知识图谱的实体的聚合信息。
*   **字段：**
    *   `subtype` (字符串):  **必需**。信息框子类型标识符。值始终为"entity"。

**17. QAInfobox (AbstractGraphInfobox) (问答信息框)**

*   **描述：** 问答信息框
*   **字段：**
    *   `subtype` (字符串):  **必需**。信息框子类型标识符。值始终为"code"。
    *   `data` (QAPage): **必需**。问题和相关答案。
    *   `meta_url` (MetaUrl): 可选。包含问题和相关答案的页面的详细信息。

**18. InfoboxWithLocation (AbstractGraphInfobox) (带有位置的信息框)**

*   **描述：** 带有位置的信息框。
*   **字段：**
    *   `subtype` (字符串):  **必需**。信息框子类型标识符。值始终为"location"。
    *   `is_location` (布尔值):  **必需**。实体是否为位置。
    *   `coordinates` (浮点数列表): 可选。位置的坐标。
    *   `zoom_level` (整数):  **必需**。地图缩放级别。
    *   `location` (LocationResult): 可选。位置结果。

**19. InfoboxPlace (AbstractGraphInfobox) (信息框位置)**

*   **描述：** 位置的信息框，例如企业。
*   **字段：**
    *   `subtype` (字符串):  **必需**。信息框子类型标识符。值始终为"place"。
    *   `location` (LocationResult): **必需**。位置结果。

**20. GraphInfobox (图形信息框)**

*   **描述：** 显示为信息框的实体的聚合信息。
*   **字段：**
    *   `type` (字符串):  **必需**。信息框的类型标识符。值始终为"graph"。
    *   `results` (GenericInfoboxQAInfoboxInfoboxPlaceInfoboxWithLocationEntityInfobox):  **必需**。与查询关联的信息框列表。

**21. QAPage (问答页面)**

*   **描述：** 从问答页面聚合的结果。
*   **字段：**
    *   `question` (字符串):  **必需**。要问的问题。
    *   `answer` (Answer):  **必需**。问题的答案。

**22. Answer (答案)**

*   **描述：** 表示论坛上问题的答案的响应。
*   **字段：**
    *   `text` (字符串):  **必需**。答案的主要内容。
    *   `author` (字符串): 可选。答案作者的姓名。
    *   `upvoteCount` (整数): 可选。答案的赞成票数。
    *   `downvoteCount` (整数): 可选。答案的反对票数。

**23. Thumbnail (缩略图)**

*   **描述：** 表示图片缩略图的聚合详细信息。
*   **字段：**
    *   `src` (字符串):  **必需**。提供的图片缩略图的URL。
    *   `original` (字符串): 可选。图像的原始URL。

**24. LocationWebResult (Result) (位置Web结果)**

*   **描述：** 表示与位置相关的Web结果的模型。
*   **字段：**
    *   `meta_url` (MetaUrl):  **必需**。有关URL的聚合信息。

**25. LocationResult (Result) (位置结果)**

*   **描述：** 与位置相关的结果。
*   **字段：**
    *   `type` (字符串):  **必需**。位置结果类型标识符。值始终为"location_result"。
    *   `id` (字符串): 可选。与此结果关联的临时ID，可用于检索有关位置的额外信息。有效期为8小时…
    *   `provider_url` (字符串):  **必需**。提供者的完整URL。
    *   `coordinates` (浮点数列表): 可选。与位置关联的坐标列表。这是表示为浮点数的纬度经度。
    *   `zoom_level` (整数):  **必需**。地图上的缩放级别。
    *   `thumbnail` (Thumbnail): 可选。与位置关联的缩略图。
    *   `postal_address` (PostalAddress): 可选。与位置关联的邮政地址。
    *   `opening_hours` (OpeningHours): 可选。如果是企业，则为与位置关联的营业时间。
    *   `contact` (Contact): 可选。与位置关联的企业的联系方式。
    *   `price_range` (字符串): 可选。用于显示企业价格分类的显示字符串。
    *   `rating` (Rating): 可选。企业的评分。
    *   `distance` (Unit): 可选。位置与客户端的距离。
    *   `profiles` (DataProvider列表): 可选。与企业关联的配置文件。
    *   `reviews` (Reviews): 可选。来自与企业相关的各种来源的聚合评论。
    *   `pictures` (PictureResults): 可选。与企业关联的一堆图片。
    *   `action` (Action): 可选。要采取的措施。
    *   `serves_cuisine` (字符串列表): 可选。提供的菜肴类别列表。
    *   `categories` (字符串列表): 可选。类别列表。
    *   `icon_category` (字符串): 可选。图标类别。
    *   `results` (LocationWebResult): 可选。与此位置相关的Web结果。
    *   `timezone` (字符串): 可选。IANA 时区标识符。
    *   `timezone_offset` (字符串): 可选。时区的 UTC 偏移量。

**26. LocationDescription (位置描述)**

*   **描述：** 位置结果的AI生成的描述。
*   **字段：**
    *   `type` (字符串):  **必需**。位置描述的类型。值始终为"local_description"。
    *   `id` (字符串):  **必需**。具有此描述的位置的临时ID。
    *   `description` (字符串): 可选。具有给定ID的位置的AI生成的描述。

**27. Locations (位置)**

*   **描述：** 表示位置结果的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。位置类型标识符。值始终为"locations"。
    *   `results` (LocationResult列表):  **必需**。位置敏感结果的聚合列表。

**28. MixedResponse (混合响应)**

*   **描述：** 搜索结果页面上结果的排名顺序。
*   **字段：**
    *   `type` (字符串):  **必需**。表示模型混合的类型。值始终为"mixed"。
    *   `main` (ResultReference列表): 可选。搜索结果页面主要部分的排名顺序。
    *   `top` (ResultReference列表): 可选。搜索结果页面顶部部分的排名顺序。
    *   `side` (ResultReference列表): 可选。搜索结果页面侧面部分的排名顺序。

**29. ResultReference (结果引用)**

*   **描述：** 搜索结果页面上结果的排名顺序。
*   **字段：**
    *   `type` (字符串):  **必需**。结果的类型。
    *   `index` (整数): 可选。放置结果的从0开始的索引。
    *   `all` (布尔值):  **必需**。是否将类型的所有结果都放在特定位置。

**30. Videos (视频)**

*   **描述：** 表示视频结果的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。表示视频的类型。值始终为"videos"。
    *   `results` (VideoResult列表):  **必需**。视频结果的列表。
    *   `mutated_by_goggles` (布尔值): 可选。视频结果是否由Goggle更改。默认为False。

**31. News (新闻)**

*   **描述：** 表示新闻结果的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。表示新闻的类型。值始终为"news"。
    *   `results` (NewsResult列表):  **必需**。新闻结果的列表。
    *   `mutated_by_goggles` (布尔值): 可选。新闻结果是否由Goggle更改。默认为False。

**32. NewsResult (Result) (新闻结果)**

*   **描述：** 表示新闻结果的模型。
*   **字段：**
    *   `meta_url` (MetaUrl): 可选。表示新闻结果的URL上的聚合信息
    *   `source` (字符串): 可选。新闻的来源。
    *   `breaking` (布尔值):  **必需**。新闻结果当前是否为突发新闻。
    *   `is_live` (布尔值):  **必需**。新闻结果当前是否为直播。
    *   `thumbnail` (Thumbnail): 可选。与新闻结果关联的缩略图。
    *   `age` (字符串): 可选。表示新闻文章年龄的字符串。
    *   `extra_snippets` (字符串列表): 可选。新闻搜索结果的其他备用代码段的列表。

**33. PictureResults (图片结果)**

*   **描述：** 表示图片列表的模型。
*   **字段：**
    *   `viewMoreUrl` (字符串): 可选。用于查看更多图片的URL。
    *   `results` (Thumbnail列表):  **必需**。缩略图结果的列表。

**34. Action (操作)**

*   **描述：** 表示要采取的操作的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。表示操作的类型。
    *   `url` (字符串):  **必需**。表示要采取的操作的URL。

**35. PostalAddress (邮政地址)**

*   **描述：** 表示位置的邮政地址的模型
*   **字段：**
    *   `type` (字符串):  **必需**。标识邮政地址的类型。值始终为PostalAddress。
    *   `country` (字符串): 可选。与位置关联的国家/地区。
    *   `postalCode` (字符串): 可选。与位置关联的邮政编码。
    *   `streetAddress` (字符串): 可选。与位置关联的街道地址。
    *   `addressRegion` (字符串): 可选。与位置关联的区域。这通常是一个州。
    *   `addressLocality` (字符串): 可选。与位置关联的地址位置或子区域。
    *   `displayAddress` (字符串):  **必需**。显示的地址字符串。

**36. OpeningHours (营业时间)**

*   **描述：** 特定位置的企业营业时间。
*   **字段：**
    *   `current_day` (DayOpeningHours列表): 可选。当前的营业时间。可以有两个营业时间设置。
    *   `days` (DayOpeningHours列表列表): 可选。整个星期的营业时间。

**37. DayOpeningHours (每日营业时间)**

*   **描述：** 表示特定位置的特定企业的特定日期营业时间的模型。
*   **字段：**
    *   `abbr_name` (字符串):  **必需**。表示星期几的短字符串。
    *   `full_name` (字符串):  **必需**。表示星期几的完整字符串。
    *   `opens` (字符串):  **必需**。企业在特定日期的营业时间的24小时制时钟时间字符串。
    *   `closes` (字符串):  **必需**。企业在特定日期的营业时间的24小时制时钟时间字符串。

**38. Contact (联系方式)**

*   **描述：** 表示实体的联系信息的模型。
*   **字段：**
    *   `email` (字符串): 可选。电子邮件地址。
    *   `telephone` (字符串): 可选。电话号码。

**39. DataProvider (数据提供者)**

*   **描述：** 表示与实体关联的数据提供程序的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。表示数据来源的类型。这通常是外部的。
    *   `name` (字符串):  **必需**。数据提供程序的名称。这可以是一个域。
    *   `url` (字符串):  **必需**。信息来源的URL。
    *   `long_name` (字符串): 可选。数据提供程序的长名称。
    *   `img` (字符串): 可选。提供的图像数据的URL。

**40. Profile (个人资料)**

*   **描述：** 实体的配置文件。
*   **字段：**
    *   `name` (字符串):  **必需**。配置文件的名称。
    *   `long_name` (字符串):  **必需**。配置文件的长名称。
    *   `url` (字符串): 可选。提供配置文件的原始URL。
    *   `img` (字符串): 可选。表示配置文件的提供的图像URL。

**41. Unit (单位)**

*   **描述：** 表示测量单位的模型。
*   **字段：**
    *   `value` (浮点数):  **必需**。单位的数量。
    *   `units` (字符串):  **必需**。与数量关联的单位名称。

**42. MovieData (电影数据)**

*   **描述：** 电影结果的聚合数据。
*   **字段：**
    *   `name` (字符串): 可选。电影名称。
    *   `description` (字符串): 可选。电影的简短情节摘要。
    *   `url` (字符串): 可选。提供电影配置文件页面的URL。
    *   `thumbnail` (Thumbnail): 可选。电影海报的缩略图。
    *   `release` (字符串): 可选。电影的发行日期。
    *   `directors` (Person列表): 可选。负责导演电影的人员列表。
    *   `actors` (Person列表): 可选。电影中的演员列表。
    *   `rating` (Rating): 可选。从各种来源提供给电影的评分。
    *   `duration` (字符串): 可选。电影的运行时间。格式为HH:MM:SS。
    *   `genre` (字符串列表): 可选。可以对电影进行分类的流派列表。
    *   `query` (字符串): 可选。导致电影结果的查询。

**43. Thing (事物)**

*   **描述：** 描述通用事物的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。标识事物的类型。值始终为"thing"。
    *   `name` (字符串):  **必需**。事物的名称。
    *   `url` (字符串): 可选。事物的URL。
    *   `thumbnail` (Thumbnail): 可选。与事物关联的缩略图。

**44. Person (Thing) (人物)**

*   **描述：** 描述人物实体的模型。
*   **字段：**
    *   `type` (字符串):  **必需**。标识人物的类型。值始终为"person"。

**45. Rating (评分)**

*   **描述：** 与实体关联的评分。
*   **字段：**
    *   `ratingValue` (浮点数):  **必需**。评分的当前值。
    *   `bestRating` (浮点数):  **必需**。收到的最佳评分。
    *   `reviewCount` (整数): 可选。与评分关联的评论数。
    *   `profile` (Profile): 可选。与评分关联的配置文件。
    *   `is_tripadvisor` (布尔值):  **必需**。评分是否来自Tripadvisor。

**46. Book (书籍)**

*   **描述：** 表示书籍结果的模型。
*   **字段：**
    *   `title` (字符串):  **必需**。书名。
    *   `author` (Person列表):  **必需**。图书的作者。
    *   `date` (字符串): 可选。本书的出版日期。
    *   `price` (Price): 可选。这本书的价格。
    *   `pages` (整数): 可选。书中的页数。
    *   `publisher` (Person): 可选。这本书的出版商。
    *   `rating` (Rating): 可选。与本书关联的不同来源的收集评分。

**47. Price (价格)**

*   **描述：** 表示实体价格的模型。
*   **字段：**
    *   `price` (字符串):  **必需**。以给定货币表示的价格值。
    *   `price_currency` (字符串):  **必需**。价格值的当前值。

**48. Article (文章)**

*   **描述：** 表示文章的模型。
*   **字段：**
    *   `author` (Person列表): 可选。文章的作者。
    *   `date` (字符串): 可选。文章的发布日期。
    *   `publisher` (Organization): 可选。文章的出版商名称。
    *   `thumbnail` (Thumbnail): 可选。与文章关联的缩略图。
    *   `isAccessibleForFree` (布尔值): 可选。文章是否可以免费阅读还是在付费专区之后。

**49. ContactPoint (Thing) (联系点)**

*   **描述：** 联系实体的方式。
*   **字段：**
    *   `type` (字符串):  **必需**。标识联系点的类型字符串。值始终为contact_point。
    *   `telephone` (字符串): 可选。实体的电话号码。
    *   `email` (字符串): 可选。实体的电子邮件地址。

**50. Organization (Thing) (组织)**

*   **描述：** 负责另一个实体的实体。
*   **字段：**
    *   `type` (字符串):  **必需**。标识组织的类型字符串。值始终为organization。
    *   `contact_points` (ContactPoint列表): 可选。组织的联系点列表。

**51. HowTo (操作方法)**

*   **描述：** 有关如何操作的聚合信息。
*   **字段：**
    *   `text` (字符串):  **必需**。操作方法文本。
    *   `name` (字符串): 可选。操作方法的名称。
    *   `url` (字符串): 可选。与操作方法关联的URL。
    *   `image` (字符串列表): 可选。与操作方法关联的图像URL列表。

**52. Recipe (食谱)**

*   **描述：** 有关食谱的聚合信息。
*   **字段：**
    *   `title` (字符串):  **必需**。食谱的标题。
    *   `description` (字符串):  **必需**。食谱的描述。
    *   `thumbnail` (Thumbnail):  **必需**。与食谱关联的缩略图。
    *   `url` (字符串):  **必需**。找到食谱的网页的URL。
    *   `domain` (字符串):  **必需**。找到食谱的网页的域。
    *   `favicon` (字符串):  **必需**。找到食谱的网页的favicon的URL。
    *   `time` (字符串): 可选。烹饪食谱所需的总时间。
    *   `prep_time` (字符串): 可选。食谱的准备时间。
    *   `cook_time` (字符串): 可选。食谱的烹饪时间。
    *   `ingredients` (字符串): 可选。食谱所需的食材。
    *   `instructions` (HowTo列表): 可选。食谱的说明列表。
    *   `servings` (整数): 可选。食谱为多少人份。
    *   `calories` (整数): 可选。食谱的卡路里计数。
    *   `rating` (Rating): 可选。与食谱关联的评分的聚合信息。
    *   `recipeCategory` (字符串): 可选。食谱的类别。
    *   `recipeCuisine` (字符串): 可选。食谱的美食分类。
    *   `video` (VideoData): 可选。与食谱关联的烹饪视频的聚合信息。

**53. Product (产品)**

*   **描述:** 表示产品的模型。
*   **字段:**
    *   `type` (字符串): **必需**。表示产品类型的字符串。值始终为 product。
    *   `name` (字符串): **必需**。产品名称。
    *   `category` (字符串): 可选。产品类别。
    *   `price` (字符串): **必需**。产品价格。
    *   `thumbnail` (Thumbnail): **必需**。与产品关联的缩略图。
    *   `description` (字符串): 可选。产品描述。
    *   `offers` (Offer 列表): 可选。产品上可用的报价列表。
    *   `rating` (Rating): 可选。与产品关联的评分。

**54. Offer (报价)**

*   **描述:** 与产品关联的报价。
*   **字段:**
    *   `url` (字符串): **必需**。可以找到报价的 URL。
    *   `priceCurrency` (字符串): **必需**。报价的货币。
    *   `price` (字符串): **必需**。当前报价的产品价格。

**55. Review (评论)**

*   **描述:** 表示实体评论的模型。
*   **字段:**
    *   `type` (字符串): **必需**。表示评论类型的字符串。这始终是 review。
    *   `name` (字符串): **必需**。评论的评论标题。
    *   `thumbnail` (Thumbnail): **必需**。与评论者关联的缩略图。
    *   `description` (字符串): **必需**。评论的描述 (评论文本本身)。
    *   `rating` (Rating): **必需**。与评论关联的评分。

**56. Reviews (评论)**

*   **描述:** 与实体关联的评论。
*   **字段:**
    *   `results` (TripAdvisorReview 列表): **必需**。实体的 TripAdvisor 评论列表。
    *   `viewMoreUrl` (字符串): **必需**。指向网页的 URL，可以在该网页上查看有关结果的更多信息。
    *   `reviews_in_foreign_language` (布尔值): **必需**。任何以其他语言提供的评论。

**57. TripAdvisorReview (TripAdvisor 评论)**

*   **描述:** 表示 TripAdvisor 评论的模型。
*   **字段:**
    *   `title` (字符串): **必需**。评论的标题。
    *   `description` (字符串): **必需**。在评论中看到的描述。
    *   `date` (字符串): **必需**。发布评论的日期。
    *   `rating` (Rating): **必需**。评论者给出的评分。
    *   `author` (Person): **必需**。评论的作者。
    *   `review_url` (字符串): **必需**。指向可以在其中找到评论的页面的 URL 链接。
    *   `language` (字符串): **必需**。评论的语言。

**58. CreativeWork (创意作品)**

*   **描述:** 与查询相关的创意作品。一个例子可以是应用程序的丰富元数据。
*   **字段:**
    *   `name` (字符串): **必需**。创意作品的名称。
    *   `thumbnail` (Thumbnail): 与创意作品关联的缩略图。
    *   `rating` (Rating): 可选。给予创意作品的评分。

**59. MusicRecording (音乐录音)**

*   **描述:** 结果分类为音乐标签或歌曲。
*   **字段:**
    *   `name` (字符串): **必需**。歌曲或专辑的名称。
    *   `thumbnail` (Thumbnail): 可选。与音乐关联的缩略图。
    *   `rating` (Rating): 可选。音乐的评分。

**60. Software (软件)**

*   **描述:** 表示软件实体的模型。
*   **字段:**
    *   `name` (字符串): 可选。软件产品的名称。
    *   `author` (字符串): 可选。软件产品的作者。
    *   `version` (字符串): 可选。软件产品的最新版本。
    *   `codeRepository` (字符串): 可选。软件产品当前可用或维护的代码存储库。
    *   `homepage` (字符串): 可选。软件产品的主页。
    *   `datePublisher` (字符串): 可选。软件产品的发布日期。
    *   `is_npm` (布尔值): 可选。该软件产品是否在 npm 上可用。
    *   `is_pypi` (布尔值): 可选。该软件产品是否在 pypi 上可用。
    *   `stars` (整数): 可选。存储库上的星数。
    *   `forks` (整数): 可选。存储库的 fork 数。
    *   `ProgrammingLanguage` (字符串): 可选。软件产品上使用的编程语言。

**61. DeepResult (深度结果)**

*   **描述:** 来自新闻、社交、视频和图像的聚合深度结果。
*   **字段:**
    *   `news` (NewsResult 列表): 可选。与结果关联的新闻结果列表。
    *   `buttons` (ButtonResult 列表): 可选。与结果关联的按钮结果列表。
    *   `videos` (VideoResult 列表): 可选。与结果关联的视频。
    *   `images` (Image 列表): 可选。与结果关联的图像。

**62. VideoResult (Result) (视频结果)**

*   **描述:** 表示视频结果的模型。
*   **字段:**
    *   `type` (字符串): **必需**。标识视频结果的类型。值始终为 video_result。
    *   `video` (VideoData): **必需**。视频的元数据。
    *   `meta_url` (MetaUrl): 可选。有关 URL 的聚合信息
    *   `thumbnail` (Thumbnail): 可选。视频的缩略图。
    *   `age` (字符串): 可选。表示视频年龄的字符串。

**63. VideoData (视频数据)**

*   **描述:** 表示为视频收集的元数据的模型。
*   **字段:**
    *   `duration` (字符串): 可选。表示视频时长的字符串。格式可以是 HH:MM:SS 或 MM:SS。
    *   `views` (字符串): 可选。视频的观看次数。
    *   `creator` (字符串): 可选。视频的创建者。
    *   `publisher` (字符串): 可选。视频的发布者。
    *   `thumbnail` (Thumbnail): 可选。与视频关联的缩略图。
    *   `tags` (字符串列表): 可选。与视频关联的标签列表。
    *   `author` (Profile): 可选。视频的作者。
    *   `requires_subscription` (布尔值): 可选。是否需要订阅才能观看视频。

**64. ButtonResult (按钮结果)**

*   **描述:** 可以用作按钮的结果。
*   **字段:**
    *   `type` (字符串): **必需**。标识按钮结果的类型。值始终为 button_result。
    *   `title` (字符串): **必需**。结果的标题。
    *   `url` (字符串): **必需**。按钮结果的 URL。

**65. Image (图像)**

*   **描述:** 描述图像的模型。
*   **字段:**
    *   `thumbnail` (Thumbnail): **必需**。与图像关联的缩略图。
    *   `url` (字符串): 可选。图像的 URL。
    *   `properties` (ImageProperties): 可选。图像上的元数据。

**66. Language (语言)**

*   **描述:** 表示语言的模型。
*   **字段:**
    *   `main` (字符串): **必需**。字符串中看到的主要语言。

**67. ImageProperties (图像属性)**

*   **描述:** 图像上的元数据。
*   **字段:**
    *   `url` (字符串): **必需**。原始图像 URL。
    *   `resized` (字符串): **必需**。质量更好的调整大小的图像的 URL。
    *   `placeholder` (字符串): **必需**。占位符图像 URL。
    *   `height` (整数): 可选。图像高度。
    *   `width` (整数): 可选。图像宽度。
    *   `format` (字符串): 可选。图像格式。
    *   `content_size` (字符串): 可选。图像大小。

**68. Summarizer (摘要器)**

*   **描述:** 获取摘要的详细信息。
*   **字段:**
    *   `type` (字符串): **必需**。值始终为 summarizer。
    *   `key` (字符串): **必需**。摘要器 API 的密钥。

**69. RichCallbackInfo (富媒体回调信息)**

*   **描述:** 富媒体结果的回调信息。
*   **字段:**
    *   `type` (字符串): **必需**。值始终为 rich。
    *   `hint` (RichCallbackHint): 可选。富媒体结果的提示。

**70. RichCallbackHint (富媒体回调提示)**

*   **描述:** 富媒体结果的提示。
*   **字段:**
    *   `vertical` (字符串): **必需**。富媒体结果的垂直名称。
    *   `callback_key` (字符串): **必需**。富媒体结果的回调键。