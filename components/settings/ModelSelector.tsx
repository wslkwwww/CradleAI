import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { OpenRouterModel } from '@/shared/types/api-types';
import { CloudServiceAdapter } from '@/services/cloud-service-adapter';
import { API_CONFIG } from '@/constants/api-config';

interface ModelSelectorProps {
  models?: OpenRouterModel[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  isLoading?: boolean;
  apiKey: string;
  useCloudService?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  apiKey,
  selectedModelId,
  onSelectModel,
  isLoading = false,
  models = [],
  useCloudService = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [internalModels, setInternalModels] = useState<OpenRouterModel[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fallbackToDirectFetch, setFallbackToDirectFetch] = useState(false);

  // Fetch models directly from OpenRouter with better error handling
  const fetchModelsDirectly = async (apiKey?: string): Promise<any> => {
    try {
      console.log('【ModelSelector】直接从 OpenRouter 获取模型列表');
      
      // If no API key but we're in fallback mode, try to use the demo endpoint
      const endpoint = apiKey 
        ? 'https://openrouter.ai/api/v1/models'
        : 'https://openrouter.ai/api/v1/models?auth=nokey';
        
      const headers: Record<string, string> = {
        'HTTP-Referer': 'https://github.com',
        'X-Title': 'AI Chat App'
      };
      
      // Only add Authorization header if we have an API key
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const modelData = await response.json();
        console.log(`【ModelSelector】成功从 OpenRouter 获取 ${modelData.data?.length || 0} 个模型`);
        
        return modelData;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('请求超时，请检查网络连接');
        }
        throw error;
      }
    } catch (error) {
      console.error('【ModelSelector】直接获取模型失败:', error);
      throw error;
    }
  };

  // Fetch models on component mount or when API key changes
  useEffect(() => {
    const fetchModels = async () => {
      setInternalLoading(true);
      setFetchError(null);
      
      try {
        let modelData;
        let fetchSource = '';
        
        // First try the preferred method
        if (useCloudService && !fallbackToDirectFetch) {
          fetchSource = 'cloud';
          console.log('【ModelSelector】通过 CradleAI 云服务获取模型列表');
          
          try {
            // Try to get models through cloud service
            const cloudModels = await CloudServiceAdapter.listAvailableModels().catch(e => {
              console.log('【ModelSelector】云服务获取模型失败，尝试直接获取:', e);
              throw e;
            });
            
            if (cloudModels?.data && Array.isArray(cloudModels.data)) {
              modelData = cloudModels;
              console.log(`【ModelSelector】成功从 CradleAI 获取 ${cloudModels.data.length} 个模型`);
            } else {
              throw new Error('获取模型列表失败：无效的响应格式');
            }
          } catch (cloudError) {
            console.error('【ModelSelector】通过 CradleAI 获取模型失败，将尝试直接获取:', cloudError);
            setFallbackToDirectFetch(true);
            fetchSource = 'direct-with-key';
            // Fall through to direct fetch
            if (apiKey) {
              modelData = await fetchModelsDirectly(apiKey);
            } else {
              fetchSource = 'direct-no-key';
              modelData = await fetchModelsDirectly();
            }
          }
        } else if (apiKey) {
          fetchSource = 'direct-with-key';
          // Direct fetch from OpenRouter with API key
          modelData = await fetchModelsDirectly(apiKey);
        } else {
          fetchSource = 'direct-no-key';
          // Direct fetch from OpenRouter without API key
          modelData = await fetchModelsDirectly();
        }
        
        // If we still don't have models, try without an API key as last resort
        if (!modelData || !modelData.data || !modelData.data.length) {
          console.log('【ModelSelector】尝试无密钥获取公共模型列表');
          fetchSource = 'direct-no-key-fallback';
          modelData = await fetchModelsDirectly();
        }
        
        if (modelData?.data && Array.isArray(modelData.data)) {
          console.log(`【ModelSelector】成功获取模型列表 (来源: ${fetchSource})，${modelData.data.length} 个模型`);
          setInternalModels(modelData.data);
        } else {
          throw new Error('无效的响应格式');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('【ModelSelector】获取模型列表失败:', errorMessage);
        setFetchError(errorMessage);
        
        // Even if we have an error, we might have some models from a previous fetch
        if (internalModels.length === 0) {
          // Try to use some default models as a last resort
          const defaultModels = getDefaultModels();
          if (defaultModels.length > 0) {
            console.log('【ModelSelector】使用默认模型列表作为最后的备选');
            setInternalModels(defaultModels);
          }
        }
      } finally {
        setInternalLoading(false);
      }
    };
    
    // Always attempt to fetch models
    fetchModels();
  }, [apiKey, useCloudService, fallbackToDirectFetch]);

  // Provide fallback default models as a last resort
  const getDefaultModels = (): OpenRouterModel[] => {
    return [
      {
        id: "openai/gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        description: "Most capable GPT-3.5 model for chat and text generation",
        context_length: 16385,
        pricing: { prompt: 0.0000015, completion: 0.000002 },
        provider: { id: "openai", name: "OpenAI" }
      },
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        description: "OpenAI's most advanced model for complex tasks",
        context_length: 8192,
        pricing: { prompt: 0.00003, completion: 0.00006 },
        provider: { id: "openai", name: "OpenAI" }
      },
      {
        id: "anthropic/claude-3-opus",
        name: "Claude 3 Opus",
        description: "Anthropic's most capable model for complex tasks",
        context_length: 200000,
        pricing: { prompt: 0.00005, completion: 0.00015 },
        provider: { id: "anthropic", name: "Anthropic" }
      },
      {
        id: "google/gemini-pro",
        name: "Gemini Pro",
        description: "Google's largest model for sophisticated tasks",
        context_length: 30720,
        pricing: { prompt: 0.000005, completion: 0.000005 },
        provider: { id: "google", name: "Google" }
      },
    ];
  };

  // Use either the provided models or internally fetched models
  const displayModels = models.length > 0 ? models : internalModels;

  // 检查模型数组的有效性
  const validModels = Array.isArray(displayModels) ? displayModels.filter(model => 
    model && typeof model === 'object' && model.id && model.name
  ) : [];

  // Filter models based on search query
  const filteredModels = validModels.filter(model => 
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (model.provider?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group models by provider, with additional safety checks
  const groupedModels = filteredModels.reduce((acc, model) => {
    // 确保 provider 和 provider.id 存在
    const providerId = model.provider?.id || 'unknown';
    
    if (!acc[providerId]) {
      acc[providerId] = {
        provider: model.provider || { id: providerId, name: 'Unknown Provider' },
        models: []
      };
    }
    acc[providerId].models.push(model);
    return acc;
  }, {} as Record<string, { provider: OpenRouterModel['provider'], models: OpenRouterModel[] }>);

  // Sort providers alphabetically with safety check
  const sortedProviders = Object.values(groupedModels).sort((a, b) => 
    (a.provider?.name || '').localeCompare(b.provider?.name || '')
  );

  // Toggle model details
  const toggleDetails = (modelId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [modelId]: !prev[modelId]
    }));
  };

  // Format price to make it more readable
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '$0.0000';
    return `$${price.toFixed(6)}`;
  };

  // Render model item with enhanced safety
  const renderModelItem = (model: OpenRouterModel) => {
    if (!model || !model.id) return null;
    
    const isSelected = model.id === selectedModelId;
    const showModelDetails = showDetails[model.id] || false;
    
    return (
      <View style={styles.modelItemContainer} key={model.id}>
        <TouchableOpacity
          style={[
            styles.modelItem,
            isSelected && styles.selectedModelItem
          ]}
          onPress={() => onSelectModel(model.id)}
        >
          <View style={styles.modelMainInfo}>
            <Text style={[
              styles.modelName,
              isSelected && styles.selectedModelText
            ]} numberOfLines={1}>
              {model.name || 'Unnamed Model'}
            </Text>
            <Text style={styles.modelProvider} numberOfLines={1}>
              {model.provider?.name || 'Unknown Provider'}
            </Text>
          </View>
          
          <View style={styles.modelActions}>
            <TouchableOpacity onPress={() => toggleDetails(model.id)}>
              <MaterialIcons 
                name={showModelDetails ? "expand-less" : "expand-more"} 
                size={24} 
                color="#666" 
              />
            </TouchableOpacity>
            {isSelected && (
              <MaterialIcons name="check-circle" size={20} color="#FF9ECD" />
            )}
          </View>
        </TouchableOpacity>
        
        {showModelDetails && (
          <View style={styles.modelDetails}>
            <Text style={styles.modelId}>ID: {model.id}</Text>
            <Text style={styles.modelDescription}>{model.description || 'No description available'}</Text>
            <View style={styles.modelStats}>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Context</Text>
                <Text style={styles.modelStatValue}>
                  {(model.context_length || 0).toLocaleString()} tokens
                </Text>
              </View>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Prompt</Text>
                <Text style={styles.modelStatValue}>
                  {formatPrice(model.pricing?.prompt)}
                </Text>
              </View>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Completion</Text>
                <Text style={styles.modelStatValue}>
                  {formatPrice(model.pricing?.completion)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Render provider section
  const renderProviderSection = (providerData: typeof sortedProviders[0]) => (
    <View style={styles.providerSection} key={providerData.provider?.id || 'unknown'}>
      <Text style={styles.providerName}>{providerData.provider?.name || 'Unknown Provider'}</Text>
      {providerData.models.map(model => renderModelItem(model))}
    </View>
  );

  // Render error message
  const renderError = () => (
    <View style={styles.errorContainer}>
      <MaterialIcons name="error-outline" size={24} color="#f44336" />
      <Text style={styles.errorText}>{fetchError}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={() => {
          // Re-trigger the useEffect by forcing a re-render
          setInternalLoading(true);
          setTimeout(() => {
            setInternalLoading(false);
          }, 100);
        }}
      >
        <Text style={styles.retryButtonText}>重试</Text>
      </TouchableOpacity>
    </View>
  );

  // Update source indicator to show the actual source
  const getDataSourceText = () => {
    if (fallbackToDirectFetch) {
      return "数据来源: OpenRouter API (云服务回退)";
    } else if (useCloudService) {
      return "数据来源: CradleAI 云服务";
    } else {
      return "数据来源: OpenRouter API";
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜索模型..."
          placeholderTextColor="#999"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
            <MaterialIcons name="close" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading || internalLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9ECD" />
          <Text style={styles.loadingText}>加载模型列表中...</Text>
        </View>
      ) : fetchError ? (
        renderError()
      ) : validModels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="info" size={24} color="#999" />
          <Text style={styles.emptyText}>没有可用的模型。请确保您的API密钥有效或云服务已正确配置。</Text>
        </View>
      ) : filteredModels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={24} color="#999" />
          <Text style={styles.emptyText}>没有找到符合搜索条件的模型。</Text>
        </View>
      ) : (
        // Use ScrollView with proper height
        <ScrollView style={styles.modelsScrollContainer}>
          <View style={styles.modelsListContainer}>
            {sortedProviders.map(provider => renderProviderSection(provider))}
          </View>
        </ScrollView>
      )}

      {/* Source indicator */}
      <View style={styles.sourceIndicator}>
        <Text style={styles.sourceText}>
          {getDataSourceText()}
        </Text>
        {useCloudService && !fallbackToDirectFetch && (
          <MaterialIcons name="cloud-done" size={16} color="#2196F3" style={{marginLeft: 4}} />
        )}
        {fallbackToDirectFetch && (
          <MaterialIcons name="sync" size={16} color="#FFA726" style={{marginLeft: 4}} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 20,
    paddingHorizontal: 16, // Add padding
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#444', // Change to darker color for dark theme
    borderRadius: 8,
    marginVertical: 16, // Add more vertical margin
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 50, // Fixed height to make it more visible
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#fff', // Change text color for dark theme
  },
  clearSearch: {
    padding: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  emptyText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  // Add a proper ScrollView container with height
  modelsScrollContainer: {
    height: 400, // Fixed height for the scroll view
  },
  modelsListContainer: {
    paddingBottom: 20, // Add padding at bottom for scrolling
  },
  providerSection: {
    marginBottom: 16,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modelItemContainer: {
    marginBottom: 8,
  },
  modelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  selectedModelItem: {
    borderColor: '#FF9ECD',
    backgroundColor: 'rgba(255, 158, 205, 0.05)',
  },
  modelMainInfo: {
    flex: 1,
    marginRight: 8,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedModelText: {
    color: '#FF9ECD',
  },
  modelProvider: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  modelActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelDetails: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#eee',
  },
  modelId: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  modelDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  modelStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modelStat: {
    flex: 1,
    alignItems: 'center',
  },
  modelStatLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  modelStatValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 8,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  errorText: {
    marginTop: 10,
    marginBottom: 16,
    color: '#f44336',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sourceIndicator: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 16,
  },
  sourceText: {
    fontSize: 12,
    color: '#999',
  },
});

export default ModelSelector;
