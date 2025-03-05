import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '@/constants/UserContext';
import { useRouter } from 'expo-router';
import { NodeSTCleanupButton } from '@/components/settings/NodeSTCleanupButton';
import ListItem from '@/components/ListItem';
import EmptyStateView from '@/components/EmptyStateView';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingIndicator from '@/components/LoadingIndicator';
import ActionButton from '@/components/ActionButton';
import { theme } from '@/constants/theme';
const Profile: React.FC = () => {
  const { user, updateAvatar } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const pickImage = useCallback(async () => {
    try {
      setIsLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setShowConfirmDialog(true);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await updateAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [updateAvatar]);

  const handleCleanupComplete = () => {
    // 可以在清理完成后执行一些操作
    console.log("NodeST 数据清理完成");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      {/* 用户信息 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={pickImage}>
          <Image
            source={user?.avatar ? { uri: user.avatar } : require('@/assets/images/default-avatar.png')}
            style={styles.avatar}
          />
          <View style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      {/* 项目列表 - 使用新的ListItem组件 */}
      <ScrollView style={styles.content}>
        <ListItem
          title="我的Agent"
          leftIcon="person-outline"
          chevron={true}
          onPress={() => router.push('/pages/global-settings')}
        />
        
        <ListItem
          title="Agent集市"
          leftIcon="storefront"
          leftIconColor="#777777"
          chevron={true}
          onPress={() => router.push('/pages/global-settings')}
        />
        
        <ListItem
          title="全局设置"
          leftIcon="settings-outline"
          chevron={true}
          onPress={() => router.push('/pages/global-settings')}
        />
        
        <ListItem
          title="API 设置"
          leftIcon="cloud-outline"
          chevron={true}
          onPress={() => router.push('/pages/api-settings')}
        />

        {/* 危险区域 - 使用我们的新组件 */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>危险区域</Text>
          <ActionButton 
            title="清理所有角色数据" 
            onPress={() => setShowConfirmDialog(true)}
            color={theme.colors.danger}
            textColor="#fff"
            icon="trash-outline"
            iconPosition="left"
          />
          <Text style={styles.dangerSectionDescription}>
            清理所有角色数据将删除所有存储在应用中的角色对话历史和设定数据。此操作无法撤销。
          </Text>
        </View>
      </ScrollView>

      {/* 使用新的ConfirmDialog组件 */}
      <ConfirmDialog
        visible={showConfirmDialog}
        title="确认清理数据"
        message="此操作将永久删除所有角色数据和对话历史。确定要继续吗？"
        confirmText="确认删除"
        cancelText="取消"
        confirmAction={() => {
          setShowConfirmDialog(false);
          // 调用清理函数
          handleCleanupComplete();
        }}
        cancelAction={() => setShowConfirmDialog(false)}
        destructive={true}
        icon="alert-circle"
      />

      {/* 使用新的LoadingIndicator组件 */}
      <LoadingIndicator 
        visible={isLoading} 
        text="处理中..."
        overlay={true}
        useModal={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 16,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  dangerSection: {
    margin: 16,
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(255, 71, 87, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  dangerSectionTitle: {
    color: theme.colors.danger,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  dangerSectionDescription: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
});

export default Profile;