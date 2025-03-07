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
} from 'react-native';
import { SimpleContext } from '../extract/simple-context';
import { NovelAIApiService, NovelAIConfig } from '../extract';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NovelAITestModalProps {
  visible: boolean;
  onClose: () => void;
  onImageGenerated: (imageUrl: string) => void;
}

const NovelAITestModal: React.FC<NovelAITestModalProps> = ({
  visible,
  onClose,
  onImageGenerated,
}) => {
  // 身份验证配置
  const [authType, setAuthType] = useState<'token' | 'login' | 'sd-webui' | 'stable-horde' | 'naifu' | 'comfyui'>('token');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [endpoint, setEndpoint] = useState('https://api.novelai.net');
  
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
  const [result, setResult] = useState<{success: boolean; message: string; imageUrl?: string}>(); 
  const [logs, setLogs] = useState<string[]>([]);

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
          setEndpoint(settings.endpoint || 'https://api.novelai.net');
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
    }
  }, [visible]);

  // 保存设置
  const saveSettings = async () => {
    try {
      const settings = {
        authType,
        token,
        email,
        endpoint,
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

  // 生成图像
  const generateImage = async () => {
    setIsLoading(true);
    setResult(undefined);
    setLogs([]);
    addLog('开始生成图像...');
    addLog(`认证类型: ${authType}`);
    addLog(`使用端点: ${endpoint}`);
    addLog(`模型: ${model}, 采样器: ${sampler}, 步数: ${steps}`);
    
    try {
      // 创建简易上下文
      const ctx = new SimpleContext();
      addLog('已创建SimpleContext');
      
      // 输出日志的自定义方法
      ctx.logger = {
        debug: (...args: any[]) => {
          console.debug('[Debug]', ...args);
          addLog('Debug: ' + args.join(' '));
        },
        info: (...args: any[]) => {
          console.info('[Info]', ...args);
          addLog('Info: ' + args.join(' '));
        },
        warn: (...args: any[]) => {
          console.warn('[Warn]', ...args);
          addLog('Warn: ' + args.join(' '));
        },
        error: (...args: any[]) => {
          console.error('[Error]', ...args);
          addLog('Error: ' + args.join(' '));
        },
      };
      
      // 创建配置
      const config: NovelAIConfig = {
        type: authType,
        token: authType === 'token' ? token : undefined,
        email: authType === 'login' ? email : undefined,
        password: authType === 'login' ? password : undefined,
        endpoint: endpoint,
        apiEndpoint: endpoint,
        model: model,
        sampler: sampler,
        textSteps: parseInt(steps),
        imageSteps: parseInt(steps),
        scale: parseFloat(scale),
        strength: parseFloat(strength),
        noise: parseFloat(noise),
        requestTimeout: 60000,
      };
      addLog('已创建NovelAI配置');
      
      // 初始化API服务
      addLog('正在初始化NovelAIApiService...');
      const service = new NovelAIApiService(ctx, config);
      addLog('NovelAIApiService初始化成功');
      
      // 生成图像
      addLog(`正在生成图像... 提示词: "${prompt}"`);
      addLog(`负面提示词: "${negativePrompt}"`);
      
      const generationResult = await service.generateFromText({
        prompt: prompt,
        negativePrompt: negativePrompt,
        steps: parseInt(steps),
        scale: parseFloat(scale),
        resolution: resolution,
      });
      
      if (generationResult.success) {
        addLog('图像生成成功!');
        setResult({
          success: true,
          message: '图像生成成功!',
          imageUrl: generationResult.imageUrl,
        });
        
        // 将图片传递给父组件
        if (generationResult.imageUrl) {
          onImageGenerated(generationResult.imageUrl);
        }
      } else {
        addLog(`图像生成失败: ${generationResult.error}`);
        setResult({
          success: false,
          message: `生成失败: ${generationResult.error}`,
        });
      }
    } catch (error) {
      console.error('生成图像过程中发生错误:', error);
      addLog('生成图像过程中发生错误: ' + (error instanceof Error ? error.message : String(error)));
      setResult({
        success: false,
        message: '生成图像过程中发生错误: ' + (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setIsLoading(false);
    }
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
            {(['token', 'login', 'sd-webui', 'stable-horde', 'naifu'] as const).map((type) => (
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

          <Text style={styles.label}>API端点</Text>
          <TextInput
            style={styles.input}
            value={endpoint}
            onChangeText={setEndpoint}
            placeholder="API端点URL"
            autoCapitalize="none"
          />
        </View>

        {/* 生成设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生成设置</Text>
          
          <Text style={styles.label}>模型</Text>
          <View style={styles.pickerContainer}>
            {(['nai-v3', 'nai-v4-full', 'safe', 'nai', 'furry'] as const).map((modelOption) => (
              <TouchableOpacity
                key={modelOption}
                style={[
                  styles.optionButton,
                  model === modelOption && styles.selectedOption,
                ]}
                onPress={() => setModel(modelOption)}
              >
                <Text style={styles.optionText}>{modelOption}</Text>
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
          </View>
        )}

        {/* 结果展示 */}
        {result && (
          <View style={[styles.resultContainer, 
            result.success ? styles.successResult : styles.errorResult]}>
            <Text style={styles.resultText}>{result.message}</Text>
            {result.success && result.imageUrl && (
              <Image
                source={{ uri: result.imageUrl }}
                style={styles.resultImage}
                resizeMode="contain"
              />
            )}
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
    width: '100%',
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
});

export default NovelAITestModal;
