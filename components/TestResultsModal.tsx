import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  Image 
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';

interface TestResult {
  characterId: string;
  name: string;
  success: boolean;
  action?: {
    like?: boolean;
    comment?: string;
  };
}

interface TestResultsModalProps {
  visible: boolean;
  onClose: () => void;
  results: TestResult[];
}

const TestResultsModal: React.FC<TestResultsModalProps> = ({
  visible,
  onClose,
  results
}) => {
  const { characters } = useCharacters();

  const getStatusColor = (success: boolean): string => {
    return success ? '#4CAF50' : '#FF5252';
  };

  const getStatusText = (success: boolean): string => {
    return success ? '成功' : '失败';
  };

  const renderResultItem = ({ item }: { item: TestResult }) => {
    const character = characters.find(c => c.id === item.characterId);

    return (
      <View style={styles.resultItem}>
        <Image 
          source={character?.avatar ? { uri: character.avatar } : require('@/assets/images/default-avatar.png')} 
          style={styles.characterAvatar}
        />
        <View style={styles.resultInfo}>
          <View style={styles.resultHeader}>
            <Text style={styles.characterName}>{character?.name || item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.success) }]}>
              <Text style={styles.statusText}>{getStatusText(item.success)}</Text>
            </View>
          </View>
          
          {item.success && item.action && (
            <View style={styles.actionInfo}>
              <View style={styles.actionRow}>
                <Ionicons 
                  name={item.action.like ? "heart" : "heart-outline"} 
                  size={18} 
                  color={item.action.like ? "#FF9ECD" : "#999"} 
                />
                <Text style={styles.actionText}>
                  {item.action.like ? "点赞" : "未点赞"}
                </Text>
              </View>
              
              {item.action.comment && (
                <View style={styles.commentContainer}>
                  <MaterialIcons name="comment" size={18} color="#999" />
                  <Text style={styles.commentText} numberOfLines={2}>
                    {item.action.comment}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {!item.success && (
            <Text style={styles.errorText}>未能获取互动响应</Text>
          )}
        </View>
      </View>
    );
  };

  const getSuccessRate = (): string => {
    const successCount = results.filter(r => r.success).length;
    const total = results.length;
    const rate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    return `${rate}%`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>互动测试结果</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>响应成功率:</Text>
              <Text style={styles.summaryValue}>{getSuccessRate()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>互动角色数:</Text>
              <Text style={styles.summaryValue}>{results.length}</Text>
            </View>
          </View>
          
          <Text style={styles.sectionTitle}>角色互动详情</Text>
          
          {results.length > 0 ? (
            <FlatList
              data={results}
              renderItem={renderResultItem}
              keyExtractor={(item) => item.characterId}
              contentContainerStyle={styles.resultsList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无测试结果</Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#333',
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 5,
  },
  summaryValue: {
    color: '#FF9ECD',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 15,
  },
  resultsList: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  resultItem: {
    flexDirection: 'row',
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  characterAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  resultInfo: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  characterName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionInfo: {
    marginTop: 5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  actionText: {
    color: '#ccc',
    marginLeft: 5,
    fontSize: 14,
  },
  commentContainer: {
    flexDirection: 'row',
    marginTop: 5,
    alignItems: 'flex-start',
  },
  commentText: {
    color: '#fff',
    flex: 1,
    marginLeft: 5,
    fontSize: 14,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 5,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  closeButtonBottom: {
    backgroundColor: '#FF9ECD',
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TestResultsModal;
