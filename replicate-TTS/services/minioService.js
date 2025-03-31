const Minio = require('minio');
const axios = require('axios');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

class MinioService {
  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey
    });
    
    this.bucketName = config.minio.bucket;
    
    // 本地访问的端点 (用于调试和本地上传)
    this.localEndpoint = `${config.minio.endPoint}:${config.minio.port}`;
    
    // 公网访问的端点 (用于 Replicate API 访问)
    this.publicEndpoint = `${config.minio.publicEndPoint}:${config.minio.port}`;
    
    this.initBucket();
  }

  async initBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        console.log(`Bucket '${this.bucketName}' created successfully`);
      }
    } catch (error) {
      console.error('Error initializing bucket:', error);
    }
  }

  async uploadAudio(audioBuffer) {
    try {
      const objectName = `audio-${uuidv4()}.wav`;
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        audioBuffer
      );
      
      // 构建并返回 MinIO URL (使用本地端点，因为返回给前端)
      const audioUrl = `http://${this.localEndpoint}/${this.bucketName}/${objectName}`;
      return audioUrl;
    } catch (error) {
      console.error('Error uploading audio to MinIO:', error);
      throw new Error('Failed to upload audio to storage');
    }
  }

  // 获取公网可访问的模板音频 URL (Replicate API 需要)
  getPublicTemplateAudioUrl(templateId) {
    return `http://${this.publicEndpoint}/${this.bucketName}/${config.minio.templatesDir}/${templateId}/source_audio.wav`;
  }
  
  // 获取本地可访问的模板音频 URL (本地调试用)
  getLocalTemplateAudioUrl(templateId) {
    return `http://${this.localEndpoint}/${this.bucketName}/${config.minio.templatesDir}/${templateId}/source_audio.wav`;
  }
  
  // 获取公网可访问的模板文本 URL
  getTemplateTranscriptUrl(templateId) {
    return `http://${this.publicEndpoint}/${this.bucketName}/${config.minio.templatesDir}/${templateId}/source_transcript.txt`;
  }
  
  // 获取源音频 URL - 新方法，从指定 URL 获取
  getSourceAudioUrl(templateId) {
    return `${config.sourceFiles.baseUrl}/${templateId}/source_audio.mp3`;
  }
  
  // 获取源文本 URL - 新方法，从指定 URL 获取
  getSourceTranscriptUrl(templateId) {
    return `${config.sourceFiles.baseUrl}/${templateId}/source_transcript.txt`;
  }
  
  async getTranscriptText(templateId) {
    try {
      // 使用新的 URL 格式获取文本内容
      const transcriptUrl = this.getSourceTranscriptUrl(templateId);
      const response = await axios.get(transcriptUrl);
      
      if (response.status !== 200) {
        throw new Error(`Failed to fetch transcript from URL: ${response.statusText}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching transcript from URL:', error);
      throw new Error(`Failed to get transcript for template ID: ${templateId}`);
    }
  }
}

module.exports = new MinioService();
