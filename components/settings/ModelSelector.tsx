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

  // 检查模型数组的有效性
  const validModels = Array.isArray(models) ? models.filter(model => 
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

      {isLoading ? (
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
        // 替换 FlatList 为 普通的 View 来避免嵌套 VirtualizedList 的问题
        <View style={styles.modelsListContainer}>
          {sortedProviders.map(provider => renderProviderSection(provider))}
        </View>
      )}
    </View>
  );
};

// Update styles to handle the new layout
const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 16,
    color: '#333',
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
  modelsListContainer: {
    maxHeight: 400,
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
