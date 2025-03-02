import { useCallback, useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCharacters } from '@/constants/CharactersContext';

export default function Index() {
  const { characters } = useCharacters();
  const router = useRouter();

  const navigateToLastConversation = useCallback(async () => {
    try {
      const lastConversationId = await AsyncStorage.getItem('lastConversationId');
      if (lastConversationId) {
        const character = characters.find(char => char.id === lastConversationId);
        if (character) {
          router.replace({
            pathname: '/(tabs)',
            params: { characterId: lastConversationId }
          });
          return;
        }
      }
      
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error navigating to last conversation:', error);
      router.replace('/(tabs)');
    }
  }, [characters, router]);

  useEffect(() => {
    navigateToLastConversation();
  }, [navigateToLastConversation]);

  return <Redirect href="/(tabs)" />;
}
