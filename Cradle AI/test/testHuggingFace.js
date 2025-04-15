const axios = require('axios');
require('dotenv').config();

// 测试配置
const TEST_SERVER_URL = 'http://localhost:' + (process.env.PORT || 3000);
const TEST_ENDPOINT = `${TEST_SERVER_URL}/api/huggingface/completion`;
const TEST_LICENSE_KEY = process.env.TEST_LICENSE_KEY || 'test-license-key';
const TEST_DEVICE_ID = process.env.TEST_DEVICE_ID || 'test-device-id';

// 测试请求数据
const testRequestData = {
  license_key: TEST_LICENSE_KEY,
  device_id: TEST_DEVICE_ID,  // 添加设备ID
  model: 'gemini-2.0-flash-exp',
  messages: [
    {
      role: 'user',
      content: '你好，请用中文介绍一下自己。'
    }
  ]
};

/**
 * 测试 Hugging Face Space 集成
 */
async function testHuggingFaceIntegration() {
  console.log('开始测试 Hugging Face Space 集成...');
  console.log(`测试端点: ${TEST_ENDPOINT}`);
  console.log('测试请求数据:', JSON.stringify(testRequestData, null, 2));

  try {
    console.log('发送第一次请求 (应当扣除0.33点余额)...');
    const firstResponse = await axios.post(TEST_ENDPOINT, testRequestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n=== 第一次请求成功 ===');
    console.log('状态码:', firstResponse.status);
    console.log('响应头:', JSON.stringify(firstResponse.headers, null, 2));
    console.log('响应数据:', JSON.stringify(firstResponse.data, null, 2));

    // 输出实际生成的文本
    if (firstResponse.data.choices && firstResponse.data.choices.length > 0) {
      console.log('\n生成的文本:');
      console.log(firstResponse.data.choices[0].message.content);
    }

    // 间隔一秒进行第二次请求
    console.log('\n等待1秒后进行第二次请求...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n发送第二次请求 (不应扣除余额)...');
    const secondResponse = await axios.post(TEST_ENDPOINT, testRequestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n=== 第二次请求成功 ===');
    console.log('状态码:', secondResponse.status);
    console.log('响应数据:', JSON.stringify(secondResponse.data, null, 2));

    if (secondResponse.data.choices && secondResponse.data.choices.length > 0) {
      console.log('\n生成的文本:');
      console.log(secondResponse.data.choices[0].message.content);
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
  console.log('=== Hugging Face 集成测试脚本 ===\n');
  
  try {
    await testHuggingFaceIntegration();
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
runTests();
