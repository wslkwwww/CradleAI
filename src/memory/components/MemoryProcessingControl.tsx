import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialCommunityIcons, } from '@expo/vector-icons';
import { useMemoryContext } from '../providers/MemoryProvider';
import Mem0Service from '../services/Mem0Service';
import { theme } from '@/constants/theme';
import { Character } from '@/shared/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DB_SIZE_WARNING_THRESHOLD = 50; 
const DB_SIZE_ALERT_THRESHOLD = 100;  

interface MemoryFact {
  id: string;
  memory: string;
  score?: number;
  createdAt?: string;
  updatedAt?: string;
  metadata?: any;
  agentId?: string;
  userId?: string;
  runId?: string;
}

interface MemoryProcessingControlProps {
  visible?: boolean;
  onClose: () => void;
  characterId?: string;
  conversationId?: string;
  character?: Character;
}

const MemoryProcessingControl: React.FC<MemoryProcessingControlProps> = ({
  visible = false,
  onClose,
  characterId,
  conversationId,
  character,
}) => {
  const { setMemoryProcessingInterval, getMemoryProcessingInterval } = useMemoryContext();
  const [currentInterval, setCurrentInterval] = useState(10);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'memories' | 'stats'>('memories');
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>([]);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [factSearchQuery, setFactSearchQuery] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | undefined>(characterId);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(conversationId);
  const [editingMemory, setEditingMemory] = useState<MemoryFact | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [dbStats, setDbStats] = useState<{totalCount: number, dbSize: number, dbSizeMB: string}>({
    totalCount: 0,
    dbSize: 0,
    dbSizeMB: '0'
  });
  const [characterMemoryCount, setCharacterMemoryCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = getMemoryProcessingInterval();
    setCurrentInterval(interval);
    const mem0Service = Mem0Service.getInstance();
    const enabled = mem0Service.isMemoryEnabled?.() ?? true;
    setMemoryEnabled(enabled);
    setIsInitialized(true);

    if (character) {
      setSelectedCharacterId(character.id);
    }
  }, [getMemoryProcessingInterval, character]);

  useEffect(() => {
    if (isInitialized) {
      const mem0Service = Mem0Service.getInstance();
      if (mem0Service.setMemoryEnabled) {
        mem0Service.setMemoryEnabled(memoryEnabled);
        console.log(`[MemoryProcessingControl] Memory recording ${memoryEnabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [memoryEnabled, isInitialized]);

  const fetchDbStats = useCallback(async () => {
    const mem0Service = Mem0Service.getInstance();
    
    try {
      const stats = await mem0Service.getVectorDbStats();
      setDbStats(stats);
      
      if (selectedCharacterId) {
        const count = await mem0Service.getCharacterMemoryCount(selectedCharacterId);
        setCharacterMemoryCount(count);
      }
    } catch (error) {
      console.error('[MemoryProcessingControl] Error fetching database stats:', error);
    }
  }, [selectedCharacterId]);

  const dbSizeWarningMessage = useMemo(() => {
    const sizeMB = parseFloat(dbStats.dbSizeMB);
    if (sizeMB >= DB_SIZE_ALERT_THRESHOLD) {
      return `警告: 向量数据库已达到 ${dbStats.dbSizeMB}MB，建议清理不必要的记忆!`;
    } else if (sizeMB >= DB_SIZE_WARNING_THRESHOLD) {
      return `提示: 向量数据库大小为 ${dbStats.dbSizeMB}MB，接近建议上限`;
    }
    return '';
  }, [dbStats.dbSizeMB]);

  useEffect(() => {
    if (visible && (selectedCharacterId || characterId)) {
      fetchMemoryFacts();
      fetchDbStats();
    }
  }, [visible, selectedCharacterId, characterId]);

  const fetchMemoryFacts = useCallback(async () => {
    if (!selectedCharacterId && !characterId) {
      console.warn('[MemoryProcessingControl] No character ID provided for memory facts');
      return;
    }

    const charId = selectedCharacterId || characterId;
    
    try {
      setIsLoadingFacts(true);
      const mem0Service = Mem0Service.getInstance();
      
      let memories: MemoryFact[] = [];
      
      if (mem0Service.getCharacterMemories && charId) {
        memories = await mem0Service.getCharacterMemories(charId, 200);
        console.log(`[MemoryProcessingControl] Retrieved ${memories.length} memories directly for character ${charId}`);
      }
      
      if (memories.length === 0 && mem0Service.memoryRef) {
        try {
          const result = await mem0Service.memoryRef.getAll({
            agentId: charId,
            limit: 100
          });

          if (result && result.results) {
            memories = result.results;
          }
        } catch (err) {
          console.error('[MemoryProcessingControl] Error accessing database directly:', err);
        }
      }
      
      if (factSearchQuery && memories.length > 0) {
        memories = memories.filter((item: MemoryFact) =>
          item.memory.toLowerCase().includes(factSearchQuery.toLowerCase())
        );
      }
      
      memories.sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || '';
        const dateB = b.updatedAt || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      
      setMemoryFacts(memories);
    } catch (error) {
      console.error('[MemoryProcessingControl] Error fetching memory facts:', error);
    } finally {
      setIsLoadingFacts(false);
    }
  }, [selectedCharacterId, characterId, factSearchQuery]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchMemoryFacts(), fetchDbStats()]);
    setIsRefreshing(false);
  }, [fetchMemoryFacts, fetchDbStats]);

  const handleIntervalChange = (value: number) => {
    const roundedValue = Math.round(value);
    setCurrentInterval(roundedValue);
  };

  const handleIntervalSave = () => {
    setMemoryProcessingInterval(currentInterval);
    const mem0Service = Mem0Service.getInstance();
    if (mem0Service.setProcessingInterval) {
      mem0Service.setProcessingInterval(currentInterval);
      console.log(`[MemoryProcessingControl] Memory processing interval set to ${currentInterval}`);
    }

    if (currentInterval === 1) {
      Alert.alert(
        '警告',
        '将处理间隔设置为每轮处理可能导致API使用量增加，这可能会提高成本。确定要继续吗？',
        [
          { text: '取消', style: 'cancel', onPress: () => setCurrentInterval(2) },
          { text: '确定', style: 'destructive' }
        ]
      );
    }
    
    Alert.alert('成功', '记忆处理间隔设置已保存');
  };

  const handleProcessNow = () => {
    try {
      const mem0Service = Mem0Service.getInstance();
      if (mem0Service.processCurrentMemories) {
        const charId = selectedCharacterId || characterId;
        const convId = selectedConversationId || conversationId;
        
        if (!charId) {
          Alert.alert('错误', '未选择角色，无法处理记忆');
          return;
        }
        
        mem0Service.processCurrentMemories(charId, convId);
        Alert.alert('成功', '已手动处理当前记忆缓存');
      }
    } catch (error) {
      console.error('[MemoryProcessingControl] Error processing memories:', error);
      Alert.alert('错误', '处理记忆失败，请稍后再试');
    }
  };

  const handleSearchQueryChange = (text: string) => {
    setFactSearchQuery(text);
  };

  const handleSearchSubmit = () => {
    fetchMemoryFacts();
  };

  const handleAddMemory = () => {
    setIsCreatingNew(true);
    setNewMemoryContent('');
  };

  const handleSaveNewMemory = async () => {
    if (!newMemoryContent.trim()) {
      Alert.alert('错误', '记忆内容不能为空');
      return;
    }

    const charId = selectedCharacterId || characterId;
    if (!charId) {
      Alert.alert('错误', '未选择角色');
      return;
    }

    try {
      const mem0Service = Mem0Service.getInstance();
      const result = await mem0Service.createMemory(
        newMemoryContent, 
        charId, 
        selectedConversationId || conversationId
      );

      if (result) {
        Alert.alert('成功', '成功创建新记忆');
        setIsCreatingNew(false);
        setNewMemoryContent('');
        await handleRefresh();
      } else {
        Alert.alert('错误', '创建记忆失败');
      }
    } catch (error) {
      console.error('[MemoryProcessingControl] Error creating memory:', error);
      Alert.alert('错误', '创建记忆失败');
    }
  };

  const handleEditMemory = (memory: MemoryFact) => {
    setEditingMemory(memory);
    setEditingContent(memory.memory);
  };

  const handleSaveEditedMemory = async () => {
    if (!editingMemory || !editingContent.trim()) {
      Alert.alert('错误', '记忆内容不能为空');
      return;
    }

    try {
      const mem0Service = Mem0Service.getInstance();
      const result = await mem0Service.updateMemory(
        editingMemory.id,
        editingContent
      );

      if (result) {
        Alert.alert('成功', '记忆更新成功');
        setEditingMemory(null);
        setEditingContent('');
        await handleRefresh();
      } else {
        Alert.alert('错误', '更新记忆失败');
      }
    } catch (error) {
      console.error('[MemoryProcessingControl] Error updating memory:', error);
      Alert.alert('错误', '更新记忆失败');
    }
  };

  const handleDeleteMemory = (memory: MemoryFact) => {
    Alert.alert(
      '确认删除',
      '确定要删除此记忆吗？此操作不可逆。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const mem0Service = Mem0Service.getInstance();
              const result = await mem0Service.deleteMemory(memory.id);
              
              if (result) {
                setMemoryFacts(prev => prev.filter(item => item.id !== memory.id));
                Alert.alert('成功', '记忆已删除');
                await fetchDbStats();
              } else {
                Alert.alert('错误', '删除记忆失败');
              }
            } catch (error) {
              console.error('[MemoryProcessingControl] Error deleting memory:', error);
              Alert.alert('错误', '删除记忆失败');
            }
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.fullScreenContainer}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>记忆管理系统</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {(character || selectedCharacterId) && (
            <View style={styles.characterInfo}>
              <Text style={styles.characterInfoText}>
                {character?.name || '角色'} - ID: {selectedCharacterId || characterId}
              </Text>
              {characterMemoryCount > 0 && (
                <View style={styles.memoryCountBadge}>
                  <Text style={styles.memoryCountText}>{characterMemoryCount} 条记忆</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'memories' && styles.activeTabButton]}
            onPress={() => setActiveTab('memories')}
          >
            <MaterialCommunityIcons
              name="brain"
              size={22}
              color={activeTab === 'memories' ? '#fff' : '#aaa'}
            />
            <Text style={[styles.tabText, activeTab === 'memories' && styles.activeTabText]}>
              记忆
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'stats' && styles.activeTabButton]}
            onPress={() => setActiveTab('stats')}
          >
            <Ionicons
              name="stats-chart"
              size={22}
              color={activeTab === 'stats' ? '#fff' : '#aaa'}
            />
            <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
              统计
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'settings' && styles.activeTabButton]}
            onPress={() => setActiveTab('settings')}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={activeTab === 'settings' ? '#fff' : '#aaa'}
            />
            <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
              设置
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {activeTab === 'memories' && (
            <MemoriesPanel
              memories={memoryFacts}
              isLoading={isLoadingFacts}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              onEditMemory={handleEditMemory}
              onDeleteMemory={handleDeleteMemory}
              onAddMemory={handleAddMemory}
              characterId={selectedCharacterId || characterId}
              searchQuery={factSearchQuery}
              onSearchQueryChange={handleSearchQueryChange}
              onSearchSubmit={handleSearchSubmit}
            />
          )}
          
          {activeTab === 'settings' && (
            <SettingsPanel
              currentInterval={currentInterval}
              memoryEnabled={memoryEnabled}
              setMemoryEnabled={setMemoryEnabled}
              onIntervalChange={handleIntervalChange}
              onSaveInterval={handleIntervalSave}
              onProcessNow={handleProcessNow}
              characterId={selectedCharacterId || characterId}
              conversationId={selectedConversationId || conversationId}
            />
          )}
          
          {activeTab === 'stats' && (
            <StatsPanel
              dbStats={dbStats}
              characterMemoryCount={characterMemoryCount}
              characterName={character?.name || '当前角色'}
              characterId={selectedCharacterId || characterId || ''}
              onRefresh={fetchDbStats}
            />
          )}
        </View>

        {dbSizeWarningMessage && (
          <View style={[
            styles.dbSizeWarning, 
            parseFloat(dbStats.dbSizeMB) >= DB_SIZE_ALERT_THRESHOLD ? styles.dbSizeAlert : {}
          ]}>
            <Ionicons name="warning" size={18} color="white" />
            <Text style={styles.dbSizeWarningText}>{dbSizeWarningMessage}</Text>
          </View>
        )}

        <Modal
          visible={!!editingMemory}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditingMemory(null)}
        >
          <KeyboardAvoidingView 
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editModalContainer}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>编辑记忆</Text>
                <TouchableOpacity onPress={() => setEditingMemory(null)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.editModalInput}
                value={editingContent}
                onChangeText={setEditingContent}
                multiline
                placeholder="编辑记忆内容..."
                placeholderTextColor="#999"
              />
              
              <View style={styles.editModalButtons}>
                <TouchableOpacity 
                  style={[styles.editModalButton, styles.cancelButton]}
                  onPress={() => setEditingMemory(null)}
                >
                  <Text style={styles.editModalButtonText}>取消</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.editModalButton, styles.saveButton]}
                  onPress={handleSaveEditedMemory}
                >
                  <Text style={styles.editModalButtonText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={isCreatingNew}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsCreatingNew(false)}
        >
          <KeyboardAvoidingView 
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editModalContainer}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>新建记忆</Text>
                <TouchableOpacity onPress={() => setIsCreatingNew(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.editModalInput}
                value={newMemoryContent}
                onChangeText={setNewMemoryContent}
                multiline
                placeholder="输入新记忆内容..."
                placeholderTextColor="#999"
              />
              
              <View style={styles.editModalButtons}>
                <TouchableOpacity 
                  style={[styles.editModalButton, styles.cancelButton]}
                  onPress={() => setIsCreatingNew(false)}
                >
                  <Text style={styles.editModalButtonText}>取消</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.editModalButton, styles.saveButton]}
                  onPress={handleSaveNewMemory}
                >
                  <Text style={styles.editModalButtonText}>创建</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

interface SettingsPanelProps {
  currentInterval: number;
  memoryEnabled: boolean;
  setMemoryEnabled: (enabled: boolean) => void;
  onIntervalChange: (value: number) => void;
  onSaveInterval: () => void;
  onProcessNow: () => void;
  characterId?: string;
  conversationId?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  currentInterval,
  memoryEnabled,
  setMemoryEnabled,
  onIntervalChange,
  onSaveInterval,
  onProcessNow,
  characterId,
  conversationId
}) => {
  return (
    <ScrollView style={styles.settingsScrollView}>
      <View style={styles.settingsContainer}>
        {characterId && conversationId && (
          <View style={styles.settingsInfoSection}>
            <Text style={styles.settingsInfoTitle}>当前会话信息</Text>
            <Text style={styles.settingsInfoText}>角色ID: {characterId}</Text>
            <Text style={styles.settingsInfoText}>会话ID: {conversationId}</Text>
          </View>
        )}
        
        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>记忆系统</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>启用记忆功能</Text>
            <Switch
              value={memoryEnabled}
              onValueChange={setMemoryEnabled}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={memoryEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          <Text style={styles.settingDescription}>
            {memoryEnabled ? '记忆系统已启用，将自动记录对话内容' : '记忆系统已禁用，不会记录新的对话'}
          </Text>
        </View>
        
        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>记忆处理间隔</Text>
          <Text style={styles.settingDescription}>
            每隔多少轮用户消息处理一次记忆（1-20轮）
          </Text>
          
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>1</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={20}
              step={1}
              value={currentInterval}
              onValueChange={onIntervalChange}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#555"
              thumbTintColor={theme.colors.primary}
            />
            <Text style={styles.sliderValue}>20</Text>
          </View>
          
          <View style={styles.currentValueContainer}>
            <Text style={styles.currentValueLabel}>当前设置:</Text>
            <Text style={styles.currentValue}>{currentInterval} 轮</Text>
            
            {currentInterval === 1 && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningText}>单轮处理会增加API调用次数!</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={onSaveInterval}
          >
            <Ionicons name="save-outline" size={18} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>保存设置</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>手动处理记忆</Text>
          <Text style={styles.settingDescription}>
            立即处理记忆缓存，无需等待轮次计数
          </Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]} 
            onPress={onProcessNow}
          >
            <MaterialCommunityIcons name="brain" size={18} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>处理当前角色记忆</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

interface MemoriesPanelProps {
  memories: MemoryFact[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onEditMemory: (memory: MemoryFact) => void;
  onDeleteMemory: (memory: MemoryFact) => void;
  onAddMemory: () => void;
  characterId?: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
}

const MemoriesPanel: React.FC<MemoriesPanelProps> = ({
  memories,
  isLoading,
  isRefreshing,
  onRefresh,
  onEditMemory,
  onDeleteMemory,
  onAddMemory,
  characterId,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit
}) => {
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);

  const toggleMemoryExpansion = (id: string) => {
    setExpandedMemoryId(expandedMemoryId === id ? null : id);
  };

  const renderMemoryItem = (memory: MemoryFact) => {
    const isExpanded = expandedMemoryId === memory.id;
    return (
      <View 
        style={[
          styles.memoryItem, 
          isExpanded && styles.expandedMemoryItem
        ]}
        key={memory.id}
      >
        <TouchableOpacity 
          style={styles.memoryHeader}
          onPress={() => toggleMemoryExpansion(memory.id)}
        >
          <View style={styles.memoryIconContainer}>
            <MaterialCommunityIcons 
              name="brain" 
              size={18} 
              color="#2ecc71" 
            />
          </View>
          
          <View style={styles.memoryContent}>
            <Text 
              style={styles.memoryText}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {memory.memory}
            </Text>
          </View>
          
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#aaa" 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.memoryDetails}>
            <View style={styles.memoryMetadata}>
              <Text style={styles.metadataLabel}>创建时间:</Text>
              <Text style={styles.metadataValue}>
                {formatTimestamp(memory.createdAt)}
              </Text>
            </View>
            
            {memory.updatedAt && (
              <View style={styles.memoryMetadata}>
                <Text style={styles.metadataLabel}>更新时间:</Text>
                <Text style={styles.metadataValue}>
                  {formatTimestamp(memory.updatedAt)}
                </Text>
              </View>
            )}
            
            {memory.agentId && (
              <View style={styles.memoryMetadata}>
                <Text style={styles.metadataLabel}>角色ID:</Text>
                <Text style={styles.metadataValue}>{memory.agentId}</Text>
              </View>
            )}
            
            {memory.runId && (
              <View style={styles.memoryMetadata}>
                <Text style={styles.metadataLabel}>会话ID:</Text>
                <Text style={styles.metadataValue}>{memory.runId}</Text>
              </View>
            )}
            
            {memory.metadata?.aiResponse && (
              <View style={styles.memoryMetadata}>
                <Text style={styles.metadataLabel}>AI响应:</Text>
                <Text style={styles.metadataValue}>{memory.metadata.aiResponse}</Text>
              </View>
            )}
            
            <View style={styles.memoryActions}>
              <TouchableOpacity 
                style={[styles.memoryAction, styles.editAction]} 
                onPress={() => onEditMemory(memory)}
              >
                <Ionicons name="pencil" size={16} color="#fff" />
                <Text style={styles.actionText}>编辑</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.memoryAction, styles.deleteAction]} 
                onPress={() => onDeleteMemory(memory)}
              >
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.actionText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.memoriesContainer}>
      <View style={styles.memoriesHeader}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索记忆内容..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            onSubmitEditing={onSearchSubmit}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={onSearchSubmit}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.memoryActionsHeader}>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={onRefresh}
            disabled={isRefreshing || isLoading}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="refresh" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={onAddMemory}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>加载记忆中...</Text>
        </View>
      ) : memories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="brain" size={60} color="#aaa" />
          <Text style={styles.emptyText}>
            {characterId ? `未找到该角色的记忆` : '请选择角色查看记忆'}
          </Text>
          <TouchableOpacity 
            style={styles.createMemoryButton}
            onPress={onAddMemory}
          >
            <Text style={styles.createMemoryButtonText}>创建新记忆</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.memoriesList}>
          {memories.map(renderMemoryItem)}
        </ScrollView>
      )}
    </View>
  );
};

interface StatsPanelProps {
  dbStats: {
    totalCount: number;
    dbSize: number;
    dbSizeMB: string;
  };
  characterMemoryCount: number;
  characterName: string;
  characterId: string;
  onRefresh: () => void;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  dbStats,
  characterMemoryCount,
  characterName,
  characterId,
  onRefresh
}) => {
  return (
    <ScrollView style={styles.statsScrollView}>
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.refreshStatsButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>刷新统计数据</Text>
        </TouchableOpacity>
        
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Ionicons name="analytics-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.statTitle}>向量数据库统计</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>总记忆数量</Text>
            <Text style={styles.statValue}>{dbStats.totalCount} 条</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>数据库大小</Text>
            <Text style={styles.statValue}>{dbStats.dbSizeMB} MB</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>平均记忆大小</Text>
            <Text style={styles.statValue}>
              {dbStats.totalCount > 0 
                ? (parseFloat(dbStats.dbSizeMB) / dbStats.totalCount * 1024).toFixed(2) + ' KB'
                : '0 KB'}
            </Text>
          </View>
        </View>
        
        {characterId && (
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="brain" size={24} color={theme.colors.primary} />
              <Text style={styles.statTitle}>{characterName}的记忆统计</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>记忆数量</Text>
              <Text style={styles.statValue}>{characterMemoryCount} 条</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>占总记忆比例</Text>
              <Text style={styles.statValue}>
                {dbStats.totalCount > 0 
                  ? ((characterMemoryCount / dbStats.totalCount) * 100).toFixed(1) + '%'
                  : '0%'}
              </Text>
            </View>
          </View>
        )}
        
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Ionicons name="information-circle-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.statTitle}>建议值</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>最佳数据库大小</Text>
            <Text style={styles.statValue}>&lt; 50 MB</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>每个角色记忆</Text>
            <Text style={styles.statValue}>50-200 条</Text>
          </View>
          
          {parseFloat(dbStats.dbSizeMB) > DB_SIZE_WARNING_THRESHOLD && (
            <View style={styles.dbSizeWarningBox}>
              <Ionicons name="warning-outline" size={20} color="#f39c12" />
              <Text style={styles.dbSizeWarningBoxText}>
                数据库大小已超过建议阈值，请考虑删除不必要的记忆
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return '未知时间';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch (e) {
    return timestamp;
  }
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  characterInfo: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  characterInfoText: {
    color: '#ddd',
    fontSize: 14,
  },
  memoryCountBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  memoryCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 8,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  activeTabButton: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: '#aaa',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  
  memoriesContainer: {
    flex: 1,
    padding: 12,
  },
  memoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryActionsHeader: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  refreshButton: {
    width: 44,
    height: 44,
    backgroundColor: '#2c2c2c',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoriesList: {
    flex: 1,
  },
  memoryItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  expandedMemoryItem: {
    backgroundColor: '#222',
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  memoryIconContainer: {
    marginRight: 12,
  },
  memoryContent: {
    flex: 1,
  },
  memoryText: {
    color: '#fff',
    fontSize: 15,
  },
  memoryDetails: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  memoryMetadata: {
    flexDirection: 'row',
    marginTop: 12,
  },
  metadataLabel: {
    width: 80,
    fontSize: 14,
    color: '#aaa',
  },
  metadataValue: {
    flex: 1,
    fontSize: 14,
    color: '#ddd',
  },
  memoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
  },
  memoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  editAction: {
    backgroundColor: '#3498db',
  },
  deleteAction: {
    backgroundColor: '#e74c3c',
  },
  actionText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ddd',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  createMemoryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  createMemoryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  settingsScrollView: {
    flex: 1,
  },
  settingsContainer: {
    padding: 16,
  },
  settingsInfoSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  settingsInfoTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 8,
  },
  settingsInfoText: {
    color: '#ddd',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  settingSection: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
  },
  settingDescription: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 30,
    textAlign: 'center',
    color: '#aaa',
  },
  currentValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  currentValueLabel: {
    fontSize: 16,
    color: '#fff',
  },
  currentValue: {
    fontSize: 24,
    color: theme.colors.primary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 10,
  },
  warningText: {
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#34c759',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cautionText: {
    color: '#ff9500',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  
  statsScrollView: {
    flex: 1,
  },
  statsContainer: {
    padding: 16,
  },
  refreshStatsButton: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  statCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statLabel: {
    color: '#aaa',
    fontSize: 16,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dbSizeWarningBox: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dbSizeWarningBoxText: {
    color: '#f39c12',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  
  dbSizeWarning: {
    backgroundColor: 'rgba(243, 156, 18, 0.9)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dbSizeAlert: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
  },
  dbSizeWarningText: {
    color: 'white',
    marginLeft: 8,
    flex: 1,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainer: {
    backgroundColor: 'white',
    width: '100%',
    maxWidth: 500,
    borderRadius: 12,
    padding: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  editModalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  editModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#aaa',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  editModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default MemoryProcessingControl;
