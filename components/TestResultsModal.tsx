import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

interface TestResult {
  characterId: string;
  name: string;
  success: boolean;
  action?: {
    type: string;
    content?: string;
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
  const likeCount = results.filter(r => r.success && r.action?.type === 'like').length;
  const commentCount = results.filter(r => r.success && r.action?.type === 'comment').length;
  const skipCount = results.filter(r => r.success && r.action?.type === 'skip').length;
  const failCount = results.filter(r => !r.success).length;

  const renderResultItem = ({ item }: { item: TestResult }) => (
    <View style={styles.resultItem}>
      <View style={styles.resultHeader}>
        <Text style={styles.characterName}>{item.name}</Text>
        {item.success ? (
          <View style={styles.successBadge}>
            <Text style={styles.successText}>成功</Text>
          </View>
        ) : (
          <View style={styles.failBadge}>
            <Text style={styles.failText}>失败</Text>
          </View>
        )}
      </View>
      
      {item.success ? (
        <View style={styles.actionContainer}>
          {item.action?.type === 'like' && (
            <>
              <Ionicons name="heart" size={16} color={theme.colors.primary} />
              <Text style={styles.actionText}>点赞了帖子</Text>
            </>
          )}
          
          {item.action?.type === 'comment' && (
            <>
              <Ionicons name="chatbubble" size={16} color={theme.colors.info} />
              <Text style={styles.actionText}>
                评论: "{item.action.content}"
              </Text>
            </>
          )}
          
          {item.action?.type === 'skip' && (
            <>
              <Ionicons name="remove-circle" size={16} color="#999" />
              <Text style={styles.actionText}>跳过互动</Text>
            </>
          )}
        </View>
      ) : (
        <Text style={styles.errorText}>交互处理失败</Text>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>互动测试结果</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>总结</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{results.length}</Text>
                  <Text style={styles.statLabel}>角色总数</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{likeCount}</Text>
                  <Text style={styles.statLabel}>点赞</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{commentCount}</Text>
                  <Text style={styles.statLabel}>评论</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{failCount}</Text>
                  <Text style={styles.statLabel}>失败</Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.sectionTitle}>详细结果</Text>
            {results.length > 0 ? (
              <FlatList
                data={results}
                renderItem={renderResultItem}
                keyExtractor={(item) => item.characterId}
                style={styles.resultsList}
                contentContainerStyle={styles.resultsContent}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#666" />
                <Text style={styles.emptyStateText}>暂无测试结果</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>完成</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  blurContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  summaryContainer: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  statDivider: {
    height: 30,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 20,
  },
  resultItem: {
    backgroundColor: 'rgba(50, 50, 50, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  successBadge: {
    backgroundColor: 'rgba(80, 200, 120, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  successText: {
    color: '#50C878',
    fontSize: 12,
    fontWeight: '500',
  },
  failBadge: {
    backgroundColor: 'rgba(255, 68, 68, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  failText: {
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    color: '#ddd',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    color: '#999',
    fontStyle: 'italic',
  },
  doneButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyStateText: {
    color: '#999',
    fontSize: 16,
    marginTop: 12,
  },
});

export default TestResultsModal;
