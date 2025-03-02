import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Dimensions,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCharacters } from '@/constants/CharactersContext';
import CradleCreateForm from '@/components/CradleCreateForm';
import { theme } from '@/constants/theme';

// 示例角色预设
const FEATURED_TEMPLATES = [
  {
    id: 'template_1',
    name: '青春期少女',
    description: '活泼开朗，情绪波动较大',
    image: require('@/assets/images/template_teenage_girl.png')
  },
  {
    id: 'template_2',
    name: '成熟男性',
    description: '稳重自信，思维清晰',
    image: require('@/assets/images/template_mature_man.png')
  },
  {
    id: 'template_3',
    name: '科学家',
    description: '理性思维，好奇心强',
    image: require('@/assets/images/template_scientist.png')
  },
  {
    id: 'template_4',
    name: '艺术家',
    description: '富有创造力，感性直觉',
    image: require('@/assets/images/template_artist.png')
  }
];

const { width } = Dimensions.get('window');

const CreateCharCradle: React.FC = () => {
  const router = useRouter();
  const { getCradleSettings, updateCradleSettings } = useCharacters();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const cradleSettings = getCradleSettings();

  const handleCreateCharacter = () => {
    // 如果摇篮系统未启用，先启用它
    if (!cradleSettings.enabled) {
      updateCradleSettings({
        ...cradleSettings,
        enabled: true,
        startDate: new Date().toISOString(),
      });
    }
    
    // 显示创建表单
    setShowCreateForm(true);
  };

  const handleGoToCharacter = () => {
    router.push('/pages/create_char');
  };

  const handleGoToCradle = () => {
    router.push('/(tabs)/cradle');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#181818" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>摇篮模式</Text>
      </View>
      
      <ScrollView style={styles.container}>
        <LinearGradient
          colors={['#2c3e50', '#1a1a2e']}
          style={styles.gradientHeader}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>角色摇篮系统</Text>
            <Text style={styles.subtitle}>
              创建一个独特的AI角色，通过投喂培养它的个性
            </Text>
            
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleCreateCharacter}
            >
              <LinearGradient
                colors={['#4A90E2', '#357ABD']}
                style={styles.gradientButton}
              >
                <Text style={styles.createButtonText}>创建摇篮角色</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>摇篮系统介绍</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              摇篮系统是一种创建更有个性AI角色的方式。通过投喂数据来培育角色，可以形成更加丰富独特的个性特征。
            </Text>
            <View style={styles.featureRow}>
              <View style={styles.featureItem}>
                <Ionicons name="leaf-outline" size={24} color="#4A90E2" />
                <Text style={styles.featureText}>个性培育</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="time-outline" size={24} color="#4A90E2" />
                <Text style={styles.featureText}>持续互动</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="happy-outline" size={24} color="#4A90E2" />
                <Text style={styles.featureText}>情感连接</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快速入门步骤</Text>
          <View style={styles.stepsContainer}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <Text style={styles.stepTitle}>设置角色</Text>
              <Text style={styles.stepDescription}>
                创建角色并定义初始性格特征
              </Text>
            </View>
            
            <View style={styles.stepConnector} />
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <Text style={styles.stepTitle}>投喂数据</Text>
              <Text style={styles.stepDescription}>
                通过文字、图片等方式培育角色个性
              </Text>
            </View>
            
            <View style={styles.stepConnector} />
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumber}>3</Text>
              </View>
              <Text style={styles.stepTitle}>生成角色</Text>
              <Text style={styles.stepDescription}>
                培育完成后生成可交互的AI角色
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>已有摇篮角色</Text>
            <TouchableOpacity onPress={handleGoToCradle}>
              <Text style={styles.viewAllLink}>查看全部</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.cradleStatus}>
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot, 
                cradleSettings.enabled ? styles.statusActive : styles.statusInactive
              ]} />
              <Text style={styles.statusText}>
                {cradleSettings.enabled ? '摇篮系统已启用' : '摇篮系统未启用'}
              </Text>
            </View>
            {cradleSettings.enabled && cradleSettings.startDate && (
              <Text style={styles.statusDetail}>
                培育周期: {cradleSettings.duration} 天
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>推荐模板</Text>
            <TouchableOpacity onPress={handleCreateCharacter}>
              <Text style={styles.viewAllLink}>创建自定义</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templatesContainer}
          >
            {FEATURED_TEMPLATES.map(template => (
              <TouchableOpacity 
                key={template.id} 
                style={styles.templateCard}
                onPress={() => {
                  setShowCreateForm(true);
                }}
              >
                <Image source={template.image} style={styles.templateImage} />
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateDesc}>{template.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        <View style={styles.section}>
          <View style={styles.optionRow}>
            <TouchableOpacity 
              style={[styles.optionButton, styles.optionButtonPrimary]}
              onPress={handleCreateCharacter}
            >
              <Text style={styles.optionButtonText}>创建摇篮角色</Text>
              <MaterialCommunityIcons name="cradle" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.optionButton, styles.optionButtonSecondary]}
              onPress={handleGoToCharacter}
            >
              <Text style={styles.optionButtonText}>常规创建模式</Text>
              <Ionicons name="person-add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 底部间距 */}
        <View style={{ height: 40 }} />
      </ScrollView>
      
      <CradleCreateForm
        isVisible={showCreateForm}
        onClose={() => setShowCreateForm(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#181818',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#252525',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  gradientHeader: {
    padding: 24,
    paddingBottom: 32,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  createButton: {
    width: '70%',
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginTop: 8,
  },
  gradientButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  viewAllLink: {
    color: '#4A90E2',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardText: {
    color: '#ddd',
    lineHeight: 22,
    fontSize: 15,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureItem: {
    alignItems: 'center',
  },
  featureText: {
    color: '#bbb',
    marginTop: 8,
    fontSize: 12,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
  },
  stepConnector: {
    height: 2,
    backgroundColor: '#4A90E2',
    flex: 0.5,
    marginTop: 20,
  },
  stepNumberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    color: '#bbb',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  cradleStatus: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusInactive: {
    backgroundColor: '#FF5722',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
  },
  statusDetail: {
    color: '#bbb',
    fontSize: 14,
    marginTop: 8,
    marginLeft: 20,
  },
  templatesContainer: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  templateCard: {
    width: 150,
    backgroundColor: '#252525',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  templateImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  templateName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    padding: 12,
    paddingBottom: 4,
  },
  templateDesc: {
    color: '#bbb',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  optionButtonPrimary: {
    backgroundColor: '#4A90E2',
  },
  optionButtonSecondary: {
    backgroundColor: '#424242',
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
});

export default CreateCharCradle;