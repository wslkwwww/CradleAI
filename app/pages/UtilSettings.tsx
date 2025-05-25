import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CharacterImporter } from '@/utils/CharacterImporter';
import { NodeSTCore } from '@/NodeST/nodest/core/node-st-core';
import { getApiSettings } from '@/utils/settings-helper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedGenerateContent } from '@/services/unified-api';

const ADAPTERS = [
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'OpenAI Compatible', value: 'openai-compatible' }
];

interface AutoMessagePromptConfig {
  inputText: string;
  presetJson: string;
  worldBookJson: string;
  adapterType: 'gemini' | 'openrouter' | 'openai-compatible';
  messageArray: any[];
  autoMessageInterval?: number; // 新增
}

interface MemorySummaryPromptConfig {
  inputText: string;
  presetJson: string;
  worldBookJson: string;
  adapterType: 'gemini' | 'openrouter' | 'openai-compatible';
  messageArray: any[];
}

interface MemoryServiceConfig {
  summaryThreshold: number;
  summaryLength: number;
  summaryRange: { start: number; end: number } | null;
}

const AUTO_MESSAGE_STORAGE_KEY = 'auto_message_prompt_config';
const MEMORY_SUMMARY_STORAGE_KEY = 'memory_summary_prompt_config';
const MEMORY_SERVICE_STORAGE_KEY = 'memory_service_config';
const IMAGEGEN_STORAGE_KEY = 'imagegen_prompt_config';

export default function UtilSettings() {
  const [activeTab, setActiveTab] = useState('autoMessage');
  
  // Auto Message states
  const [inputText, setInputText] = useState('[AUTO_MESSAGE] 用户已经一段时间没有回复了。请基于上下文和你的角色设定，主动发起一条合适的消息。这条消息应该自然，不要直接提及用户长时间未回复的事实。');
  const [presetJson, setPresetJson] = useState<string>('');
  const [worldBookJson, setWorldBookJson] = useState<string>('');
  const [adapterType, setAdapterType] = useState<'gemini' | 'openrouter' | 'openai-compatible'>('gemini');
  const [messageArray, setMessageArray] = useState<any[]>([]);
  const [autoMessageInterval, setAutoMessageInterval] = useState<number>(5); // 新增
  
  // Memory Summary states
  const [memoryInputText, setMemoryInputText] = useState('请对以下对话内容进行总结。你的总结应该：1. 提取关键信息、事件、讨论的话题和重要细节 2. 保持叙述的连续性，不使用模糊的引用 3. 保留角色意图、情感和提到的重要承诺或计划 4. 专注于事实和内容，而不是对话的元描述 5. 使总结对继续对话有帮助');
  const [memoryPresetJson, setMemoryPresetJson] = useState<string>('');
  const [memoryWorldBookJson, setMemoryWorldBookJson] = useState<string>('');
  const [memoryAdapterType, setMemoryAdapterType] = useState<'gemini' | 'openrouter' | 'openai-compatible'>('gemini');
  const [memoryMessageArray, setMemoryMessageArray] = useState<any[]>([]);
  
  // Image Generation states
  const [imagegenInputText, setImagegenInputText] = useState('[IMAGEGEN] 请根据recentMessages变量（最近10条对话）生成一句不超过15个英文单词的连贯语句，描述角色当前的表情、动作、场景（时间、地点、画面），不要描述外观、服饰。输出英文短句。');
  const [imagegenPresetJson, setImagegenPresetJson] = useState<string>('');
  const [imagegenWorldBookJson, setImagegenWorldBookJson] = useState<string>('');
  const [imagegenAdapterType, setImagegenAdapterType] = useState<'gemini' | 'openrouter' | 'openai-compatible'>('gemini');
  const [imagegenMessageArray, setImagegenMessageArray] = useState<any[]>([]);

  // Memory Service settings states
  const [memorySummaryThreshold, setMemorySummaryThreshold] = useState<number>(6000);
  const [memorySummaryLength, setMemorySummaryLength] = useState<number>(1000);
  const [memorySummaryRangeEnabled, setMemorySummaryRangeEnabled] = useState<boolean>(false);
  const [memorySummaryRangeStart, setMemorySummaryRangeStart] = useState<number>(3);
  const [memorySummaryRangeEnd, setMemorySummaryRangeEnd] = useState<number>(10);
  
  const [error, setError] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<string>('');
  const [apiLoading, setApiLoading] = useState(false);

  // 加载保存的配置
  useEffect(() => {
    loadSavedConfig();
    loadAdapterFromSettings();
  }, []);

  const loadSavedConfig = async () => {
    try {
      // Load auto message config
      const savedAuto = await AsyncStorage.getItem(AUTO_MESSAGE_STORAGE_KEY);
      if (savedAuto) {
        const config: AutoMessagePromptConfig = JSON.parse(savedAuto);
        setInputText(config.inputText || inputText);
        setPresetJson(config.presetJson || '');
        setWorldBookJson(config.worldBookJson || '');
        setAdapterType(config.adapterType || 'gemini');
        setMessageArray(config.messageArray || []);
        setAutoMessageInterval(config.autoMessageInterval ?? 5); // 新增
      }
      
      // Load memory summary config
      const savedMemory = await AsyncStorage.getItem(MEMORY_SUMMARY_STORAGE_KEY);
      if (savedMemory) {
        const config: MemorySummaryPromptConfig = JSON.parse(savedMemory);
        setMemoryInputText(config.inputText || memoryInputText);
        setMemoryPresetJson(config.presetJson || '');
        setMemoryWorldBookJson(config.worldBookJson || '');
        setMemoryAdapterType(config.adapterType || 'gemini');
        setMemoryMessageArray(config.messageArray || []);
      }
      
      // Load imagegen config
      const savedImagegen = await AsyncStorage.getItem(IMAGEGEN_STORAGE_KEY);
      if (savedImagegen) {
        const config: AutoMessagePromptConfig = JSON.parse(savedImagegen);
        setImagegenInputText(config.inputText || imagegenInputText);
        setImagegenPresetJson(config.presetJson || '');
        setImagegenWorldBookJson(config.worldBookJson || '');
        setImagegenAdapterType(config.adapterType || 'gemini');
        setImagegenMessageArray(config.messageArray || []);
      }
      
      // Load memory service config
      const savedMemoryService = await AsyncStorage.getItem(MEMORY_SERVICE_STORAGE_KEY);
      if (savedMemoryService) {
        const config: MemoryServiceConfig = JSON.parse(savedMemoryService);
        setMemorySummaryThreshold(config.summaryThreshold || 6000);
        setMemorySummaryLength(config.summaryLength || 1000);
        if (config.summaryRange) {
          setMemorySummaryRangeEnabled(true);
          setMemorySummaryRangeStart(config.summaryRange.start);
          setMemorySummaryRangeEnd(config.summaryRange.end);
        } else {
          setMemorySummaryRangeEnabled(false);
        }
      }
    } catch (e) {
      console.error('加载配置失败:', e);
    }
  };

  const loadAdapterFromSettings = async () => {
    try {
      const settings = getApiSettings();
      if (settings?.apiProvider) {
        const provider = settings.apiProvider.toLowerCase();
        let newAdapterType: 'gemini' | 'openrouter' | 'openai-compatible' = 'gemini';
        if (provider.includes('gemini')) {
          newAdapterType = 'gemini';
        } else if (provider.includes('openrouter')) {
          newAdapterType = 'openrouter';
        } else if (provider.includes('openai')) {
          newAdapterType = 'openai-compatible';
        }
        setAdapterType(newAdapterType);
        setMemoryAdapterType(newAdapterType);
        setImagegenAdapterType(newAdapterType);
      }
    } catch (e) {
      console.error('读取适配器设置失败:', e);
    }
  };

  const saveConfig = async () => {
    try {
      if (activeTab === 'autoMessage') {
        const config: AutoMessagePromptConfig = {
          inputText,
          presetJson,
          worldBookJson,
          adapterType,
          messageArray,
          autoMessageInterval // 新增
        };
        await AsyncStorage.setItem(AUTO_MESSAGE_STORAGE_KEY, JSON.stringify(config));
        Alert.alert('保存成功', '自动消息提示词配置已保存');
      } else if (activeTab === 'memorySummary') {
        const config: MemorySummaryPromptConfig = {
          inputText: memoryInputText,
          presetJson: memoryPresetJson,
          worldBookJson: memoryWorldBookJson,
          adapterType: memoryAdapterType,
          messageArray: memoryMessageArray
        };
        await AsyncStorage.setItem(MEMORY_SUMMARY_STORAGE_KEY, JSON.stringify(config));
        
        // Save memory service config
        const memoryServiceConfig: MemoryServiceConfig = {
          summaryThreshold: memorySummaryThreshold,
          summaryLength: memorySummaryLength,
          summaryRange: memorySummaryRangeEnabled ? {
            start: memorySummaryRangeStart,
            end: memorySummaryRangeEnd
          } : null
        };
        await AsyncStorage.setItem(MEMORY_SERVICE_STORAGE_KEY, JSON.stringify(memoryServiceConfig));
        
        Alert.alert('保存成功', '记忆总结提示词配置已保存');
      } else if (activeTab === 'imagegen') {
        const config: AutoMessagePromptConfig = {
          inputText: imagegenInputText,
          presetJson: imagegenPresetJson,
          worldBookJson: imagegenWorldBookJson,
          adapterType: imagegenAdapterType,
          messageArray: imagegenMessageArray
        };
        await AsyncStorage.setItem(IMAGEGEN_STORAGE_KEY, JSON.stringify(config));
        Alert.alert('保存成功', '图像生成提示词配置已保存');
      }
    } catch (e) {
      console.error('保存配置失败:', e);
      Alert.alert('保存失败', '无法保存配置');
    }
  };

  // 导入preset
  const handleImportPreset = async () => {
    setError('');
    try {
      const file = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (file.canceled || !file.assets?.[0]?.uri) return;
      const preset = await CharacterImporter.importPresetForCharacter(file.assets[0].uri, 'test');
      const presetStr = JSON.stringify(preset, null, 2);
      if (activeTab === 'autoMessage') {
        setPresetJson(presetStr);
      } else if (activeTab === 'memorySummary') {
        setMemoryPresetJson(presetStr);
      } else if (activeTab === 'imagegen') {
        setImagegenPresetJson(presetStr);
      }
    } catch (e: any) {
      setError('导入preset失败: ' + (e?.message || e));
    }
  };

  // 导入worldbook
  const handleImportWorldBook = async () => {
    setError('');
    try {
      const file = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (file.canceled || !file.assets?.[0]?.uri) return;
      const worldBook = await CharacterImporter.importWorldBookOnlyFromJson(file.assets[0].uri);
      const worldBookStr = JSON.stringify(worldBook, null, 2);
      if (activeTab === 'autoMessage') {
        setWorldBookJson(worldBookStr);
      } else if (activeTab === 'memorySummary') {
        setMemoryWorldBookJson(worldBookStr);
      } else if (activeTab === 'imagegen') {
        setImagegenWorldBookJson(worldBookStr);
      }
    } catch (e: any) {
      setError('导入worldbook失败: ' + (e?.message || e));
    }
  };

  // 生成消息数组
  const handleGenerateMessageArray = async () => {
    setError('');
    setIsLoading(true);
    try {
      let currentPreset = '', currentInput = '', currentAdapter: 'gemini' | 'openrouter' | 'openai-compatible' = 'gemini', currentWorldBook = '';
      if (activeTab === 'autoMessage') {
        currentPreset = presetJson;
        currentInput = inputText;
        currentAdapter = adapterType;
        currentWorldBook = worldBookJson;
      } else if (activeTab === 'memorySummary') {
        currentPreset = memoryPresetJson;
        currentInput = memoryInputText;
        currentAdapter = memoryAdapterType;
        currentWorldBook = memoryWorldBookJson;
      } else if (activeTab === 'imagegen') {
        currentPreset = imagegenPresetJson;
        currentInput = imagegenInputText;
        currentAdapter = imagegenAdapterType;
        currentWorldBook = imagegenWorldBookJson;
      }
      if (!currentPreset) {
        setError('请先导入preset');
        return;
      }
      const arr = await NodeSTCore.buildRFrameworkWithChatHistory(
        currentInput,
        currentPreset,
        currentAdapter,
        currentWorldBook || undefined
      );
      if (activeTab === 'autoMessage') {
        setMessageArray(arr);
      } else if (activeTab === 'memorySummary') {
        setMemoryMessageArray(arr);
      } else if (activeTab === 'imagegen') {
        setImagegenMessageArray(arr);
      }
    } catch (e: any) {
      setError('生成消息数组失败: ' + (e?.message || e));
    } finally {
      setIsLoading(false);
    }
  };

  // API测试
  const handleApiTest = async () => {
    setError('');
    setApiResponse('');
    setApiLoading(true);
    try {
      let currentMessageArray, currentAdapter;
      if (activeTab === 'autoMessage') {
        currentMessageArray = messageArray;
        currentAdapter = adapterType;
      } else if (activeTab === 'memorySummary') {
        currentMessageArray = memoryMessageArray;
        currentAdapter = memoryAdapterType;
      } else if (activeTab === 'imagegen') {
        currentMessageArray = imagegenMessageArray;
        currentAdapter = imagegenAdapterType;
      }
      if (!currentMessageArray || currentMessageArray.length === 0) {
        setError('请先生成消息数组');
        setApiLoading(false);
        return;
      }
      const apiSettings = getApiSettings();
      if (!currentAdapter) {
        throw new Error('Adapter type is not selected');
      }
      const options = {
        ...apiSettings,
        adapter: currentAdapter
      } as const;
      const resp = await unifiedGenerateContent(currentMessageArray, options);
      setApiResponse(typeof resp === 'string' ? resp : JSON.stringify(resp));
    } catch (e: any) {
      setError('API测试失败: ' + (e?.message || e));
    }
    setApiLoading(false);
  };

  // 点击结果区域，弹出全屏modal
  const handleResultPress = () => {
    const currentMessageArray = activeTab === 'autoMessage' ? messageArray : activeTab === 'memorySummary' ? memoryMessageArray : imagegenMessageArray;
    if (currentMessageArray && currentMessageArray.length > 0) setModalVisible(true);
  };

  const renderAutoMessageTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.title}>自动消息提示词配置</Text>
      
      <Text style={styles.label}>自动消息指令：</Text>
      <Text style={styles.hint}>
        注意：此指令将作为隐藏的用户消息发送给AI，不会在聊天界面显示，但会参与消息计数和上下文构建。
      </Text>
      <TextInput
        style={styles.input}
        value={inputText}
        onChangeText={setInputText}
        placeholder="请输入自动消息生成指令"
        multiline
      />

      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={handleImportPreset}>
          <Text style={styles.buttonText}>导入Preset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleImportWorldBook}>
          <Text style={styles.buttonText}>导入WorldBook</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>适配器类型：</Text>
      <View style={styles.row}>
        {ADAPTERS.map(a => (
          <TouchableOpacity
            key={a.value}
            style={[
              styles.adapterBtn,
              adapterType === a.value && styles.adapterBtnActive
            ]}
            onPress={() => setAdapterType(a.value as any)}
          >
            <Text style={{ color: adapterType === a.value ? '#fff' : '#333' }}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>自动消息发送间隔（分钟）：</Text>
      <TextInput
        style={[styles.input, { minHeight: 40 }]}
        value={autoMessageInterval.toString()}
        onChangeText={text => {
          const num = parseInt(text) || 1;
          setAutoMessageInterval(num);
        }}
        placeholder="5"
        keyboardType="numeric"
      />

      <TouchableOpacity 
        style={[styles.runBtn, isLoading && styles.runBtnDisabled]} 
        onPress={handleGenerateMessageArray}
        disabled={isLoading}
      >
        <Text style={styles.runBtnText}>
          {isLoading ? '生成中...' : '生成自动消息提示词消息数组'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.runBtn, { backgroundColor: '#e67e22', marginTop: 8 }, apiLoading && styles.runBtnDisabled]}
        onPress={handleApiTest}
        disabled={apiLoading}
      >
        <Text style={styles.runBtnText}>{apiLoading ? 'API测试中...' : 'API测试（发送到unified-api）'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveBtn} onPress={saveConfig}>
        <Text style={styles.saveBtnText}>保存配置</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {apiResponse ? (
        <>
          <Text style={styles.label}>API响应：</Text>
          <ScrollView style={styles.resultBox}>
            <Text selectable style={{ fontSize: 12 }}>{apiResponse}</Text>
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.label}>生成的消息数组：</Text>
      <TouchableOpacity activeOpacity={0.7} onPress={handleResultPress}>
        <ScrollView style={styles.resultBox}>
          <Text selectable style={{ fontSize: 12 }}>
            {JSON.stringify(messageArray, null, 2)}
          </Text>
          {messageArray && messageArray.length > 0 ? (
            <Text style={styles.fullscreenHint}>（点击可全屏查看）</Text>
          ) : null}
        </ScrollView>
      </TouchableOpacity>

      {/* 全屏Modal显示结果 */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>消息数组全屏查看</Text>
            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text selectable style={{ fontSize: 14 }}>
              {JSON.stringify(messageArray, null, 2)}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      <Text style={styles.label}>当前Preset：</Text>
      <ScrollView style={styles.resultBox}>
        <Text selectable style={{ fontSize: 12 }}>{presetJson}</Text>
      </ScrollView>

      <Text style={styles.label}>当前WorldBook：</Text>
      <ScrollView style={styles.resultBox}>
        <Text selectable style={{ fontSize: 12 }}>{worldBookJson}</Text>
      </ScrollView>
    </ScrollView>
  );

  const renderMemorySummaryTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.title}>记忆总结提示词配置</Text>
      
      <Text style={styles.label}>记忆总结指令：</Text>
      <TextInput
        style={styles.input}
        value={memoryInputText}
        onChangeText={setMemoryInputText}
        placeholder="请输入记忆总结生成指令"
        multiline
      />

      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={handleImportPreset}>
          <Text style={styles.buttonText}>导入Preset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleImportWorldBook}>
          <Text style={styles.buttonText}>导入WorldBook</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>适配器类型：</Text>
      <View style={styles.row}>
        {ADAPTERS.map(a => (
          <TouchableOpacity
            key={a.value}
            style={[
              styles.adapterBtn,
              memoryAdapterType === a.value && styles.adapterBtnActive
            ]}
            onPress={() => setMemoryAdapterType(a.value as any)}
          >
            <Text style={{ color: memoryAdapterType === a.value ? '#fff' : '#333' }}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Memory Service Settings */}
      <Text style={[styles.label, { marginTop: 20, fontSize: 16, color: '#2c3e50' }]}>记忆服务设置</Text>
      
      <Text style={styles.label}>总结阈值（字符数）：</Text>
      <TextInput
        style={[styles.input, { minHeight: 40 }]}
        value={memorySummaryThreshold.toString()}
        onChangeText={(text) => {
          const num = parseInt(text) || 0;
          setMemorySummaryThreshold(num);
        }}
        placeholder="6000"
        keyboardType="numeric"
      />

      <Text style={styles.label}>总结长度（字符数）：</Text>
      <TextInput
        style={[styles.input, { minHeight: 40 }]}
        value={memorySummaryLength.toString()}
        onChangeText={(text) => {
          const num = parseInt(text) || 0;
          setMemorySummaryLength(num);
        }}
        placeholder="1000"
        keyboardType="numeric"
      />

      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.adapterBtn,
            memorySummaryRangeEnabled && styles.adapterBtnActive
          ]}
          onPress={() => setMemorySummaryRangeEnabled(!memorySummaryRangeEnabled)}
        >
          <Text style={{ color: memorySummaryRangeEnabled ? '#fff' : '#333' }}>
            启用自定义总结区间
          </Text>
        </TouchableOpacity>
      </View>

      {memorySummaryRangeEnabled && (
        <View>
          <Text style={styles.label}>总结区间起始索引：</Text>
          <TextInput
            style={[styles.input, { minHeight: 40 }]}
            value={memorySummaryRangeStart.toString()}
            onChangeText={(text) => {
              const num = parseInt(text) || 0;
              setMemorySummaryRangeStart(num);
            }}
            placeholder="3"
            keyboardType="numeric"
          />

          <Text style={styles.label}>总结区间结束索引：</Text>
          <TextInput
            style={[styles.input, { minHeight: 40 }]}
            value={memorySummaryRangeEnd.toString()}
            onChangeText={(text) => {
              const num = parseInt(text) || 0;
              setMemorySummaryRangeEnd(num);
            }}
            placeholder="10"
            keyboardType="numeric"
          />
          
          <Text style={styles.hint}>
            提示：区间为 [{memorySummaryRangeStart}, {memorySummaryRangeEnd}]，将总结第{memorySummaryRangeStart + 1}到第{memorySummaryRangeEnd + 1}条消息
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.runBtn, isLoading && styles.runBtnDisabled]} 
        onPress={handleGenerateMessageArray}
        disabled={isLoading}
      >
        <Text style={styles.runBtnText}>
          {isLoading ? '生成中...' : '生成记忆总结提示词消息数组'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.runBtn, { backgroundColor: '#e67e22', marginTop: 8 }, apiLoading && styles.runBtnDisabled]}
        onPress={handleApiTest}
        disabled={apiLoading}
      >
        <Text style={styles.runBtnText}>{apiLoading ? 'API测试中...' : 'API测试（发送到unified-api）'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveBtn} onPress={saveConfig}>
        <Text style={styles.saveBtnText}>保存配置</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {apiResponse ? (
        <>
          <Text style={styles.label}>API响应：</Text>
          <ScrollView style={styles.resultBox}>
            <Text selectable style={{ fontSize: 12 }}>{apiResponse}</Text>
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.label}>生成的消息数组：</Text>
      <TouchableOpacity activeOpacity={0.7} onPress={handleResultPress}>
        <ScrollView style={styles.resultBox}>
          <Text selectable style={{ fontSize: 12 }}>
            {JSON.stringify(memoryMessageArray, null, 2)}
          </Text>
          {memoryMessageArray && memoryMessageArray.length > 0 ? (
            <Text style={styles.fullscreenHint}>（点击可全屏查看）</Text>
          ) : null}
        </ScrollView>
      </TouchableOpacity>

      {/* 全屏Modal显示结果 */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>消息数组全屏查看</Text>
            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text selectable style={{ fontSize: 14 }}>
              {JSON.stringify(memoryMessageArray, null, 2)}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      <Text style={styles.label}>当前Preset：</Text>
      <ScrollView style={styles.resultBox}>
        <Text selectable style={{ fontSize: 12 }}>{memoryPresetJson}</Text>
      </ScrollView>

      <Text style={styles.label}>当前WorldBook：</Text>
      <ScrollView style={styles.resultBox}>
        <Text selectable style={{ fontSize: 12 }}>{memoryWorldBookJson}</Text>
      </ScrollView>
    </ScrollView>
  );

  const renderImagegenTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.title}>图像生成提示词配置</Text>
      
      <Text style={styles.label}>图像生成指令：</Text>
      <TextInput
        style={styles.input}
        value={imagegenInputText}
        onChangeText={setImagegenInputText}
        placeholder="请输入图像生成提示词指令"
        multiline
      />

      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={handleImportPreset}>
          <Text style={styles.buttonText}>导入Preset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleImportWorldBook}>
          <Text style={styles.buttonText}>导入WorldBook</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>适配器类型：</Text>
      <View style={styles.row}>
        {ADAPTERS.map(a => (
          <TouchableOpacity
            key={a.value}
            style={[
              styles.adapterBtn,
              imagegenAdapterType === a.value && styles.adapterBtnActive
            ]}
            onPress={() => setImagegenAdapterType(a.value as any)}
          >
            <Text style={{ color: imagegenAdapterType === a.value ? '#fff' : '#333' }}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.runBtn, isLoading && styles.runBtnDisabled]} 
        onPress={handleGenerateMessageArray}
        disabled={isLoading}
      >
        <Text style={styles.runBtnText}>
          {isLoading ? '生成中...' : '生成图像生成提示词消息数组'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.runBtn, { backgroundColor: '#e67e22', marginTop: 8 }, apiLoading && styles.runBtnDisabled]}
        onPress={handleApiTest}
        disabled={apiLoading}
      >
        <Text style={styles.runBtnText}>{apiLoading ? 'API测试中...' : 'API测试（发送到unified-api）'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveBtn} onPress={saveConfig}>
        <Text style={styles.saveBtnText}>保存配置</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {apiResponse ? (
        <>
          <Text style={styles.label}>API响应：</Text>
          <ScrollView style={styles.resultBox}>
            <Text selectable style={{ fontSize: 12 }}>{apiResponse}</Text>
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.label}>生成的消息数组：</Text>
      <TouchableOpacity activeOpacity={0.7} onPress={handleResultPress}>
        <ScrollView style={styles.resultBox}>
          <Text selectable style={{ fontSize: 12 }}>
            {JSON.stringify(imagegenMessageArray, null, 2)}
          </Text>
          {imagegenMessageArray && imagegenMessageArray.length > 0 ? (
            <Text style={styles.fullscreenHint}>（点击可全屏查看）</Text>
          ) : null}
        </ScrollView>
      </TouchableOpacity>

      {/* 全屏Modal显示结果 */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>消息数组全屏查看</Text>
            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text selectable style={{ fontSize: 14 }}>
              {JSON.stringify(imagegenMessageArray, null, 2)}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      <Text style={styles.label}>当前Preset：</Text>
      <ScrollView style={styles.resultBox}>
        <Text selectable style={{ fontSize: 12 }}>{imagegenPresetJson}</Text>
      </ScrollView>

      <Text style={styles.label}>当前WorldBook：</Text>
      <ScrollView style={styles.resultBox}>
        <Text selectable style={{ fontSize: 12 }}>{imagegenWorldBookJson}</Text>
      </ScrollView>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'autoMessage' && styles.activeTab]}
          onPress={() => setActiveTab('autoMessage')}
        >
          <Text style={[styles.tabText, activeTab === 'autoMessage' && styles.activeTabText]}>
            自动消息提示词
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'memorySummary' && styles.activeTab]}
          onPress={() => setActiveTab('memorySummary')}
        >
          <Text style={[styles.tabText, activeTab === 'memorySummary' && styles.activeTabText]}>
            记忆总结提示词
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'imagegen' && styles.activeTab]}
          onPress={() => setActiveTab('imagegen')}
        >
          <Text style={[styles.tabText, activeTab === 'imagegen' && styles.activeTabText]}>
            图像生成提示词
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'autoMessage' && renderAutoMessageTab()}
      {activeTab === 'memorySummary' && renderMemorySummaryTab()}
      {activeTab === 'imagegen' && renderImagegenTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbfc' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4a90e2',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#4a90e2',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  label: { marginTop: 12, fontWeight: 'bold' },
  input: {
    borderWidth: 1, 
    borderColor: '#ccc', 
    borderRadius: 6, 
    padding: 8, 
    minHeight: 60, 
    backgroundColor: '#fff'
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  button: {
    backgroundColor: '#4a90e2', 
    padding: 8, 
    borderRadius: 6, 
    marginRight: 10
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  adapterBtn: {
    borderWidth: 1, 
    borderColor: '#4a90e2', 
    borderRadius: 6, 
    padding: 8, 
    marginRight: 10, 
    backgroundColor: '#fff'
  },
  adapterBtnActive: { backgroundColor: '#4a90e2' },
  runBtn: {
    marginTop: 16, 
    backgroundColor: '#27ae60', 
    padding: 12, 
    borderRadius: 6, 
    alignItems: 'center'
  },
  runBtnDisabled: {
    backgroundColor: '#95a5a6',
  },
  runBtnText: { color: '#fff', fontWeight: 'bold' },
  saveBtn: {
    marginTop: 12,
    backgroundColor: '#f39c12',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center'
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  error: { color: 'red', marginTop: 8 },
  resultBox: {
    backgroundColor: '#f5f5f5', 
    borderRadius: 6, 
    padding: 8, 
    marginTop: 6, 
    maxHeight: 180
  },
  fullscreenHint: {
    color: '#888', 
    fontSize: 11, 
    marginTop: 6, 
    textAlign: 'center'
  },
  modalContainer: {
    flex: 1, 
    backgroundColor: '#fff'
  },
  modalHeader: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingTop: 40, 
    paddingBottom: 12, 
    backgroundColor: '#4a90e2'
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalClose: { color: '#fff', fontSize: 16, padding: 4 },
  modalContent: { flex: 1, padding: 16 },
  hint: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic'
  }
});
