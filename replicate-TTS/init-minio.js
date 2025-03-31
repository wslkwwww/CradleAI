/**
 * 初始化 MinIO 存储桶
 * 
 * 这个脚本可以用来检查 MinIO 存储桶是否已存在模板文件
 * 如果需要，可以在这里添加代码上传本地模板文件到 MinIO
 */

const axios = require('axios');
const minioService = require('./services/minioService');
const config = require('./config');

async function initMinio() {
  console.log('======= 初始化 MinIO 存储 =======');
  
  try {
    await minioService.initBucket();
    
    // 检查模板文件是否存在
    const templateId = 'template1';
    
    // 使用本地地址检查文件是否存在
    const audioUrl = minioService.getLocalTemplateAudioUrl(templateId);
    const transcriptUrl = minioService.getTemplateTranscriptUrl(templateId).replace(
      config.minio.publicEndPoint,
      config.minio.endPoint
    );
    
    // 显示公网和本地访问的 URL
    console.log(`检查模板文件是否存在...`);
    console.log(`本地音频文件 URL: ${audioUrl}`);
    console.log(`本地文本文件 URL: ${transcriptUrl}`);
    
    console.log(`\n公网访问 URL (Replicate API 将使用这些 URL):`);
    console.log(`公网音频文件 URL: ${minioService.getPublicTemplateAudioUrl(templateId)}`);
    console.log(`公网文本文件 URL: ${minioService.getTemplateTranscriptUrl(templateId)}`);
    
    let audioExists = false;
    let transcriptExists = false;
    
    try {
      const audioResponse = await axios.head(audioUrl);
      audioExists = audioResponse.status === 200;
    } catch (error) {
      audioExists = false;
    }
    
    try {
      const transcriptResponse = await axios.head(transcriptUrl);
      transcriptExists = transcriptResponse.status === 200;
    } catch (error) {
      transcriptExists = false;
    }
    
    console.log(`\n音频文件存在: ${audioExists ? '✅' : '❌'}`);
    console.log(`文本文件存在: ${transcriptExists ? '✅' : '❌'}`);
    
    if (!audioExists || !transcriptExists) {
      console.log('\n⚠️ 警告: 部分模板文件不存在');
      console.log('请确保在 MinIO 存储桶中上传以下文件:');
      console.log(`1. ${config.minio.templatesDir}/${templateId}/source_audio.wav`);
      console.log(`2. ${config.minio.templatesDir}/${templateId}/source_transcript.txt`);
      console.log('\n您可以使用 MinIO 控制台或 API 上传这些文件。');
    } else {
      console.log('\n✅ 模板文件已存在，MinIO 初始化完成!');
    }
    
    // 验证公网 IP 能否正常访问
    console.log('\n正在验证公网 IP 访问...');
    try {
      const publicUrl = minioService.getPublicTemplateAudioUrl(templateId);
      console.log(`请手动在浏览器中打开以下 URL 验证公网访问是否正常:`);
      console.log(publicUrl);
      console.log('\n如果能正常访问，说明公网 IP 配置正确，Replicate API 可以正常获取音频文件。');
    } catch (error) {
      console.error('验证公网 IP 访问时出错:', error);
    }
  } catch (error) {
    console.error('初始化 MinIO 时出错:', error);
    process.exit(1);
  }
}

// 执行初始化
initMinio().catch(console.error);
