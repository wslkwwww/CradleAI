const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 确保测试目录存在
const testOutputDir = path.join(__dirname, 'output');
if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
}

// 测试配置
const config = {
  apiUrl: 'http://localhost:3002/api/tts',
  templateId: 'template1',
  ttsText: '这是一段要转换为语音的示例文本。',
  outputPath: path.join(testOutputDir, 'test-output.wav')
};

/**
 * 发送 TTS 请求测试函数
 */
async function testTtsApi() {
  console.log('======= Replicate TTS API 测试 =======');
  console.log(`发送请求到: ${config.apiUrl}`);
  console.log(`请求参数: templateId=${config.templateId}, tts_text=${config.ttsText}`);
  
  try {
    // 构建请求数据
    const requestData = {
      templateId: config.templateId,
      tts_text: config.ttsText
    };
    
    console.log('发送请求...');
    const startTime = Date.now();
    
    // 发送请求到 TTS API
    const response = await axios.post(config.apiUrl, requestData);
    
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    
    console.log(`请求完成! 耗时: ${elapsedTime.toFixed(2)}秒`);
    
    if (response.data.success) {
      console.log('✅ 请求成功!');
      console.log(`音频URL: ${response.data.data.audio_url}`);
      
      // 可选: 下载生成的音频文件
      await downloadAudio(response.data.data.audio_url, config.outputPath);
    } else {
      console.error('❌ 请求失败:', response.data.error);
    }
  } catch (error) {
    console.error('❌ 请求出错:', error.response?.data || error.message);
    
    // 输出更详细的错误信息
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

/**
 * 下载音频文件
 */
async function downloadAudio(audioUrl, outputPath) {
  try {
    console.log(`下载音频文件到: ${outputPath}`);
    
    // 发送请求获取音频文件
    const response = await axios({
      method: 'get',
      url: audioUrl,
      responseType: 'stream'
    });
    
    // 将响应流写入到文件
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('✅ 音频文件下载完成!');
        resolve();
      });
      writer.on('error', (err) => {
        console.error('❌ 音频文件下载失败:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('❌ 下载音频文件出错:', error.message);
  }
}

// 执行测试
testTtsApi().catch(console.error);
