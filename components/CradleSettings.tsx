import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

interface CradleSettingsProps {
  isVisible: boolean;
  embedded?: boolean;
  onClose: () => void;
  isCradleEnabled: boolean;
  cradleDuration: number;
  onCradleToggle: (enabled: boolean) => void;
  onDurationChange: (duration: number) => void;
}

export default function CradleSettings({
  isVisible,
  embedded = false,
  onClose,
  isCradleEnabled,
  cradleDuration,
  onCradleToggle,
  onDurationChange
}: CradleSettingsProps) {
  const [localEnabled, setLocalEnabled] = useState(isCradleEnabled);
  const [localDuration, setLocalDuration] = useState(cradleDuration);
  const [isDirty, setIsDirty] = useState(false);

  // Handle toggle
  const handleToggle = (value: boolean) => {
    setLocalEnabled(value);
    setIsDirty(true);
  };

  // Handle duration change
  const handleDurationChange = (value: number) => {
    const roundedValue = Math.round(value);
    setLocalDuration(roundedValue);
    setIsDirty(true);
  };

  // Handle save
  const handleSave = () => {
    onCradleToggle(localEnabled);
    onDurationChange(localDuration);
    onClose();
  };

  // Reset values when modal opens or component mounts in embedded mode
  React.useEffect(() => {
    if (isVisible || embedded) {
      setLocalEnabled(isCradleEnabled);
      setLocalDuration(cradleDuration);
      setIsDirty(false);
    }
  }, [isVisible, embedded, isCradleEnabled, cradleDuration]);

  const content = (
    <>
      <ScrollView style={styles.content}>
        {/* Enable/Disable Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.settingDescription}>
            <Text style={styles.settingTitle}>启用摇篮系统</Text>
            <Text style={styles.settingSubtitle}>
              启用后，摇篮系统将开始培育过程
            </Text>
          </View>
          <Switch
            value={localEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#555', true: '#4A90E2' }}
            thumbColor={localEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>

        {/* Duration Setting */}
        <View style={styles.settingItem}>
          <View style={styles.settingDescription}>
            <Text style={styles.settingTitle}>培育周期</Text>
            <Text style={styles.settingSubtitle}>
              设置角色培育所需的天数
            </Text>
          </View>
          <Text style={styles.durationText}>{localDuration} 天</Text>
        </View>

        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={30}
            step={1}
            value={localDuration}
            onValueChange={handleDurationChange}
            minimumTrackTintColor="#4A90E2"
            maximumTrackTintColor="#555"
            thumbTintColor="#4A90E2"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>1天</Text>
            <Text style={styles.sliderLabel}>30天</Text>
          </View>
        </View>

        {/* Information Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>关于摇篮系统</Text>
          <Text style={styles.infoText}>
            摇篮系统通过让用户在一段时间内"投喂"数据（文本、图片等）给未成熟的角色，来塑造和生成具有独特个性的AI角色。这种方式比直接创建角色更能形成有深度和个性的角色设定。
          </Text>
          
          <View style={styles.infoListItem}>
            <Ionicons name="time-outline" size={18} color="#4A90E2" style={styles.infoIcon} />
            <Text style={styles.infoListText}>
              培育周期越长，角色个性越丰富
            </Text>
          </View>
          
          <View style={styles.infoListItem}>
            <Ionicons name="document-text-outline" size={18} color="#4A90E2" style={styles.infoIcon} />
            <Text style={styles.infoListText}>
              投喂内容包括"关于我"、"素材"和"知识"三种类型
            </Text>
          </View>
          
          <View style={styles.infoListItem}>
            <Ionicons name="information-circle-outline" size={18} color="#4A90E2" style={styles.infoIcon} />
            <Text style={styles.infoListText}>
              投喂数据将定期批量处理，而不是每次投喂都即时处理
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!embedded && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.saveButton, !isDirty && styles.disabledButton]}
          onPress={handleSave}
          disabled={!isDirty}
        >
          <Text style={styles.saveButtonText}>保存</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // If embedded mode is enabled, render directly without a modal
  if (embedded) {
    return (
      <View style={styles.embeddedContainer}>
        <Text style={styles.embeddedTitle}>摇篮系统设置</Text>
        {content}
      </View>
    );
  }

  // Modal view
  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>摇篮系统设置</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {content}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modal: {
    backgroundColor: '#282828',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
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
  content: {
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingDescription: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  durationText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  sliderContainer: {
    marginBottom: 20,
  },
  slider: {
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderLabel: {
    color: '#999',
    fontSize: 12,
  },
  infoSection: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 16,
  },
  infoListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoListText: {
    color: '#ccc',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#444',
    padding: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#aaa',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.7,
  },
  embeddedContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#282828',
  },
  embeddedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
});
