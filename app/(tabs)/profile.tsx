import React, { useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '@/constants/UserContext';
import { useRouter } from 'expo-router';
import { NodeSTCleanupButton } from '@/components/settings/NodeSTCleanupButton';

const Profile: React.FC = () => {
  const { user, updateAvatar } = useUser();
  const router = useRouter();

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change your avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        updateAvatar(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error(error);
    }
  }, [updateAvatar]);

  const handleCleanupComplete = () => {
    // 可以在清理完成后执行一些操作
    console.log("NodeST 数据清理完成");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* 头部 */}
      <View style={headerStyles.header}>
        <Text style={headerStyles.headerText}>我的</Text>
      </View>

      {/* 用户信息 */}
      <View style={styles.header}>
       <TouchableOpacity onPress={pickImage}>
         <Image
           source={user?.avatar ? { uri: user.avatar } : require('@/assets/images/default-avatar.png')}
           style={styles.avatar}
         />
       </TouchableOpacity>
     </View>

      {/* 项目列表 */}
      <ScrollView style={styles.content}>
        <TouchableOpacity style={styles.itemCard}>
          <Ionicons name="person-outline" size={24} color="#777777" />
          <Text style={styles.itemText}>我的Agent</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.itemCard}>
          <MaterialIcons name="storefront" size={24} color="#777777" />
          <Text style={styles.itemText}>Agent集市</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.itemCard}
          onPress={() => router.push('/pages/global-settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#777777" />
          <Text style={styles.itemText}>全局设置</Text>
        </TouchableOpacity>

        {/* 添加NodeSTCleanupButton */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>危险区域</Text>
          <NodeSTCleanupButton onCleanupComplete={handleCleanupComplete} />
          <Text style={styles.dangerSectionDescription}>
            清理所有角色数据将删除所有存储在应用中的角色对话历史和设定数据。此操作无法撤销。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#282828',
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
  loginButton: {
    backgroundColor: 'rgba(255, 123, 0, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemText: {
    color: '#4A4A4A',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  // 添加新样式
  dangerSection: {
    marginTop: 20,
    marginBottom: 30,
    padding: 16,
    backgroundColor: 'rgba(255, 71, 87, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  dangerSectionTitle: {
    color: '#ff4757',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dangerSectionDescription: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
    opacity: 0.7,
  },
});

const headerStyles = StyleSheet.create({
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    alignItems: 'center',
    backgroundColor: '#282828',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerText: {
    color: 'rgb(255, 224, 195)',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default Profile;