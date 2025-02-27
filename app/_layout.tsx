// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router'; //  Tabs 不在这里导入
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Animated, useWindowDimensions, Easing, View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CharactersProvider } from '@/constants/CharactersContext';
import { UserProvider } from '@/constants/UserContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

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
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{headerShown: false}}>
                
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
    backgroundColor: 'gray',
  },
});
