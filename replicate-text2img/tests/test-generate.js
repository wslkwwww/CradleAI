/**
 * Replicate Text2Img 后端测试脚本
 * 此脚本用于测试从本地向后端发送图片生成请求的完整流程
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 配置
const config = {
  // 服务器地址，默认为本地开发环境
  serverUrl: process.env.TEST_SERVER_URL || 'http://localhost:3000',
  // 输出目录，用于保存下载的图片
  outputDir: path.join(__dirname, 'output'),
  // 测试参数
  testParams: {
    prompt: '高清动漫风景，樱花树下的日本传统神社，黄昏时分，云彩，细节丰富',
    negative_prompt: 'nsfw, 低质量, 模糊, 畸形, 不完整',
    width: 1024,
    height: 1024,
    steps: 28,
    batch_size: 1
  },
  // 超时设置，单位：毫秒
  timeout: 300000 // 5分钟
};

// 确保输出目录存在
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  console.log(`📁 创建输出目录: ${config.outputDir}`);
}

/**
 * 格式化时间为人类可读格式
 * @returns {string} 格式化的时间字符串
 */
function getFormattedTime() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 记录带时间戳的日志信息
 * @param {string} message 日志消息
 * @param {string} level 日志级别
 */
function log(message, level = 'info') {
  const time = getFormattedTime();
  const prefix = {
    info: '📢 信息',
    error: '❌ 错误',
    success: '✅ 成功',
    warn: '⚠️ 警告'
  }[level] || '📝 日志';
  
  console.log(`[${time}] ${prefix}: ${message}`);
}

/**
 * 下载图片到本地
 * @param {string} url 图片URL
 * @param {string} outputPath 输出路径
 * @returns {Promise<void>}
 */
async function downloadImage(url, outputPath) {
  log(`开始下载图片: ${url}`, 'info');
  
  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(outputPath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        log(`图片已保存到: ${outputPath}`, 'success');
        resolve();
      });
      writer.on('error', (err) => {
        log(`图片下载失败: ${err.message}`, 'error');
        reject(err);
      });
    });
  } catch (error) {
    log(`图片下载请求失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 向后端发送图片生成请求
 * @returns {Promise<void>}
 */
async function testImageGeneration() {
  const startTime = Date.now();
  const testId = uuidv4().substring(0, 8);
  
  log(`========== 开始测试会话 ID: ${testId} ==========`, 'info');
  log(`后端服务地址: ${config.serverUrl}`, 'info');
  
  try {
    // 检查服务器健康状态
    try {
      log(`检查服务器健康状态...`, 'info');
      const healthResponse = await axios.get(`${config.serverUrl}/health`, { timeout: 5000 });
      log(`服务器健康状态: ${JSON.stringify(healthResponse.data)}`, 'success');
    } catch (healthError) {
      log(`服务器健康检查失败: ${healthError.message}`, 'warn');
      log(`继续尝试发送请求...`, 'info');
    }
    
    // 1. 准备请求参数
    log(`准备发送以下参数:`, 'info');
    console.log(JSON.stringify(config.testParams, null, 2));
    
    // 2. 发送请求
    log(`正在向 ${config.serverUrl}/generate 发送 POST 请求...`, 'info');
    const generateStartTime = Date.now();
    
    const response = await axios.post(
      `${config.serverUrl}/generate`,
      config.testParams,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: config.timeout // 设置超时时间
      }
    );
    
    const generateDuration = ((Date.now() - generateStartTime) / 1000).toFixed(2);
    log(`请求成功完成！耗时: ${generateDuration} 秒`, 'success');
    
    // 3. 检查响应
    if (!response.data || !response.data.urls || !Array.isArray(response.data.urls)) {
      log(`响应格式不正确: ${JSON.stringify(response.data)}`, 'error');
      return;
    }
    
    log(`服务器返回 ${response.data.urls.length} 个图片URL:`, 'success');
    console.log(JSON.stringify(response.data.urls, null, 2));
    
    // 4. 下载生成的图片
    log(`开始下载生成的图片...`, 'info');
    const promises = response.data.urls.map(async (url, index) => {
      const filename = `test_${testId}_image_${index + 1}.png`;
      const outputPath = path.join(config.outputDir, filename);
      await downloadImage(url, outputPath);
      return outputPath;
    });
    
    const downloadedFiles = await Promise.all(promises);
    
    // 5. 总结测试结果
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`========== 测试完成 ==========`, 'success');
    log(`总耗时: ${totalDuration} 秒`, 'info');
    log(`成功生成并下载了 ${downloadedFiles.length} 个图片:`, 'success');
    downloadedFiles.forEach(file => {
      log(`- ${file}`, 'info');
    });
    
  } catch (error) {
    // 处理错误
    log(`测试过程中发生错误:`, 'error');
    
    if (error.response) {
      // 服务器返回了错误状态码
      log(`服务器返回状态码: ${error.response.status}`, 'error');
      log(`错误信息: ${JSON.stringify(error.response.data)}`, 'error');
      
      // 提供更多故障排除建议
      if (error.response.status === 500) {
        log(`服务器内部错误，可能原因:`, 'warn');
        log(`1. Replicate API 访问问题 - 请检查 API 令牌是否正确设置`, 'warn');
        log(`2. MinIO 连接问题 - 请检查 MinIO 配置是否正确`, 'warn');
        log(`3. 服务器内存或资源不足`, 'warn');
        log(`建议查看服务器日志获取更多详细信息`, 'warn');
      }
    } else if (error.request) {
      // 请求已发送但未收到响应
      log(`未收到服务器响应，请检查服务器是否正在运行`, 'error');
      log(`可能原因:`, 'warn');
      log(`1. 服务器未启动或已崩溃`, 'warn');
      log(`2. 网络连接问题`, 'warn');
      log(`3. 防火墙阻止了连接`, 'warn');
      log(`4. 服务器 URL 配置错误: ${config.serverUrl}`, 'warn');
    } else {
      // 设置请求时发生错误
      log(`请求设置错误: ${error.message}`, 'error');
    }
    
    log(`完整错误信息:`, 'error');
    console.error(error);
  } finally {
    log(`========== 测试会话 ID: ${testId} 结束 ==========`, 'info');
  }
}

/**
 * 主函数
 */
async function main() {
  log(`Replicate Text2Img 后端测试脚本启动`, 'info');
  log(`Node.js 版本: ${process.version}`, 'info');
  
  try {
    await testImageGeneration();
  } catch (error) {
    log(`主函数执行出错: ${error.message}`, 'error');
  }
}

// 执行测试
main().catch(err => {
  log(`未捕获的错误: ${err.message}`, 'error');
  process.exit(1);
});
