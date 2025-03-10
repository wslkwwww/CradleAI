import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import tagData from '@/app/data/tag.json';
import { theme } from '@/constants/theme';

// Update the types to match the actual structure of the tag data
type SubCategory = {
  [key: string]: string[];
};

type Category = {
  name: string;
  sub_categories: SubCategory;
};

interface TagSelectorProps {
  onPositiveTagsChange: (tags: string[]) => void;
  onNegativeTagsChange: (tags: string[]) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({ onPositiveTagsChange, onNegativeTagsChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<{ [key: string]: 'positive' | 'negative' }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredTags, setFilteredTags] = useState<{ tag: string; category: string }[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showSelectedTags, setShowSelectedTags] = useState(true);

  // Load tag data
  useEffect(() => {
    if (tagData?.general_categories) {
      setCategories(tagData.general_categories as unknown as Category[]);
      // Select first category by default
      if (tagData.general_categories.length > 0) {
        setSelectedCategory(tagData.general_categories[0] as unknown as Category);
      }
    }
  }, []);

  // Create a flat list of all tags for searching
  const allTags = React.useMemo(() => {
    const tags: { tag: string; category: string }[] = [];
    categories.forEach(category => {
      if (category.sub_categories) {
        Object.entries(category.sub_categories).forEach(([subCategoryName, tagsArray]) => {
          if (Array.isArray(tagsArray)) {
            tagsArray.forEach(tag => {
              tags.push({ tag, category: `${category.name} > ${subCategoryName}` });
            });
          }
        });
      }
    });
    return tags;
  }, [categories]);

  // Improve search functionality to also search for Chinese tags
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTags([]);
      setShowSearchResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allTags.filter(item => {
      // Check both original tag and the Chinese part of the tag
      const originalMatch = item.tag.toLowerCase().includes(query);
      const chineseNameMatch = getTagName(item.tag).toLowerCase().includes(query);
      return originalMatch || chineseNameMatch;
    });
    
    setFilteredTags(filtered);
    setShowSearchResults(true);
  }, [searchQuery, allTags]);

  // Update the parent component when selected tags change
  useEffect(() => {
    const positiveTags = Object.entries(selectedTags)
      .filter(([_, type]) => type === 'positive')
      .map(([tag]) => tag);
    
    const negativeTags = Object.entries(selectedTags)
      .filter(([_, type]) => type === 'negative')
      .map(([tag]) => tag);
    
    onPositiveTagsChange(positiveTags);
    onNegativeTagsChange(negativeTags);
  }, [selectedTags, onPositiveTagsChange, onNegativeTagsChange]);

  // Handle tag selection
  const handleTagSelect = (tag: string, type: 'positive' | 'negative') => {
    setSelectedTags(prev => {
      // If already selected with the same type, remove it
      if (prev[tag] === type) {
        const newTags = { ...prev };
        delete newTags[tag];
        return newTags;
      }
      
      // Otherwise add or update it
      return { ...prev, [tag]: type };
    });
  };

  // Improve how we extract Chinese tag names for display
  const getTagName = (tag: string) => {
    // Try different patterns to find the Chinese part of the tag
    
    // Pattern 1: chineseText:englishText or chineseText：englishText
    const colonMatch = tag.match(/^(.+?)(?::|：)/);
    if (colonMatch) return colonMatch[1].trim();
    
    // Pattern 2: Find where Latin characters start
    const latinMatch = tag.match(/^(.*?)[a-zA-Z0-9]/);
    if (latinMatch && latinMatch[1].length > 0) return latinMatch[1].trim();
    
    // Pattern 3: Check if the entire string is Chinese
    if (/^[\u4e00-\u9fa5]+$/.test(tag)) return tag.trim();
    
    // Default: just return the tag
    return tag;
  };

  // Render category selector
  const renderCategorySelector = () => (
    <View style={styles.categoryContainer}>
      <ScrollView style={styles.categorySelector} showsHorizontalScrollIndicator={false}>
        {categories.map((category, index) => (
          <TouchableOpacity
            key={`category-${index}`}
            style={[
              styles.categoryButton,
              selectedCategory?.name === category.name && styles.selectedCategoryButton
            ]}
            onPress={() => {
              setSelectedCategory(category);
              setSelectedSubCategory(null);
              setShowSearchResults(false);
            }}
          >
            <Text 
              style={[
                styles.categoryButtonText,
                selectedCategory?.name === category.name && styles.selectedCategoryButtonText
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render subcategory selector if a category is selected
  const renderSubCategorySelector = () => {
    if (!selectedCategory || !selectedCategory.sub_categories) return null;

    const subCategories = Object.keys(selectedCategory.sub_categories);
    
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subCategorySelector}>
        {subCategories.map((subCategory, index) => (
          <TouchableOpacity
            key={`subcategory-${index}`} // Fixed: Corrected key attribute syntax
            style={[
              styles.subCategoryButton,
              selectedSubCategory === subCategory && styles.selectedSubCategoryButton
            ]}
            onPress={() => {
              setSelectedSubCategory(subCategory);
              setShowSearchResults(false);
            }}
          >
            <Text 
              style={[
                styles.subCategoryButtonText, 
                selectedSubCategory === subCategory && styles.selectedSubCategoryButtonText
              ]}
            >
              {subCategory}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render tags for the selected subcategory
  const renderTags = () => {
    if (!selectedCategory || !selectedSubCategory) return null;
    
    const tags = selectedCategory.sub_categories[selectedSubCategory];
    
    if (!tags || !Array.isArray(tags)) return null;

    return (
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => {
          const isPositive = selectedTags[tag] === 'positive';
          const isNegative = selectedTags[tag] === 'negative';

          return (
            <View key={`tag-${index}`} style={styles.tagItem}>
              <Text style={styles.tagText}>{tag}</Text>
              <View style={styles.tagActions}>
                <TouchableOpacity 
                  style={[
                    styles.tagActionButton, 
                    styles.positiveButton,
                    isPositive && styles.positiveButtonActive
                  ]}
                  onPress={() => handleTagSelect(tag, 'positive')}
                >
                  <Ionicons 
                    name={isPositive ? "checkmark-circle" : "add-circle-outline"} 
                    size={22} 
                    color={isPositive ? "#000" : theme.colors.accent} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.tagActionButton, 
                    styles.negativeButton,
                    isNegative && styles.negativeButtonActive
                  ]}
                  onPress={() => handleTagSelect(tag, 'negative')}
                >
                  <Ionicons 
                    name={isNegative ? "checkmark-circle" : "remove-circle-outline"} 
                    size={22} 
                    color={isNegative ? "#fff" : "#ff4444"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render search results
  const renderSearchResults = () => {
    if (!showSearchResults || filteredTags.length === 0) return null;

    return (
      <View style={styles.searchResultsContainer}>
        <Text style={styles.searchResultTitle}>搜索结果 ({filteredTags.length})</Text>
        <FlatList
          data={filteredTags}
          keyExtractor={(item, index) => `search-${index}`}
          renderItem={({ item }) => {
            const isPositive = selectedTags[item.tag] === 'positive';
            const isNegative = selectedTags[item.tag] === 'negative';

            return (
              <View style={styles.searchResultItem}>
                <View style={styles.searchResultTextContainer}>
                  <Text style={styles.searchResultTag}>{item.tag}</Text>
                  <Text style={styles.searchResultCategory}>{item.category}</Text>
                </View>
                <View style={styles.tagActions}>
                  <TouchableOpacity 
                    style={[
                      styles.tagActionButton, 
                      styles.positiveButton,
                      isPositive && styles.positiveButtonActive
                    ]}
                    onPress={() => handleTagSelect(item.tag, 'positive')}
                  >
                    <Ionicons 
                      name={isPositive ? "checkmark-circle" : "add-circle-outline"} 
                      size={22} 
                      color={isPositive ? "#000" : theme.colors.accent} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.tagActionButton, 
                      styles.negativeButton,
                      isNegative && styles.negativeButtonActive
                    ]}
                    onPress={() => handleTagSelect(item.tag, 'negative')}
                  >
                    <Ionicons 
                      name={isNegative ? "checkmark-circle" : "remove-circle-outline"} 
                      size={22} 
                      color={isNegative ? "#fff" : "#ff4444"} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          style={styles.searchResultsList}
        />
      </View>
    );
  };

  // Update the selected tag components rendering to show more info
  const renderSelectedTags = () => {
    const positiveTags = Object.entries(selectedTags)
      .filter(([_, type]) => type === 'positive')
      .map(([tag]) => tag);
    
    const negativeTags = Object.entries(selectedTags)
      .filter(([_, type]) => type === 'negative')
      .map(([tag]) => tag);
    
    if (positiveTags.length === 0 && negativeTags.length === 0) {
      return (
        <View style={styles.selectedTagsContainer}>
          <Text style={styles.noTagsText}>
            未选择任何标签，请从下方分类中选择或搜索标签
          </Text>
          <View style={styles.tagHelpContainer}>
            <View style={styles.tagHelpItem}>
              <Ionicons name="add-circle-outline" size={16} color={theme.colors.accent} />
              <Text style={styles.tagHelpText}>点击"+"添加为正面标签</Text>
            </View>
            <View style={styles.tagHelpItem}>
              <Ionicons name="remove-circle-outline" size={16} color="#ff4444" />
              <Text style={styles.tagHelpText}>点击"-"添加为负面标签</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.selectedTagsContainer}>
        <View style={styles.selectedTagsHeader}>
          <Text style={styles.selectedTagsTitle}>已选标签</Text>
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={() => setShowSelectedTags(!showSelectedTags)}
          >
            <Text style={styles.toggleButtonText}>{showSelectedTags ? '收起' : '展开'}</Text>
            <Ionicons name={showSelectedTags ? "chevron-up" : "chevron-down"} size={16} color="#aaa" />
          </TouchableOpacity>
        </View>

        {showSelectedTags && (
          <>
            {positiveTags.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionTitle}>正面标签 ({positiveTags.length})</Text>
                <View style={styles.tagChipsContainer}>
                  {positiveTags.map((tag, index) => (
                    <TouchableOpacity
                      key={`positive-${index}`}
                      style={[styles.tagChip, styles.positiveTagChip]}
                      onPress={() => handleTagSelect(tag, 'positive')}
                    >
                      <Text style={styles.tagChipText} numberOfLines={1}>{getTagName(tag)}</Text>
                      <Ionicons name="close-circle" size={16} color="rgba(0,0,0,0.5)" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {negativeTags.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionTitle}>负面标签 ({negativeTags.length})</Text>
                <View style={styles.tagChipsContainer}>
                  {negativeTags.map((tag, index) => (
                    <TouchableOpacity
                      key={`negative-${index}`}
                      style={[styles.tagChip, styles.negativeTagChip]}
                      onPress={() => handleTagSelect(tag, 'negative')}
                    >
                      <Text style={styles.tagChipText} numberOfLines={1}>{getTagName(tag)}</Text>
                      <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#aaa" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜索标签..."
          placeholderTextColor="#888"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Selected Tags Summary */}
      {renderSelectedTags()}

      {/* Tag Browser - Only show when not searching */}
      {!showSearchResults && (
        <>
          {/* Category Selector */}
          {renderCategorySelector()}
          
          {/* Subcategory Selector */}
          {renderSubCategorySelector()}
          
          {/* Tags List */}
          <ScrollView style={styles.tagBrowser}>
            {renderTags()}
          </ScrollView>
        </>
      )}

      {/* Search Results */}
      {renderSearchResults()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  selectedTagsContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedTagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedTagsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#aaa',
    marginRight: 4,
  },
  noTagsText: {
    color: '#aaa',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  tagSection: {
    marginTop: 12,
  },
  tagSectionTitle: {
    color: '#aaa',
    marginBottom: 8,
  },
  tagChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    margin: 4,
  },
  positiveTagChip: {
    backgroundColor: 'rgba(255, 224, 195, 0.8)',
  },
  negativeTagChip: {
    backgroundColor: 'rgba(255, 68, 68, 0.8)',
  },
  tagChipText: {
    marginRight: 6,
    fontSize: 13,
    maxWidth: 120,
    color: '#000', // Black text for positive tags
  },
  categoryContainer: {
    height: 40, // Fixed height for category selector
    marginBottom: 12,
  },
  categorySelector: {
    flex: 1,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  selectedCategoryButton: {
    backgroundColor: theme.colors.accent,
  },
  categoryButtonText: {
    color: '#fff',
  },
  selectedCategoryButtonText: {
    color: '#000',
    fontWeight: '500',
  },
  subCategorySelector: {
    marginBottom: 12,
  },
  subCategoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  selectedSubCategoryButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.3)',
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  subCategoryButtonText: {
    color: '#fff',
  },
  selectedSubCategoryButtonText: {
    color: theme.colors.accent,
    fontWeight: '500',
  },
  tagBrowser: {
    flex: 1,
  },
  tagsContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  tagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10, // Slightly smaller padding
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tagText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  tagActions: {
    flexDirection: 'row',
  },
  tagActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  positiveButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.2)',
  },
  positiveButtonActive: {
    backgroundColor: theme.colors.accent,
  },
  negativeButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
  },
  negativeButtonActive: {
    backgroundColor: '#FF4444',
  },
  searchResultsContainer: {
    flex: 1,
  },
  searchResultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchResultTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  searchResultTag: {
    color: '#fff',
    fontSize: 14,
  },
  searchResultCategory: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  tagHelpContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
  },
  tagHelpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagHelpText: {
    color: '#aaa',
    marginLeft: 8,
    fontSize: 12,
  },
});

export default TagSelector;