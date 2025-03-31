import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { theme } from '@/constants/theme';

interface VoiceSelectorProps {
  selectedGender: 'male' | 'female';
  selectedTemplate: string | undefined;
  onSelectGender: (gender: 'male' | 'female') => void;
  onSelectTemplate: (templateId: string) => void;
}

interface VoiceTemplate {
  id: string;
  gender: 'male' | 'female';
  transcript: string;
  audioSource: any; // Use any for require() audio source
  isLoading: boolean;
  error: string | null;
}

type TemplateId = 'template1' | 'template2' | 'template3';
type TranscriptType = Record<TemplateId, string>;

// Define sample transcripts since we can't dynamically load text files
const SAMPLE_TRANSCRIPTS: Record<'male' | 'female', TranscriptType> = {
  male: {
    template1: "Hello, I am a male voice assistant. How can I help you today?",
    template2: "Welcome to our service. I'm here to provide information and assistance.",
    template3: "Greetings! I'm your AI companion. Feel free to ask me anything."
  },
  female: {
    template1: "Hi there! I'm your female voice assistant. What can I do for you?",
    template2: "Welcome! I'm happy to assist you with any questions or tasks.",
    template3: "Hello! I'm here to help make your experience better. What do you need?"
  }
};

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
  selectedGender, 
  selectedTemplate, 
  onSelectGender,
  onSelectTemplate 
}) => {
  const [templates, setTemplates] = useState<VoiceTemplate[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingTemplateId, setPlayingTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize audio
  useEffect(() => {
    return sound
      ? () => {
          console.log('Unloading Sound');
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Load templates based on gender selection
  useEffect(() => {
    loadTemplates(selectedGender);
  }, [selectedGender]);

  const loadTemplates = (gender: 'male' | 'female') => {
    setIsLoading(true);
    
    try {
      // Define template IDs based on gender
      const templateIds = gender === 'male' 
        ? ['template1', 'template2', 'template3'] 
        : ['template1', 'template2', 'template3'];
      
      // Create templates with static audio sources
      const loadedTemplates = templateIds.map(id => {
        // For display ID, add 'a' suffix for female templates
        const displayId = gender === 'female' ? `${id}a` : id;
        
        // Get transcript from predefined samples
        const transcript = SAMPLE_TRANSCRIPTS[gender][id as TemplateId] || 
          `Sample voice for ${gender === 'male' ? 'male' : 'female'} template ${id}`;
        
        // Set audio source based on gender and template ID
        let audioSource;
        try {
          // This will throw an error if the asset doesn't exist
          if (gender === 'male') {
            if (id === 'template1') {
              audioSource = require('@/assets/tts-audio/templates/male/template1/source_audio.mp3');
            } else if (id === 'template2') {
              audioSource = require('@/assets/tts-audio/templates/male/template2/source_audio.mp3');
            } else if (id === 'template3') {
              audioSource = require('@/assets/tts-audio/templates/male/template3/source_audio.mp3');
            }
          } else {
            if (id === 'template1') {
              audioSource = require('@/assets/tts-audio/templates/female/template1/source_audio.mp3');
            } else if (id === 'template2') {
              audioSource = require('@/assets/tts-audio/templates/female/template2/source_audio.mp3');
            } else if (id === 'template3') {
              audioSource = require('@/assets/tts-audio/templates/female/template3/source_audio.mp3');
            }
          }
        } catch (error) {
          console.warn(`Audio file not found for ${gender}/${id}:`, error);
          audioSource = null;
        }
        
        return {
          id: displayId,
          gender,
          transcript,
          audioSource,
          isLoading: false,
          error: audioSource ? null : 'Audio file not found'
        };
      });
      
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Error loading voice templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playSound = async (templateId: string, audioSource: any) => {
    // Stop currently playing sound
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    
    if (!audioSource) {
      console.error('No audio source provided');
      return;
    }
    
    try {
      setPlayingTemplateId(templateId);
      
      // Load and play sound using the direct asset reference
      const { sound: newSound } = await Audio.Sound.createAsync(
        audioSource,
        { shouldPlay: true }
      );
      
      setSound(newSound);
      
      // When sound finishes playing
      newSound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingTemplateId(null);
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
      setPlayingTemplateId(null);
    }
  };

  const renderTemplateItem = ({ item }: { item: VoiceTemplate }) => {
    const isSelected = selectedTemplate === item.id;
    const isPlaying = playingTemplateId === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.templateItem,
          isSelected && styles.selectedTemplateItem
        ]}
        onPress={() => onSelectTemplate(item.id)}
      >
        <View style={styles.templateHeader}>
          <Text style={[
            styles.templateTitle,
            isSelected && styles.selectedTemplateTitle
          ]}>
            Voice {item.id.replace(/template/i, '')}
          </Text>
          
          {/* Play button */}
          {item.audioSource ? (
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => playSound(item.id, item.audioSource)}
              disabled={isPlaying}
            >
              {isPlaying ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons 
                  name="play-circle" 
                  size={28} 
                  color={isSelected ? theme.colors.primary : "#aaa"} 
                />
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.errorText}>Audio unavailable</Text>
          )}
        </View>
        
        {/* Transcript display */}
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptText}>"{item.transcript}"</Text>
        </View>
        
        {/* Error display */}
        {item.error && (
          <Text style={styles.errorText}>{item.error}</Text>
        )}
        
        {/* Selection indicator */}
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>角色声线</Text>
      
      {/* Gender selection */}
      <View style={styles.genderSelector}>
        <TouchableOpacity
          style={[
            styles.genderButton,
            selectedGender === 'male' && styles.selectedGender
          ]}
          onPress={() => onSelectGender('male')}
        >
          <Ionicons 
            name="male" 
            size={20} 
            color={selectedGender === 'male' ? '#fff' : '#aaa'} 
          />
          <Text style={[
            styles.genderText,
            selectedGender === 'male' && styles.selectedGenderText
          ]}>
            男性声线
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.genderButton,
            selectedGender === 'female' && styles.selectedGender
          ]}
          onPress={() => onSelectGender('female')}
        >
          <Ionicons 
            name="female" 
            size={20} 
            color={selectedGender === 'female' ? '#fff' : '#aaa'} 
          />
          <Text style={[
            styles.genderText,
            selectedGender === 'female' && styles.selectedGenderText
          ]}>
            女性声线
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Template list */}
      <View style={styles.templateListContainer}>
        <Text style={styles.listTitle}>选择声音样本</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>正在加载声音样本...</Text>
          </View>
        ) : templates.length === 0 ? (
          <Text style={styles.emptyText}>未找到声音样本</Text>
        ) : (
          <FlatList
            data={templates}
            renderItem={renderTemplateItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.templateList}
          />
        )}
      </View>
      
      {/* Selected voice information */}
      {selectedTemplate && (
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedInfoText}>
            已选择: {selectedGender === 'male' ? '男性' : '女性'}声线 - 
            Voice {selectedTemplate.replace(/template/i, '')}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  genderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    marginHorizontal: 4,
  },
  selectedGender: {
    backgroundColor: theme.colors.primaryDark,
  },
  genderText: {
    color: '#aaa',
    marginLeft: 8,
  },
  selectedGenderText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  templateListContainer: {
    flex: 1,
    marginTop: 16,
  },
  listTitle: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 12,
  },
  templateList: {
    paddingBottom: 16,
  },
  templateItem: {
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  selectedTemplateItem: {
    backgroundColor: 'rgba(255, 224, 195, 0.1)',
    borderColor: theme.colors.primary,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  selectedTemplateTitle: {
    color: theme.colors.primary,
  },
  playButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  transcriptText: {
    color: '#ddd',
    fontStyle: 'italic',
    fontSize: 14,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  selectedInfo: {
    backgroundColor: 'rgba(224, 196, 168, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  selectedInfoText: {
    color: theme.colors.primary,
    textAlign: 'center',
  },
});

export default VoiceSelector;
