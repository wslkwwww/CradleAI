import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

interface CradleSettingsProps {
  isVisible: boolean;
  onClose: () => void;
  onCradleToggle: (enabled: boolean) => void;
  onDurationChange: (days: number) => void;
  isCradleEnabled: boolean;
  cradleDuration: number;
}

const CradleSettings: React.FC<CradleSettingsProps> = ({
  isVisible,
  onClose,
  onCradleToggle,
  onDurationChange,
  isCradleEnabled,
  cradleDuration
}) => {
  // 本地状态，提交前可以修改
  const [localEnabled, setLocalEnabled] = useState(isCradleEnabled);
  const [localDuration, setLocalDuration] = useState(cradleDuration);

  // 保存设置
  const handleSave = () => {
    console.log('[摇篮系统] 保存设置:', { enabled: localEnabled, duration: localDuration });
    onCradleToggle(localEnabled);
    onDurationChange(localDuration);
    onClose();
  };

  // 取消
  const handleCancel = () => {
    // 重置为外部传入的值
    setLocalEnabled(isCradleEnabled);
    setLocalDuration(cradleDuration);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>摇篮系统设置</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* 摇篮系统开关 */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>开启摇篮系统</Text>
              <View style={styles.switchContainer}>
                <Text style={styles.settingLabel}>
                  {localEnabled ? '已开启' : '已关闭'}
                </Text>
                <Switch
                  value={localEnabled}
                  onValueChange={setLocalEnabled}
                  trackColor={{ false: '#767577', true: '#4A90E2' }}
                  thumbColor={localEnabled ? '#f4f3f4' : '#f4f3f4'}
                />
              </View>
              <Text style={styles.settingDescription}>
                开启后，您可以在此创建摇篮角色，通过投喂数据来培育它们。
              </Text>
            </View>

            {/* 培育周期 */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>培育周期</Text>
              <Text style={styles.durationValue}>{localDuration} 天</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={30}
                step={1}
                value={localDuration}
                onValueChange={setLocalDuration}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1天</Text>
                <Text style={styles.sliderLabel}>30天</Text>
              </View>
              <Text style={styles.settingDescription}>
                设置角色培育的周期。周期越长，角色个性形成越充分，但需要更多投喂数据。
              </Text>
            </View>

            {/* 注意事项 */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>注意事项</Text>
              <Text style={styles.settingDescription}>
                1. 角色培育期间需定期投喂数据，以帮助形成个性。{'\n'}
                2. 培育周期结束后，可选择是否生成正式角色。{'\n'}
                3. 已生成的摇篮角色将有特殊标记，表明其来源。
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.footerButton, styles.cancelButton]} 
              onPress={handleCancel}
            >
              <Text style={styles.buttonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.footerButton, styles.saveButton]} 
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>保存设置</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#282828',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    padding: 16,
  },
  settingSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#fff',
  },
  settingDescription: {
    fontSize: 12,
    color: '#aaa',
  },
  durationValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#aaa',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#333',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#4A90E2',
  },
  buttonText: {
    fontSize: 14,
    color: '#fff',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CradleSettings;
