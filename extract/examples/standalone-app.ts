/**
 * 独立应用示例
 * 
 * 本示例展示如何在非 Koishi 环境中使用提取的 NovelAI 功能
 */

import { SimpleContext } from '../simple-context';
import { NovelAIApiService } from '../api-service';
import { NovelAIConfig } from '../features';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 为每个生成的图像创建唯一文件名
function generateUniqueFilename(): string {
  const now = new Date();
  return `image-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}.png`;
}

// 从 base64 数据 URL 保存图像
async function saveImage(dataUrl: string, outputPath: string): Promise<string> {
  // 解析 base64 数据
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  
  if (!matches || matches.length !== 3) {
    throw new Error('无效的数据URL');
  }
  
  // 提取 base64 数据
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 写入文件
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function main() {
  // 创建输出目录
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 创建配置
  // 可以从.env文件或环境变量中加载这些值
  const config: NovelAIConfig = {
    type: process.env.NAI_TYPE as any || 'token',
    token: process.env.NAI_TOKEN,
    email: process.env.NAI_EMAIL,
    password: process.env.NAI_PASSWORD,
    endpoint: process.env.NAI_ENDPOINT || 'https://api.novelai.net',
    apiEndpoint: process.env.NAI_API_ENDPOINT || 'https://api.novelai.net',
    model: process.env.NAI_MODEL || 'nai-v3',
    sampler: process.env.NAI_SAMPLER || 'k_euler_ancestral',
    textSteps: parseInt(process.env.NAI_TEXT_STEPS || '28'),
    imageSteps: parseInt(process.env.NAI_IMAGE_STEPS || '50'),
    scale: parseFloat(process.env.NAI_SCALE || '11'),
    strength: parseFloat(process.env.NAI_STRENGTH || '0.7'),
    noise: parseFloat(process.env.NAI_NOISE || '0.2'),
    requestTimeout: parseInt(process.env.NAI_REQUEST_TIMEOUT || '60000'),
  };
  
  console.log('使用的配置:');
  console.log({
    type: config.type,
    endpoint: config.endpoint,
    model: config.model,
    sampler: config.sampler,
    // 其他敏感信息不显示
  });
  
  // 创建简易上下文
  const ctx = new SimpleContext();
  
  // 初始化 API 服务
  const service = new NovelAIApiService(ctx, config);
  
  try {
    console.log('1. 开始从文本生成图像...');
    const promptText = '一个美丽的风景，有山脉和湖泊，最佳质量，超级详细';
    const negativePrompt = '模糊，低质量，变形';
    
    const textResult = await service.generateFromText({ 
      prompt: promptText,
      negativePrompt: negativePrompt
    });
    
    if (textResult.success) {
      const filename = path.join(outputDir, 'text2image-' + generateUniqueFilename());
      await saveImage(textResult.imageUrl, filename);
      console.log(`成功保存图片到 ${filename}`);
      
      console.log('2. 开始基于第一张图片生成新图片...');
      const imageResult = await service.generateFromImage(
        textResult.imageUrl,
        {
          prompt: '同样的风景但有雪，冬季场景',
          negativePrompt: '模糊，低质量',
          strength: 0.5 // 控制与原图的相似程度
        }
      );
      
      if (imageResult.success) {
        const imageFilename = path.join(outputDir, 'image2image-' + generateUniqueFilename());
        await saveImage(imageResult.imageUrl, imageFilename);
        console.log(`成功保存第二张图片到 ${imageFilename}`);
        
        // 如果后端支持，尝试图像增强
        if (config.type === 'sd-webui') {
          console.log('3. 开始增强第二张图片...');
          const enhanceResult = await service.enhanceImage(
            imageResult.imageUrl,
            {
              scale: 2,
              upscaler: 'Lanczos'
            }
          );
          
          if (enhanceResult.success) {
            const enhanceFilename = path.join(outputDir, 'enhanced-' + generateUniqueFilename());
            await saveImage(enhanceResult.imageUrl, enhanceFilename);
            console.log(`成功保存增强图片到 ${enhanceFilename}`);
          } else {
            console.error('增强图片失败:', enhanceResult.error);
          }
        }
      } else {
        console.error('图像到图像转换失败:', imageResult.error);
      }
    } else {
      console.error('文本到图像生成失败:', textResult.error);
    }
    
    // 获取生成历史
    console.log('4. 获取生成历史...');
    const history = service.getHistory('anonymous', 10); // 获取匿名用户的最近10条历史
    console.log(`找到 ${history.length} 条历史记录`);
    
    // 输出可用模型和采样器
    console.log('5. 可用的模型和参数:');
    console.log('可用模型:', service.getAvailableModels());
    console.log('可用采样器:', service.getAvailableSamplers());
    console.log('可用调度器:', service.getAvailableSchedulers());
    console.log('预设分辨率:', service.getAvailableResolutions());
    
  } catch (error) {
    console.error('发生错误:', error);
  }
}

// 运行主函数
main().catch(console.error);
