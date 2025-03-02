import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CradleCharacter } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Slider from '@react-native-community/slider';

interface CradleCreateFormProps {
  isVisible: boolean;
  onClose: () => void;
}

// 2D 坐标轴类型
interface Axis {
  x: number;
  y: number;
  xLabel?: string;
  yLabel?: string;
}

// 坐标轴配置
const DEFAULT_AXES = {
  personality: {
    x: 50,
    y: 50,
    xLabel: '内向 - 外向',
    yLabel: '感性 - 理性'
  },
  morality: {
    x: 50,
    y: 50,
    xLabel: '守序 - 混乱',
    yLabel: '善良 - 邪恶'
  }
};

// 默认滑块配置
const DEFAULT_SLIDERS = {
  intelligence: 50,
  creativity: 50,
  sociability: 50
};

// 预设参考角色
const REFERENCE_CHARACTERS = [
  { id: 'ref_1', name: '灰原哀', avatar: require('@/assets/images/ref_haibara.png') },
  { id: 'ref_2', name: '哆啦A梦', avatar: require('@/assets/images/ref_doraemon.png') },
  { id: 'ref_3', name: '新垣结衣', avatar: require('@/assets/images/ref_aragaki.png') },
  { id: 'ref_4', name: '死神', avatar: require('@/assets/images/ref_shinigami.png') },
  { id: 'ref_5', name: '初音未来', avatar: require('@/assets/images/ref_miku.png') },
  { id: 'ref_6', name: '七龙珠', avatar: require('@/assets/images/ref_dragonball.png') },
];

const CradleCreateForm: React.FC<CradleCreateFormProps> = ({ isVisible, onClose }) => {
  const router = useRouter();
  const { addCradleCharacter, getCradleSettings, generateCharacterFromCradle } = useCharacters();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [characterName, setCharacterName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [referenceCharacterId, setReferenceCharacterId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [backgroundUri, setBackgroundUri] = useState<string | null>(null);
  const [axes, setAxes] = useState<{[key: string]: Axis}>(DEFAULT_AXES);
  const [sliders, setSliders] = useState<{[key: string]: number}>(DEFAULT_SLIDERS);
  
  // 是否直接生成角色，跳过摇篮过程
  const [generateImmediately, setGenerateImmediately] = useState(false);
  
  const cradleSettings = getCradleSettings();

  // 重置表单数据当模态框关闭时
  useEffect(() => {
    if (!isVisible) {
      // 短暂延迟后重置表单，避免关闭动画过程中看到表单重置
      const timer = setTimeout(() => {
        setStep(1);
        setCharacterName('');
        setGender('male');
        setReferenceCharacterId(null);
        setDescription('');
        setAvatarUri(null);
        setBackgroundUri(null);
        setAxes(DEFAULT_AXES);
        setSliders(DEFAULT_SLIDERS);
        setGenerateImmediately(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // 处理成方形头像
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 400, height: 400 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
        );
        
        setAvatarUri(manipResult.uri);
      }
    } catch (error) {
      console.error('选择头像失败:', error);
      Alert.alert('错误', '选择头像失败');
    }
  };

  const pickBackground = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setBackgroundUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('选择背景图失败:', error);
      Alert.alert('错误', '选择背景图失败');
    }
  };

  const handleAxisChange = (category: string, axis: 'x' | 'y', value: number) => {
    setAxes(prevAxes => ({
      ...prevAxes,
      [category]: {
        ...prevAxes[category],
        [axis]: value
      }
    }));
  };

  const handleSliderChange = (name: string, value: number) => {
    setSliders(prevSliders => ({
      ...prevSliders,
      [name]: value
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!referenceCharacterId) {
        setStep(2); // 跳过参考角色，直接到步骤2
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      if (!characterName.trim()) {
        Alert.alert('信息不完整', '请输入角色名称');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      handleCreateCharacter();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const handleCreateCharacter = async () => {
    if (!characterName.trim()) {
      Alert.alert('信息不完整', '请输入角色名称');
      return;
    }

    setIsLoading(true);

    try {
      // Updated to ensure CradleCharacter properly extends Character
      const cradleCharacter: CradleCharacter = {
        // Character base properties
        id: Date.now().toString(),
        name: characterName,
        avatar: avatarUri,
        backgroundImage: backgroundUri,
        description: description || '',
        personality: '', // Will be developed through cradle system
        interests: [],
        gender,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        
        // Cradle specific properties
        inCradleSystem: true,
        feedHistory: [],
        initialSettings: {
          axis: axes,
          sliders: sliders,
          reference: referenceCharacterId || undefined,
          description
        },
        isCradleGenerated: true
      };

      // 如果选择立即生成，则跳过摇篮过程
      if (generateImmediately) {
        const character = await generateCharacterFromCradle(cradleCharacter.id);
        Alert.alert('成功', '角色已创建并生成', [
          { text: '确定', onPress: () => {
            onClose();
            // Fix the pathname to use correct format
            router.replace({
              pathname: "/(tabs)",
              params: { characterId: character.id }
            });
          }}
        ]);
      } else {
        await addCradleCharacter(cradleCharacter);
        Alert.alert('成功', '摇篮角色已创建，请前往摇篮页面投喂数据', [
          { text: '确定', onPress: () => {
            onClose();
            // Fix the pathname to use correct format
            router.replace({
              pathname: "/(tabs)/cradle"
            });
          }}
        ]);
      }
    } catch (error) {
      console.error('创建角色失败:', error);
      Alert.alert('错误', '创建角色失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 渲染参考角色选择界面
  const renderReferenceSelection = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>选择参考角色</Text>
      <Text style={styles.stepDescription}>
        选择一个喜欢的角色作为参考，或跳过此步骤
      </Text>
      
      <ScrollView style={styles.referenceContainer}>
        <View style={styles.referenceGrid}>
          {REFERENCE_CHARACTERS.map(character => (
            <TouchableOpacity
              key={character.id}
              style={[
                styles.referenceItem,
                referenceCharacterId === character.id && styles.selectedReference
              ]}
              onPress={() => setReferenceCharacterId(
                referenceCharacterId === character.id ? null : character.id
              )}
            >
              <Image source={character.avatar} style={styles.referenceAvatar} />
              <Text style={styles.referenceName}>{character.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      <Text style={styles.skipText}>
        如果没有合适的参考角色，请点击"下一步"跳过
      </Text>
    </View>
  );

  // 渲染角色初始信息设置界面
  const renderCharacterSettings = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>设置角色基本信息</Text>
      
      <ScrollView style={styles.settingsContainer}>
        {/* 名称和性别 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>角色名称</Text>
          <TextInput
            style={styles.textInput}
            value={characterName}
            onChangeText={setCharacterName}
            placeholder="输入角色名称"
            placeholderTextColor="#aaa"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>性别</Text>
          <View style={styles.genderSelector}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === 'male' && styles.selectedGender
              ]}
              onPress={() => setGender('male')}
            >
              <Ionicons 
                name="male" 
                size={20} 
                color={gender === 'male' ? '#fff' : '#aaa'} 
              />
              <Text style={[
                styles.genderText,
                gender === 'male' && styles.selectedGenderText
              ]}>
                男性
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === 'female' && styles.selectedGender
              ]}
              onPress={() => setGender('female')}
            >
              <Ionicons 
                name="female" 
                size={20} 
                color={gender === 'female' ? '#fff' : '#aaa'} 
              />
              <Text style={[
                styles.genderText,
                gender === 'female' && styles.selectedGenderText
              ]}>
                女性
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === 'other' && styles.selectedGender
              ]}
              onPress={() => setGender('other')}
            >
              <Ionicons 
                name="person" 
                size={20} 
                color={gender === 'other' ? '#fff' : '#aaa'} 
              />
              <Text style={[
                styles.genderText,
                gender === 'other' && styles.selectedGenderText
              ]}>
                其他
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 图片选择区域 */}
        <View style={styles.imageSelectionContainer}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={pickAvatar}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
              ) : (
                <>
                  <Ionicons name="person-circle-outline" size={40} color="#aaa" />
                  <Text style={styles.imageButtonText}>添加头像</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.backgroundContainer}>
            <TouchableOpacity
              style={styles.backgroundButton}
              onPress={pickBackground}
            >
              {backgroundUri ? (
                <Image source={{ uri: backgroundUri }} style={styles.backgroundPreview} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={40} color="#aaa" />
                  <Text style={styles.imageButtonText}>添加背景</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 性格坐标轴 */}
        <View style={styles.axisContainer}>
          <Text style={styles.sectionTitle}>性格定位</Text>
          
          {/* 内向-外向 vs 感性-理性 */}
          <View style={styles.axisGroup}>
            <Text style={styles.axisTitle}>性格象限</Text>
            
            <View style={styles.axis}>
              <Text style={styles.axisLabel}>{axes.personality.xLabel?.split(' - ')[0]}</Text>
              <Slider
                style={styles.axisSlider}
                minimumValue={0}
                maximumValue={100}
                value={axes.personality.x}
                onValueChange={(value) => handleAxisChange('personality', 'x', value)}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <Text style={styles.axisLabel}>{axes.personality.xLabel?.split(' - ')[1]}</Text>
            </View>
            
            <View style={styles.axis}>
              <Text style={styles.axisLabel}>{axes.personality.yLabel?.split(' - ')[0]}</Text>
              <Slider
                style={styles.axisSlider}
                minimumValue={0}
                maximumValue={100}
                value={axes.personality.y}
                onValueChange={(value) => handleAxisChange('personality', 'y', value)}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <Text style={styles.axisLabel}>{axes.personality.yLabel?.split(' - ')[1]}</Text>
            </View>
          </View>
          
          {/* 守序-混乱 vs 善良-邪恶 */}
          <View style={styles.axisGroup}>
            <Text style={styles.axisTitle}>道德定位</Text>
            
            <View style={styles.axis}>
              <Text style={styles.axisLabel}>{axes.morality.xLabel?.split(' - ')[0]}</Text>
              <Slider
                style={styles.axisSlider}
                minimumValue={0}
                maximumValue={100}
                value={axes.morality.x}
                onValueChange={(value) => handleAxisChange('morality', 'x', value)}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <Text style={styles.axisLabel}>{axes.morality.xLabel?.split(' - ')[1]}</Text>
            </View>
            
            <View style={styles.axis}>
              <Text style={styles.axisLabel}>{axes.morality.yLabel?.split(' - ')[0]}</Text>
              <Slider
                style={styles.axisSlider}
                minimumValue={0}
                maximumValue={100}
                value={axes.morality.y}
                onValueChange={(value) => handleAxisChange('morality', 'y', value)}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <Text style={styles.axisLabel}>{axes.morality.yLabel?.split(' - ')[1]}</Text>
            </View>
          </View>
          
          {/* 属性滑块 */}
          <View style={styles.slidersContainer}>
            <Text style={styles.sectionTitle}>能力属性</Text>
            
            <View style={styles.sliderGroup}>
              <Text style={styles.sliderLabel}>智力</Text>
              <Slider
                style={styles.attributeSlider}
                minimumValue={0}
                maximumValue={100}
                value={sliders.intelligence}
                onValueChange={(value) => handleSliderChange('intelligence', value)}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <Text style={styles.sliderValue}>{Math.round(sliders.intelligence)}</Text>
            </View>
            
            <View style={styles.sliderGroup}>
              <Text style={styles.sliderLabel}>创造力</Text>
              <Slider
                style={styles.attributeSlider}
                minimumValue={0}
                maximumValue={100}
                value={sliders.creativity}
                onValueChange={(value) => handleSliderChange('creativity', value)}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <Text style={styles.sliderValue}>{Math.round(sliders.creativity)}</Text>
            </View>
            
            <View style={styles.sliderGroup}>
              <Text style={styles.sliderLabel}>社交能力</Text>
              <Slider
                style={styles.attributeSlider}
                minimumValue={0}
                maximumValue={100}
                value={sliders.sociability}
                onValueChange={(value) => handleSliderChange('sociability', value)}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#444"
                thumbTintColor="#4A90E2"
              />
              <Text style={styles.sliderValue}>{Math.round(sliders.sociability)}</Text>
            </View>
          </View>
          
          {/* 其他描述 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>其他描述</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="添加其他有助于塑造角色的描述信息（选填）"
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // 渲染生成选项界面
  const renderGenerationOptions = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>设置生成方式</Text>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.optionButton,
            !generateImmediately && styles.selectedOption
          ]}
          onPress={() => setGenerateImmediately(false)}
        >
          <Ionicons 
            name="leaf-outline" 
            size={40} 
            color={!generateImmediately ? '#4A90E2' : '#aaa'} 
          />
          <Text style={styles.optionTitle}>摇篮培育（推荐）</Text>
          <Text style={styles.optionDescription}>
            角色将被放入摇篮中培育，您需要通过投喂数据来培养角色的个性
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.optionButton,
            generateImmediately && styles.selectedOption
          ]}
          onPress={() => setGenerateImmediately(true)}
        >
          <Ionicons 
            name="flash-outline" 
            size={40} 
            color={generateImmediately ? '#4A90E2' : '#aaa'} 
          />
          <Text style={styles.optionTitle}>立即生成</Text>
          <Text style={styles.optionDescription}>
            立即根据已设置的属性生成角色，跳过摇篮培育阶段
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={20} color="#aaa" />
        <Text style={styles.noteText}>
          摇篮培育可以让AI根据您投喂的数据更加个性化地塑造角色，培育周期可在摇篮设置中调整，当前为 {cradleSettings.duration || 7} 天。
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* 模态框头部 */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>创建摇篮角色</Text>
            
            <View style={styles.stepIndicator}>
              {[1, 2, 3].map(i => (
                <View 
                  key={i} 
                  style={[
                    styles.stepDot,
                    step >= i && styles.activeStepDot
                  ]} 
                />
              ))}
            </View>
          </View>
          
          {/* 模态框内容 */}
          <View style={styles.modalContent}>
            {/* 步骤 1: 选择参考角色 */}
            {step === 1 && renderReferenceSelection()}
            
            {/* 步骤 2: 设置角色属性 */}
            {step === 2 && renderCharacterSettings()}
            
            {/* 步骤 3: 选择生成方式 */}
            {step === 3 && renderGenerationOptions()}
          </View>
          
          {/* 模态框底部按钮 */}
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.footerButton, styles.backButton]} 
              onPress={handleBack}
            >
              <Text style={styles.buttonText}>
                {step === 1 ? '取消' : '上一步'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.footerButton, styles.nextButton]} 
              onPress={handleNext}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {step === 3 ? '完成' : '下一步'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    height: '90%',
    backgroundColor: '#282828',
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    padding: 4,
  },
  stepIndicator: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555',
    marginHorizontal: 4,
  },
  activeStepDot: {
    backgroundColor: '#4A90E2',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#333',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    backgroundColor: '#555',
    marginRight: 8,
  },
  nextButton: {
    backgroundColor: '#4A90E2',
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
  },
  referenceContainer: {
    flex: 1,
  },
  referenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  referenceItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
  },
  selectedReference: {
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  referenceAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  referenceName: {
    color: '#fff',
    textAlign: 'center',
  },
  skipText: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 14,
    marginTop: 16,
  },
  settingsContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  genderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    marginHorizontal: 4,
  },
  selectedGender: {
    backgroundColor: '#4A90E2',
  },
  genderText: {
    color: '#aaa',
    marginLeft: 8,
  },
  selectedGenderText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  imageSelectionContainer: {
    flexDirection: 'row',
    marginVertical: 16,
    justifyContent: 'space-between',
  },
  avatarContainer: {
    flex: 1,
    marginRight: 8,
  },
  avatarButton: {
    aspectRatio: 1,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  backgroundContainer: {
    flex: 2,
  },
  backgroundButton: {
    aspectRatio: 1.77,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  backgroundPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imageButtonText: {
    color: '#aaa',
    marginTop: 8,
  },
  axisContainer: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  axisGroup: {
    marginBottom: 24,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    padding: 12,
    borderRadius: 8,
  },
  axisTitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  axis: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  axisLabel: {
    width: 50,
    color: '#aaa',
    fontSize: 12,
  },
  axisSlider: {
    flex: 1,
    height: 40,
  },
  slidersContainer: {
    marginBottom: 24,
  },
  sliderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    width: 70,
    color: '#fff',
  },
  attributeSlider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 36,
    color: '#aaa',
    textAlign: 'center',
  },
  optionsContainer: {
    marginTop: 20,
  },
  optionButton: {
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedOption: {
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderColor: '#4A90E2',
  },
  optionTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginVertical: 8,
  },
  optionDescription: {
    color: '#aaa',
    textAlign: 'center',
  },
  noteCard: {
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noteText: {
    color: '#aaa',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});

export default CradleCreateForm;