const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');

class ReplicateService {
  constructor() {
    this.apiUrl = config.replicate.apiUrl;
    this.headers = {
      'Authorization': `Token ${config.replicate.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  async generateAudio(sourceAudioUrl, sourceTranscript, ttsText) {
    try {
      // 准备 Replicate API 请求参数
      const payload = {
        version: "669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d",
        input: {
          source_audio: sourceAudioUrl,
          source_transcript: sourceTranscript,
          tts_text: ttsText,
          task: "zero-shot voice clone"
        }
      };

      // 发送请求创建预测任务
      console.log('Sending request to Replicate API:', JSON.stringify(payload));
      const response = await axios.post(this.apiUrl, payload, { headers: this.headers });
      
      // 获取预测任务 ID
      const predictionId = response.data.id;
      console.log(`Prediction created with ID: ${predictionId}`);
      
      // 轮询获取预测结果
      return await this.pollPredictionResult(predictionId);
    } catch (error) {
      console.error('Error calling Replicate API:', error.response?.data || error.message);
      throw new Error('Failed to generate audio via Replicate API');
    }
  }

  async pollPredictionResult(predictionId) {
    // Increase the maximum attempts to allow for longer processing time
    const maxAttempts = 180;  // 6 minutes at 2-second intervals
    const pollingInterval = 2000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `${this.apiUrl}/${predictionId}`,
          { headers: this.headers }
        );
        
        const prediction = response.data;
        
        if (prediction.status === 'succeeded') {
          console.log('Prediction succeeded:', prediction.output);
          
          // 下载生成的音频文件
          const audioUrl = prediction.output;
          const audioBuffer = await this.downloadAudio(audioUrl);
          return audioBuffer;
        } else if (prediction.status === 'failed') {
          throw new Error(`Prediction failed: ${prediction.error}`);
        } else {
          console.log(`Prediction status: ${prediction.status}. Waiting... (Attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
      } catch (error) {
        // Only throw an error if the API call itself failed
        // We don't want to exit polling just because of a temporary network issue
        console.error('Error during polling, will retry:', error.message);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }
    
    // Even after maximum attempts, don't throw error if the task is still running
    // Instead, provide a message but continue polling
    console.log(`Maximum initial polling attempts (${maxAttempts}) reached, but task may still be processing.`);
    console.log(`Continuing to poll until task completes or fails...`);
    
    // Continue polling indefinitely until the task succeeds or fails
    while (true) {
      try {
        const response = await axios.get(
          `${this.apiUrl}/${predictionId}`,
          { headers: this.headers }
        );
        
        const prediction = response.data;
        
        if (prediction.status === 'succeeded') {
          console.log('Prediction finally succeeded:', prediction.output);
          
          // 下载生成的音频文件
          const audioUrl = prediction.output;
          const audioBuffer = await this.downloadAudio(audioUrl);
          return audioBuffer;
        } else if (prediction.status === 'failed') {
          throw new Error(`Prediction failed: ${prediction.error}`);
        } else {
          console.log(`Extended polling - Prediction status: ${prediction.status}. Continuing to wait...`);
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
      } catch (error) {
        console.error('Error during extended polling, will retry:', error.message);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }
  }

  async downloadAudio(audioUrl) {
    try {
      const response = await axios({
        method: 'get',
        url: audioUrl,
        responseType: 'arraybuffer'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error downloading audio:', error);
      throw new Error('Failed to download generated audio');
    }
  }
}

module.exports = new ReplicateService();
