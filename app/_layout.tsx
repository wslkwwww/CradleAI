import 'react-native-reanimated'; // 必须最顶层
import 'react-native-gesture-handler'; // 建议紧随其后
// import '@/lib/polyfills';
// // import '@/lib/matrix/init'; // 安全初始化Matrix SDK
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, useWindowDimensions, Easing, View, StyleSheet, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CharactersProvider } from '@/constants/CharactersContext';
import { UserProvider } from '@/constants/UserContext';
import Colors from '@/constants/Colors';
import { RegexProvider } from '@/constants/RegexContext';
import { initCloudServiceTracker } from '@/utils/cloud-service-tracker';
// import { MatrixDebugger } from '@/components/MatrixDebugger';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() || 'light';
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { height: windowHeight } = useWindowDimensions();
  const [isRootReady, setIsRootReady] = useState(false); // 新增：根布局就绪状态

  // 新增：安全初始化根布局
  useEffect(() => {
    const initRoot = async () => {
      try {
        // 检查基础服务
        const appState = AppState.currentState;
        console.log('[RootLayout] Current app state:', appState);
        
        // 确保只在前台状态下初始化
        if (appState === 'active') {
          setTimeout(() => {
            setIsRootReady(true);
            console.log('[RootLayout] Root layout ready');
          }, 300);
        } else {
          // 如果不在前台，监听状态变化
          const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active') {
              setIsRootReady(true);
              subscription.remove();
            }
          };
          
          const subscription = AppState.addEventListener('change', handleAppStateChange);
        }
      } catch (error) {
        console.error('[RootLayout] Initialization error:', error);
        // 出错也要初始化
        setTimeout(() => setIsRootReady(true), 1000);
      }
    };
    
    initRoot();
  }, []);

  // Initialize cloud service tracker
  useEffect(() => {
    if (isRootReady) {
      initCloudServiceTracker();
    }
  }, [isRootReady]);

  // Use the correct theme structure that ReactNavigation expects
  const theme = colorScheme === 'dark' 
    ? { 
        ...DarkTheme, 
        colors: {
          ...DarkTheme.colors,
          primary: Colors.dark.tint,
          background: '#282828',
          card: '#333333',
          text: '#ffffff',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      } 
    : { 
        ...DefaultTheme, 
        colors: {
          ...DefaultTheme.colors,
          primary: Colors.light.tint,
          background: '#f8f8f8',
          card: '#ffffff',
          text: '#333333',
          border: 'rgba(0, 0, 0, 0.1)',
        }
      };

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // 等待字体加载和根布局就绪
  if (!loaded || !isRootReady) {
    return null;
  }

  const MyTransition = {
    gestureDirection: 'vertical' as const,
    transitionSpec: {
      duration: 250,
      easing: Easing.out(Easing.poly(4)),
      timing: Animated.timing,
      useNativeDriver: true,
    },
    screenInterpolator: ({ position, scene }: { position: Animated.Value; scene: { index: number; }; }) => {
      const thisSceneIndex = scene.index;

      const translateY = position.interpolate({
        inputRange: [thisSceneIndex - 1, thisSceneIndex],
        outputRange: [windowHeight, 0],
      });

      return { transform: [{ translateY }] };
    },
  };

  return (
    <SafeAreaProvider>
      <UserProvider>
        <CharactersProvider>
          <RegexProvider>
            <View style={styles.container}>
              <ThemeProvider value={theme}>
                <Stack screenOptions={{headerShown: false}}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="pages/character-detail" />
                  <Stack.Screen name="pages/create_char" />
                  <Stack.Screen name="pages/create_character_tabs" />
                </Stack>
                <StatusBar style="dark" backgroundColor='black' />
              </ThemeProvider>
              {/* <MatrixDebugger /> */}
            </View>
          </RegexProvider>
        </CharactersProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
});
