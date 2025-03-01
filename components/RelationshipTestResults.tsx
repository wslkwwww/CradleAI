import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character } from '../shared/types';
import { Relationship } from '../shared/types/relationship-types';
import { RelationshipAction } from '../shared/types/action-types';

interface RelationshipTestResultsProps {
  visible: boolean;
  onClose: () => void;
  results: RelationshipTestResult | null;
}

// 关系测试结果类型
export interface RelationshipTestResult {
  postAuthor: {
    id: string;
    name: string;
  };
  postContent: string;
  participants: {
    id: string;
    name: string;
    action: string;
  }[];
  relationshipUpdates: {
    targetId: string;
    targetName: string;
    before: Relationship | null;
    after: Relationship | null;
  }[];
  triggeredActions: RelationshipAction[];
  messages: string[];
}

const RelationshipTestResults: React.FC<RelationshipTestResultsProps> = ({
  visible,
  onClose,
  results
}) => {
  if (!results) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>关系测试结果</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* 发帖信息 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>测试内容</Text>
              <View style={styles.card}>
                <Text style={styles.postAuthor}>{results.postAuthor.name} 发布了：</Text>
                <Text style={styles.postContent}>{results.postContent}</Text>
              </View>
            </View>
            
            {/* 互动信息 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>互动角色</Text>
              {results.participants.length > 0 ? (
                <View style={styles.card}>
                  {results.participants.map((participant, index) => (
                    <Text key={index} style={styles.participantText}>
                      • <Text style={styles.highlightText}>{participant.name}</Text>: {participant.action}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>无角色互动</Text>
              )}
            </View>
            
            {/* 关系更新 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>关系变化</Text>
              {results.relationshipUpdates.length > 0 ? (
                <View style={styles.card}>
                  {results.relationshipUpdates.map((update, index) => (
                    <View key={index} style={styles.updateItem}>
                      <Text style={styles.updateTitle}>
                        与 <Text style={styles.highlightText}>{update.targetName}</Text> 的关系:
                      </Text>
                      <View style={styles.updateDetails}>
                        <View style={styles.updateColumn}>
                          <Text style={styles.updateLabel}>之前</Text>
                          {update.before ? (
                            <>
                              <Text style={styles.updateValue}>类型: {update.before.type}</Text>
                              <Text style={styles.updateValue}>强度: {update.before.strength}</Text>
                              <Text style={styles.updateValue}>互动: {update.before.interactions}</Text>
                            </>
                          ) : (
                            <Text style={styles.noDataText}>无关系</Text>
                          )}
                        </View>
                        <Ionicons name="arrow-forward" size={20} color="#999" style={styles.arrow} />
                        <View style={styles.updateColumn}>
                          <Text style={styles.updateLabel}>之后</Text>
                          {update.after ? (
                            <>
                              <Text style={[
                                styles.updateValue,
                                update.before?.type !== update.after.type && styles.changedValue
                              ]}>
                                类型: {update.after.type}
                                {update.before?.type !== update.after.type && " 🆕"}
                              </Text>
                              <Text style={[
                                styles.updateValue,
                                update.before?.strength !== update.after.strength && styles.changedValue
                              ]}>
                                强度: {update.after.strength}
                                {update.before && update.after.strength > update.before.strength && " ⬆️"}
                                {update.before && update.after.strength < update.before.strength && " ⬇️"}
                              </Text>
                              <Text style={[
                                styles.updateValue,
                                update.before?.interactions !== update.after.interactions && styles.changedValue
                              ]}>
                                互动: {update.after.interactions}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.noDataText}>关系被删除</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>无关系变化</Text>
              )}
            </View>
            
            {/* 触发的行动 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>触发的行动</Text>
              {results.triggeredActions.length > 0 ? (
                <View style={styles.card}>
                  {results.triggeredActions.map((action, index) => (
                    <View key={index} style={styles.actionItem}>
                      <Text style={styles.actionTitle}>🎯 {action.type}</Text>
                      <Text style={styles.actionContent}>{action.content}</Text>
                      <Text style={styles.actionDetails}>
                        到期时间: {new Date(action.expiresAt).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>无触发行动</Text>
              )}
            </View>
            
            {/* 测试日志 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>测试日志</Text>
              <View style={styles.logCard}>
                {results.messages.map((message, index) => (
                  <Text key={index} style={styles.logMessage}>{message}</Text>
                ))}
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
    maxHeight: 500,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  postContent: {
    fontSize: 16,
    color: '#444',
    fontStyle: 'italic',
  },
  participantText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    lineHeight: 20,
  },
  highlightText: {
    color: '#5C6BC0',
    fontWeight: '500',
  },
  updateItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  updateDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updateColumn: {
    flex: 1,
  },
  updateLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 4,
  },
  updateValue: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  changedValue: {
    color: '#FF9ECD',
    fontWeight: '500',
  },
  arrow: {
    marginHorizontal: 8,
  },
  actionItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5C6BC0',
    marginBottom: 4,
  },
  actionContent: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  actionDetails: {
    fontSize: 12,
    color: '#777',
  },
  logCard: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
  },
  logMessage: {
    color: '#eee',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  noDataText: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#FF9ECD',
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default RelationshipTestResults;
