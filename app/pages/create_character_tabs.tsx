import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialTabBar, Tabs } from 'react-native-collapsible-tab-view';
import CreateChar from './create_char';
import CreateCharCradle from './create_char_cradle';
import { Ionicons } from '@expo/vector-icons';

const CreateCharacterTabs: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  
  const tabData = [
    { key: 'regular', title: '常规模式', component: CreateChar },
    { key: 'cradle', title: '摇篮模式', component: CreateCharCradle },
  ];

  // 自定义标签栏
  const CustomTabBar = (props: any) => {
    return (
      <View style={styles.tabBarContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.tabBar}>
          {tabData.map((tab, index) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabItem,
                index === activeTab && styles.activeTabItem
              ]}
              onPress={() => {
                setActiveTab(index);
                props.onTabPress({ index });
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  index === activeTab && styles.activeTabText
                ]}
              >
                {tab.title}
              </Text>
              {index === activeTab && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#181818" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>创建角色</Text>
      </View>
      
      <Tabs.Container
        renderTabBar={props => <CustomTabBar {...props} />}
        onTabChange={index => setActiveTab(index.index)}
        initialTabName="regular"
        renderHeader={() => null}
        containerStyle={styles.tabsContainer}
      >
        <Tabs.Tab name="regular">
          <Tabs.ScrollView style={styles.tabContent}>
            <CreateChar />
          </Tabs.ScrollView>
        </Tabs.Tab>
        
        <Tabs.Tab name="cradle">
          <Tabs.ScrollView style={styles.tabContent}>
            <CreateCharCradle />
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181818',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#252525',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  tabsContainer: {
    backgroundColor: '#181818',
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 16,
  },
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTabItem: {
    backgroundColor: 'transparent',
  },
  tabText: {
    color: '#aaa',
    fontSize: 16,
  },
  activeTabText: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '50%',
    backgroundColor: '#4A90E2',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabContent: {
    flex: 1,
  },
});

export default CreateCharacterTabs;
