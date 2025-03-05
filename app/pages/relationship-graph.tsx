import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  StatusBar,
  SafeAreaView,
  Platform,
  Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCharacters } from '@/constants/CharactersContext';
import { Character } from '@/shared/types';
import { RelationshipService } from '@/services/relationship-service';
import { Relationship, RelationshipType } from '@/shared/types/relationship-types';
import { RelationshipPromptService } from '@/services/relationship-prompt-service';
import { useUser } from '@/constants/UserContext';
import RelationshipGraph from '@/components/RelationshipGraph';
import CharacterSelector from '@/components/CharacterSelector';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Color mapping for relationship types
const COLOR_MAP: Record<RelationshipType, string> = {
  'enemy': '#FF4444',
  'rival': '#FF7744',
  'stranger': '#AAAAAA',
  'acquaintance': '#88AAFF',
  'colleague': '#44AAFF',
  'friend': '#44DDFF',
  'close_friend': '#44FFDD',
  'best_friend': '#44FF88',
  'family': '#DDFF44',
  'crush': '#FF88DD',
  'lover': '#FF44AA',
  'partner': '#FF4488',
  'ex': '#FF8888',
  'mentor': '#DDAA44',
  'student': '#AA88FF',
  'admirer': '#FF88AA',
  'idol': '#FFAA44'
};

const RelationshipGraphPage = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { characters, updateCharacter } = useCharacters();
  const { user } = useUser();

  // State variables
  const [loading, setLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(id || null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isNewRelationshipModalVisible, setIsNewRelationshipModalVisible] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  
  // Edit form state
  const [editedStrength, setEditedStrength] = useState('0');
  const [editedType, setEditedType] = useState<RelationshipType>('acquaintance');
  const [editedDescription, setEditedDescription] = useState('');
  
  // New relationship form state
  const [newTargetCharacterId, setNewTargetCharacterId] = useState<string | null>(null);
  
  useEffect(() => {
    if (characters.length > 0) {
      // If we have a specific ID, use that
      if (id) {
        const character = characters.find(c => c.id === id);
        if (character) {
          setSelectedCharacterId(id);
          setSelectedCharacter(character);
        } else {
          // If character not found, pick first with relationships enabled
          const characterWithRelationships = characters.find(c => c.relationshipEnabled);
          if (characterWithRelationships) {
            setSelectedCharacterId(characterWithRelationships.id);
            setSelectedCharacter(characterWithRelationships);
          }
        }
      } else {
        // No ID provided, pick first with relationships enabled
        const characterWithRelationships = characters.find(c => c.relationshipEnabled);
        if (characterWithRelationships) {
          setSelectedCharacterId(characterWithRelationships.id);
          setSelectedCharacter(characterWithRelationships);
        }
      }
      setLoading(false);
    }
  }, [characters, id]);

  // Set up selected relationship details when changed
  useEffect(() => {
    if (selectedRelationshipId && selectedCharacter?.relationshipMap?.relationships) {
      const relationship = selectedCharacter.relationshipMap.relationships[selectedRelationshipId];
      if (relationship) {
        setEditedStrength(relationship.strength.toString());
        setEditedType(relationship.type);
        setEditedDescription(relationship.description);
      }
    }
  }, [selectedRelationshipId, selectedCharacter]);

  // Handle character selection
  const handleSelectCharacter = useCallback((characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (character) {
      setSelectedCharacterId(characterId);
      setSelectedCharacter(character);
      setSelectedRelationshipId(null); // Reset selected relationship when character changes
    }
  }, [characters]);

  // Handle relationship selection
  const handleSelectRelationship = useCallback((relationshipId: string) => {
    setSelectedRelationshipId(relationshipId);
    setIsEditModalVisible(true);
  }, []);

  // Handle relationship update