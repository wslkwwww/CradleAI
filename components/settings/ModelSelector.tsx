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

interface ModelSelectorProps {
  models?: OpenRouterModel[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  isLoading?: boolean;
  apiKey: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  apiKey,
  selectedModelId,
  onSelectModel,
  isLoading = false,
  models = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [internalModels, setInternalModels] = useState<OpenRouterModel[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  // Fetch models on component mount or when API key changes
  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey) return;
      
      setInternalLoading(true);
      
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com',
            'X-Title': 'AI Chat App'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
          setInternalModels(data.data);
          console.log(`【ModelSelector】成功获取 ${data.data.length} 个模型`);
        } else {
          console.error('【ModelSelector】无效的响应格式:', data);
          setInternalModels([]);
        }
      } catch (error) {
        console.error('【ModelSelector】获取模型列表失败:', error);
        setInternalModels([]);
      } finally {
        setInternalLoading(false);
      }
    };
    
    fetchModels();
  }, [apiKey]);

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
    return `$${price.toFixed(4)}`;
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

  return (
    <View style={styles.container}>
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search models..."
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
          <Text style={styles.loadingText}>Loading models...</Text>
        </View>
      ) : validModels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="info" size={24} color="#999" />
          <Text style={styles.emptyText}>No models available. Make sure your API key is valid and try refreshing.</Text>
        </View>
      ) : filteredModels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={24} color="#999" />
          <Text style={styles.emptyText}>No models matching your search.</Text>
        </View>
      ) : (
        // Use ScrollView with proper height
        <ScrollView style={styles.modelsScrollContainer}>
          <View style={styles.modelsListContainer}>
            {sortedProviders.map(provider => renderProviderSection(provider))}
          </View>
        </ScrollView>
      )}
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
});

export default ModelSelector;
