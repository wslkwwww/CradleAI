import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  ScrollView // Import ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { OpenRouterModel } from '@/shared/types/api-types';

interface ModelSelectorProps {
  settings?: any;
  onModelSelect?: (modelId: string) => void;
  onSortingStrategySelect?: (strategy: 'price' | 'speed' | 'latency') => void;
  // For direct model list usage
  models?: OpenRouterModel[];
  selectedModelId?: string;
  onSelectModel?: (modelId: string) => void;
  isLoading?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  settings,
  onModelSelect,
  onSortingStrategySelect,
  // Direct props
  models: providedModels,
  selectedModelId: providedSelectedId,
  onSelectModel,
  isLoading: externalLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [filterMode, setFilterMode] = useState<'all' | 'popular'>('all');

  // Determine if we're using the direct model list (new) or via settings (old)
  const isDirectMode = providedModels !== undefined;
  const models = isDirectMode ? providedModels : [];
  const isLoading = externalLoading ?? false;
  const selectedModelId = providedSelectedId ?? settings?.chat?.openrouter?.model;
  
  // Filter models based on search query
  const filteredModels = models.filter(model => 
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (model.provider?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle model details
  const toggleDetails = useCallback((modelId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [modelId]: !prev[modelId]
    }));
  }, []);

  // Improved format price to handle undefined safely
  const formatPrice = useCallback((price: number | undefined) => {
    if (price === undefined || price === null) return 'N/A';
    try {
      return `$${Number(price).toFixed(6)}`;
    } catch (error) {
      console.error('Error formatting price:', price, error);
      return 'N/A';
    }
  }, []);

  // Debounced model selection to prevent multiple rapid clicks
  const handleModelSelect = useCallback((modelId: string) => {
    if (selectedModelId === modelId) {
      // Skip if it's already selected to prevent duplicate calls
      return;
    }
    
    // Add console log to debug
    console.log('ModelSelector - selecting model:', modelId);
    
    if (isDirectMode && onSelectModel) {
      onSelectModel(modelId);
    } else if (onModelSelect) {
      onModelSelect(modelId);
    }
  }, [selectedModelId, onModelSelect, onSelectModel, isDirectMode]);

  // Clear search query
  const clearSearchQuery = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Render a model item
  const renderModelItem = useCallback(({ item }: { item: OpenRouterModel }) => {
    if (!item || !item.id) return null;
    
    const isSelected = item.id === selectedModelId;
    const showModelDetails = showDetails[item.id] || false;
    
    // Skip displaying provider info if not available
    const hasProviderInfo = item.provider && item.provider.name;
    
    return (
      <View style={styles.modelItemContainer} key={item.id}>
        <TouchableOpacity
          style={[
            styles.modelItem,
            isSelected && styles.selectedModelItem
          ]}
          onPress={() => handleModelSelect(item.id)}
        >
          <View style={styles.modelMainInfo}>
            <Text style={[
              styles.modelName,
              isSelected && styles.selectedModelText
            ]} numberOfLines={1}>
              {item.name || item.id}
            </Text>
            
            {/* Only show provider name if available */}
            {hasProviderInfo && (
              <Text style={styles.modelProvider} numberOfLines={1}>
                {item.provider?.name}
              </Text>
            )}
          </View>
          
          <View style={styles.modelActions}>
            <TouchableOpacity 
              style={styles.detailsButton}
              onPress={(e) => {
                // Stop propagation to prevent triggering the parent's onPress
                e.stopPropagation();
                toggleDetails(item.id);
              }}
            >
              <MaterialIcons 
                name={showModelDetails ? "expand-less" : "expand-more"} 
                size={24} 
                color="#888" 
              />
            </TouchableOpacity>
            {isSelected && (
              <MaterialIcons name="check-circle" size={20} color="#FF9ECD" />
            )}
          </View>
        </TouchableOpacity>
        
        {showModelDetails && (
          <View style={styles.modelDetails}>
            <Text style={styles.modelId}>ID: {item.id}</Text>
            <Text style={styles.modelDescription}>{item.description || 'No description available'}</Text>
            <View style={styles.modelStats}>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Context</Text>
                <Text style={styles.modelStatValue}>
                  {(item.context_length || 0).toLocaleString()} tokens
                </Text>
              </View>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Prompt</Text>
                <Text style={styles.modelStatValue}>
                  {formatPrice(item.pricing?.prompt)}
                </Text>
              </View>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Completion</Text>
                <Text style={styles.modelStatValue}>
                  {formatPrice(item.pricing?.completion)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }, [selectedModelId, showDetails, toggleDetails, handleModelSelect, formatPrice]);

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
          <TouchableOpacity onPress={clearSearchQuery} style={styles.clearSearch}>
            <MaterialIcons name="close" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>
      
      {/* Sorting options if not in direct mode */}
      {!isDirectMode && onSortingStrategySelect && (
        <View style={styles.sortingOptions}>
          <Text style={styles.sortingLabel}>排序方式:</Text>
          <View style={styles.sortingButtons}>
            <TouchableOpacity
              style={[
                styles.sortButton,
                settings?.chat?.openrouter?.sortingStrategy === 'price' && styles.activeSortButton
              ]}
              onPress={() => onSortingStrategySelect('price')}
            >
              <Text style={[
                styles.sortButtonText,
                settings?.chat?.openrouter?.sortingStrategy === 'price' && styles.activeSortButtonText
              ]}>价格</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sortButton,
                settings?.chat?.openrouter?.sortingStrategy === 'speed' && styles.activeSortButton
              ]}
              onPress={() => onSortingStrategySelect('speed')}
            >
              <Text style={[
                styles.sortButtonText,
                settings?.chat?.openrouter?.sortingStrategy === 'speed' && styles.activeSortButtonText
              ]}>性能</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sortButton,
                settings?.chat?.openrouter?.sortingStrategy === 'latency' && styles.activeSortButton
              ]}
              onPress={() => onSortingStrategySelect('latency')}
            >
              <Text style={[
                styles.sortButtonText,
                settings?.chat?.openrouter?.sortingStrategy === 'latency' && styles.activeSortButtonText
              ]}>延迟</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Model list display area */}
      <View style={styles.modelsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF9ECD" />
            <Text style={styles.loadingText}>加载模型中...</Text>
          </View>
        ) : filteredModels.length > 0 ? (
          // Use ScrollView instead of FlatList to avoid nesting VirtualizedLists
          <ScrollView style={styles.modelList}>
            <Text style={styles.modelListHeader}>
              可用模型 ({filteredModels.length})
            </Text>
            {filteredModels.map(model => renderModelItem({ item: model }))}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={48} color="#555" />
            <Text style={styles.emptyText}>
              {searchQuery ? "没有找到匹配的模型" : "未找到可用模型"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
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
    color: '#fff',
    fontSize: 16,
    height: 36,
  },
  clearSearch: {
    padding: 4,
  },
  sortingOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sortingLabel: {
    color: '#ddd',
    marginRight: 8,
  },
  sortingButtons: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#444',
    borderRadius: 16,
    marginRight: 8,
  },
  sortButtonText: {
    color: '#ddd',
    fontSize: 14,
  },
  activeSortButton: {
    backgroundColor: '#FF9ECD',
  },
  activeSortButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modelsContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    height: 350, // Fixed height to prevent layout issues
  },
  modelList: {
    maxHeight: 350,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modelListHeader: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  loadingText: {
    color: '#ddd',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  emptyText: {
    color: '#777',
    marginTop: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  modelItemContainer: {
    marginBottom: 12,
  },
  modelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#444',
    borderRadius: 8,
  },
  selectedModelItem: {
    backgroundColor: 'rgba(255, 158, 205, 0.15)',
    borderWidth: 1,
    borderColor: '#FF9ECD',
  },
  modelMainInfo: {
    flex: 1,
    marginRight: 8,
  },
  modelName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  selectedModelText: {
    color: '#FF9ECD',
  },
  modelProvider: {
    color: '#aaa',
    fontSize: 13,
  },
  modelActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsButton: {
    padding: 4,
    marginRight: 4,
  },
  modelDetails: {
    padding: 12,
    backgroundColor: '#333',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: 1,
  },
  modelId: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  modelDescription: {
    color: '#ddd',
    fontSize: 14,
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
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  modelStatValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ModelSelector;
