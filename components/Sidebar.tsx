import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Animated, Alert, Image, ScrollView } from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { SidebarItemProps } from '@/constants/types';
import { LongPressGestureHandler, GestureHandlerRootView, HandlerStateChangeEvent, LongPressGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { useCharacters } from '@/constants/CharactersContext';
import { Character } from '@/shared/types';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIDEBAR_WIDTH_EXPANDED = 200;
const SIDEBAR_WIDTH_COLLAPSED = 0;

interface SideBarProps {
  isVisible: boolean;
  onClose: () => void;
  conversations: SidebarItemProps[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export default function SideBar({ isVisible, onClose, conversations, selectedConversationId, onSelectConversation }: SideBarProps) {
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH_EXPANDED)).current;
  const { characters, deleteCharacters } = useCharacters();
  const router = useRouter();

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : SIDEBAR_WIDTH_EXPANDED,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const handleDeleteConversation = (id: string) => {
    Alert.alert(
      "Delete Character",
      "Are you sure you want to delete this character and all associated conversations?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "OK", onPress: () => deleteCharacters([id]) }
      ],
      { cancelable: false }
    );
  };

  const handleSelectCharacter = async (character: Character) => {
    try {
      // Validate character data
      if (character.jsonData) {
        try {
          const data = JSON.parse(character.jsonData);
          if (!data.roleCard || !data.preset || !data.worldBook) {
            console.error('[Sidebar] Invalid character data:', {
              hasRoleCard: !!data.roleCard,
              hasPreset: !!data.preset,
              hasWorldBook: !!data.worldBook
            });
            Alert.alert('Error', 'Character data is invalid. Please try recreating this character.');
            return;
          }
        } catch (error) {
          console.error('[Sidebar] Failed to parse character data:', error);
          Alert.alert('Error', 'Could not parse character data. The character may be corrupted.');
          return;
        }
      }

      console.log(`[Sidebar] Selecting character: ${character.id} - ${character.name}`);
      
      // First save the conversation ID to AsyncStorage
      await AsyncStorage.setItem('lastConversationId', character.id);
      console.log(`[Sidebar] Saved lastConversationId to AsyncStorage: ${character.id}`);
      
      // Close sidebar immediately to improve UX
      onClose();
      
      // Directly call the onSelectConversation callback
      // This will handle all the state updating logic
      onSelectConversation(character.id);
      
      // Don't use router.setParams() here as it can create an infinite loop
      // The parent component will handle navigation
      
    } catch (error) {
      console.error('[Sidebar] Error selecting character:', error);
      Alert.alert('Error', 'Failed to switch to this character. Please try again.');
    }
  };

  return (
    <>
      {/* Overlay */}
      {isVisible && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        />
      )}
      
      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: slideAnim }],
            width: SIDEBAR_WIDTH_EXPANDED,
            right: 0,
            left: 'auto',
          },
        ]}
      >
        <ScrollView style={styles.scrollView}>
          {characters.map((character) => (
            <GestureHandlerRootView key={character.id} style={{marginBottom: 2}}>
              <LongPressGestureHandler
                onHandlerStateChange={(event: HandlerStateChangeEvent<LongPressGestureHandlerEventPayload>) => {
                  if (event.nativeEvent.state === 5) {
                    handleDeleteConversation(character.id);
                  }
                }}
                minDurationMs={500}
              >
                <Animated.View>
                  <TouchableOpacity
                    onPress={() => handleSelectCharacter(character)}
                    style={[
                      styles.contactItem,
                      selectedConversationId === character.id && styles.selectedContact
                    ]}
                  >
                    {character.avatar ? (
                      typeof character.avatar === 'string' ? (
                        <Image source={{ uri: character.avatar }} style={styles.contactAvatar} />
                      ) : (
                        <Image source={character.avatar} style={styles.contactAvatar} />
                      )
                    ) : (
                      <View style={styles.contactAvatarPlaceholder} />
                    )}
                    <Text style={styles.contactName} numberOfLines={1} ellipsizeMode="tail">
                      {character.name}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </LongPressGestureHandler>
            </GestureHandlerRootView>
          ))}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    position: 'absolute',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 30,
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: "rgba(0, 0, 0, 0.66)",
    padding: 30,
    zIndex: 200,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedContact: {
    backgroundColor: 'rgb(255, 224, 195)',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0)',
  },
  contactAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  contactAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginRight: 15,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
  contactName: {
    fontSize: 16,
    color: '#4A4A4A',
    flex: 1,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  }
});