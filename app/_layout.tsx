import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UserProvider } from '@/constants/UserContext';
import { CharactersProvider } from '@/constants/CharactersContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useWindowDimensions, Easing, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { Animated } from 'react-native';
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() || 'light';
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { height: windowHeight } = useWindowDimensions();
  const [isReady, setIsReady] = useState(false);

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

  useEffect(() => {
    async function prepare() {
      try {
        // Perform any AsyncStorage operations or other async initialization here
        await AsyncStorage.getItem('dummy-key'); // Just to test AsyncStorage is ready
        
        // Set ready state after a small delay to ensure everything is mounted
        setTimeout(() => {
          setIsReady(true);
        }, 100);
      } catch (e) {
        console.warn('Initialization error:', e);
        setIsReady(true); // Still mark as ready to avoid hanging
      }
    }
    
    prepare();
  }, []);
  
  // Show a loading state while initializing
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        <CharactersProvider>
          <View style={styles.container}>
            <ThemeProvider value={theme}>
              <Stack screenOptions={{headerShown: false}}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="pages/character-detail" />
                <Stack.Screen name="pages/create_char" />
                <Stack.Screen name="pages/create_char_cradle" />
                <Stack.Screen name="pages/create_character_tabs" />
                <Stack.Screen name="pages/settings" />
                <Stack.Screen name="pages/character-import" />
                <Stack.Screen name="pages/update-avatar" />
              </Stack>
              <StatusBar style="dark" backgroundColor='black' />
            </ThemeProvider>
          </View>
        </CharactersProvider>
      </UserProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
});
