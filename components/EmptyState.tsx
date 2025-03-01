import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  message: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  message, 
  icon = 'information-circle-outline',
  actionLabel,
  onAction
}) => {
  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={60} color="#BDBDBD" />
      <Text style={styles.message}>{message}</Text>
      
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#5C6BC0',
    borderRadius: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EmptyState;
