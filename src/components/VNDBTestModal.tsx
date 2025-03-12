import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ToastAndroid,
} from 'react-native';
import { defaultClient as vndb } from '@/src/services/vndb';
import { CharacterQueryOptions, VNDBCharacter } from '@/src/services/vndb/types';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface VNDBTestModalProps {
  visible: boolean;
  onClose: () => void;
}

const VNDBTestModal: React.FC<VNDBTestModalProps> = ({ visible, onClose }) => {
  // 状态管理
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [results, setResults] = useState<VNDBCharacter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queryType, setQueryType] = useState<'search' | 'id'>('search');
  const [advancedOptions, setAdvancedOptions] = useState<Partial<CharacterQueryOptions>>({
    results: 5,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 添加日志
  const addLog = (message: string) => {
    setLogMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // 重置结果
  const resetResults = () => {
    setResults([]);
    setError(null);
    setLogMessages([]);
  };

  // 处理查询
  const handleQuery = async () => {
    resetResults();
    setIsLoading(true);
    addLog('开始查询...');

    try {
      if (queryType === 'search' && searchTerm) {
        addLog(`执行搜索查询: "${searchTerm}"`);
        const response = await vndb.searchCharacters(searchTerm, advancedOptions);
        setResults(response.results);
        addLog(`查询完成，找到 ${response.results.length} 个角色`);
      } else if (queryType === 'id' && characterId) {
        addLog(`执行ID查询: "${characterId}"`);
        const character = await vndb.getCharacterById(characterId);
        if (character) {
          setResults([character]);
          addLog(`查询完成，找到角色: ${character.name}`);
        } else {
          setResults([]);
          addLog(`未找到ID为 ${characterId} 的角色`);
        }
      } else {
        setError('请输入有效的搜索词或角色ID');
        addLog('查询失败: 缺少必要参数');
      }
    } catch (err: any) {
      setError(err.message || '查询过程中发生错误');
      addLog(`查询失败: ${err.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 更新高级选项
  const updateAdvancedOption = (key: keyof CharacterQueryOptions, value: any) => {
    setAdvancedOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 保存结果到JSON文件
  const saveResultsToJson = async () => {
    if (results.length === 0) {
      addLog('没有查询结果可以保存');
      if (Platform.OS === 'android') {
        ToastAndroid.show('没有查询结果可以保存', ToastAndroid.SHORT);
      } else {
        Alert.alert('提示', '没有查询结果可以保存');
      }
      return;
    }

    try {
      setIsSaving(true);
      addLog('正在保存查询结果...');
      
      // 创建一个包含查询信息的结果对象
      const resultData = {
        query: {
          type: queryType,
          searchTerm: queryType === 'search' ? searchTerm : characterId,
          options: advancedOptions,
        },
        timestamp: new Date().toISOString(),
        count: results.length,
        results: results
      };
      
      // 创建文件名
      const fileName = `vndb-${queryType}-${Date.now()}.json`;
      
      // 确定文件保存路径
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      // 将对象转换为JSON字符串并保存
      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(resultData, null, 2), 
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      addLog(`查询结果已保存到: ${filePath}`);
      
      // 检查是否可以分享
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        // 分享文件
        await Sharing.shareAsync(filePath);
        addLog('已打开分享选项');
      } else {
        if (Platform.OS === 'android') {
          ToastAndroid.show(`结果已保存至: ${filePath}`, ToastAndroid.LONG);
        } else {
          Alert.alert('保存成功', `结果已保存至: ${filePath}`);
        }
      }
    } catch (error: any) {
      const errorMsg = `保存失败: ${error.message || '未知错误'}`;
      addLog(errorMsg);
      setError(errorMsg);
      
      if (Platform.OS === 'android') {
        ToastAndroid.show(errorMsg, ToastAndroid.LONG);
      } else {
        Alert.alert('错误', errorMsg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 渲染角色结果
  const renderCharacterResult = (character: VNDBCharacter, index: number) => {
    return (
      <View key={index} style={styles.resultItem}>
        <Text style={styles.resultTitle}>
          {character.name} {character.original ? `(${character.original})` : ''}
        </Text>
        
        {character.image?.url && (
          <View style={styles.imageContainer}>
            <Text style={styles.resultSubtext}>图片: {character.image.url.substring(0, 30)}...</Text>
          </View>
        )}
        
        {character.description && (
          <Text style={styles.resultDescription} numberOfLines={3}>
            {character.description.replace(/\[.*?\]/g, '')}
          </Text>
        )}
        
        <View style={styles.resultInfo}>
          {character.sex && (
            <Text style={styles.resultInfoItem}>
              性别: {character.sex[0] === 'm' ? '男' : 
                    character.sex[0] === 'f' ? '女' : 
                    character.sex[0] === 'b' ? '双性' : '未知'}
            </Text>
          )}
          
          {character.blood_type && (
            <Text style={styles.resultInfoItem}>血型: {character.blood_type.toUpperCase()}</Text>
          )}
          
          {character.age !== null && character.age !== undefined && (
            <Text style={styles.resultInfoItem}>年龄: {character.age}</Text>
          )}
          
          {character.height && (
            <Text style={styles.resultInfoItem}>身高: {character.height}cm</Text>
          )}
        </View>
        
        {character.vns && character.vns.length > 0 && (
          <View style={styles.vnsContainer}>
            <Text style={styles.resultSubtext}>
              出现在 {character.vns.length} 部作品中，角色定位: 
              {character.vns.map(vn => 
                vn.role === 'main' ? '主角' : 
                vn.role === 'primary' ? '主要角色' : 
                vn.role === 'side' ? '配角' : '出场'
              ).filter((v, i, a) => a.indexOf(v) === i).join('/')}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>VNDB 角色查询测试</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.queryTypeSelector}>
            <TouchableOpacity
              style={[styles.queryTypeButton, queryType === 'search' && styles.activeQueryType]}
              onPress={() => setQueryType('search')}
            >
              <Text style={[styles.queryTypeText, queryType === 'search' && styles.activeQueryTypeText]}>
                搜索名称
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.queryTypeButton, queryType === 'id' && styles.activeQueryType]}
              onPress={() => setQueryType('id')}
            >
              <Text style={[styles.queryTypeText, queryType === 'id' && styles.activeQueryTypeText]}>
                按ID查询
              </Text>
            </TouchableOpacity>
          </View>

          {queryType === 'search' ? (
            <TextInput
              style={styles.input}
              placeholder="输入角色名称搜索 (例如: Saber)"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          ) : (
            <TextInput
              style={styles.input}
              placeholder="输入角色ID (例如: c1, c17)"
              value={characterId}
              onChangeText={setCharacterId}
            />
          )}

          <TouchableOpacity 
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={styles.advancedToggleText}>
              {showAdvanced ? '隐藏高级选项 ▲' : '显示高级选项 ▼'}
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advancedOptions}>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>结果数量:</Text>
                <TextInput
                  style={styles.smallInput}
                  keyboardType="number-pad"
                  value={String(advancedOptions.results || 5)}
                  onChangeText={(value) => updateAdvancedOption('results', parseInt(value) || 5)}
                />
              </View>
              
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>血型:</Text>
                <View style={styles.buttonGroup}>
                  {['a', 'b', 'ab', 'o'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.optionButton,
                        advancedOptions.bloodType === type && styles.selectedOptionButton
                      ]}
                      onPress={() => {
                        advancedOptions.bloodType === type
                          ? updateAdvancedOption('bloodType', undefined)
                          : updateAdvancedOption('bloodType', type)
                      }}
                    >
                      <Text style={[
                        styles.optionButtonText,
                        advancedOptions.bloodType === type && styles.selectedOptionButtonText
                      ]}>
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>性别:</Text>
                <View style={styles.buttonGroup}>
                  {[
                    {value: 'm', label: '男'},
                    {value: 'f', label: '女'},
                    {value: 'b', label: '双性'}
                  ].map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        advancedOptions.sex === option.value && styles.selectedOptionButton
                      ]}
                      onPress={() => {
                        advancedOptions.sex === option.value
                          ? updateAdvancedOption('sex', undefined)
                          : updateAdvancedOption('sex', option.value)
                      }}
                    >
                      <Text style={[
                        styles.optionButtonText,
                        advancedOptions.sex === option.value && styles.selectedOptionButtonText
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity 
            style={styles.queryButton} 
            onPress={handleQuery}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.queryButtonText}>查询</Text>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.resultsContainer}>
            <View style={styles.resultHeader}>
              <Text style={styles.sectionTitle}>
                查询结果 ({results.length})
              </Text>
              
              {results.length > 0 && (
                <TouchableOpacity 
                  style={styles.saveButton} 
                  onPress={saveResultsToJson}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveButtonText}>保存结果</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView style={styles.resultsList}>
              {results.length > 0 ? (
                results.map((character, index) => renderCharacterResult(character, index))
              ) : (
                !isLoading && !error && (
                  <Text style={styles.emptyText}>尚无查询结果</Text>
                )
              )}
            </ScrollView>
          </View>

          <View style={styles.logContainer}>
            <Text style={styles.sectionTitle}>操作日志</Text>
            <ScrollView style={styles.logScroll}>
              {logMessages.map((log, index) => (
                <Text key={index} style={styles.logMessage}>{log}</Text>
              ))}
              {logMessages.length === 0 && (
                <Text style={styles.emptyText}>尚无日志记录</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  queryTypeSelector: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  queryTypeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#eee',
  },
  activeQueryType: {
    borderBottomColor: '#007bff',
  },
  queryTypeText: {
    color: '#666',
  },
  activeQueryTypeText: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  advancedToggle: {
    alignItems: 'center',
    marginBottom: 10,
  },
  advancedToggleText: {
    color: '#007bff',
    fontSize: 14,
  },
  advancedOptions: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionLabel: {
    width: 80,
    fontSize: 14,
  },
  smallInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: 60,
    textAlign: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  selectedOptionButton: {
    backgroundColor: '#007bff',
  },
  optionButtonText: {
    color: '#666',
    fontSize: 14,
  },
  selectedOptionButtonText: {
    color: 'white',
  },
  queryButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  queryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  errorText: {
    color: '#d32f2f',
  },
  resultsContainer: {
    flex: 1,
    marginBottom: 10,
    maxHeight: '30%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  resultsList: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
  resultItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultSubtext: {
    color: '#666',
    fontSize: 12,
    marginBottom: 5,
  },
  resultDescription: {
    color: '#333',
    fontSize: 14,
    marginBottom: 5,
  },
  resultInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 5,
  },
  resultInfoItem: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 5,
    fontSize: 12,
  },
  logContainer: {
    maxHeight: '25%',
  },
  logScroll: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
  logMessage: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    padding: 10,
    fontStyle: 'italic',
  },
  imageContainer: {
    marginVertical: 5,
  },
  
  vnsContainer: {
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  
  saveButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default VNDBTestModal;
