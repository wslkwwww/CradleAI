import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Switch,
  TextInput,
  Alert,
} from 'react-native';

import { CradleSettingsProps } from '@/constants/types';

const SIDEBAR_WIDTH = 280;



export default function CradleSettings({
  isVisible,
  onClose,
  onCradleToggle,
  onDurationChange,
  isCradleEnabled,
  cradleDuration,
}: CradleSettingsProps) {
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const [duration, setDuration] = useState(String(cradleDuration));

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : SIDEBAR_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const handleDurationChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      if (numValue >= 1 && numValue <= 65535) {
        setDuration(value);
        onDurationChange(numValue);
      } else {
        Alert.alert('提示', '摇篮时长必须在1到65535天之间');
      }
    }
  };

  return (
    <Animated.View
      style={[
        styles.sidebar,
        {
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <View style={styles.settingsContainer}>
        <Text style={styles.title}>摇篮设置</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>开启摇篮</Text>
          <Switch
            value={isCradleEnabled}
            onValueChange={onCradleToggle}
            trackColor={{ false: '#767577', true: '#FFD1DC' }}
            thumbColor={isCradleEnabled ? '#FF9ECD' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>摇篮时长（天）</Text>
          <TextInput
            style={styles.durationInput}
            value={duration}
            onChangeText={handleDurationChange}
            keyboardType="numeric"
            placeholder="1-65535"
            placeholderTextColor="#999"
            editable={isCradleEnabled}
          />
        </View>
      </View>

      {isVisible && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: -1000,
    bottom: 0,
    width: 1000,
  },
  settingsContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 30,
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingLabel: {
    fontSize: 16,
    color: '#FFF',
  },
  durationInput: {
    width: 100,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#FFF',
    textAlign: 'center',
  },
});
