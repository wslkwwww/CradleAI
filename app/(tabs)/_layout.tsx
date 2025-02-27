// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router/tabs';
import { FontAwesome } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams } from 'expo-router';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -7 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { hideTabBar } = useLocalSearchParams<{ hideTabBar?: string }>();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'dark'].tint,
        tabBarStyle: {
          // Hide tab bar when keyboard is visible
          display: hideTabBar === 'true' ? 'none' : 'flex',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title:"",
          tabBarIcon: ({ color }) => <TabBarIcon name="comment" color= "rgb(255, 224, 195)" />,
          headerShown: false,
          headerTitle: ""
        }}
      />
      <Tabs.Screen
        name="Character"
        options={{
          title:"",
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color="rgb(255, 224, 195)" />,
           headerShown: false,
           headerTitle: ""
        }}
      />
            <Tabs.Screen
        name="cradle"
        options={{
          title:"",
          tabBarIcon: ({ color }) => <TabBarIcon name="heart" color="rgb(255, 224, 195)" />,
          headerShown: false,
          headerTitle: ""
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title:"",
          tabBarIcon: ({ color }) => <TabBarIcon name="wpexplorer" color="rgb(255, 224, 195)" />,
          headerShown: false,
          headerTitle: ""
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          title:"",
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color="rgb(255, 224, 195)" />,
          headerShown: false,
          headerTitle: ""
        }}
      />

    </Tabs>
  );
}
