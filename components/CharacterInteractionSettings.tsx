import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Switch,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Character } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import { theme } from '@/constants/theme';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CharacterInteractionSettingsProps {
  isVisible: boolean;
  onClose: () => void;
}

// Helper to get bytes size of a string
const getStringByteSize = (str: string): number => {
  return new Blob([str]).size;
};

// Format bytes to readable format
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
};

// Format timestamp to readable date
const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

const CharacterInteractionSettings: React.FC<CharacterInteractionSettingsProps> = ({
  isVisible,
  onClose
}) => {
  const { characters, updateCharacter } = useCharacters();
  const [expandedCharacterId, setExpandedCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  
  // Memory management states
  const [isMemoryModalVisible, setIsMemoryModalVisible] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [circleMemories, setCircleMemories] = useState<any[]>([]);
  const [memoryStats, setMemoryStats] = useState<{
    count: number;
    totalSize: number;
    oldestDate: number | null;
    newestDate: number | null;
  }>({
    count: 0,
    totalSize: 0,
    oldestDate: null,
    newestDate: null,
  });
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [memoryDeleteLoading, setMemoryDeleteLoading] = useState<string | null>(null);

  // Handle circle interaction toggle
  const handleCircleInteractionToggle = async (character: Character) => {
    try {
      setLoading(character.id);
      
      const updatedCharacter = {
        ...character,
        circleInteraction: !character.circleInteraction
      };
      
      // If enabling, set default values if they don't exist
      if (!character.circleInteraction) {
        updatedCharacter.circlePostFrequency = character.circlePostFrequency || 'medium';
        updatedCharacter.circleInteractionFrequency = character.circleInteractionFrequency || 'medium';
        updatedCharacter.circleStats = character.circleStats || {
          repliedToCharacters: {},
          repliedToPostsCount: 0,
          repliedToCommentsCount: {}
        };
      }
      
      await updateCharacter(updatedCharacter);
      
      // Automatically expand settings when enabling circle interaction
      if (!character.circleInteraction) {
        setExpandedCharacterId(character.id);
      }
      // If disabling and this character's settings were expanded, collapse them
      else if (expandedCharacterId === character.id) {
        setExpandedCharacterId(null);
      }
    } catch (error) {
      console.error('更新角色朋友圈设置失败:', error);
      Alert.alert('错误', '无法更新朋友圈设置');
    } finally {
      setLoading(null);
    }
  };
  
  // Handle relationship toggle
  const handleRelationshipToggle = async (character: Character) => {
    try {
      setLoading(character.id);
      
      const updatedCharacter = {
        ...character,
        relationshipEnabled: !character.relationshipEnabled
      };
      
      await updateCharacter(updatedCharacter);
    } catch (error) {
      console.error('更新角色关系设置失败:', error);
      Alert.alert('错误', '无法更新关系设置');
    } finally {
      setLoading(null);
    }
  };

  // Handle frequency changes for circle posts and interactions
  const handleFrequencyChange = async (
    character: Character, 
    type: 'circlePostFrequency' | 'circleInteractionFrequency', 
    value: 'low' | 'medium' | 'high'
  ) => {
    try {
      setLoading(character.id);
      
      const updatedCharacter = {
        ...character,
        [type]: value
      };
      
      await updateCharacter(updatedCharacter);
    } catch (error) {
      console.error('更新角色频率设置失败:', error);
      Alert.alert('错误', '无法更新频率设置');
    } finally {
      setLoading(null);
    }
  };

  // Get frequency description text
  const getFrequencyDescription = (type: 'circlePostFrequency' | 'circleInteractionFrequency', value: string | undefined) => {
    switch (value) {
      case 'low': return type === 'circlePostFrequency' ? '低 (1次/天)' : '低';
      case 'medium': return type === 'circlePostFrequency' ? '中 (3次/天)' : '中';
      case 'high': return type === 'circlePostFrequency' ? '高 (5次/天)' : '高';
      default: return '中';
    }
  };

  // Function to load circle memory for a character
  const loadCircleMemory = async (character: Character) => {
    try {
      setIsLoadingMemory(true);
      setSelectedCharacter(character);
      
      const storageKey = `nodest_${character.id}_circle_memory`;
      const memoryData = await AsyncStorage.getItem(storageKey);
      
      if (memoryData) {
        const memories = JSON.parse(memoryData);
        setCircleMemories(memories);
        
        // Calculate memory stats
        let totalSize = getStringByteSize(memoryData);
        let oldestDate = null;
        let newestDate = null;
        
        if (memories.length > 0) {
          // Find oldest and newest entries
          oldestDate = Math.min(...memories.map((m: any) => m.timestamp));
          newestDate = Math.max(...memories.map((m: any) => m.timestamp));
        }
        
        setMemoryStats({
          count: memories.length,
          totalSize,
          oldestDate,
          newestDate
        });
      } else {
        setCircleMemories([]);
        setMemoryStats({
          count: 0,
          totalSize: 0,
          oldestDate: null,
          newestDate: null
        });
      }
      
      setIsMemoryModalVisible(true);
    } catch (error) {
      console.error('加载角色朋友圈记忆失败:', error);
      Alert.alert('错误', '无法加载朋友圈记忆');
    } finally {
      setIsLoadingMemory(false);
    }
  };

  // Delete a specific memory entry
  const deleteMemoryEntry = async (index: number) => {
    if (!selectedCharacter) return;
    
    try {
      setMemoryDeleteLoading(`entry-${index}`);
      
      // Prepare storage key
      const storageKey = `nodest_${selectedCharacter.id}_circle_memory`;
      
      // Create a new array without the deleted entry
      const updatedMemories = [...circleMemories];
      updatedMemories.splice(index, 1);
      
      // Save updated memories
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedMemories));
      
      // Update state
      setCircleMemories(updatedMemories);
      
      // Update stats
      const memoriesJson = JSON.stringify(updatedMemories);
      setMemoryStats({
        count: updatedMemories.length,
        totalSize: getStringByteSize(memoriesJson),
        oldestDate: updatedMemories.length > 0 ? Math.min(...updatedMemories.map(m => m.timestamp)) : null,
        newestDate: updatedMemories.length > 0 ? Math.max(...updatedMemories.map(m => m.timestamp)) : null
      });
    } catch (error) {
      console.error('删除记忆条目失败:', error);
      Alert.alert('错误', '无法删除记忆条目');
    } finally {
      setMemoryDeleteLoading(null);
    }
  };

  // Delete all memory entries for a character
  const clearAllMemories = async () => {
    if (!selectedCharacter) return;
    
    Alert.alert(
      '确认清除',
      `确定要清除 ${selectedCharacter.name} 的所有朋友圈记忆吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              setMemoryDeleteLoading('all');
              
              // Prepare storage key
              const storageKey = `nodest_${selectedCharacter.id}_circle_memory`;
              
              // Clear memory by setting empty array
              await AsyncStorage.setItem(storageKey, JSON.stringify([]));
              
              // Update state
              setCircleMemories([]);
              
              // Update stats
              setMemoryStats({
                count: 0,
                totalSize: 0,
                oldestDate: null,
                newestDate: null
              });
            } catch (error) {
              console.error('清除所有记忆失败:', error);
              Alert.alert('错误', '无法清除所有记忆');
            } finally {
              setMemoryDeleteLoading(null);
            }
          }
        }
      ]
    );
  };

  // Check memory size for a character
  const checkMemorySize = async (character: Character) => {
    try {
      setLoading(character.id);
      
      const storageKey = `nodest_${character.id}_circle_memory`;
      const memoryData = await AsyncStorage.getItem(storageKey);
      
      if (memoryData) {
        const memories = JSON.parse(memoryData);
        const size = getStringByteSize(memoryData);
        
        Alert.alert(
          '朋友圈记忆状态',
          `${character.name} 的朋友圈记忆:\n条目数量: ${memories.length}\n存储大小: ${formatBytes(size)}\n\n点击"管理"按钮可查看详情和清理记忆。`
        );
      } else {
        Alert.alert('朋友圈记忆状态', `${character.name} 没有朋友圈记忆记录。`);
      }
    } catch (error) {
      console.error('检查记忆大小失败:', error);
      Alert.alert('错误', '无法检查记忆大小');
    } finally {
      setLoading(null);
    }
  };

  // Render expanded settings for a character
  const renderExpandedSettings = (character: Character) => {
    if (expandedCharacterId !== character.id) return null;
    
    return (
      <View style={styles.expandedSettings}>
        <Text style={styles.settingsLabel}>朋友圈互动设置</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>发布频率</Text>
          {Platform.OS === 'ios' ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={character.circlePostFrequency || 'medium'}
                style={styles.picker}
                itemStyle={styles.pickerItem}
                onValueChange={(value) => handleFrequencyChange(character, 'circlePostFrequency', value as 'low' | 'medium' | 'high')}
              >
                <Picker.Item label="低 (1次/天)" value="low" />
                <Picker.Item label="中 (3次/天)" value="medium" />
                <Picker.Item label="高 (5次/天)" value="high" />
              </Picker>
            </View>
          ) : (
            <View style={styles.pickerContainerAndroid}>
              <Picker
                selectedValue={character.circlePostFrequency || 'medium'}
                style={styles.pickerAndroid}
                dropdownIconColor={theme.colors.white}
                onValueChange={(value) => handleFrequencyChange(character, 'circlePostFrequency', value as 'low' | 'medium' | 'high')}
              >
                <Picker.Item label="低 (1次/天)" value="low" color={theme.colors.white} />
                <Picker.Item label="中 (3次/天)" value="medium" color={theme.colors.white} />
                <Picker.Item label="高 (5次/天)" value="high" color={theme.colors.white} />
              </Picker>
            </View>
          )}
        </View>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>互动频率</Text>
          {Platform.OS === 'ios' ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={character.circleInteractionFrequency || 'medium'}
                style={styles.picker}
                itemStyle={styles.pickerItem}
                onValueChange={(value) => handleFrequencyChange(character, 'circleInteractionFrequency', value as 'low' | 'medium' | 'high')}
              >
                <Picker.Item label="低" value="low" />
                <Picker.Item label="中" value="medium" />
                <Picker.Item label="高" value="high" />
              </Picker>
            </View>
          ) : (
            <View style={styles.pickerContainerAndroid}>
              <Picker
                selectedValue={character.circleInteractionFrequency || 'medium'}
                style={styles.pickerAndroid}
                dropdownIconColor={theme.colors.white}
                onValueChange={(value) => handleFrequencyChange(character, 'circleInteractionFrequency', value as 'low' | 'medium' | 'high')}
              >
                <Picker.Item label="低" value="low" color={theme.colors.white} />
                <Picker.Item label="中" value="medium" color={theme.colors.white} />
                <Picker.Item label="高" value="high" color={theme.colors.white} />
              </Picker>
            </View>
          )}
        </View>
        
        <Text style={styles.settingDescription}>
          {`互动频率 ${getFrequencyDescription('circleInteractionFrequency', character.circleInteractionFrequency || 'medium')} 表示：\n`}
          {character.circleInteractionFrequency === 'low' 
            ? '- 最多回复同一角色的朋友圈1次\n- 最多回复5个不同角色的朋友圈\n- 最多回复朋友圈下其他角色的评论1次' 
            : character.circleInteractionFrequency === 'medium'
              ? '- 最多回复同一角色的朋友圈3次\n- 最多回复5个不同角色的朋友圈\n- 最多回复朋友圈下其他角色的评论3次'
              : '- 最多回复同一角色的朋友圈5次\n- 最多回复7个不同角色的朋友圈\n- 最多回复朋友圈下其他角色的评论5次'
          }
        </Text>

        {/* Memory management section */}
        <View style={styles.memorySection}>
          <Text style={styles.memoryTitle}>朋友圈社交记忆管理</Text>
          <View style={styles.memoryActions}>
            <TouchableOpacity
              style={styles.memoryButton}
              onPress={() => checkMemorySize(character)}
              disabled={loading === character.id}
            >
              <MaterialCommunityIcons name="memory" size={18} color={theme.colors.text} />
              <Text style={styles.memoryButtonText}>检查大小</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.memoryButton, styles.manageButton]}
              onPress={() => loadCircleMemory(character)}
              disabled={loading === character.id || isLoadingMemory}
            >
              <MaterialIcons name="settings" size={18} color={theme.colors.text} />
              <Text style={styles.memoryButtonText}>管理记忆</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.memoryDescription}>
            管理朋友圈社交记忆可以减少存储空间占用，提高角色响应速度。定期清理无用记忆有助于提升APP性能。
          </Text>
        </View>
      </View>
    );
  };

  // Render character memory modal
  const renderMemoryModal = () => {
    if (!selectedCharacter) return null;
    
    return (
      <Modal
        visible={isMemoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsMemoryModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.memoryModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{`${selectedCharacter.name} 的朋友圈记忆`}</Text>
              <TouchableOpacity 
                onPress={() => setIsMemoryModalVisible(false)} 
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Memory stats section */}
            <View style={styles.memoryStatsSection}>
              <Text style={styles.memoryStatsTitle}>记忆统计</Text>
              <View style={styles.memoryStatsGrid}>
                <View style={styles.memoryStatItem}>
                  <Text style={styles.memoryStatLabel}>记忆条目</Text>
                  <Text style={styles.memoryStatValue}>{memoryStats.count}</Text>
                </View>
                <View style={styles.memoryStatItem}>
                  <Text style={styles.memoryStatLabel}>存储大小</Text>
                  <Text style={styles.memoryStatValue}>{formatBytes(memoryStats.totalSize)}</Text>
                </View>
                <View style={styles.memoryStatItem}>
                  <Text style={styles.memoryStatLabel}>最早记忆</Text>
                  <Text style={styles.memoryStatValue}>
                    {memoryStats.oldestDate ? formatDate(memoryStats.oldestDate) : '无记忆'}
                  </Text>
                </View>
                <View style={styles.memoryStatItem}>
                  <Text style={styles.memoryStatLabel}>最新记忆</Text>
                  <Text style={styles.memoryStatValue}>
                    {memoryStats.newestDate ? formatDate(memoryStats.newestDate) : '无记忆'}
                  </Text>
                </View>
              </View>
              
              {/* Clear all memories button */}
              {circleMemories.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={clearAllMemories}
                  disabled={memoryDeleteLoading === 'all'}
                >
                  {memoryDeleteLoading === 'all' ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <>
                      <MaterialIcons name="delete-sweep" size={18} color={theme.colors.white} />
                      <Text style={styles.clearAllButtonText}>清除所有记忆</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            
            {/* Memory entries list */}
            {isLoadingMemory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>加载记忆中...</Text>
              </View>
            ) : circleMemories.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons 
                  name="thought-bubble-outline" 
                  size={48} 
                  color={theme.colors.textSecondary} 
                />
                <Text style={styles.emptyText}>没有朋友圈记忆</Text>
                <Text style={styles.emptySubtext}>
                  当角色参与朋友圈互动时会自动创建记忆
                </Text>
              </View>
            ) : (
              <FlatList
                data={circleMemories}
                renderItem={({ item, index }) => renderMemoryItem(item, index)}
                keyExtractor={(_, index) => `memory-${index}`}
                contentContainerStyle={styles.memoryListContainer}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // Render each memory item
  const renderMemoryItem = (memory: any, index: number) => {
    // Extract content from memory
    const content = memory.parts?.[0]?.text || 'Unknown memory content';
    const timestamp = memory.timestamp || Date.now();
    const date = new Date(timestamp).toLocaleString();
    
    // Calculate memory size
    const memorySize = getStringByteSize(JSON.stringify(memory));
    
    // Parse interaction type and content from text if possible
    let interactionType = '';
    let memoryContent = '';
    
    try {
      // Try to extract type and content
      if (content.includes('newPost:') || content.includes('replyToComment:') || content.includes('replyToPost:')) {
        const parts = content.split('\n');
        interactionType = parts[0].split(':')[0]; // Get type before colon
        memoryContent = parts[0].split(':').slice(1).join(':').trim(); // Get content after colon
      } else {
        memoryContent = content;
      }
    } catch (error) {
      memoryContent = content;
    }
    
    return (
      <View style={styles.memoryItem}>
        <View style={styles.memoryHeader}>
          <View style={styles.memoryInfo}>
            <Text style={styles.memoryDate}>{date}</Text>
            <Text style={styles.memoryType}>{interactionType || '朋友圈互动'}</Text>
            <Text style={styles.memorySize}>{formatBytes(memorySize)}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.deleteMemoryButton}
            onPress={() => deleteMemoryEntry(index)}
            disabled={memoryDeleteLoading === `entry-${index}`}
          >
            {memoryDeleteLoading === `entry-${index}` ? (
              <ActivityIndicator size="small" color={theme.colors.danger} />
            ) : (
              <MaterialIcons name="delete" size={20} color={theme.colors.danger} />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.memoryContent}>
          <ScrollView style={styles.memoryContentScroll}>
            <Text style={styles.memoryContentText} numberOfLines={3} ellipsizeMode="tail">
              {memoryContent}
            </Text>
            
            {/* Show response data if available */}
            {content.includes('Response:') && (
              <View style={styles.memoryResponse}>
                <Text style={styles.memoryResponseLabel}>回应:</Text>
                <Text style={styles.memoryResponseText} numberOfLines={3} ellipsizeMode="tail">
                  {content.split('Response:')[1].trim()}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  // Render each character item
  const renderCharacterItem = ({ item }: { item: Character }) => {
    const isExpanded = expandedCharacterId === item.id;
    const isLoading = loading === item.id;
    
    return (
      <View style={styles.characterItem}>
        <View style={styles.characterHeader}>
          <View style={styles.characterInfo}>
            <Image 
              source={item.avatar ? { uri: item.avatar } : require('@/assets/images/default-avatar.png')} 
              style={styles.avatar} 
            />
            <Text style={styles.characterName}>{item.name}</Text>
          </View>
          
          <View style={styles.togglesContainer}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <View style={styles.toggleItem}>
                  <Text style={styles.toggleLabel}>朋友圈</Text>
                  <Switch
                    value={item.circleInteraction === true}
                    onValueChange={() => handleCircleInteractionToggle(item)}
                    trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }}
                    thumbColor={item.circleInteraction ? 'rgb(255, 224, 195)' : '#f4f3f4'}
                  />
                </View>
                
                <View style={styles.toggleItem}>
                  <Text style={styles.toggleLabel}>关系</Text>
                  <Switch
                    value={item.relationshipEnabled === true}
                    onValueChange={() => handleRelationshipToggle(item)}
                    trackColor={{ false: '#767577', true: 'rgba(255, 224, 195, 0.7)' }}
                    thumbColor={item.relationshipEnabled ? 'rgb(255, 224, 195)' : '#f4f3f4'}
                  />
                </View>
                
                {item.circleInteraction && (
                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => setExpandedCharacterId(isExpanded ? null : item.id)}
                  >
                    <MaterialIcons 
                      name={isExpanded ? "expand-less" : "expand-more"} 
                      size={24} 
                      color={theme.colors.text} 
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
        
        {renderExpandedSettings(item)}
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>角色互动设置</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={characters}
            renderItem={renderCharacterItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无角色</Text>
              </View>
            }
          />
        </View>
      </View>
      
      {/* Circle Memory Management Modal */}
      {renderMemoryModal()}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 5,
  },
  listContainer: {
    padding: 16,
  },
  characterItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    marginBottom: 12,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  characterHeader: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  characterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  characterName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  togglesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleItem: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  toggleLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  settingsButton: {
    padding: 4,
    marginLeft: 8,
  },
  expandedSettings: {
    padding: 16,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: theme.borderRadius.sm,
  },
  settingLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  // iOS picker styles
  pickerContainer: {
    width: 140,
    overflow: 'hidden',
  },
  picker: {
    width: 140,
    color: theme.colors.text,
  },
  pickerItem: {
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  // Android picker styles
  pickerContainerAndroid: {
    width: 140,
    backgroundColor: 'rgba(80, 80, 80, 0.8)',
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  pickerAndroid: {
    width: 140,
    color: theme.colors.white,
    backgroundColor: 'transparent',
  },
  settingDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Memory management styles
  memorySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 12,
  },
  memoryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    padding: 10,
    borderRadius: theme.borderRadius.sm,
    flex: 1,
    marginRight: 8,
  },
  manageButton: {
    backgroundColor: 'rgba(80, 80, 80, 0.8)',
    marginRight: 0,
  },
  memoryButtonText: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 6,
  },
  memoryDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 12,
    lineHeight: 18,
  },
  
  // Memory modal styles
  memoryModalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  memoryStatsSection: {
    padding: 16,
    backgroundColor: 'rgba(60, 60, 60, 0.3)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  memoryStatsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 12,
  },
  memoryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  memoryStatItem: {
    width: '48%',
    backgroundColor: 'rgba(80, 80, 80, 0.5)',
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 8,
  },
  memoryStatLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  memoryStatValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
    padding: 10,
    borderRadius: theme.borderRadius.sm,
    marginTop: 8,
  },
  clearAllButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.white,
    marginLeft: 6,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  memoryListContainer: {
    padding: 16,
  },
  memoryItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 12,
    overflow: 'hidden',
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(60, 60, 60, 0.5)',
  },
  memoryInfo: {
    flex: 1,
  },
  memoryDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  memoryType: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: 2,
  },
  memorySize: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  deleteMemoryButton: {
    padding: 8,
  },
  memoryContent: {
    padding: 12,
    maxHeight: 120,
  },
  memoryContentScroll: {
    maxHeight: 96,
  },
  memoryContentText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  memoryResponse: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(120, 120, 120, 0.3)',
  },
  memoryResponseLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  memoryResponseText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
});

export default CharacterInteractionSettings;
