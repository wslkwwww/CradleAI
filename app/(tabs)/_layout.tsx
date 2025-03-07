import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { Colors } from '@/constants/Colors';
// 导入正则工具上下文提供者
import { RegexProvider } from '@/constants/RegexContext';

export default function TabLayout() {
  const colorScheme = useColorScheme() || 'light';
  
  // Define fallback theme to prevent undefined tint error
  const colorTheme = {
    text: colorScheme === 'dark' ? '#fff' : '#000',
    background: colorScheme === 'dark' ? '#000' : '#fff',
    tint: colorScheme === 'dark' ? '#fff' : '#2f95dc', 
    tabIconDefault: '#ccc',
    tabIconSelected: colorScheme === 'dark' ? '#fff' : '#2f95dc',
  };

  return (
    <RegexProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colorTheme.tabIconSelected,
          tabBarStyle: {
            backgroundColor: '#282828',
            borderTopColor: 'rgba(255, 255, 255, 0.1)',
          },
          tabBarLabelStyle: {
            fontWeight: '500',
          },
          headerStyle: {
            backgroundColor: '#282828',
          },
          headerTitleStyle: {
            color: 'rgb(255, 224, 195)',
            fontWeight: 'bold',
          },
          headerTintColor: 'rgb(255, 224, 195)',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '聊天',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                size={26}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: '发现',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'compass' : 'compass-outline'}
                size={26}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="Character"
          options={{
            title: '角色卡',
            headerShown: true,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'document-text' : 'document-text-outline'}
                size={26}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="cradle"
          options={{
            title: '摇篮',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'leaf' : 'leaf-outline'}
                size={26}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '我',
            headerShown: true,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={26}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </RegexProvider>
  );
}
