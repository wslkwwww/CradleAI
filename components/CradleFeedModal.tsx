import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { FeedType } from '@/NodeST/nodest/services/character-generator-service';

interface CradleFeedModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CradleFeedModal({ visible, onClose }: CradleFeedModalProps) {
  const { addFeedToCradle, getFeedHistory, processFeedsNow } = useCharacters();
  
  const [feedContent, setFeedContent] = useState('');
  const [feedHistory, setFeedHistory] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<FeedType>(FeedType.MATERIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  // Load feed history
  useEffect(() => {
    if (visible) {
      loadFeedHistory();
    }
  }, [visible]);

  const loadFeedHistory = () => {
    try {
      const history = getFeedHistory();
      console.log("Loaded feed history:", history);
      setFeedHistory(history || []);
    } catch (error) {
      console.error("Error loading feed history:", error);
    }
  };

  const handleAddFeed = async () => {
    if (!feedContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      await addFeedToCradle(feedContent, selectedType);
      setFeedContent('');
      loadFeedHistory();
    } catch (error) {
      console.error("Error adding feed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessFeeds = async () => {
    setProcessingStatus('processing');
    try {
      await processFeedsNow();
      setProcessingStatus('success');
      // Reset status after delay
      setTimeout(() => {
        setProcessingStatus('idle');
      }, 2000);
    } catch (error) {
      console.error("Error processing feeds:", error);
      setProcessingStatus('error');
      // Reset status after delay
      setTimeout(() => {
        setProcessingStatus('idle');
      }, 2000);
    }
  };

  // Get type label for display
  const getTypeLabel = (type: FeedType) => {
    switch (type) {
      case FeedType.ABOUT_ME:
        return '关于我';
      case FeedType.MATERIAL:
        return '素材';
      case FeedType.KNOWLEDGE:
        return '知识';
      default:
        return '未知';
    }
  };

  // Get type color for UI
  const getTypeColor = (type: FeedType) => {
    switch (type) {
      case FeedType.ABOUT_ME:
        return '#4A90E2';
      case FeedType.MATERIAL:
        return '#E2844A';
      case FeedType.KNOWLEDGE:
        return '#4AE28A';
      default:
        return '#888';
    }
  };

  // Get type icon name
  const getTypeIcon = (type: FeedType) => {
    switch (type) {
      case FeedType.ABOUT_ME:
        return 'person-outline';
      case FeedType.MATERIAL:
        return 'color-palette-outline';
      case FeedType.KNOWLEDGE:
        return 'book-outline';
      default:
        return 'help-circle-outline';
    }
  };

  // Get processing status styles
  const getProcessingStyles = () => {
    switch (processingStatus) {
      case 'processing':
        return { text: '处理中...', color: '#E2844A' };
      case 'success':
        return { text: '处理成功!', color: '#4AE28A' };
      case 'error':
        return { text: '处理失败', color: '#E24A4A' };
      default:
        return { text: '手动处理', color: '#4A90E2' };
    }
  };

  const processingStyles = getProcessingStyles();

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
          >
            <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>数据投喂</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    !showHistory && styles.activeTabButton
                  ]}
                  onPress={() => setShowHistory(false)}
                >
                  <Text style={[
                    styles.tabText,
                    !showHistory && styles.activeTabText
                  ]}>
                    投喂
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    showHistory && styles.activeTabButton
                  ]}
                  onPress={() => setShowHistory(true)}
                >
                  <Text style={[
                    styles.tabText,
                    showHistory && styles.activeTabText
                  ]}>
                    历史 ({feedHistory.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {!showHistory ? (
                <View style={styles.feedForm}>
                  <Text style={styles.formLabel}>投喂类型</Text>
                  
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        selectedType === FeedType.ABOUT_ME && { 
                          backgroundColor: 'rgba(74, 144, 226, 0.2)',
                          borderColor: '#4A90E2' 
                        }
                      ]}
                      onPress={() => setSelectedType(FeedType.ABOUT_ME)}
                    >
                      <Ionicons 
                        name="person-outline" 
                        size={24} 
                        color={selectedType === FeedType.ABOUT_ME ? '#4A90E2' : '#888'} 
                      />
                      <Text style={[
                        styles.typeText,
                        selectedType === FeedType.ABOUT_ME && { color: '#4A90E2' }
                      ]}>
                        关于我
                      </Text>
                      <Text style={styles.typeDesc}>个人信息和偏好</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        selectedType === FeedType.MATERIAL && { 
                          backgroundColor: 'rgba(226, 132, 74, 0.2)',
                          borderColor: '#E2844A' 
                        }
                      ]}
                      onPress={() => setSelectedType(FeedType.MATERIAL)}
                    >
                      <Ionicons 
                        name="color-palette-outline" 
                        size={24} 
                        color={selectedType === FeedType.MATERIAL ? '#E2844A' : '#888'} 
                      />
                      <Text style={[
                        styles.typeText,
                        selectedType === FeedType.MATERIAL && { color: '#E2844A' }
                      ]}>
                        素材
                      </Text>
                      <Text style={styles.typeDesc}>角色设定参考</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        selectedType === FeedType.KNOWLEDGE && { 
                          backgroundColor: 'rgba(74, 226, 138, 0.2)',
                          borderColor: '#4AE28A' 
                        }
                      ]}
                      onPress={() => setSelectedType(FeedType.KNOWLEDGE)}
                    >
                      <Ionicons 
                        name="book-outline" 
                        size={24} 
                        color={selectedType === FeedType.KNOWLEDGE ? '#4AE28A' : '#888'} 
                      />
                      <Text style={[
                        styles.typeText,
                        selectedType === FeedType.KNOWLEDGE && { color: '#4AE28A' }
                      ]}>
                        知识
                      </Text>
                      <Text style={styles.typeDesc}>角色需记住的内容</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.formLabel}>投喂内容</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="输入投喂内容..."
                    placeholderTextColor="#888"
                    multiline={true}
                    numberOfLines={6}
                    value={feedContent}
                    onChangeText={setFeedContent}
                  />
                  
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.processButton}
                      onPress={handleProcessFeeds}
                      disabled={processingStatus === 'processing'}
                    >
                      <Ionicons 
                        name={processingStatus === 'processing' ? 'sync-outline' : 'flash-outline'} 
                        size={20} 
                        color={processingStyles.color} 
                      />
                      <Text style={[styles.processButtonText, { color: processingStyles.color }]}>
                        {processingStyles.text}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        (!feedContent.trim() || isSubmitting) && styles.disabledButton
                      ]}
                      onPress={handleAddFeed}
                      disabled={!feedContent.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Text style={styles.submitButtonText}>提交中...</Text>
                      ) : (
                        <>
                          <Ionicons name="add-circle-outline" size={20} color="#fff" />
                          <Text style={styles.submitButtonText}>添加投喂</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.historyContainer}>
                  {feedHistory.length > 0 ? (
                    <FlatList
                      data={feedHistory}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <View style={styles.historyItem}>
                          <View style={styles.historyHeader}>
                            <View style={styles.historyTypeContainer}>
                              <Ionicons 
                                name={getTypeIcon(item.type)} 
                                size={16} 
                                color={getTypeColor(item.type)} 
                              />
                              <Text style={[
                                styles.historyType,
                                { color: getTypeColor(item.type) }
                              ]}>
                                {getTypeLabel(item.type)}
                              </Text>
                            </View>
                            
                            <Text style={styles.historyTime}>
                              {new Date(item.timestamp).toLocaleString()}
                            </Text>
                          </View>
                          
                          <Text style={styles.historyContent}>
                            {item.content}
                          </Text>
                          
                          <View style={styles.historyStatus}>
                            <View style={[
                              styles.statusIndicator,
                              item.processed ? styles.processedIndicator : styles.pendingIndicator
                            ]} />
                            <Text style={styles.statusText}>
                              {item.processed ? '已处理' : '等待处理'}
                            </Text>
                          </View>
                        </View>
                      )}
                    />
                  ) : (
                    <View style={styles.emptyHistory}>
                      <Ionicons name="document-text-outline" size={48} color="#666" />
                      <Text style={styles.emptyHistoryText}>暂无投喂历史</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#282828',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#4A90E2',
  },
  tabText: {
    fontSize: 16,
    color: '#888',
  },
  activeTabText: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  feedForm: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  typeButton: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 8,
    fontWeight: 'bold',
  },
  typeDesc: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    height: 150,
    textAlignVertical: 'top',
    marginBottom: 20,
    fontSize: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.7,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  processButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: 500,
  },
  historyItem: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyType: {
    marginLeft: 6,
    fontWeight: 'bold',
  },
  historyTime: {
    fontSize: 12,
    color: '#999',
  },
  historyContent: {
    fontSize: 15,
    color: '#eee',
    marginBottom: 12,
    lineHeight: 22,
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  processedIndicator: {
    backgroundColor: '#4AE28A',
  },
  pendingIndicator: {
    backgroundColor: '#E2844A',
  },
  statusText: {
    fontSize: 12,
    color: '#aaa',
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyHistoryText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});
