import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Character } from '@/shared/types';
import { MessageBoxItem } from '@/services/relationship-service';
import { Ionicons } from '@expo/vector-icons';

interface MessageBoxProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
}

export const MessageBox: React.FC<MessageBoxProps> = ({ 
  character, 
  onUpdateCharacter 
}) => {
  // Function to mark all messages as read
  const handleMarkAllAsRead = () => {
    if (!character.messageBox || character.messageBox.length === 0) return;
    
    const updatedMessageBox = character.messageBox.map(message => ({
      ...message,
      read: true
    }));
    
    onUpdateCharacter({
      ...character,
      messageBox: updatedMessageBox
    });
  };
  
  // Function to render timestamp in a readable format
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Function to get icon based on message type
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <Ionicons name="document-text" size={18} color="#AAAAAA" />;
      case 'comment':
        return <Ionicons name="chatbox" size={18} color="#AAAAAA" />;
      case 'like':
        return <Ionicons name="heart" size={18} color="#AAAAAA" />;
      case 'reply':
        return <Ionicons name="return-down-back" size={18} color="#AAAAAA" />;
      case 'action':
        return <Ionicons name="flash" size={18} color="#AAAAAA" />;
      default:
        return <Ionicons name="help-circle" size={18} color="#AAAAAA" />;
    }
  };

  // Function to mark a single message as read
  const handleMarkAsRead = (messageId: string) => {
    if (!character.messageBox) return;
    
    const updatedMessageBox = character.messageBox.map(message => 
      message.id === messageId ? {...message, read: true} : message
    );
    
    onUpdateCharacter({
      ...character,
      messageBox: updatedMessageBox
    });
  };

  // If relationship system is not enabled
  if (!character.relationshipMap) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateTitle}>需要启用关系系统</Text>
          <Text style={styles.emptyStateDescription}>
            请先在关系图谱标签中启用关系系统，然后才能查看消息盒子。
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{character.name}的消息盒子</Text>
        
        {character.messageBox && character.messageBox.some(msg => !msg.read) && (
          <TouchableOpacity 
            style={styles.markAllReadButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllReadText}>全部标为已读</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {(!character.messageBox || character.messageBox.length === 0) && (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateDescription}>
            暂无消息。当其他角色与{character.name}互动时，消息将显示在这里。
          </Text>
        </View>
      )}
      
      {character.messageBox && character.messageBox.length > 0 && (
        <FlatList
          data={character.messageBox}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.messageItem, !item.read && styles.unreadMessage]}
              onPress={() => handleMarkAsRead(item.id)}
            >
              <View style={styles.messageHeader}>
                <View style={styles.messageIconContainer}>
                  {getMessageIcon(item.type)}
                </View>
                <Text style={styles.messageSender}>
                  {item.senderName || "未知角色"}
                </Text>
                {!item.read && (
                  <View style={styles.unreadDot} />
                )}
              </View>
              
              <Text style={styles.messageContent}>
                {item.content}
              </Text>
              
              {item.contextContent && (
                <View style={styles.contextContainer}>
                  <Text style={styles.contextContent}>
                    回应: {item.contextContent}
                  </Text>
                </View>
              )}
              
              <Text style={styles.messageTimestamp}>
                {formatTimestamp(item.timestamp)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#282828',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgb(255, 224, 195)',
  },
  markAllReadButton: {
    backgroundColor: 'rgba(255, 224, 195, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  markAllReadText: {
    color: 'rgb(255, 224, 195)',
    fontSize: 12,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgb(255, 224, 195)',
    marginBottom: 12,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#AAAAAA',
    textAlign: 'center',
  },
  messageItem: {
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: 'rgb(255, 224, 195)',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageIconContainer: {
    marginRight: 8,
  },
  messageSender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgb(255, 224, 195)',
  },
  messageContent: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  contextContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  contextContent: {
    fontSize: 12,
    color: '#AAAAAA',
    fontStyle: 'italic',
  },
  messageTimestamp: {
    fontSize: 12,
    color: '#888888',
    alignSelf: 'flex-end',
  },
});
