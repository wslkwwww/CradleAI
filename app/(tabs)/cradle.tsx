import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCharacters } from '@/constants/CharactersContext';
import CradleFeedModal from '@/components/CradleFeedModal';
import CradleSettings from '@/components/CradleSettings';
import ImportToCradleModal from '@/components/ImportToCradleModal';
import { CradleCharacter, } from '@/shared/types';
import { CradleSettings as CradleSettingsType } from '@/constants/types';

export default function CradleScreen() {
  const router = useRouter();
  const {
    getCradleSettings,
    updateCradleSettings,
    getCradleCharacters,
    generateCharacterFromCradle
  } = useCharacters();

  // Define types for state variables
  const [cradleSettings, setCradleSettingsState] = useState<CradleSettingsType>({
    enabled: false,
    duration: 7,
    startDate: undefined,
    progress: 0
  });
  const [characters, setCharactersState] = useState<CradleCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);
  
  // Load cradle data
  const loadData = () => {
    try {
      setLoading(true);
      const settings = getCradleSettings();
      const chars = getCradleCharacters();
      
      console.log("Loaded cradle settings:", settings);
      console.log("Loaded cradle characters:", chars);
      
      setCradleSettingsState(settings as CradleSettingsType);
      setCharactersState(chars || []);
    } catch (error) {
      console.error("Error loading cradle data:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle cradle system enabled state
  const handleToggleCradle = async (enabled: boolean) => {
    const newSettings: CradleSettingsType = { 
      ...cradleSettings, 
      enabled,
      // If enabling, set start date if not already set
      startDate: enabled && !cradleSettings.startDate ? new Date().toISOString() : cradleSettings.startDate
    };
    
    try {
      await updateCradleSettings(newSettings);
      setCradleSettingsState(newSettings);
    } catch (error) {
      console.error("Error toggling cradle:", error);
    }
  };
  
  // Update cradle duration
  const handleDurationChange = async (duration: number) => {
    try {
      const newSettings: CradleSettingsType = { ...cradleSettings, duration };
      await updateCradleSettings(newSettings);
      setCradleSettingsState(newSettings);
    } catch (error) {
      console.error("Error changing duration:", error);
    }
  };
  
  // Calculate progress based on start date and duration
  const calculateProgress = () => {
    if (!cradleSettings.enabled || !cradleSettings.startDate) {
      return 0;
    }
    
    const startDate = new Date(cradleSettings.startDate);
    const currentDate = new Date();
    const elapsedDays = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const totalDuration = cradleSettings.duration || 7;
    
    return Math.min(Math.round((elapsedDays / totalDuration) * 100), 100);
  };
  
  const progress = calculateProgress();
  
  // Handle character generation
  const handleGenerateCharacter = async (characterId: string) => {
    try {
      const character = await generateCharacterFromCradle(characterId);
      router.push({
        pathname: "/(tabs)",
        params: { characterId: character.id }
      });
    } catch (error) {
      console.error('Failed to generate character:', error);
    }
  };
  
  // Handle feed button click
  const handleFeedCharacter = () => {
    setShowFeedModal(true);
  };

  // Create new character
  const handleCreateCharacter = () => {
    router.push('/pages/create_char_cradle');
  };
  
  // Add new function to handle importing characters
  const handleImportCharacter = () => {
    setShowImportModal(true);
  };
  
  // If still loading data
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>加载摇篮系统...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#282828" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>摇篮系统</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleImportCharacter}
          >
            <Ionicons name="cloud-download-outline" size={22} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowSettingsModal(true)}
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <LinearGradient
          colors={['#2c3e50', '#1a1a2e']}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>
              {cradleSettings.enabled 
                ? "摇篮培育进行中" 
                : "摇篮系统未启用"}
            </Text>
            
            {cradleSettings.enabled && (
              <>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${progress}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{progress}%</Text>
                </View>
                
                <Text style={styles.bannerSubtitle}>
                  {progress >= 100 
                    ? "培育周期已完成，可以生成角色" 
                    : `培育周期: ${cradleSettings.duration || 7} 天`}
                </Text>
              </>
            )}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.bannerButton}
                onPress={() => handleToggleCradle(!cradleSettings.enabled)}
              >
                <Text style={styles.bannerButtonText}>
                  {cradleSettings.enabled ? "暂停培育" : "开始培育"}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.bannerButton, styles.secondaryButton]}
                onPress={handleFeedCharacter}
                disabled={characters.length === 0}
              >
                <Text style={[styles.bannerButtonText, styles.secondaryButtonText]}>
                  投喂数据
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>我的摇篮角色</Text>
            <View style={styles.headerActionButtons}>
              <TouchableOpacity 
                style={styles.smallActionButton}
                onPress={handleImportCharacter}
              >
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.smallButtonText}>导入</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleCreateCharacter}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>新建</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {characters && characters.length > 0 ? (
            characters.map((character: CradleCharacter) => (
              <View key={character.id} style={styles.characterCard}>
                <View style={styles.characterHeader}>
                  <View style={styles.avatarContainer}>
                    {character.avatar ? (
                      <Image source={{ uri: character.avatar }} style={styles.avatar} />
                    ) : (
                      <View style={styles.placeholderAvatar}>
                        <Ionicons name="person" size={30} color="#ccc" />
                      </View>
                    )}
                  </View>
                  <View style={styles.characterInfo}>
                    <Text style={styles.characterName}>
                      {character.name || '未命名角色'}
                      {character.importedFromCharacter && (
                        <Text style={styles.importBadge}> (导入)</Text>
                      )}
                    </Text>
                    <Text style={styles.characterMeta}>
                      投喂数据: {character.feedHistory?.length || 0} 条
                    </Text>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => setShowFeedModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#4A90E2" />
                    <Text style={styles.actionText}>投喂</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="analytics-outline" size={18} color="#4A90E2" />
                    <Text style={styles.actionText}>培育状态</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, progress >= 100 ? styles.readyButton : styles.disabledButton]}
                    disabled={progress < 100}
                    onPress={() => handleGenerateCharacter(character.id)}
                  >
                    <Ionicons 
                      name={character.importedFromCharacter ? "refresh-outline" : "rocket-outline"} 
                      size={18} 
                      color={progress >= 100 ? "#4A90E2" : "#999"} 
                    />
                    <Text style={[
                      styles.actionText,
                      progress >= 100 ? styles.readyText : styles.disabledText
                    ]}>
                      {progress >= 100 
                        ? (character.importedFromCharacter ? "应用更新" : "生成角色")
                        : "未准备好"
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="leaf-outline" size={60} color="#666" />
              <Text style={styles.emptyTitle}>没有摇篮角色</Text>
              <Text style={styles.emptyText}>创建一个摇篮角色开始培育吧</Text>
              <View style={styles.emptyButtons}>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreateCharacter}
                >
                  <Text style={styles.createButtonText}>创建角色</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.createButton, styles.importButton]}
                  onPress={handleImportCharacter}
                >
                  <Text style={styles.createButtonText}>导入已有角色</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>摇篮系统说明</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              摇篮系统可以帮助你培育更具个性的AI角色。通过投喂文本、图片等数据，系统将为角色塑造个性。培育周期结束后，你可以将摇篮角色生成为正式角色进行互动。
            </Text>
            
            <View style={styles.infoPoints}>
              <View style={styles.infoPoint}>
                <Ionicons name="time-outline" size={20} color="#4A90E2" />
                <Text style={styles.infoPointText}>需要时间培育</Text>
              </View>
              
              <View style={styles.infoPoint}>
                <Ionicons name="document-text-outline" size={20} color="#4A90E2" />
                <Text style={styles.infoPointText}>投喂各类数据</Text>
              </View>
              
              <View style={styles.infoPoint}>
                <Ionicons name="person-outline" size={20} color="#4A90E2" />
                <Text style={styles.infoPointText}>塑造个性特征</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Modals */}
      {showFeedModal && (
        <CradleFeedModal
          visible={showFeedModal}
          onClose={() => {
            setShowFeedModal(false);
            loadData(); // Reload data when modal closes
          }}
        />
      )}
      
      {showSettingsModal && (
        <CradleSettings
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onCradleToggle={handleToggleCradle}
          onDurationChange={handleDurationChange}
          isCradleEnabled={cradleSettings.enabled}
          cradleDuration={cradleSettings.duration || 7}
        />
      )}
      
      {/* New Import Modal */}
      <ImportToCradleModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={loadData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#282828',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  banner: {
    padding: 20,
  },
  bannerContent: {
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  progressText: {
    width: 40,
    fontSize: 14,
    color: '#fff',
    textAlign: 'right',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  bannerButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  bannerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  secondaryButtonText: {
    color: '#4A90E2',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 4,
  },
  characterCard: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  characterHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  placeholderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  characterName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  characterMeta: {
    fontSize: 14,
    color: '#aaa',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    marginLeft: 4,
    color: '#4A90E2',
  },
  readyButton: {
    // Additional styles when ready
  },
  disabledButton: {
    opacity: 0.6,
  },
  readyText: {
    color: '#4A90E2',
  },
  disabledText: {
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#333',
    borderRadius: 10,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
    marginBottom: 16,
  },
  infoPoints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  infoPointText: {
    marginLeft: 6,
    color: '#bbb',
    fontSize: 13,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#555',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  importBadge: {
    fontSize: 12,
    color: '#4A90E2',
    fontStyle: 'italic',
  },
  emptyButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
  importButton: {
    backgroundColor: '#555',
    marginLeft: 12,
  },
});