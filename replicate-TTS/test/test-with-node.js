const http = require('http');
const fs = require('fs');
const path = require('path');

// 测试配置
const config = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/tts',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  requestData: {
    templateId: 'template1',
    tts_text: '这是一段要转换为语音的示例文本。'
  }
};

console.log('======= Replicate TTS API 测试 (使用 Node.js http) =======');
console.log(`发送请求到: http://${config.hostname}:${config.port}${config.path}`);
console.log(`请求参数:`, config.requestData);

// 将数据转换为 JSON 字符串
const data = JSON.stringify(config.requestData);

// 创建请求
const req = http.request({
  hostname: config.hostname,
  port: config.port,
  path: config.path,
  method: config.method,
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      console.log('响应内容:');
      console.log(JSON.stringify(parsedData, null, 2));
      
      // 保存响应到文件
      const outputDir = path.join(__dirname, 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(outputDir, 'node-response.json'),
        JSON.stringify(parsedData, null, 2)
      );
      
      if (parsedData.success) {
        console.log('✅ 请求成功!');
        console.log(`音频URL: ${parsedData.data.audio_url}`);
      } else {
        console.error('❌ 请求失败:', parsedData.error);
      }
    } catch (e) {
      console.error('解析响应失败:', e.message);
      console.log('原始响应:', responseData);
    }
  });
});

// 请求错误处理
req.on('error', (e) => {
  console.error(`请求出错: ${e.message}`);
});

// 发送请求数据
req.write(data);
req.end();

console.log('请求已发送，等待响应...');
