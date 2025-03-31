const fs = require('fs');
const path = require('path');
const replicateService = require('../services/replicateService');
const minioService = require('../services/minioService');
const config = require('../config');

class TTSController {
  async generateAudio(req, res) {
    try {
      const { templateId, tts_text } = req.body;
      
      if (!templateId || !tts_text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: templateId and tts_text'
        });
      }
      
      // 1. 加载模板数据
      const templateData = await this.loadTemplateData(templateId);
      
      // 2. 调用 Replicate API 生成音频
      const audioBuffer = await replicateService.generateAudio(
        templateData.sourceAudioUrl,
        templateData.sourceTranscript,
        tts_text
      );
      
      // 3. 保存音频到 MinIO
      const audioUrl = await minioService.uploadAudio(audioBuffer);
      
      // 4. 返回音频 URL 给前端
      return res.status(200).json({
        success: true,
        data: {
          audio_url: audioUrl
        }
      });
    } catch (error) {
      console.error('Error generating audio:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate audio'
      });
    }
  }
  
  async loadTemplateData(templateId) {
    try {
      // 获取源音频 URL，现在从指定 URL 获取，而不是 MinIO
      const sourceAudioUrl = minioService.getSourceAudioUrl(templateId);
      
      // 获取源文本内容
      const sourceTranscript = await minioService.getTranscriptText(templateId);
      
      console.log(`Template data loaded: Audio URL: ${sourceAudioUrl}`);
      console.log(`Template transcript: ${sourceTranscript}`);
      
      return {
        sourceAudioUrl,
        sourceTranscript
      };
    } catch (error) {
      console.error('Error loading template data:', error);
      throw new Error(`Failed to load template data: ${error.message}`);
    }
  }
}

module.exports = new TTSController();
