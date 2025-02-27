import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Dimensions,Platform,StatusBar, Text, TouchableOpacity } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withRepeat, 
  withSequence,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CradleSettings from '@/components/CradleSettings';
import { useCharacters } from '@/constants/CharactersContext';
import CradleFeedModal from '@/components/CradleFeedModal';

const { width, height } = Dimensions.get('window');

export default function CradleScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];
  
  // Animation values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.85);

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const { updateCradleSettings, getCradleSettings } = useCharacters();
  const cradleSettings = getCradleSettings();
  const [isFeedSheetVisible, setIsFeedSheetVisible] = useState(false);

  const handleCradleToggle = async (enabled: boolean) => {
    const newSettings = {
      ...cradleSettings,
      enabled,
      startDate: enabled ? new Date().toISOString() : undefined,
    };
    await updateCradleSettings(newSettings);
  };

  const handleDurationChange = async (days: number) => {
    const newSettings = {
      ...cradleSettings,
      duration: days,
    };
    await updateCradleSettings(newSettings);
  };

  useEffect(() => {
    // Breathing animation
    scale.value = withRepeat(
      withSequence(
        withSpring(1.1, { duration: 2000 }),
        withSpring(1, { duration: 2000 })
      ),
      -1,
      true
    );

    // Glow animation
    opacity.value = withRepeat(
      withSequence(
        withSpring(1, { duration: 2000 }),
        withSpring(0.85, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.topBarContainer}>
        <View style={styles.leftSection}>
          <Text></Text>
        </View>
        <View style={styles.rightButtons}>
          <TouchableOpacity 
            style={[styles.iconButton, { padding: 12 }]}  // 增加按钮大小
            onPress={() => setIsSettingsVisible(true)}
          >
            <Icon name="settings" size={24} color="#4A4A4A" />
          </TouchableOpacity>
        </View>
      </View>
      
      <LinearGradient
        colors={['#FFE6E6', '#E6E6FF']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <TouchableOpacity 
            onPress={() => setIsFeedSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Animated.View style={[styles.cradle, animatedStyles]}>
              <View style={styles.innerGlow} />
            </Animated.View>
          </TouchableOpacity>
          
          <View style={styles.textContainer}>
            <ThemedText style={styles.subtitle}>点击摇篮，投喂你的兴趣...</ThemedText>
          </View>
        </View>
      </LinearGradient>

      <CradleSettings
        isVisible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        onCradleToggle={handleCradleToggle}
        onDurationChange={handleDurationChange}
        isCradleEnabled={cradleSettings.enabled}
        cradleDuration={cradleSettings.duration}
      />

      <CradleFeedModal
        visible={isFeedSheetVisible}
        onClose={() => setIsFeedSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: height * 0.1,
    width: '100%',
  },
  cradle: {
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerGlow: {
    width: '80%',
    height: '80%',
    borderRadius: width * 0.2,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 10,
    color:"black"
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 20,
    color:"black"
  },
  progress: {
    fontSize: 14,
    opacity: 0.6,
    color: "black"
  },
  topBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 10,
  },
  leftSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightButtons: {
    flexDirection: 'row',
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    marginHorizontal: 2,
  },
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
});