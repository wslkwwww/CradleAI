import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character} from '@/shared/types';
import { MessageBoxItem } from '@/shared/types/relationship-types';
import { theme } from '@/constants/theme';
import { RelationshipService } from '@/services/relationship-service';
import { getCharacterById } from '@/services/character-service';
import { useCharacters } from '@/constants/CharactersContext';

interface MessageBoxProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
}

const MessageBox: React.FC<MessageBoxProps> = ({ character, onUpdateCharacter }) => {
  const { characters } = useCharacters();
  const [messages, setMessages] = useState<MessageBoxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<MessageBoxItem | null>(null);
  
  useEffect(() => {
    loadMessages();
  }, [character.id]);
  
  const loadMessages = () => {
    setIsLoading(true);
    try {
      const messageBox = character.messageBox || [];
      let sortedMessages = [...messageBox];
      
      // Sort by timestamp
      sortedMessages.sort((a, b) => b.timestamp - a.timestamp);
      setMessages(sortedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMarkAsRead = async (message: MessageBoxItem) => {
    try {
      if (!character.messageBox) return;
      
      const updatedMessages = character.messageBox.map(msg =>
        msg.id === message.id ? { ...msg, read: true } : msg
      );
      
      const updatedCharacter: Character = {
        ...character,
        messageBox: updatedMessages
      };
      
      await onUpdateCharacter(updatedCharacter);
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === message.id ? { ...msg, read: true } : msg
        )
      );
      setSelectedMessage(message);
    } catch (error) {
      console.error('Error marking message as read:', error);
      Alert.alert('Error', 'Failed to mark message as read');
    }
  };

  const handleDeleteMessage = async (message: MessageBoxItem) => {
    try {
      if (!character.messageBox) return;
      
      const updatedMessages = character.messageBox.filter(msg => msg.id !== message.id);
      
      const updatedCharacter: Character = {
        ...character,
        messageBox: updatedMessages
      };
      
      await onUpdateCharacter(updatedCharacter);
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== message.id));
      
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };
  
  const handleClearAll = async () => {
    Alert.alert(
      '清空消息',
      '确定要删除所有消息吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedCharacter: Character = {
                ...character,
                messageBox: []
              };
              
              await onUpdateCharacter(updatedCharacter);
              setMessages([]);
              setSelectedMessage(null);
            } catch (error) {
              console.error('Error clearing messages:', error);
              Alert.alert('Error', 'Failed to clear messages');
            }
          }
        }
      ]
    );
  };

  // Helper functions for displaying message info
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const getSenderName = (message: MessageBoxItem) => {
    return message.senderName || 'Unknown';
  };
  
  const getSenderAvatar = (message: MessageBoxItem) => {
    if (!message.senderId) return null;
    const sender = getCharacterById(characters, message.senderId);
    return sender?.avatar || null;
  };
  
  const getMessageTypeIcon = (message: MessageBoxItem) => {
    switch (message.type) {
      case 'relationship_request':
        return 'people-outline';
      case 'invitation':
        return 'mail-outline';
      case 'alert':
        return 'alert-circle-outline';
      default:
        return 'chatbubble-outline';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>消息盒子</Text>
        {messages.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
            <Text style={styles.clearButtonText}>清空</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>加载消息中...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {messages.length > 0 ? (
            <View style={styles.messageContainer}>
              <ScrollView style={styles.messageList}>
                {messages.map(message => (
                  <TouchableOpacity
                    key={message.id}
                    style={[
                      styles.messageItem,
                      selectedMessage?.id === message.id && styles.selectedMessage,
                      !message.read && styles.unreadMessage
                    ]}
                    onPress={() => handleMarkAsRead(message)}
                  >
                    <View style={styles.messageIcon}>
                      <Ionicons 
                        name={getMessageTypeIcon(message)} 
                        size={24} 
                        color={theme.colors.primary} 
                      />
                    </View>
                    
                    <View style={styles.messageContent}>
                      <View style={styles.messageHeader}>
                        <Text style={styles.messageSender}>{getSenderName(message)}</Text>
                        <Text style={styles.messageTime}>{formatTime(message.timestamp || Date.now())}</Text>
                      </View>
                      <Text 
                        style={styles.messageText} 
                        numberOfLines={2}
                      >
                        {message.text}
                      </Text>
                    </View>
                    
                    {!message.read && (
                      <View style={styles.unreadIndicator} />
                    )}
                    
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteMessage(message)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#888" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <View style={styles.messageDetail}>
                {selectedMessage ? (
                  <View>
                    <View style={styles.detailHeader}>
                      <Image
                        source={
                          getSenderAvatar(selectedMessage)
                            ? { uri: getSenderAvatar(selectedMessage) as string }
                            : require('@/assets/images/default-avatar.png')
                        }
                        style={styles.senderAvatar}
                      />
                      <View>
                        <Text style={styles.detailSender}>{getSenderName(selectedMessage)}</Text>
                        <Text style={styles.detailTime}>{formatTime(selectedMessage.timestamp || Date.now())}</Text>
                      </View>
                    </View>
                    
                    <ScrollView style={styles.detailContent}>
                      <Text style={styles.detailText}>{selectedMessage.text}</Text>
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.noSelectionContainer}>
                    <Ionicons name="mail-outline" size={40} color="#555" />
                    <Text style={styles.noSelectionText}>选择一条消息以查看详情</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-open-outline" size={60} color="#555" />
              <Text style={styles.emptyText}>没有消息</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// 保留之前的样式
const styles = StyleSheet.create({
  // ... 之前的样式不变
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: theme.colors.danger,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#aaa',
  },
  messageContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  messageList: {
    flex: 2,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  selectedMessage: {
    backgroundColor: 'rgba(255, 158, 205, 0.1)',
  },
  unreadMessage: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  messageIcon: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContent: {
    flex: 1,
    paddingRight: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageSender: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  messageTime: {
    fontSize: 12,
    color: '#777',
  },
  messageText: {
    fontSize: 14,
    color: '#bbb',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
  },
  messageDetail: {
    flex: 3,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  senderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  detailSender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  detailTime: {
    fontSize: 12,
    color: '#777',
  },
  detailContent: {
    flex: 1,
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#ddd',
  },
  noSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noSelectionText: {
    marginTop: 16,
    fontSize: 16,
    color: '#555',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#555',
  },
});

export default MessageBox;
