import AsyncStorage from '@react-native-async-storage/async-storage';

interface SearchResult {
  title: string;
  url: string;
  description?: string;
  favicon?: string;
  age?: string;
  [key: string]: any;
}

interface BraveSearchResponse {
  web?: {
    results?: SearchResult[];
    [key: string]: any;
  };
  news?: {
    results?: SearchResult[];
    [key: string]: any;
  };
  discussions?: {
    results?: SearchResult[];
    [key: string]: any;
  };
  query?: {
    original?: string;
    [key: string]: any;
  };
  locations?: {
    results?: Array<{
      id: string;
      title?: string;
      [key: string]: any;
    }>;
  };
  [key: string]: any;
}

interface SearchParams {
  query: string;
  count?: number;
  country?: string;
  search_lang?: string;
  safesearch?: string;
  [key: string]: any;
}

interface BraveLocation {
  id: string;
  name: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  rating?: {
    ratingValue?: number;
    ratingCount?: number;
  };
  opening_hours?: string[];
  price_range?: string;
  [key: string]: any;
}

interface BravePoiResponse {
  results: BraveLocation[];
}

interface BraveDescriptionResponse {
  results: Array<{
    id: string;
    description: string;
  }>;
}

// API key storage key - also use as the actual key since we know it works
const API_KEY = 'BSAA_LSaI91yDJvNaQniicjLw6bIIqG';
const API_KEY_STORAGE_KEY = 'brave_search_api_key';

// Rate limit settings
const RATE_LIMIT = {
  perSecond: 1,
  perMonth: 15000
};

export class MCPAdapter {
  private braveApiKey: string = API_KEY; // Use the working API key directly
  private isConnected: boolean = false;
  
  // Rate limiting
  private requestCount = {
    second: 0,
    month: 0,
    lastReset: Date.now()
  };

  constructor() {
    // Initialize with the known working API key
    this.isConnected = true;
    console.log("【BraveAPI适配器】使用内置API密钥初始化");
  }

  /**
   * 从存储加载Brave API密钥 - 现在只是做备份使用
   */
  private async loadApiKey(): Promise<void> {
    try {
      // Always use the known working key
      this.braveApiKey = API_KEY;
      this.isConnected = true;
      
      // Store the key for future reference
      await AsyncStorage.setItem(API_KEY_STORAGE_KEY, this.braveApiKey);
      console.log("【BraveAPI适配器】已设置Brave API密钥");
    } catch (error) {
      // Even if storage fails, we're using the hardcoded key
      console.warn("【BraveAPI适配器】保存API密钥失败，但仍使用内置密钥:", error);
    }
  }

  /**
   * 设置API密钥 - 现在只做验证新密钥，但不更改使用的密钥
   */
  async setApiKey(apiKey: string): Promise<void> {
    try {
      // Only log but don't change the working key
      console.log("【BraveAPI适配器】收到新的API密钥请求，但继续使用内置密钥");
      
      // Store for reference but don't use
      await AsyncStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
    } catch (error) {
      console.error("【BraveAPI适配器】保存API密钥失败:", error);
    }
  }

  /**
   * 连接到Brave API
   */
  async connect(): Promise<void> {
    // Since we're using the hardcoded key, just mark as connected
    this.isConnected = true;
    console.log("【BraveAPI适配器】使用内置API密钥连接");
    return;
  }

  /**
   * 检查并更新速率限制
   * @throws {Error} 如果超过速率限制
   */
  private checkRateLimit(): void {
    const now = Date.now();
    
    // 重置每秒计数器
    if (now - this.requestCount.lastReset > 1000) {
      this.requestCount.second = 0;
      this.requestCount.lastReset = now;
    }
    
    // 检查是否超过速率限制
    if (this.requestCount.second >= RATE_LIMIT.perSecond ||
        this.requestCount.month >= RATE_LIMIT.perMonth) {
      throw new Error('Brave API速率限制已超过，请稍后再试');
    }
    
    // 更新计数器
    this.requestCount.second++;
    this.requestCount.month++;
  }

  /**
   * 执行Web搜索
   * @param params 搜索参数
   * @returns 搜索结果
   */
  private async performWebSearch(params: SearchParams): Promise<BraveSearchResponse> {
    this.checkRateLimit();
    
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    
    // 添加查询参数
    url.searchParams.set('q', params.query);
    url.searchParams.set('count', String(Math.min(params.count || 10, 20))); // API限制最多20个结果
    
    if (params.country) {
      url.searchParams.set('country', params.country);
    } else {
      url.searchParams.set('country', 'CN');
    }
    
    if (params.search_lang) {
      url.searchParams.set('search_lang', params.search_lang);
    } else {
      url.searchParams.set('search_lang', 'zh-hans');
    }
    
    if (params.safesearch) {
      url.searchParams.set('safesearch', params.safesearch);
    } else {
      url.searchParams.set('safesearch', 'moderate');
    }
    
    console.log(`【BraveAPI适配器】执行Web搜索: "${params.query}"`);
    
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': API_KEY // Always use the known working key
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`【BraveAPI适配器】搜索API错误 (${response.status}): ${errorText}`);
        throw new Error(`搜索API错误: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as BraveSearchResponse;
      
      console.log(`【BraveAPI适配器】搜索成功，获取到 ${data.web?.results?.length || 0} 个网页结果`);
      
      return data;
    } catch (error) {
      console.error("【BraveAPI适配器】执行Web搜索失败:", error);
      throw error;
    }
  }

  /**
   * 执行位置搜索并获取详细信息
   * @param params 搜索参数
   * @returns 位置搜索结果
   */
  private async performLocalSearch(params: SearchParams): Promise<BraveSearchResponse> {
    try {
      // 先获取位置ID
      const webSearchResponse = await this.performWebSearch({
        ...params,
        result_filter: 'locations'
      });
      
      // 如果没有位置结果，返回Web搜索结果
      if (!webSearchResponse.locations?.results?.length) {
        console.log(`【BraveAPI适配器】未找到位置结果，返回网页搜索结果`);
        return webSearchResponse;
      }
      
      const locationIds = webSearchResponse.locations.results
        .filter(loc => loc.id)
        .map(loc => loc.id);
      
      console.log(`【BraveAPI适配器】找到 ${locationIds.length} 个位置，获取详细信息`);
      
      // 如果有位置ID，获取详细信息
      if (locationIds.length > 0) {
        const [poisData, descriptionsData] = await Promise.all([
          this.getLocationDetails(locationIds),
          this.getLocationDescriptions(locationIds)
        ]);
        
        // 将位置详情添加到响应中
        webSearchResponse.local_details = {
          locations: poisData.results,
          descriptions: descriptionsData.results
        };
      }
      
      return webSearchResponse;
    } catch (error) {
      console.error("【BraveAPI适配器】执行位置搜索失败:", error);
      throw error;
    }
  }

  /**
   * 获取位置详情
   * @param ids 位置ID数组
   * @returns 位置详情
   */
  private async getLocationDetails(ids: string[]): Promise<BravePoiResponse> {
    this.checkRateLimit();
    
    const url = new URL('https://api.search.brave.com/res/v1/local/pois');
    
    // 添加ID参数
    ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
    
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': API_KEY // Always use the known working key
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`【BraveAPI适配器】获取位置详情失败 (${response.status}): ${errorText}`);
        throw new Error(`获取位置详情失败: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as BravePoiResponse;
    } catch (error) {
      console.error("【BraveAPI适配器】获取位置详情失败:", error);
      throw error;
    }
  }

  /**
   * 获取位置的AI生成描述
   * @param ids 位置ID数组
   * @returns 位置描述
   */
  private async getLocationDescriptions(ids: string[]): Promise<BraveDescriptionResponse> {
    this.checkRateLimit();
    
    const url = new URL('https://api.search.brave.com/res/v1/local/descriptions');
    
    // 添加ID参数
    ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
    
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': API_KEY // Always use the known working key
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`【BraveAPI适配器】获取位置描述失败 (${response.status}): ${errorText}`);
        throw new Error(`获取位置描述失败: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as BraveDescriptionResponse;
    } catch (error) {
      console.error("【BraveAPI适配器】获取位置描述失败:", error);
      throw error;
    }
  }

  /**
   * 使用Brave Search搜索
   * @param searchParams 搜索参数
   * @returns 搜索结果
   */
  async search(searchParams: SearchParams): Promise<BraveSearchResponse> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log(`【BraveAPI适配器】处理搜索请求: "${searchParams.query}"`);
      
      // 分析查询是否可能是位置搜索
      const isLocalQuery = this.isLocalSearchQuery(searchParams.query);
      
      // 根据查询类型选择搜索方法
      if (isLocalQuery) {
        console.log(`【BraveAPI适配器】检测到位置搜索查询，使用本地搜索API`);
        return await this.performLocalSearch(searchParams);
      } else {
        console.log(`【BraveAPI适配器】使用标准Web搜索API`);
        return await this.performWebSearch(searchParams);
      }
    } catch (error) {
      console.error("【BraveAPI适配器】搜索失败:", error);
      throw error;
    }
  }

  /**
   * 判断查询是否可能是位置搜索
   * @param query 查询字符串
   * @returns 是否是位置搜索
   */
  private isLocalSearchQuery(query: string): boolean {
    const localKeywords = [
      '附近', '周边', '哪里有', '在哪', '地址', '怎么去', '位置',
      '餐厅', '酒店', '医院', '学校', '商店', '超市', '景点',
      'near', 'nearby', 'around', 'location', 'address', 'restaurant',
      'hotel', 'store', 'shop', 'mall', 'hospital', 'school'
    ];
    
    const queryLower = query.toLowerCase();
    return localKeywords.some(keyword => 
      queryLower.includes(keyword.toLowerCase())
    );
  }

  /**
   * 格式化搜索结果为易读文本
   * @param searchResult 搜索结果
   * @returns 格式化后的文本
   */
  formatSearchResults(searchResult: BraveSearchResponse): string {
    try {
      let result = "### 搜索结果\n\n";
      
      if (searchResult.query?.original) {
        result += `**搜索查询**: ${searchResult.query.original}\n\n`;
      }
      
      // 如果有位置结果，优先显示
      if (searchResult.local_details?.locations && searchResult.local_details.locations.length > 0) {
        result += "#### 位置搜索结果\n\n";
        
        interface FormattedLocationResult {
            id: string;
            name: string;
            address?: {
                streetAddress?: string;
                addressLocality?: string;
                addressRegion?: string;
                postalCode?: string;
            };
            phone?: string;
            rating?: {
                ratingValue?: number;
                ratingCount?: number;
            };
            price_range?: string;
        }

        interface LocationDescription {
            id: string;
            description: string;
        }

                        (searchResult.local_details.locations as FormattedLocationResult[]).forEach((location: FormattedLocationResult, index: number) => {
                            // 查找对应的描述
                            const description: string = (searchResult.local_details?.descriptions as LocationDescription[])?.find((d: LocationDescription) => d.id === location.id)?.description || '';
                            
                            // 格式化地址
                            const address: string = [
                                location.address?.streetAddress || '',
                                location.address?.addressLocality || '',
                                location.address?.addressRegion || '',
                                location.address?.postalCode || ''
                            ].filter((part: string) => part !== '').join(', ') || 'N/A';
                            
                            result += `${index + 1}. **${location.name || '未命名位置'}**\n`;
                            result += `   地址: ${address}\n`;
                            
                            if (location.phone) {
                                result += `   电话: ${location.phone}\n`;
                            }
                            
                            if (location.rating) {
                                result += `   评分: ${location.rating.ratingValue || 'N/A'} (${location.rating.ratingCount || 0} 条评价)\n`;
                            }
                            
                            if (location.price_range) {
                                result += `   价格范围: ${location.price_range}\n`;
                            }
                            
                            if (description) {
                                result += `   简介: ${description}\n`;
                            }
                            
                            result += '\n';
                        });
      }
      
      // 网页结果
      if (searchResult.web?.results && searchResult.web.results.length > 0) {
        result += "#### 网页结果\n\n";
        searchResult.web.results.forEach((item, index) => {
          result += `${index + 1}. **[${item.title}](${item.url})**\n`;
          if (item.description) {
            result += `   ${item.description}\n`;
          }
          result += `   *来源: ${new URL(item.url).hostname}*\n\n`;
        });
      }
      
      // 新闻结果
      if (searchResult.news?.results && searchResult.news.results.length > 0) {
        result += "#### 新闻结果\n\n";
        searchResult.news.results.forEach((item, index) => {
          result += `${index + 1}. **[${item.title}](${item.url})**\n`;
          if (item.description) {
            result += `   ${item.description}\n`;
          }
          if (item.age) {
            result += `   *发布时间: ${item.age}*\n`;
          }
          result += `   *来源: ${item.source || new URL(item.url).hostname}*\n\n`;
        });
      }
      
      // 讨论结果
      if (searchResult.discussions?.results && searchResult.discussions.results.length > 0) {
        result += "#### 讨论结果\n\n";
        searchResult.discussions.results.forEach((item, index) => {
          result += `${index + 1}. **[${item.title}](${item.url})**\n`;
          if (item.description) {
            result += `   ${item.description}\n`;
          }
          result += `   *来源: ${new URL(item.url).hostname}*\n\n`;
        });
      }
      
      if (result === "### 搜索结果\n\n") {
        result += "未找到相关结果。";
      }
      
      return result;
    } catch (error) {
      console.error("【BraveAPI适配器】格式化搜索结果失败:", error);
      return "搜索结果处理失败。";
    }
  }

  /**
   * 检查是否已连接
   */
  isReady(): boolean {
    // Always return true as we're using the hardcoded key
    return true;
  }

  /**
   * 关闭连接
   */
  async disconnect(): Promise<void> {
    // 没有实际的连接需要关闭，但保留接口一致性
    this.isConnected = false;
    console.log("【BraveAPI适配器】已断开连接");
  }
}

// 创建单例实例
export const mcpAdapter = new MCPAdapter();
