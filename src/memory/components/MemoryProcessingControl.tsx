import React, { useState, useEffect } from 'react';
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
  ActivityIndicator
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemoryContext } from '../providers/MemoryProvider';
import Mem0Service from '../services/Mem0Service';
import { theme } from '@/constants/theme';
import { BlurView } from 'expo-blur';

interface MemoryFact {
  id: string;
  memory: string;
  score?: number;
  createdAt?: string;
  updatedAt?: string;
  metadata?: any;
}

interface MemoryProcessingControlProps {
  showIcon?: boolean;
  mini?: boolean;
  onlySettings?: boolean;
  iconSize?: number;
  style?: any;
  darkMode?: boolean;
  visible?: boolean;
  onClose: () => void;
  characterId?: string;
  conversationId?: string;
}

const MemoryProcessingControl: React.FC<MemoryProcessingControlProps> = ({
  showIcon = true,
  mini = false,
  onlySettings = false,
  iconSize = 24,
  style,
  darkMode = true,
  visible = false,
  onClose,
  characterId,
  conversationId,
}) => {
  const { setMemoryProcessingInterval, getMemoryProcessingInterval } = useMemoryContext();
  const [currentInterval, setCurrentInterval] = useState(10);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'facts'>('settings');
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>([]);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [factSearchQuery, setFactSearchQuery] = useState('');

  useEffect(() => {
    setCurrentInterval(getMemoryProcessingInterval());
    const mem0Service = Mem0Service.getInstance();
    const enabled = mem0Service.isMemoryEnabled?.() ?? true;
    setMemoryEnabled(enabled);
    setIsInitialized(true);
  }, [getMemoryProcessingInterval]);

  useEffect(() => {
    if (isInitialized) {
      const mem0Service = Mem0Service.getInstance();
      if (mem0Service.setMemoryEnabled) {
        mem0Service.setMemoryEnabled(memoryEnabled);
        console.log(`[MemoryProcessingControl] Memory recording ${memoryEnabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [memoryEnabled, isInitialized]);

  useEffect(() => {
    if (visible && activeTab === 'facts' && characterId && conversationId) {
      fetchMemoryFacts();
    }
  }, [visible, activeTab, characterId, conversationId]);

  const fetchMemoryFacts = async () => {
    if (!characterId || !conversationId) return;

    try {
      setIsLoadingFacts(true);
      const query = factSearchQuery || "Show me the most relevant memories for this conversation";
      const mem0Service = Mem0Service.getInstance();
      const searchResults = await mem0Service.searchMemories(
        query,
        characterId,
        conversationId,
        20
      );

      if (searchResults && searchResults.results) {
        setMemoryFacts(searchResults.results);
      }
    } catch (error) {
      console.error('[MemoryProcessingControl] Error fetching memory facts:', error);
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const handleIntervalChange = (value: number) => {
    const roundedValue = Math.round(value);
    setCurrentInterval(roundedValue);
  };

  const handleIntervalSave = () => {
    setMemoryProcessingInterval(currentInterval);
    const mem0Service = Mem0Service.getInstance();
    if (mem0Service.setProcessingInterval) {
      mem0Service.setProcessingInterval(currentInterval);
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

    onClose();
  };

  const handleProcessNow = () => {
    try {
      const mem0Service = Mem0Service.getInstance();
      if (mem0Service.processCurrentMemories) {
        mem0Service.processCurrentMemories(characterId, conversationId);
        Alert.alert('成功', '已手动处理当前记忆缓存');
      }
    } catch (error) {
      console.error('[MemoryProcessingControl] Error processing memories:', error);
      Alert.alert('错误', '处理记忆失败，请稍后再试');
    }
  };

  const handleForceProcessAll = () => {
    Alert.alert(
      '确认处理',
      '确定要处理所有缓存的记忆吗？这将触发LLM调用并可能增加API使用量。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              const mem0Service = Mem0Service.getInstance();
              if (mem0Service.processAllCharacterMemories) {
                await mem0Service.processAllCharacterMemories();
                Alert.alert('成功', '所有角色的记忆缓存已处理完成');
              }
            } catch (error) {
              console.error('[MemoryProcessingControl] Error processing all memories:', error);
              Alert.alert('错误', '处理所有记忆失败，请稍后再试');
            }
          }
        }
      ]
    );
  };

  if (onlySettings) {
    return (
      <View style={[styles.container, style]}>
        <SettingsContent
          currentInterval={currentInterval}
          memoryEnabled={memoryEnabled}
          setMemoryEnabled={setMemoryEnabled}
          handleIntervalChange={handleIntervalChange}
          handleIntervalSave={handleIntervalSave}
          handleProcessNow={handleProcessNow}
          handleForceProcessAll={handleForceProcessAll}
          darkMode={darkMode}
          characterId={characterId}
          conversationId={conversationId}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <BlurView intensity={80} tint="dark" style={styles.blurView}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>记忆系统管理</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'settings' && styles.activeTabButton]}
                  onPress={() => setActiveTab('settings')}
                >
                  <Ionicons
                    name="settings-outline"
                    size={18}
                    color={activeTab === 'settings' ? '#fff' : '#aaa'}
                  />
                  <Text style={[
                    styles.tabText,
                    activeTab === 'settings' && styles.activeTabText
                  ]}>
                    设置
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'facts' && styles.activeTabButton]}
                  onPress={() => setActiveTab('facts')}
                >
                  <MaterialCommunityIcons
                    name="brain"
                    size={18}
                    color={activeTab === 'facts' ? '#fff' : '#aaa'}
                  />
                  <Text style={[
                    styles.tabText,
                    activeTab === 'facts' && styles.activeTabText
                  ]}>
                    记忆事实
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'settings' ? (
                <SettingsContent
                  currentInterval={currentInterval}
                  memoryEnabled={memoryEnabled}
                  setMemoryEnabled={setMemoryEnabled}
                  handleIntervalChange={handleIntervalChange}
                  handleIntervalSave={handleIntervalSave}
                  handleProcessNow={handleProcessNow}
                  handleForceProcessAll={handleForceProcessAll}
                  darkMode={true}
                  characterId={characterId}
                  conversationId={conversationId}
                />
              ) : (
                <MemoryFactsPanel
                  facts={memoryFacts}
                  isLoading={isLoadingFacts}
                  onRefresh={fetchMemoryFacts}
                  characterId={characterId}
                  conversationId={conversationId}
                />
              )}
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
};

interface SettingsContentProps {
  currentInterval: number;
  memoryEnabled: boolean;
  setMemoryEnabled: (enabled: boolean) => void;
  handleIntervalChange: (value: number) => void;
  handleIntervalSave: () => void;
  handleProcessNow: () => void;
  handleForceProcessAll: () => void;
  darkMode: boolean;
  characterId?: string;
  conversationId?: string;
}

const SettingsContent: React.FC<SettingsContentProps> = ({
  currentInterval,
  memoryEnabled,
  setMemoryEnabled,
  handleIntervalChange,
  handleIntervalSave,
  handleProcessNow,
  handleForceProcessAll,
  darkMode,
  characterId,
  conversationId
}) => {
  const textColor = darkMode ? '#fff' : '#333';
  const bgColor = darkMode ? 'rgba(40, 40, 40, 0.95)' : '#f5f5f5';

  const hasCharacterInfo = characterId && conversationId;

  return (
    <View style={[styles.settingsContent, { backgroundColor: bgColor }]}>
      {hasCharacterInfo && (
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: textColor }]}>
            角色ID: {characterId}
          </Text>
          <Text style={[styles.infoText, { color: textColor }]}>
            会话ID: {conversationId}
          </Text>
        </View>
      )}

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: textColor }]}>
          记忆系统
        </Text>
        <View style={styles.settingValue}>
          <Switch
            value={memoryEnabled}
            onValueChange={setMemoryEnabled}
            trackColor={{ false: '#767577', true: theme.colors.primary }}
            thumbColor={memoryEnabled ? '#fff' : '#f4f3f4'}
          />
          <Text style={[styles.statusText, { color: memoryEnabled ? '#4cd964' : '#ff3b30' }]}>
            {memoryEnabled ? '已启用' : '已禁用'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={[styles.sectionTitle, { color: textColor }]}>
        记忆处理间隔
      </Text>
      <Text style={[styles.description, { color: textColor }]}>
        每隔多少轮用户消息处理一次记忆（1-20轮）
      </Text>

      <View style={styles.sliderContainer}>
        <Text style={[styles.sliderValue, { color: textColor }]}>1</Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={20}
          step={1}
          value={currentInterval}
          onValueChange={handleIntervalChange}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor={darkMode ? "#555" : "#ddd"}
          thumbTintColor={theme.colors.primary}
        />
        <Text style={[styles.sliderValue, { color: textColor }]}>20</Text>
      </View>

      <View style={styles.currentValueContainer}>
        <Text style={[styles.currentValueLabel, { color: textColor }]}>
          当前设置:
        </Text>
        <Text style={styles.currentValue}>
          {currentInterval} 轮
        </Text>
        {currentInterval === 1 && (
          <Text style={styles.warningText}>
            单轮处理会增加API调用次数!
          </Text>
        )}
      </View>

      <View style={styles.divider} />

      <Text style={[styles.sectionTitle, { color: textColor }]}>
        手动处理
      </Text>
      <Text style={[styles.description, { color: textColor }]}>
        立即处理记忆缓存，无需等待轮次计数
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleProcessNow}
        >
          <Text style={styles.buttonText}>处理当前角色记忆</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={handleForceProcessAll}
        >
          <Text style={styles.buttonText}>处理所有角色记忆</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.saveButton]}
        onPress={handleIntervalSave}
      >
        <Text style={styles.buttonText}>保存设置</Text>
      </TouchableOpacity>
    </View>
  );
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return 'Unknown time';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch (e) {
    return timestamp;
  }
};

interface MemoryFactsPanelProps {
  facts: MemoryFact[];
  isLoading: boolean;
  onRefresh: () => void;
  characterId?: string;
  conversationId?: string;
}

const MemoryFactsPanel: React.FC<MemoryFactsPanelProps> = ({
  facts,
  isLoading,
  onRefresh,
  characterId,
  conversationId
}) => {
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null);

  const toggleFactExpansion = (id: string) => {
    setExpandedFactId(expandedFactId === id ? null : id);
  };

  const hasCharacterInfo = characterId && conversationId;

  return (
    <View style={styles.factsContainer}>
      {hasCharacterInfo && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>当前角色ID: {characterId}</Text>
          <Text style={styles.infoText}>当前会话ID: {conversationId}</Text>
        </View>
      )}

      <View style={styles.factsHeader}>
        <Text style={styles.factsTitle}>记忆事实</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>加载记忆中...</Text>
        </View>
      ) : facts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="brain" size={48} color="#aaa" />
          <Text style={styles.emptyText}>没有找到与该对话相关的记忆</Text>
        </View>
      ) : (
        <ScrollView style={styles.factsList}>
          {facts.map(fact => (
            <TouchableOpacity
              key={fact.id}
              style={[
                styles.factItem,
                expandedFactId === fact.id && styles.factItemExpanded
              ]}
              onPress={() => toggleFactExpansion(fact.id)}
            >
              <View style={styles.factHeader}>
                <MaterialCommunityIcons
                  name="brain"
                  size={16}
                  color="#2ecc71"
                  style={styles.factIcon}
                />
                <Text style={styles.factText} numberOfLines={expandedFactId === fact.id ? undefined : 2}>
                  {fact.memory}
                </Text>
              </View>

              {expandedFactId === fact.id && (
                <View style={styles.factDetails}>
                  <View style={styles.factMetadata}>
                    <Text style={styles.factDetailLabel}>创建时间:</Text>
                    <Text style={styles.factDetailValue}>{formatTimestamp(fact.createdAt)}</Text>
                  </View>

                  {fact.updatedAt && (
                    <View style={styles.factMetadata}>
                      <Text style={styles.factDetailLabel}>更新时间:</Text>
                      <Text style={styles.factDetailValue}>{formatTimestamp(fact.updatedAt)}</Text>
                    </View>
                  )}

                  {fact.score !== undefined && (
                    <View style={styles.factMetadata}>
                      <Text style={styles.factDetailLabel}>相关性:</Text>
                      <Text style={styles.factDetailValue}>{(fact.score * 100).toFixed(1)}%</Text>
                    </View>
                  )}

                  {fact.metadata && fact.metadata.aiResponse && (
                    <View style={styles.factMetadata}>
                      <Text style={styles.factDetailLabel}>AI响应:</Text>
                      <Text style={styles.factDetailValue}>{fact.metadata.aiResponse}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  blurView: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalContent: {
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 10,
    marginBottom: 20,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: '#aaa',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  settingsContent: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
  },
  infoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
    color: '#ddd',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 15,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 25,
    textAlign: 'center',
  },
  currentValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  currentValueLabel: {
    marginRight: 10,
    fontSize: 15,
  },
  currentValue: {
    fontWeight: 'bold',
    color: theme.colors.primary,
    fontSize: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
    marginVertical: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  button: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    flex: 1,
    marginRight: 5,
  },
  dangerButton: {
    backgroundColor: '#ff3b30',
    flex: 1,
    marginLeft: 5,
  },
  saveButton: {
    backgroundColor: '#34c759',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  warningText: {
    color: '#ff3b30',
    fontSize: 12,
    marginLeft: 10,
    fontWeight: '500',
  },
  factsContainer: {
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderRadius: 12,
    padding: 15,
    maxHeight: 400,
  },
  factsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  factsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 5,
  },
  factsList: {
    maxHeight: 300,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#aaa',
    marginTop: 10,
    textAlign: 'center',
  },
  factItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  factItemExpanded: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  factHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  factIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  factText: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
  },
  factDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  factMetadata: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  factDetailLabel: {
    color: '#aaa',
    fontSize: 12,
    width: 70,
  },
  factDetailValue: {
    color: '#ddd',
    fontSize: 12,
    flex: 1,
  },
});

export default MemoryProcessingControl;
