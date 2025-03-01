import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  Switch,
  ActivityIndicator
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Character } from '../shared/types';
import { RelationshipService } from '../services/relationship-service';

interface RelationshipTestControlsProps {
  characters: Character[];
  onRunTest: (options: RelationshipTestOptions) => Promise<void>;
  onResetRelationships: () => Promise<void>;
  isRunningTest: boolean;
}

export interface RelationshipTestOptions {
  strengthModifier: number;
  accelerateInteractions: boolean;
  showDetailedLogs: boolean;
}

const RelationshipTestControls: React.FC<RelationshipTestControlsProps> = ({
  characters,
  onRunTest,
  onResetRelationships,
  isRunningTest
}) => {
  const [showModal, setShowModal] = useState(false);
  const [strengthModifier, setStrengthModifier] = useState(5);
  const [accelerateInteractions, setAccelerateInteractions] = useState(true);
  const [showDetailedLogs, setShowDetailedLogs] = useState(true);
  
  const handleRunTest = async () => {
    setShowModal(false);
    await onRunTest({
      strengthModifier,
      accelerateInteractions,
      showDetailedLogs
    });
  };
  
  const handleReset = async () => {
    setShowModal(false);
    await onResetRelationships();
  };
  
  return (
    <>
      <TouchableOpacity 
        style={[styles.testButton, isRunningTest && styles.disabledButton]} 
        onPress={() => setShowModal(true)}
        disabled={isRunningTest}
      >
        {isRunningTest ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="flask-outline" size={16} color="#ffffff" />
            <Text style={styles.testButtonText}>关系测试</Text>
          </>
        )}
      </TouchableOpacity>
      
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>关系系统测试设置</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionTitle}>关系强度变化幅度</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderValue}>±{strengthModifier}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={30}
                  step={1}
                  value={strengthModifier}
                  onValueChange={setStrengthModifier}
                  minimumTrackTintColor="#FF9ECD"
                  thumbTintColor="#FF9ECD"
                />
                <View style={styles.sliderLabels}>
                  <Text>较小</Text>
                  <Text>较大</Text>
                </View>
              </View>
              
              <View style={styles.optionRow}>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>加速互动计数</Text>
                  <Text style={styles.optionDescription}>
                    每次互动增加额外计数，加速行动触发
                  </Text>
                </View>
                <Switch
                  value={accelerateInteractions}
                  onValueChange={setAccelerateInteractions}
                  trackColor={{ false: '#767577', true: '#FF9ECD' }}
                  thumbColor="#f4f3f4"
                />
              </View>
              
              <View style={styles.optionRow}>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>显示详细日志</Text>
                  <Text style={styles.optionDescription}>
                    输出详细的测试过程日志
                  </Text>
                </View>
                <Switch
                  value={showDetailedLogs}
                  onValueChange={setShowDetailedLogs}
                  trackColor={{ false: '#767577', true: '#FF9ECD' }}
                  thumbColor="#f4f3f4"
                />
              </View>
              
              <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>系统状态</Text>
                <Text style={styles.statusText}>
                  启用关系系统的角色: {characters.filter(c => c.relationshipEnabled).length} / {characters.length}
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.resetButton]}
                onPress={handleReset}
              >
                <Text style={styles.buttonText}>重置关系数据</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.runButton]}
                onPress={handleRunTest}
              >
                <Text style={styles.buttonText}>运行测试</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8653A8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#9E9E9E',
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
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
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  slider: {
    height: 40,
    width: '100%',
  },
  sliderValue: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9ECD',
    marginBottom: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  optionTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusSection: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginLeft: 12,
  },
  resetButton: {
    backgroundColor: '#e57373',
  },
  runButton: {
    backgroundColor: '#5C6BC0',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default RelationshipTestControls;
