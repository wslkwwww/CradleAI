import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CradleCharacter } from '@/shared/types';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import CharacterEditDialog from './CharacterEditDialog'; // 导入角色编辑对话框

interface CradleCharacterDetailProps {
  character: CradleCharacter;
  onFeed: () => void;
  onGenerate: () => void;
  onDelete: () => void;
  onEdit?: () => void; // 新增编辑回调
}

const CradleCharacterDetail: React.FC<CradleCharacterDetailProps> = ({
  character,
  onFeed,
  onGenerate,
  onDelete,
  onEdit
}) => {
  // 计算角色在摇篮中的天数
  const calculateDaysInCradle = () => {
    const createdAt = character.createdAt;
    return createdAt 
      ? Math.round((Date.now() - createdAt) / (1000 * 60 * 60 * 24) * 10) / 10
      : 0;
  };

  // 计算投喂统计
  const calculateFeedStats = () => {
    const totalFeeds = character.feedHistory?.length || 0;
    const processedFeeds = character.feedHistory?.filter(feed => feed.processed).length || 0;
    
    return {
      total: totalFeeds,
      processed: processedFeeds,
      percentage: totalFeeds > 0 ? Math.round((processedFeeds / totalFeeds) * 100) : 0
    };
  };

  // 判断是否有图像生成任务
  const hasPendingImageTask = character.imageGenerationTaskId && 
                               character.imageGenerationStatus === 'pending';
  
  const hasImageError = character.imageGenerationStatus === 'error';
  
  const feedStats = calculateFeedStats();
  const daysInCradle = calculateDaysInCradle();

  return (
    <View style={styles.characterDetailCard}>
      {/* 角色背景图片 */}
      {character.backgroundImage ? (
        <Image 
          source={{ uri: character.backgroundImage }} 
          style={styles.characterDetailBackground} 
          resizeMode="cover"
        />
      ) : (
        <View style={styles.characterDetailBackgroundPlaceholder}>
          <MaterialCommunityIcons name="image-outline" size={40} color="#666" />
        </View>
      )}
      
      {/* 渐变叠加层 */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        style={styles.characterDetailGradient}
      >
        {/* 显示图像生成状态（如适用） */}
        {(hasPendingImageTask || hasImageError) && (
          <View style={styles.imageGenerationStatusContainer}>
            {hasPendingImageTask ? (
              <>
                <ActivityIndicator size="small" color="#FFD700" style={styles.imageStatusIndicator} />
                <Text style={styles.imageGenerationStatusText}>图像生成进行中...</Text>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle" size={18} color="#FF4444" style={styles.imageStatusIndicator} />
                <Text style={styles.imageGenerationStatusText}>图像生成失败</Text>
              </>
            )}
          </View>
        )}
        
        {/* 角色信息 */}
        <View style={styles.characterDetailInfo}>
          <Text style={styles.characterDetailName}>{character.name}</Text>
          
          <Text style={styles.characterDetailDescription} numberOfLines={2}>
            {character.description || "这是一个摇篮中的AI角色，等待通过投喂数据塑造个性..."}
          </Text>
          
          {/* 角色状态行 */}
          <View style={styles.characterStatusRow}>
            <View style={styles.characterStatusItem}>
              <Ionicons name="time-outline" size={16} color="#ddd" />
              <Text style={styles.characterStatusText}>培育中: {daysInCradle}天</Text>
            </View>
            
            <View style={styles.characterStatusItem}>
              <MaterialCommunityIcons name="food-apple" size={16} color="#ddd" />
              <Text style={styles.characterStatusText}>
                投喂: {feedStats.processed}/{feedStats.total}
              </Text>
            </View>
          </View>
          
          {/* 角色操作按钮 */}
          <View style={styles.characterActionButtons}>
            <TouchableOpacity 
              style={[styles.characterActionButton, styles.feedButton]}
              onPress={onFeed}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={styles.characterActionButtonText}>投喂</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.characterActionButton, styles.generateButton]}
              onPress={onGenerate}
            >
              <Ionicons name="flash-outline" size={16} color="#fff" />
              <Text style={styles.characterActionButtonText}>立即生成</Text>
            </TouchableOpacity>
            
            {/* 新增对话修改按钮 */}
            <TouchableOpacity 
              style={[styles.characterActionButton, styles.editButton]}
              onPress={onEdit}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={styles.characterActionButtonText}>对话修改</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.characterActionButton, styles.deleteButton]}
              onPress={onDelete}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.characterActionButtonText}>删除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  characterDetailCard: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333',
    position: 'relative',
  },
  characterDetailBackground: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  characterDetailBackgroundPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterDetailGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  imageGenerationStatusContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '70%',
  },
  imageStatusIndicator: {
    marginRight: 8,
  },
  imageGenerationStatusText: {
    color: '#FFD700',
    fontSize: 14,
  },
  characterDetailInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  characterDetailName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  characterDetailDescription: {
    color: '#eee',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  characterStatusRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  characterStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  characterStatusText: {
    color: '#ddd',
    marginLeft: 6,
    fontSize: 14,
  },
  characterActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap', // 允许按钮在空间不足时换行
  },
  characterActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8, // 增加垂直间距适应换行
  },
  feedButton: {
    backgroundColor: '#4A90E2',
  },
  generateButton: {
    backgroundColor: '#FF9800',
  },
  editButton: {
    backgroundColor: '#9C27B0', // 紫色，与其他按钮区分
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  characterActionButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 14,
  },
});

export default CradleCharacterDetail;
