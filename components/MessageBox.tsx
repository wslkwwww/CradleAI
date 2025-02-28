import React from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { Character } from '../shared/types';
import { MessageBoxItem } from '../shared/types/relationship-types';
import { relationshipStyles as styles } from '../styles/relationship-styles';
import { RelationshipService } from '../services/relationship-service';


interface MessageBoxProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
}

export const MessageBox: React.FC<MessageBoxProps> = ({ 
  character, 
  onUpdateCharacter 
}) => {
  const messages = character.messageBox || [];
  
  const handleMarkAllAsRead = () => {
    const updatedCharacter = RelationshipService.markAllMessagesAsRead(character);
    onUpdateCharacter(updatedCharacter);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', { 
      month: 'numeric', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageTypeColor = (type: MessageBoxItem['type']) => {
    switch (type) {
      case 'like': return '#4CAF50';
      case 'comment': return '#2196F3';
      case 'reply': return '#9C27B0';
      case 'post': return '#FF9800';
      case 'action': return '#F44336';
      default: return '#757575';
    }
  };

  const renderItem = ({ item }: { item: MessageBoxItem }) => {
    const borderColor = getMessageTypeColor(item.type);
    
    return (
      <View style={[styles.messageItem, { borderLeftColor: borderColor }]}>
        {!item.read && <View style={styles.unreadBadge} />}
        <View style={styles.messageHeader}>
          <Text style={styles.senderName}>{item.senderName}</Text>
          <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
        </View>
        <Text style={styles.messageContent}>{item.content}</Text>
        {item.contextContent && (
          <Text style={styles.contextContent}>{item.contextContent}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{character.name}的消息盒子</Text>
        <Text style={styles.subtitle}>查看你收到的互动和消息</Text>
      </View>
      
      {messages.length > 0 && (
        <TouchableOpacity 
          style={styles.button}
          onPress={handleMarkAllAsRead}
        >
          <Text style={styles.buttonText}>标记所有为已读</Text>
        </TouchableOpacity>
      )}

      {messages.length > 0 ? (
        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            暂无消息。与其他角色互动后，消息会显示在这里。
          </Text>
        </View>
      )}
    </View>
  );
};
