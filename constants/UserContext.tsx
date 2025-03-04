import React, { createContext, useState, useContext, useEffect } from 'react';
import { UserContextType } from './types';
import { User } from '@/shared/types';
import * as FileSystem from 'expo-file-system';

const UserContext = createContext<UserContextType | undefined>(undefined);

const DEFAULT_USER: User = {
  id: '1',
  avatar: undefined,
  name: undefined,
  settings: {
    self: {
      nickname: '',
      gender: 'other',
      description: '',
    },
    chat: {
      serverUrl: 'http://13.229.248.138/',
      characterApiKey: 'app-MYKZ2djh6FPb0bq7J6L3rCif',
      memoryApiKey: 'app-S1bQA9cgeKE4RXE4AluzdPUs',
      xApiKey: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      apiProvider: 'gemini',
    }
  }
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(DEFAULT_USER);

  // Load saved user data on mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userDataStr = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + 'user.json',
        { encoding: FileSystem.EncodingType.UTF8 }
      ).catch(() => JSON.stringify(DEFAULT_USER));

      const userData = JSON.parse(userDataStr);
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user data:', error);
      setUser(DEFAULT_USER);
    }
  };

  const saveUserData = async (userData: User) => {
    try {
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + 'user.json',
        JSON.stringify(userData),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  };

  const updateUser = async (newUser: User) => {
    setUser(newUser);
    await saveUserData(newUser);
  };

  const updateAvatar = async (avatar: string) => {
    if (user) {
      const updatedUser = { ...user, avatar };
      setUser(updatedUser);
      await saveUserData(updatedUser);
    }
  };

  // Save context reference
  useEffect(() => {
    globalUserContext = { user, updateUser };
    return () => {
      globalUserContext = null;
    };
  }, [user, updateUser]);

  return (
    <UserContext.Provider value={{ user, updateUser, updateAvatar }}>
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

// Keep track of the context globally to make it accessible without hooks
let globalUserContext: {
  user: User | null;
  updateUser: (user: User) => Promise<void>;
} | null = null;

export const getUserSettings = async (): Promise<User['settings'] | null> => {
  // First try to get from memory
  if (globalUserContext?.user?.settings) {
    return globalUserContext.user.settings;
  }

  // Otherwise try from storage
  try {
    const userDataStr = await FileSystem.readAsStringAsync(
      FileSystem.documentDirectory + 'user.json',
      { encoding: FileSystem.EncodingType.UTF8 }
    );
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      return userData.settings || null;
    }
  } catch (error) {
    console.error('[UserContext] Error getting user settings:', error);
  }

  return null;
};