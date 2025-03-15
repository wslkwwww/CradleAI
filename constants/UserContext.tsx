import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, GlobalSettings } from '@/shared/types';

interface UserContextProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  updateSettings: (settings: Partial<GlobalSettings>) => Promise<void>;
  loading: boolean;
  updateAvatar: (uri: string) => Promise<void>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
          
          // Also store to localStorage for web compatibility
          try {
            localStorage.setItem('user_settings', JSON.stringify(JSON.parse(userData).settings));
          } catch (error) {
            console.warn('Could not save to localStorage', error);
          }
        } else {
          // Initialize with default settings
          const defaultUser: User = {
            id: 'user-1',
            name: 'User',
            avatar: null as any,
            settings: {
              app: {
                darkMode: true,
                autoSave: true,
                notifications: {
                  enabled: false
                }
              },
              chat: {
                typingDelay: 300,
                serverUrl: '',
                characterApiKey: '',
                memoryApiKey: '',
                xApiKey: '',
                apiProvider: 'gemini',
                temperature: 0.7,
                maxTokens: 800,
                maxtokens: 800,
                openrouter: {
                  enabled: false,
                  apiKey: '',
                  model: 'openai/gpt-3.5-turbo',
                  useBackupModels: false,
                  backupModels: [],
                  autoRoute: false,
                  sortingStrategy: 'price',
                  dataCollection: true,
                  ignoredProviders: []
                }
              },
              self: {
                nickname: 'Me',
                gender: 'other',
                description: ''
              }
            }
          };
          setUser(defaultUser);
          await AsyncStorage.setItem('user', JSON.stringify(defaultUser));
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const updateAvatar = async (uri: string): Promise<void> => {
    if (!user) return;
    
    const updatedUser = {
      ...user,
      avatar: uri
    };
    setUser(updatedUser);
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const updateSettings = async (settings: Partial<GlobalSettings>) => {
    if (!user) return;

    try {
      if (!user.settings) throw new Error('User settings not initialized');
      
      const updatedUser = {
        ...user,
        settings: {
          ...user.settings,
          app: {
            ...user.settings.app,
            ...settings.app
          },
          chat: {
            ...user.settings.chat,
            ...settings.chat
          },
          self: {
            ...user.settings.self,
            ...settings.self
          }
        }
      };

      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Also update localStorage for direct access by services
      try {
        localStorage.setItem('user_settings', JSON.stringify(updatedUser.settings));
      } catch (error) {
        console.warn('Could not save to localStorage', error);
      }
      
      console.log('[UserContext] Settings updated successfully, apiProvider:', 
        updatedUser.settings.chat.apiProvider);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw new Error('Failed to update settings');
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      setUser, 
      updateSettings, 
      loading,
      updateAvatar 
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};