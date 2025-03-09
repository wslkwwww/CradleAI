import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface NovelAITestModalProps {
  visible: boolean;
  onClose: () => void;
  onImageGenerated: (imageUrl: string) => void;
}

interface GenerationResult {
  success: boolean;
  message: string;
  imageUrl?: string;
  image_urls?: string[];  // 添加对多图像URL的支持
}

const NovelAITestModal: React.FC<NovelAITestModalProps> = ({
  visible,
  onClose,
  onImageGenerated,
}) => {
  // 身份验证配置
  const [authType, setAuthType] = useState<'token' | 'login'>('token');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiServer, setApiServer] = useState('http://152.69.219.182:5000'); // 设置为你的服务器地址P和端口
  
  // 生成配置
  const [model, setModel] = useState('nai-v3');
  const [sampler, setSampler] = useState('k_euler_ancestral');
  const [steps, setSteps] = useState('28');
  const [scale, setScale] = useState('11');
  const [prompt, setPrompt] = useState('一只可爱的猫咪，高清照片');
  const [negativePrompt, setNegativePrompt] = useState('模糊，低质量，变形');
  
  // 高级配置
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [strength, setStrength] = useState('0.7');
  const [noise, setNoise] = useState('0.2');
  const [resolution, setResolution] = useState<'portrait' | 'landscape' | 'square'>('portrait');
  
  // 状态管理
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult>();
  const [logs, setLogs] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // 从存储中加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem('novelai_test_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setAuthType(settings.authType || 'token');
          setToken(settings.token || '');
          setEmail(settings.email || '');
          setApiServer(settings.apiServer || 'https://your-api-server.com');
          setModel(settings.model || 'nai-v3');
          setSampler(settings.sampler || 'k_euler_ancestral');
          setSteps(settings.steps || '28');
          setScale(settings.scale || '11');
          setResolution(settings.resolution || 'portrait');
        }
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    };

    if (visible) {
      loadSettings();
      // 清除之前的日志和结果
      setLogs([]);
      setResult(undefined);
      setTaskId(null);
    }
  }, [visible]);

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // 保存设置
  const saveSettings = async () => {
    try {
      const settings = {
        authType,
        token,
        email,
        apiServer,
        model,
        sampler,
        steps,
        scale,
        resolution,
      };
      await AsyncStorage.setItem('novelai_test_settings', JSON.stringify(settings));
      addLog('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      addLog('保存设置失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 添加日志
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // 查询任务状态
  const checkTaskStatus = async (taskId: string) => {
    try {
      addLog(`正在查询任务状态: ${taskId}`);
      const response = await axios.get(`${apiServer}/task_status/${taskId}`);
      
      if (response.data.done) {
        // 停止轮询
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        if (response.data.success) {
          addLog('图像生成成功!');
          
          // 首选图像 URL 数组
          const imageUrls = response.data.image_urls || [];
          // 向后兼容的单个图像 URL
          const mainImageUrl = response.data.image_url;
          
          // 确保我们有至少一个 URL
          if (imageUrls.length > 0 || mainImageUrl) {
            const resultMessage = imageUrls.length > 1 
              ? `成功生成了 ${imageUrls.length} 张图像!` 
              : '图像生成成功!';
              
            setResult({
              success: true,
              message: resultMessage,
              imageUrl: mainImageUrl || imageUrls[0],
              image_urls: imageUrls.length > 0 ? imageUrls : (mainImageUrl ? [mainImageUrl] : [])
            });
            
            // 将第一张图片传递给父组件
            const imageToPass = mainImageUrl || imageUrls[0];
            if (imageToPass) {
              onImageGenerated(imageToPass);
            }
          } else {
            addLog('图像生成成功但未返回图像URL');
            setResult({
              success: true,
              message: '图像生成成功但未返回图像URL'
            });
          }
        } else {
          addLog(`图像生成失败: ${response.data.error}`);
          setResult({
            success: false,
            message: `生成失败: ${response.data.error}`,
          });
        }
        
        setIsLoading(false);
      } else {
        // 任务仍在进行中
        addLog(`任务状态: ${response.data.status}`);
      }
    } catch (error) {
      addLog(`查询任务状态失败: ${error instanceof Error ? error.message : String(error)}`);
      // 不停止轮询，继续尝试
    }
  };

  // 生成图像
  const generateImage = async () => {
    setIsLoading(true);
    setResult(undefined);
    setLogs([]);
    addLog('开始生成图像...');
    addLog(`认证类型: ${authType}`);
    addLog(`API服务器: ${apiServer}`);
    addLog(`模型: ${model}, 采样器: ${sampler}, 步数: ${steps}`);
    
    try {
      // 清理token，移除可能的空格或换行符
      const cleanToken = token.trim();
      if (authType === 'token' && (!cleanToken || cleanToken.length < 10)) {
        addLog('错误: Token为空或长度不足，请检查输入');
        setResult({
          success: false,
          message: 'Token为空或长度不足，请检查输入',
        });
        setIsLoading(false);
        return;
      }
      
      // 准备请求参数
      const requestData = {
        auth_type: authType,
        token: authType === 'token' ? cleanToken : undefined,
        email: authType === 'login' ? email : undefined,
        password: authType === 'login' ? password : undefined,
        model,
        sampler,
        steps: parseInt(steps),
        scale: parseFloat(scale),
        resolution,
        prompt,
        negative_prompt: negativePrompt,
      };
      
      addLog('正在发送请求到服务器...');
      addLog(`请求数据: ${JSON.stringify({
        ...requestData,
        token: authType === 'token' ? `${cleanToken.substring(0, 5)}...${cleanToken.substring(cleanToken.length - 5)}` : undefined,
        password: authType === 'login' ? '******' : undefined,
      })}`);
      
      const response = await axios.post(`${apiServer}/generate`, requestData, {
        timeout: 30000, // 30秒超时
      });
      
      if (response.data.success) {
        const newTaskId = response.data.task_id;
        setTaskId(newTaskId);
        addLog(`任务已提交，ID: ${newTaskId}`);
        addLog('开始轮询任务状态...');
        
        // 开始轮询任务状态
        const interval = setInterval(() => {
          checkTaskStatus(newTaskId);
        }, 2000); // 每2秒检查一次
        
        setPollingInterval(interval);
      } else {
        addLog(`提交任务失败: ${response.data.error}`);
        setResult({
          success: false,
          message: `提交失败: ${response.data.error}`,
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('生成图像过程中发生错误:', error);
      let errorMessage = '未知错误';
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = `服务器错误 (${error.response.status}): ${error.response.data?.error || error.message}`;
        } else if (error.request) {
          errorMessage = `无法连接到服务器: ${error.message}`;
        } else {
          errorMessage = `请求配置错误: ${error.message}`;
        }
        
        // 针对常见错误提供建议
        if (error.response?.status === 401) {
          addLog('建议: 如果使用token认证失败，请尝试切换到login认证后再切换回token认证');
          errorMessage += '\n建议: 切换到login认证后再切换回token认证可能解决此问题';
        }
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      
      addLog('生成图像过程中发生错误: ' + errorMessage);
      setResult({
        success: false,
        message: '生成图像过程中发生错误: ' + errorMessage,
      });
      setIsLoading(false);
    }
  };

  // 渲染图像结果
  const renderImages = () => {
    if (!result?.success) return null;
    
    // 检查是否有多张图片
    const hasMultipleImages = result.image_urls && result.image_urls.length > 1;
    
    if (hasMultipleImages) {
      return (
        <ScrollView horizontal style={styles.imageScrollView}>
          {result.image_urls!.map((url, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image
                source={{ uri: url }}
                style={styles.resultImage}
                resizeMode="contain"
              />
              <Text style={styles.imageIndexText}>图像 {index + 1}</Text>
            </View>
          ))}
        </ScrollView>
      );
    }
    
    // 单张图片情况
    const imageUrl = result.imageUrl;
    if (!imageUrl) return null;
    
    // 检查URL大小，避免显示过大的base64数据
    const isDataUrl = imageUrl.startsWith('data:');
    const isLargeDataUrl = isDataUrl && imageUrl.length > 100000;
    
    if (isLargeDataUrl) {
      // 对于大型Data URL，提供查看选项而不是直接显示
      return (
        <View style={styles.imageContainer}>
          <Text style={styles.warningText}>* 图像较大，直接显示可能影响性能 *</Text>
          <TouchableOpacity 
            style={styles.viewImageButton}
            onPress={() => {
              // 打开新窗口查看图像
              if (typeof window !== 'undefined') {
                window.open(imageUrl, '_blank');
              }
            }}
          >
            <Text style={styles.viewImageButtonText}>在新窗口中查看完整图像</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // 对于普通URL，直接显示
    return (
      <Image
        source={{ uri: imageUrl }}
        style={styles.resultImage}
        resizeMode="contain"
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>NovelAI 图像生成测试</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>关闭</Text>
          </TouchableOpacity>
        </View>

        {/* 认证设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>认证设置</Text>
          
          <Text style={styles.label}>认证类型</Text>
          <View style={styles.pickerContainer}>
            {(['token', 'login'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.authTypeButton,
                  authType === type && styles.selectedAuthType,
                ]}
                onPress={() => setAuthType(type)}
              >
                <Text style={[
                  styles.authTypeText,
                  authType === type && styles.selectedAuthTypeText,
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {authType === 'token' && (
            <View>
              <Text style={styles.label}>Token</Text>
              <TextInput
                style={styles.input}
                value={token}
                onChangeText={setToken}
                placeholder="输入你的NovelAI Token"
                secureTextEntry
              />
            </View>
          )}

          {authType === 'login' && (
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="输入NovelAI账号邮箱"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.label}>密码</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="输入密码"
                secureTextEntry
              />
            </View>
          )}

          <Text style={styles.label}>API服务器</Text>
          <TextInput
            style={styles.input}
            value={apiServer}
            onChangeText={setApiServer}
            placeholder="API服务器URL"
            autoCapitalize="none"
          />
        </View>

        {/* 生成设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生成设置</Text>
          
          <Text style={styles.label}>模型</Text>
          <View style={styles.pickerContainer}>
            {([
              { id: 'nai-v3', name: 'NAI动漫v3' },
              { id: 'nai-v4-full', name: 'NAI动漫v4完整' },
              { id: 'nai-v4-preview', name: 'NAI动漫v4预览' },
              { id: 'safe', name: '安全扩散' },
              { id: 'nai', name: 'NAI动漫v1' },
              { id: 'nai-v2', name: 'NAI动漫v2' },
              { id: 'furry', name: '兽人扩散' }
            ]).map((modelOption) => (
              <TouchableOpacity
                key={modelOption.id}
                style={[
                  styles.optionButton,
                  model === modelOption.id && styles.selectedOption,
                ]}
                onPress={() => setModel(modelOption.id)}
              >
                <Text style={styles.optionText}>{modelOption.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>采样器</Text>
          <View style={styles.pickerContainer}>
            {(['k_euler_ancestral', 'k_euler', 'ddim', 'k_dpmpp_2s_ancestral', 'k_dpmpp_2m'] as const).map((samplerOption) => (
              <TouchableOpacity
                key={samplerOption}
                style={[
                  styles.optionButton,
                  sampler === samplerOption && styles.selectedOption,
                ]}
                onPress={() => setSampler(samplerOption)}
              >
                <Text style={styles.optionText}>{samplerOption}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>步数</Text>
          <TextInput
            style={styles.input}
            value={steps}
            onChangeText={setSteps}
            placeholder="生成步数"
            keyboardType="numeric"
          />

          <Text style={styles.label}>提示词相关性 (CFG Scale)</Text>
          <TextInput
            style={styles.input}
            value={scale}
            onChangeText={setScale}
            placeholder="Scale"
            keyboardType="numeric"
          />

          <Text style={styles.label}>分辨率</Text>
          <View style={styles.pickerContainer}>
            {(['portrait', 'landscape', 'square'] as const).map((res) => (
              <TouchableOpacity
                key={res}
                style={[
                  styles.optionButton,
                  resolution === res && styles.selectedOption,
                ]}
                onPress={() => setResolution(res)}
              >
                <Text style={styles.optionText}>{res}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 高级设置切换按钮 */}
          <TouchableOpacity
            style={styles.advancedButton}
            onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <Text style={styles.advancedButtonText}>
              {showAdvancedSettings ? '隐藏高级设置' : '显示高级设置'}
            </Text>
          </TouchableOpacity>

          {/* 高级设置 */}
          {showAdvancedSettings && (
            <View>
              <Text style={styles.label}>强度 (仅用于图像到图像)</Text>
              <TextInput
                style={styles.input}
                value={strength}
                onChangeText={setStrength}
                placeholder="强度 (0.0-1.0)"
                keyboardType="numeric"
              />

              <Text style={styles.label}>噪声 (仅用于图像到图像)</Text>
              <TextInput
                style={styles.input}
                value={noise}
                onChangeText={setNoise}
                placeholder="噪声 (0.0-1.0)"
                keyboardType="numeric"
              />
            </View>
          )}

          <Text style={styles.label}>提示词</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="描述您想要生成的图像"
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>负面提示词</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={negativePrompt}
            onChangeText={setNegativePrompt}
            placeholder="描述您不想在图像中出现的内容"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* 操作按钮 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.saveButton]} 
            onPress={saveSettings}
          >
            <Text style={styles.buttonText}>保存设置</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.generateButton, isLoading && styles.disabledButton]} 
            onPress={generateImage}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? '生成中...' : '生成图像'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 加载指示器 */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>正在生成图像，请稍候...</Text>
            {taskId && <Text style={styles.taskIdText}>任务ID: {taskId}</Text>}
          </View>
        )}

        {/* 结果展示 */}
        {result && (
          <View style={[styles.resultContainer, 
            result.success ? styles.successResult : styles.errorResult]}>
            <Text style={styles.resultText}>{result.message}</Text>
            {result.success && renderImages()}
          </View>
        )}

        {/* 日志输出 */}
        <View style={styles.logsContainer}>
          <Text style={styles.logsTitle}>执行日志:</Text>
          <ScrollView style={styles.logs}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logEntry}>{log}</Text>
            ))}
          </ScrollView>
        </View>

        {/* 底部间距 */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#ddd',
    borderRadius: 5,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  authTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedAuthType: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  authTypeText: {
    color: '#555',
  },
  selectedAuthTypeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedOption: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  optionText: {
    color: '#555',
    fontSize: 14,
  },
  advancedButton: {
    alignSelf: 'center',
    marginVertical: 10,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  advancedButtonText: {
    color: '#555',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    elevation: 2,
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  generateButton: {
    backgroundColor: '#3498db',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  resultContainer: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  successResult: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  errorResult: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
  },
  resultText: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultImage: {
    width: 300,
    height: 300,
    borderRadius: 5,
  },
  logsContainer: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  logsTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  logs: {
    height: 200,
  },
  logEntry: {
    color: '#adff2f',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  bottomSpacer: {
    height: 50,
  },
  taskIdText: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  imageScrollView: {
    flexGrow: 0,
    marginVertical: 10,
  },
  imageContainer: {
    marginRight: 10,
    alignItems: 'center',
  },
  imageIndexText: {
    marginTop: 5,
    color: '#666',
    fontSize: 12,
  },
  warningText: {
    color: '#e67e22',
    marginBottom: 10,
    fontSize: 14,
  },
  viewImageButton: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  viewImageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default NovelAITestModal;
