import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface CradleNotificationProps {
  visible: boolean;
  onClose: () => void;
  characterName: string;
}

export default function CradleNotification({ 
  visible, 
  onClose,
  characterName 
}: CradleNotificationProps) {
  const translateY = new Animated.Value(-100);
  const router = useRouter();

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 20,
        friction: 5
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [visible]);

  const handlePress = () => {
    onClose();
    // 修改为直接跳转到聊天界面
    router.push({
      pathname: '/(tabs)',  // 主聊天页面
      params: { characterId: characterName }
    });
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY }] }
      ]}
    >
      <View style={styles.content}>
        <MaterialIcons name="celebration" size={24} color="#FF9ECD" />
        <Text style={styles.text}>
          摇篮角色 "{characterName}" 已生成完成！
        </Text>
      </View>
      <View style={styles.buttons}>
        <TouchableOpacity 
          style={styles.button}
          onPress={handlePress}
        >
          <Text style={styles.buttonText}>查看角色</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.closeButton]}
          onPress={onClose}
        >
          <MaterialIcons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: width - 32,
    zIndex: 1000,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    color: '#333',
    fontSize: 16,
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#FF9ECD',
  },
  closeButton: {
    backgroundColor: '#eee',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
