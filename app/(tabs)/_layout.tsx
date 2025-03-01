import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import React from 'react';

/**
 * You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
 */
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme() || 'light';
  
  // Define fallback theme to prevent undefined tint error
  const theme = Colors[colorScheme] || {
    text: colorScheme === 'dark' ? '#fff' : '#000',
    background: colorScheme === 'dark' ? '#000' : '#fff',
    tint: colorScheme === 'dark' ? '#fff' : '#2f95dc', 
    tabIconDefault: '#ccc',
    tabIconSelected: colorScheme === 'dark' ? '#fff' : '#2f95dc',
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
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
          title: '角色',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
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
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
