import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  ImageBackground
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCharacters } from '@/constants/CharactersContext';
import { CradleCharacter } from '@/shared/types';

// UPDATED: CradleCharacterCarousel now supports scrollToIndex properly and has UI fixes
import CradleCharacterCarousel from '@/components/CradleCharacterCarousel';

// UPDATED: These components were previously used as modals, now they can also be embedded directly into tabs
import CradleApiSettings from '@/components/CradleApiSettings';  // NEW: Added for API provider settings
import CradleSettings from '@/components/CradleSettings';        // UPDATED: Now supports embedded mode
import CradleCreateForm from '@/components/CradleCreateForm';    // UPDATED: Fixed slider issues & supports embedded mode
import ImportToCradleModal from '@/components/ImportToCradleModal'; // UPDATED: Now supports embedded mode
import CradleFeedModal from '@/components/CradleFeedModal';      // UNCHANGED: Still used as a modal

// DEPRECATED: Previous floating action button approach - now using tabs instead

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// NEW: Define our tabs for the updated UI
const TABS = [
  { id: 'main', title: '主页', icon: 'home-outline' },
  { id: 'create', title: '创建', icon: 'add-outline' },
  { id: 'import', title: '导入', icon: 'download-outline' },
  { id: 'settings', title: '设置', icon: 'settings-outline' },
  { id: 'api', title: 'API', icon: 'cloud-outline' } // NEW: Added API settings tab
];

export default function CradlePage() {
  const router = useRouter();
  
  const { 
    getCradleCharacters, 
    getCradleSettings,
    updateCradleSettings,
  } = useCharacters();

  // States for data
  const [cradleCharacters, setCradleCharacters] = useState<CradleCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CradleCharacter | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cradleSettings = getCradleSettings();
  
  // NEW: State for tabs
  const [activeTab, setActiveTab] = useState<string>('main');
  const [showFeedModal, setShowFeedModal] = useState(false);

  // DEPRECATED: Old modal states, now handled by tab system
  // const [showCreateForm, setShowCreateForm] = useState(false);
  // const [showImportModal, setShowImportModal] = useState(false);
  // const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Load characters when component mounts or refreshes
  useEffect(() => {
    loadCradleCharacters();
  }, []);

  // Load cradle characters from context
  const loadCradleCharacters = useCallback(() => {
    const characters = getCradleCharacters();
    setCradleCharacters(characters);
    
    // If we have characters but none selected, select the first one
    if (characters.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characters[0]);
    } else if (selectedCharacter) {
      // If we have a selected character, make sure it's updated
      const updatedSelectedChar = characters.find(c => c.id === selectedCharacter.id);
      if (updatedSelectedChar) {
        setSelectedCharacter(updatedSelectedChar);
      } else if (characters.length > 0) {
        // If the selected character no longer exists, select the first one
        setSelectedCharacter(characters[0]);
      } else {
        setSelectedCharacter(null);
      }
    }
  }, [selectedCharacter]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadCradleCharacters();
    setRefreshing(false);
  }, [loadCradleCharacters]);

  // Handle character selection
  const handleSelectCharacter = (character: CradleCharacter) => {
    setSelectedCharacter(character);
  };

  // Handle feed character
  const handleFeedCharacter = (characterId: string) => {
    // Find the character
    const character = cradleCharacters.find(c => c.id === characterId);
    if (character) {
      setSelectedCharacter(character);
      setShowFeedModal(true);
    }
  };

  // NEW: Fix the scrollToIndex error by making sure we handle onScrollToIndexFailed
  const handleTabChange = (tabId: string) => {
    // Reset any flatlist scroll position issues when changing tabs
    if (tabId === 'main') {
      // Use setTimeout to ensure the state update happens after the tab change
      setTimeout(() => {
        loadCradleCharacters();
      }, 10);
    }
    setActiveTab(tabId);
  };

  // NEW: Render the appropriate content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'main':
        return (
          <ScrollView 
            style={styles.tabContent}
            contentContainerStyle={styles.tabPageContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.statusBar}>
              <View style={styles.statusContainer}>
                <View style={[
                  styles.statusIndicator, 
                  cradleSettings.enabled ? styles.statusActive : styles.statusInactive
                ]} />
                <Text style={styles.statusText}>
                  {cradleSettings.enabled 
                    ? `摇篮系统已启用 · ${cradleSettings.duration || 7}天培育期`
                    : '摇篮系统未启用'}
                </Text>
              </View>
            </View>

            <CradleCharacterCarousel
              characters={cradleCharacters}
              onSelectCharacter={handleSelectCharacter}
              selectedCharacterId={selectedCharacter?.id}
              onFeedCharacter={handleFeedCharacter}
            />
            
            {/* Empty state */}
            {cradleCharacters.length === 0 && (
              <View style={styles.emptyStateContainer}>
                <MaterialCommunityIcons name="cradle" size={60} color="#555" />
                <Text style={styles.emptyTitle}>没有摇篮角色</Text>
                <Text style={styles.emptyText}>点击"创建"标签来添加新角色</Text>
              </View>
            )}
          </ScrollView>
        );
      case 'create':
        return (
          <View style={styles.tabContent}>
            <CradleCreateForm 
              embedded={true}  // NEW: Now supports embedded mode
              onClose={() => handleTabChange('main')}
              onSuccess={loadCradleCharacters}
            />
          </View>
        );
      case 'import':
        return (
          <View style={styles.tabContent}>
            <ImportToCradleModal 
              embedded={true} // NEW: Now supports embedded mode
              visible={true}
              onClose={() => handleTabChange('main')}
              onImportSuccess={loadCradleCharacters}
            />
          </View>
        );
      case 'settings':
        return (
          <View style={styles.tabContent}>
            <CradleSettings
              embedded={true} // NEW: Now supports embedded mode
              isVisible={true}
              onClose={() => handleTabChange('main')}
              isCradleEnabled={cradleSettings.enabled}
              cradleDuration={cradleSettings.duration}
              onCradleToggle={(enabled) => {
                updateCradleSettings({
                  ...cradleSettings,
                  enabled,
                  startDate: enabled ? new Date().toISOString() : undefined
                });
              }}
              onDurationChange={(duration) => {
                updateCradleSettings({
                  ...cradleSettings,
                  duration
                });
              }}
            />
          </View>
        );
      // NEW: API settings tab
      case 'api':
        return (
          <View style={styles.tabContent}>
            <CradleApiSettings
              embedded={true}
              isVisible={true}
              onClose={() => handleTabChange('main')}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#282828" />
      
      {/* UPDATED: Header now includes tabs */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>摇篮系统</Text>
        </View>
        
        {/* NEW: Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContentContainer}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => handleTabChange(tab.id)}
              >
                <Ionicons 
                  name={tab.icon as any} 
                  size={18} 
                  color={isActive ? '#FFD700' : '#aaa'} 
                  style={styles.tabIcon}
                />
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.title}
                </Text>
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      
      {/* NEW: Tab Content - now using a simple container with conditional rendering instead of ScrollView */}
      <View style={styles.tabContentContainer}>
        {renderTabContent()}
      </View>
      
      {/* UNCHANGED: Feed Modal - still used as a popup */}
      <CradleFeedModal
        visible={showFeedModal}
        onClose={() => {
          setShowFeedModal(false);
          loadCradleCharacters();
        }}
        characterId={selectedCharacter?.id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  header: {
    backgroundColor: '#333333',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
  },
  tabsContentContainer: {
    paddingHorizontal: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    color: '#aaa',
    fontSize: 14,
  },
  activeTabText: {
    color: '#FFD700',
    fontWeight: '500',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FFD700',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabPageContent: {
    paddingBottom: 20,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusInactive: {
    backgroundColor: '#FF5722',
  },
  statusText: {
    color: '#ccc',
    fontSize: 14,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginHorizontal: 20,
    marginTop: 40,
  },
  emptyTitle: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});