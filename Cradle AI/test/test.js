const axios = require('axios');
require('dotenv').config();

// 测试配置
const TEST_SERVER_URL = 'http://localhost:' + (process.env.PORT || 3000);
const TEST_ENDPOINT = `${TEST_SERVER_URL}/api/chat/completion`;

// 测试请求数据
const testRequestData = {
  model: 'gemini-2.0-flash-exp',
  messages: [
    {
      role: 'user',
      content: '你好，请用中文介绍一下自己。'
    }
  ],
  max_tokens: 100,
  temperature: 0.7
};

/**
 * 测试 Cradle AI 聊天完成 API
 */
async function testChatCompletion() {
  console.log('开始测试 Cradle AI Chat Completion API...');
  console.log(`测试端点: ${TEST_ENDPOINT}`);
  console.log('测试请求数据:', JSON.stringify(testRequestData, null, 2));

  try {
    console.log('发送请求...');
    const response = await axios.post(TEST_ENDPOINT, testRequestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n=== 测试成功 ===');
    console.log('状态码:', response.status);
    console.log('响应头:', JSON.stringify(response.headers, null, 2));
    console.log('响应数据:', JSON.stringify(response.data, null, 2));

    // 输出实际生成的文本
    if (response.data.choices && response.data.choices.length > 0) {
      console.log('\n生成的文本:');
      console.log(response.data.choices[0].message.content);
    }

    return true;
  } catch (error) {
    console.log('\n=== 测试失败 ===');
    
    if (error.response) {
      // 服务器响应了错误状态码
      console.log('状态码:', error.response.status);
      console.log('错误数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.log('未收到响应。服务器可能未运行。');
    } else {
      // 设置请求时发生错误
      console.log('错误:', error.message);
    }
    
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('=== Cradle AI 测试脚本 ===\n');
  
  try {
    // 测试聊天完成 API
    await testChatCompletion();
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
runTests();
