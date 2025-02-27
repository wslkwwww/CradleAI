import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NodeSTCleanup } from '@/utils/NodeSTCleanup';

interface NodeSTCleanupButtonProps {
  onCleanupComplete?: () => void;
  style?: object;
}

export const NodeSTCleanupButton: React.FC<NodeSTCleanupButtonProps> = ({
  onCleanupComplete,
  style
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    setIsLoading(true);
    try {
      await NodeSTCleanup.showCleanupConfirmation();
      if (onCleanupComplete) onCleanupComplete();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <View style={styles.buttonContent}>
          <MaterialIcons name="delete-forever" size={20} color="#fff" />
          <Text style={styles.buttonText}>清理所有角色数据</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#ff4757',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});
