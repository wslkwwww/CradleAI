import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CradleCharacter } from '@/shared/types';
import { useCharacters } from '@/constants/CharactersContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Add a simple function to generate unique IDs
const generateUniqueId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

// Add the missing interface
interface CradleCreateFormProps {
  isVisible?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// 2D 坐标轴类型
interface Axis {
  x: number;
  y: number;
  xLabel?: string;
  yLabel?: string;
}

// Define interfaces for trait customization
interface TraitSlider {
  id: string;
  type: 'slider';
  name: string;
  value: number;
  minLabel?: string;
  maxLabel?: string;
}

interface TraitText {
  id: string;
  type: 'text';
  name: string;
  value: string;
}

type Trait = TraitSlider | TraitText;

interface TraitCategory {
  id: string;
  name: string;
  traits: Trait[];
}

// Default trait categories to start with
const DEFAULT_TRAIT_CATEGORIES: TraitCategory[] = [
  {
    id: 'personality-axes',
    name: '性格定位',
    traits: [
      {
        id: 'introvert-extrovert',
        type: 'slider',
        name: '内向 - 外向',
        value: 50,
        minLabel: '内向',
        maxLabel: '外向'
      },
      {
        id: 'rational-emotional',
        type: 'slider',
        name: '理性 - 感性',
        value: 50,
        minLabel: '理性',
        maxLabel: '感性'
      }
    ]
  },
  {
    id: 'morality-axes',
    name: '道德定位',
    traits: [
      {
        id: 'lawful-chaotic',
        type: 'slider',
        name: '守序 - 混乱',
        value: 50,
        minLabel: '守序',
        maxLabel: '混乱'
      },
      {
        id: 'good-evil',
        type: 'slider',
        name: '善良 - 邪恶',
        value: 50,
        minLabel: '善良',
        maxLabel: '邪恶'
      }
    ]
  },
  {
    id: 'abilities',
    name: '能力属性',
    traits: [
      {
        id: 'intelligence',
        type: 'slider',
        name: '智力',
        value: 50
      },
      {
        id: 'creativity',
        type: 'slider',
        name: '创造力',
        value: 50
      },
      {
        id: 'sociability',
        type: 'slider',
        name: '社交能力',
        value: 50
      }
    ]
  }
];

// 预设参考角色
const REFERENCE_CHARACTERS = [
  { id: 'ref_1', name: '灰原哀', avatar: require('@/assets/images/ref_haibara.png') },
  { id: 'ref_2', name: '哆啦A梦', avatar: require('@/assets/images/ref_doraemon.png') },
  { id: 'ref_3', name: '新垣结衣', avatar: require('@/assets/images/ref_aragaki.png') },
  { id: 'ref_4', name: '死神', avatar: require('@/assets/images/ref_shinigami.png') },
  { id: 'ref_5', name: '初音未来', avatar: require('@/assets/images/ref_miku.png') },
  { id: 'ref_6', name: '七龙珠', avatar: require('@/assets/images/ref_dragonball.png') },
];

const SIDEBAR_SECTIONS = [
  { id: 'basic', title: '基本信息', icon: 'person-outline' },
  { id: 'appearance', title: '外观设定', icon: 'image-outline' },
  { id: 'personality', title: '性格特点', icon: 'color-palette-outline' },
];

const CradleCreateForm: React.FC<CradleCreateFormProps> = ({
  isVisible = false,
  embedded = false,
  onClose,
  onSuccess
}) => {
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
  const [axes, setAxes] = useState<{[key: string]: Axis}>({
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
  });
  const [sliders, setSliders] = useState<{[key: string]: number}>({
    intelligence: 50,
    creativity: 50,
    sociability: 50
  });
  
  const [activeSection, setActiveSection] = useState('basic');
  const [cardImageUri, setCardImageUri] = useState<string | null>(null);
  
  // Add state variables for trait customization
  const [traitCategories, setTraitCategories] = useState<TraitCategory[]>(DEFAULT_TRAIT_CATEGORIES);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddTraitModal, setShowAddTraitModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTraitName, setNewTraitName] = useState('');
  const [newTraitType, setNewTraitType] = useState<'slider' | 'text'>('slider');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  
  // 是否直接生成角色，跳过摇篮过程
  const [generateImmediately, setGenerateImmediately] = useState(false);
  
  const cradleSettings = getCradleSettings();
  
  // Reset state when form closes
  useEffect(() => {
    if (!isVisible && !embedded) {
      // 短暂延迟后重置表单，避免关闭动画过程中看到表单重置
      const timer = setTimeout(() => {
        setStep(1);
        setCharacterName('');
        setGender('male');
        setReferenceCharacterId(null);
        setDescription('');
        setAvatarUri(null);
        setBackgroundUri(null);
        setCardImageUri(null);
        setAxes({
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
        });
        setSliders({
          intelligence: 50,
          creativity: 50,
          sociability: 50
        });
        setTraitCategories(DEFAULT_TRAIT_CATEGORIES);
        setGenerateImmediately(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, embedded]);

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

  // Function to pick character card image with 9:16 ratio
  const pickCardImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Process the image to ensure it's 9:16 ratio
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 900, height: 1600 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
        );
        
        setCardImageUri(manipResult.uri);
        // Also set as background image for compatibility
        setBackgroundUri(manipResult.uri);
      }
    } catch (error) {
      console.error('选择角色卡图片失败:', error);
      Alert.alert('错误', '选择角色卡图片失败');
    }
  };

  const handleAxisChange = (category: string, axis: 'x' | 'y', value: number) => {
    // Use requestAnimationFrame to ensure smoother slider updates
    requestAnimationFrame(() => {
      setAxes(prevAxes => ({
        ...prevAxes,
        [category]: {
          ...prevAxes[category],
          [axis]: value
        }
      }));
    });
  };

  const handleSliderChange = (name: string, value: number) => {
    // Use requestAnimationFrame to ensure smoother slider updates
    requestAnimationFrame(() => {
      setSliders(prevSliders => ({
        ...prevSliders,
        [name]: value
      }));
    });
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

  // Category and trait management functions
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert('错误', '请输入类别名称');
      return;
    }
    
    const newCategory: TraitCategory = {
      id: generateUniqueId(), // Use our custom function instead of uuidv4()
      name: newCategoryName,
      traits: []
    };
    
    setTraitCategories(prev => [...prev, newCategory]);
    setNewCategoryName('');
    setShowAddCategoryModal(false);
  };
  
  const handleDeleteCategory = (categoryId: string) => {
    Alert.alert(
      '确认删除',
      '确定要删除此类别及其所有特质吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: () => {
            setTraitCategories(prev => prev.filter(category => category.id !== categoryId));
          }
        }
      ]
    );
  };
  
  const handleAddTrait = () => {
    if (!activeCategoryId) return;
    if (!newTraitName.trim()) {
      Alert.alert('错误', '请输入特质名称');
      return;
    }
    
    const newTrait: Trait = newTraitType === 'slider' 
      ? {
          id: generateUniqueId(), // Use our custom function instead of uuidv4()
          type: 'slider',
          name: newTraitName,
          value: 50
        }
      : {
          id: generateUniqueId(), // Use our custom function instead of uuidv4()
          type: 'text',
          name: newTraitName,
          value: ''
        };
    
    setTraitCategories(prev => prev.map(category => {
      if (category.id === activeCategoryId) {
        return {
          ...category,
          traits: [...category.traits, newTrait]
        };
      }
      return category;
    }));
    
    setNewTraitName('');
    setShowAddTraitModal(false);
  };
  
  const handleDeleteTrait = (categoryId: string, traitId: string) => {
    setTraitCategories(prev => prev.map(category => {
      if (category.id === categoryId) {
        return {
          ...category,
          traits: category.traits.filter(trait => trait.id !== traitId)
        };
      }
      return category;
    }));
  };
  
  const handleUpdateTraitSlider = (categoryId: string, traitId: string, value: number) => {
    // Use requestAnimationFrame to ensure smoother slider updates
    requestAnimationFrame(() => {
      setTraitCategories(prev => prev.map(category => {
        if (category.id === categoryId) {
          return {
            ...category,
            traits: category.traits.map(trait => {
              if (trait.id === traitId && trait.type === 'slider') {
                return { ...trait, value };
              }
              return trait;
            })
          };
        }
        return category;
      }));
    });
  };
  
  const handleUpdateTraitText = (categoryId: string, traitId: string, value: string) => {
    setTraitCategories(prev => prev.map(category => {
      if (category.id === categoryId) {
        return {
          ...category,
          traits: category.traits.map(trait => {
            if (trait.id === traitId && trait.type === 'text') {
              return { ...trait, value };
            }
            return trait;
          })
        };
      }
      return category;
    }));
  };

  const handleCreateCharacter = async () => {
    if (!characterName.trim()) {
      Alert.alert('信息不完整', '请输入角色名称');
      return;
    }

    setIsLoading(true);

    try {
      // Convert trait categories to a format suitable for storage
      const traitsData = {
        categories: traitCategories.map(category => ({
          id: category.id,
          name: category.name,
          traits: category.traits
        }))
      };

      const cradleCharacter: CradleCharacter = {
        // Character base properties
        id: Date.now().toString(),
        name: characterName,
        avatar: avatarUri,
        backgroundImage: cardImageUri || backgroundUri, // Use card image as priority
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
          // Modify to fix the customTraits property error
          axis: axes,
          sliders: sliders,
          reference: referenceCharacterId || undefined,
          description,
          // Add the traits data to a valid property
          traits: traitsData
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
            if (onSuccess) onSuccess();
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
            if (onSuccess) onSuccess();
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
                step={1}
                tapToSeek={true}
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
                step={1}
                tapToSeek={true}
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
                step={1}
                tapToSeek={true}
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
                step={1}
                tapToSeek={true}
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
                step={1}
                tapToSeek={true}
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
                step={1}
                tapToSeek={true}
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
                step={1}
                tapToSeek={true}
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

  // Render functions for each section
  const renderBasicInfoSection = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>基本信息</Text>
      
      {/* Name input */}
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
      
      {/* Gender selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>性别</Text>
        <View style={styles.genderSelector}>
          {/* Gender buttons */}
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
      
      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>角色描述</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="描述角色的背景、身份等信息"
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={4}
        />
      </View>
    </View>
  );

  // New appearance section with card image
  const renderAppearanceSection = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>角色外观</Text>
      
      <View style={styles.cardPreviewSection}>
        <Text style={styles.inputLabel}>角色卡图片 (9:16)</Text>
        <View style={styles.cardImageContainer}>
          <TouchableOpacity
            style={styles.cardImagePicker}
            onPress={pickCardImage}
          >
            {cardImageUri ? (
              <Image source={{ uri: cardImageUri }} style={styles.cardImagePreview} />
            ) : (
              <>
                <Ionicons name="card-outline" size={40} color="#aaa" />
                <Text style={styles.imageButtonText}>添加角色卡图片</Text>
                <Text style={styles.imageButtonSubtext}>(9:16比例)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.imageSeparator}>
          <View style={styles.imageSeparatorLine} />
          <Text style={styles.imageSeparatorText}>或</Text>
          <View style={styles.imageSeparatorLine} />
        </View>
        
        {/* Avatar selection */}
        <Text style={styles.inputLabel}>头像图片 (方形)</Text>
        <View style={styles.imageSelectionContainer}>
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
      </View>
    </View>
  );

  const renderPersonalitySection = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>性格特点</Text>
      
      <View style={styles.traitControls}>
        <TouchableOpacity 
          style={styles.addCategoryButton}
          onPress={() => setShowAddCategoryModal(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFD700" />
          <Text style={styles.addCategoryText}>添加新类别</Text>
        </TouchableOpacity>
      </View>
      
      {traitCategories.map(category => (
        <View key={category.id} style={styles.traitCategory}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            
            <View style={styles.categoryControls}>
              <TouchableOpacity 
                style={styles.addTraitButton}
                onPress={() => {
                  setActiveCategoryId(category.id);
                  setShowAddTraitModal(true);
                }}
              >
                <Ionicons name="add" size={18} color="#4A90E2" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteCategoryButton}
                onPress={() => handleDeleteCategory(category.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          </View>
          
          {category.traits.map(trait => (
            <View key={trait.id} style={styles.traitItem}>
              <View style={styles.traitHeader}>
                <Text style={styles.traitName}>{trait.name}</Text>
                <TouchableOpacity
                  style={styles.deleteTraitButton}
                  onPress={() => handleDeleteTrait(category.id, trait.id)}
                >
                  <Ionicons name="close-circle" size={18} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
              
              {trait.type === 'slider' ? (
                <View style={styles.sliderContainer}>
                  {trait.minLabel && (
                    <Text style={styles.sliderMinLabel}>{trait.minLabel}</Text>
                  )}
                  <Slider
                    style={styles.attributeSlider}
                    minimumValue={0}
                    maximumValue={100}
                    value={trait.value}
                    onValueChange={(value) => handleUpdateTraitSlider(category.id, trait.id, value)}
                    minimumTrackTintColor="#4A90E2"
                    maximumTrackTintColor="#444"
                    thumbTintColor="#4A90E2"
                    step={1}
                    tapToSeek={true}
                  />
                  {trait.maxLabel && (
                    <Text style={styles.sliderMaxLabel}>{trait.maxLabel}</Text>
                  )}
                  <Text style={styles.sliderValue}>{Math.round(trait.value)}</Text>
                </View>
              ) : (
                <TextInput
                  style={styles.traitTextInput}
                  value={trait.value}
                  onChangeText={(text) => handleUpdateTraitText(category.id, trait.id, text)}
                  placeholder={`描述${trait.name}...`}
                  placeholderTextColor="#777"
                  multiline
                />
              )}
            </View>
          ))}
          
          {category.traits.length === 0 && (
            <Text style={styles.noTraitsText}>此类别下还没有特质，点击"+"添加</Text>
          )}
        </View>
      ))}
      
      {traitCategories.length === 0 && (
        <View style={styles.emptyTraitsContainer}>
          <Text style={styles.emptyTraitsText}>没有性格特点分类，请添加新类别</Text>
        </View>
      )}
    </View>
  );

  // Render based on whether we're embedded or in a modal
  if (embedded) {
    return (
      <View style={styles.embeddedContainer}>
        <View style={styles.sidebarContainer}>
          {/* Sidebar Navigation Items */}
          <View style={styles.sidebarNavItems}>
            {SIDEBAR_SECTIONS.map(section => (
              <TouchableOpacity 
                key={section.id}
                style={[
                  styles.sidebarItem,
                  activeSection === section.id && styles.activeSidebarItem
                ]}
                onPress={() => setActiveSection(section.id)}
              >
                <Ionicons 
                  name={section.icon as any}
                  size={24} 
                  color={activeSection === section.id ? "#FFD700" : "#aaa"} 
                />
                <Text 
                  style={[
                    styles.sidebarText,
                    activeSection === section.id && styles.activeSidebarText
                  ]}
                >
                  {section.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Create Button - At the bottom of sidebar */}
          <TouchableOpacity 
            style={styles.sidebarCreateButton}
            onPress={handleCreateCharacter}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                style={styles.createButtonGradient}
              >
                <Ionicons name="save-outline" size={24} color="#fff" />
                <Text style={styles.createButtonText}>创建摇篮角色</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <ScrollView style={styles.contentContainer}>
            {activeSection === 'basic' && renderBasicInfoSection()}
            {activeSection === 'appearance' && renderAppearanceSection()}
            {activeSection === 'personality' && renderPersonalitySection()}
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Add Category Modal */}
        <Modal
          visible={showAddCategoryModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddCategoryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalPopup}>
              <Text style={styles.modalTitle}>添加新类别</Text>
              
              <TextInput
                style={styles.modalInput}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="输入类别名称"
                placeholderTextColor="#999"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setNewCategoryName('');
                    setShowAddCategoryModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleAddCategory}
                >
                  <Text style={styles.confirmButtonText}>添加</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Add Trait Modal */}
        <Modal
          visible={showAddTraitModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddTraitModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalPopup}>
              <Text style={styles.modalTitle}>添加新特质</Text>
              
              <TextInput
                style={styles.modalInput}
                value={newTraitName}
                onChangeText={setNewTraitName}
                placeholder="输入特质名称"
                placeholderTextColor="#999"
              />
              
              <View style={styles.traitTypeContainer}>
                <Text style={styles.traitTypeLabel}>特质类型：</Text>
                
                <TouchableOpacity
                  style={[
                    styles.traitTypeButton,
                    newTraitType === 'slider' && styles.selectedTraitType
                  ]}
                  onPress={() => setNewTraitType('slider')}
                >
                  <Ionicons 
                    name="options-outline" 
                    size={16} 
                    color={newTraitType === 'slider' ? '#FFD700' : '#999'} 
                  />
                  <Text style={[
                    styles.traitTypeText,
                    newTraitType === 'slider' && styles.selectedTraitTypeText
                  ]}>
                    滑块
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.traitTypeButton,
                    newTraitType === 'text' && styles.selectedTraitType
                  ]}
                  onPress={() => setNewTraitType('text')}
                >
                  <Ionicons 
                    name="document-text-outline" 
                    size={16} 
                    color={newTraitType === 'text' ? '#FFD700' : '#999'} 
                  />
                  <Text style={[
                    styles.traitTypeText,
                    newTraitType === 'text' && styles.selectedTraitTypeText
                  ]}>
                    文本
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setNewTraitName('');
                    setShowAddTraitModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleAddTrait}
                >
                  <Text style={styles.confirmButtonText}>添加</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Modal version of the form
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

  axisContainer: {
    marginVertical: 16,
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
  // Styles for embedded mode
  embeddedContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#222',
  },
  sidebarContainer: {
    width: 120,
    backgroundColor: '#333',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  sidebarNavItems: {
    paddingTop: 20,
  },
  sidebarItem: {
    padding: 16,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  activeSidebarItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderLeftColor: '#FFD700',
  },
  sidebarText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  activeSidebarText: {
    color: '#FFD700',
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  // New sidebar create button styles
  sidebarCreateButton: {
    margin: 10,
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    height: 90,
  },
  createButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Remove the old embedded create button style since we no longer need it
  createButtonEmbedded: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 40,
  },
  sectionContent: {
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  cardPreviewSection: {
    marginBottom: 20,
  },
  cardImageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  cardImagePicker: {
    width: 180,
    height: 320, // 9:16 ratio
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  cardImagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imageButtonText: {
    color: '#aaa',
    marginTop: 12,
    textAlign: 'center',
  },
  imageButtonSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  imageSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  imageSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  imageSeparatorText: {
    color: '#aaa',
    marginHorizontal: 10,
  },
  // Styles for trait customization
  traitControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  addCategoryText: {
    color: '#FFD700',
    marginLeft: 6,
    fontWeight: '500',
  },
  traitCategory: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addTraitButton: {
    padding: 6,
    marginRight: 8,
  },
  deleteCategoryButton: {
    padding: 6,
  },
  traitItem: {
    marginBottom: 12,
  },
  traitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  traitName: {
    color: '#ddd',
    fontSize: 14,
  },
  deleteTraitButton: {
    padding: 4,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attributeSlider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 30,
    textAlign: 'right',
    color: '#4A90E2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sliderMinLabel: {
    width: 40,
    color: '#999',
    fontSize: 12,
    marginRight: 4,
  },
  sliderMaxLabel: {
    width: 40,
    color: '#999',
    fontSize: 12,
    textAlign: 'right',
    marginLeft: 4,
  },
  traitTextInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noTraitsText: {
    color: '#777',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10,
  },
  emptyTraitsContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
  },
  emptyTraitsText: {
    color: '#777',
    fontSize: 16,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPopup: {
    width: '80%',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#444',
    borderRadius: 6,
    padding: 12,
    color: '#fff',
    marginBottom: 16,
  },
  traitTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  traitTypeLabel: {
    color: '#ddd',
    marginRight: 10,
  },
  traitTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#444',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  selectedTraitType: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  traitTypeText: {
    color: '#999',
    marginLeft: 4,
  },
  selectedTraitTypeText: {
    color: '#FFD700',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  cancelButtonText: {
    color: '#ddd',
  },
  confirmButton: {
    backgroundColor: '#4A90E2',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CradleCreateForm;