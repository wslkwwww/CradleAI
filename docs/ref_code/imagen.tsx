import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header (Just the background and some basic icons - doesn't need full functionality) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>图片生成</Text>
      </View>

      {/* Content Area (Placeholder) */}
      <View style={styles.content}>
        {/* Role Selection Buttons */}
        <View style={styles.roleButtonsContainer}>
          <TouchableOpacity style={styles.roleButton}>
            <Text style={styles.roleButtonText}>选角色</Text>
          </TouchableOpacity>
        </View>

        {/* Placeholder for the Image/Character Display */}
        <View style={styles.imagePlaceholder}>
          {/* This would be the actual character/image area */}
        </View>
      </View>


      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Ratio Buttons */}
        <View style={styles.ratioButtonsContainer}>
          <TouchableOpacity style={styles.ratioButton}>
            <Text style={styles.ratioButtonText}>3:4</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ratioButton}>
            <Text style={styles.ratioButtonText}>9:16</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ratioButton}>
            <Text style={styles.ratioButtonText}>1:1</Text>
          </TouchableOpacity>
        </View>

        {/* Input Buttons */}
        <View style={styles.inputButtonsContainer}>
          <TouchableOpacity style={styles.inputButton}>
            <Text style={styles.inputButtonText}>自由输入</Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* Bottom "元素"  */}
      <View style={styles.elementBar}>
        <Text style={styles.elementBarTitle}>元素</Text>

        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.elementList}>
          {/* Element Items - Just placeholders for now */}
          <TouchableOpacity style={styles.elementItem}>
            <Text style={styles.elementItemText}>风格库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.elementItem}>
            <Text style={styles.elementItemText}>表情</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.elementItem}>
            <Text style={styles.elementItemText}>动作</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.elementItem}>
            <Text style={styles.elementItemText}>场景</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.elementItem}>
            <Text style={styles.elementItemText}>服饰</Text>
          </TouchableOpacity>
          {/* Add more element items as needed */}
        </ScrollView>

        {/* Generate Button */}
        <TouchableOpacity style={styles.generateButton}>
          <Text style={styles.generateButtonText}>生成</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A3A34', // Background color from image
  },
  header: {
    backgroundColor: '#4A3A34', // Background color
    paddingTop: 10, // SafeAreaView will add extra padding on iOS
    paddingBottom: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  roleButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'spaceEvenly',
    marginBottom: 20,
  },
  roleButton: {
    backgroundColor: '#6F5A51', // Slightly darker background
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  roleButtonText: {
    color: 'white',
    fontSize: 16,
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#8B786D', // A different shade to suggest an image area
    borderRadius: 10,
    marginBottom: 20,
  },
  bottomControls: {
    paddingHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'spaceAround',
    alignItems: 'center',
  },
  ratioButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratioButton: {
    backgroundColor: '#6F5A51',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 5,
  },
  ratioButtonText: {
    color: 'white',
    fontSize: 14,
  },
  inputButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputButton: {
    backgroundColor: '#E39665',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginLeft: 5,
  },
  inputButtonText: {
    color: 'white',
    fontSize: 16,
  },
  elementBar: {
    backgroundColor: '#54433C', // Darker background for bottom bar
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  elementBarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  elementList: {
    flexDirection: 'row',
  },
  elementItem: {
    backgroundColor: '#6F5A51',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
  },
  elementItemText: {
    color: 'white',
    fontSize: 14,
  },
  generateButton: {
    backgroundColor: '#E39665',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 15,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});