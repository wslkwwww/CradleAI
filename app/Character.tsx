import React, { useEffect, useRef, useState } from 'react';
import { Animated, SafeAreaView, StatusBar, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCharacters } from '@/constants/CharactersContext';
import CradleStatusBadge from '@/components/CradleStatusBadge';
import { Character } from '@/shared/types';

const HEADER_MAX_HEIGHT = 200;
const HEADER_MIN_HEIGHT = 60;

const CharacterScreen = () => {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const { characters } = useCharacters();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(HEADER_MAX_HEIGHT);

  // Load character data
  useEffect(() => {
    if (characterId) {
      const foundCharacter = characters.find(c => c.id === characterId);
      setCharacter(foundCharacter || null);
      setLoading(false);
    }
  }, [characterId, characters]);

  useEffect(() => {
    // Calculate header height based on content
    const headerHeightListener = scrollY.addListener(({ value }) => {
      setHeaderHeight(Math.max(HEADER_MIN_HEIGHT, HEADER_MAX_HEIGHT - value));
    });

    return () => {
      scrollY.removeListener(headerHeightListener);
    };
  }, [scrollY]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#212121" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!character) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#212121" />
        <Text style={styles.errorText}>Character not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#212121" />
      
      {/* Character Header */}
      <Animated.View 
        style={[
          styles.header,
          { height: headerHeight }
        ]}
      >
        {/* Header background */}
        {character.backgroundImage && (
          <Animated.Image
            source={{ uri: character.backgroundImage }}
            style={styles.headerBackground}
            resizeMode="cover"
          />
        )}
        
        {/* Dark overlay */}
        <View style={styles.headerOverlay} />
        
        {/* Character info */}
        <View style={styles.characterInfo}>
          <Text style={styles.characterName}>{character.name}</Text>
          <Text style={styles.characterDescription} numberOfLines={2}>
            {character.description || 'No description'}
          </Text>
        </View>
      </Animated.View>
      
      {/* Add Cradle Status Badge if character is in cradle system */}
      {character && <CradleStatusBadge characterId={character.id} />}
      
      {/* Character content */}
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        style={styles.scrollView}
      >
        {/* Character details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>{character.description || 'No description available'}</Text>
        </View>
        
        {/* Personality */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personality</Text>
          <Text style={styles.sectionText}>{character.personality || 'Not specified'}</Text>
        </View>
        
        {/* Interests */}
        {character.interests && character.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestContainer}>
              {character.interests.map((interest, index) => (
                <View key={index} style={styles.interestBadge}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 10,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  characterInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  characterName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  characterDescription: {
    fontSize: 14,
    color: '#ddd',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  scrollView: {
    flex: 1,
    marginTop: HEADER_MAX_HEIGHT,
  },
  section: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#333',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionText: {
    color: '#ddd',
    lineHeight: 20,
  },
  interestContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestBadge: {
    backgroundColor: 'rgba(74, 144, 226, 0.3)',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
    margin: 4,
  },
  interestText: {
    color: '#4A90E2',
    fontSize: 14,
  },
});

export default CharacterScreen;
