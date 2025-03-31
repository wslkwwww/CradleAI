const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 模板路径
const templateDir = path.join(__dirname, '..', 'templates', 'template1');

/**
 * 设置测试模板
 */
async function setupTemplate() {
  console.log('======= 设置测试模板 =======');
  
  // 确保模板目录存在
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true });
    console.log(`创建模板目录: ${templateDir}`);
  }
  
  // 创建示例文本文件
  const sampleText = '这是一个示例音频的文本内容。';
  const transcriptPath = path.join(templateDir, 'source_transcript.txt');
  
  fs.writeFileSync(transcriptPath, sampleText);
  console.log(`创建示例文本文件: ${transcriptPath}`);
  
  // 检查音频文件是否存在
  const audioPath = path.join(templateDir, 'source_audio.wav');
  if (!fs.existsSync(audioPath)) {
    console.log(`\n⚠️ 警告: 音频文件不存在: ${audioPath}`);
    console.log('请确保在此路径放置一个WAV格式的示例音频文件。');
    console.log('您需要手动添加一个名为 "source_audio.wav" 的音频文件到模板目录。');
    
    // 询问用户是否需要帮助
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('是否需要帮助获取示例音频文件? (y/n): ', answer => {
        rl.close();
        resolve(answer.toLowerCase());
      });
    });
    
    if (answer === 'y' || answer === 'yes') {
      console.log('\n您可以通过以下方式获取示例音频:');
      console.log('1. 使用示例音频文件，如从公开数据集下载');
      console.log('2. 使用录音工具录制自己的声音');
      console.log('3. 使用文本转语音工具生成示例音频');
      console.log('\n请确保音频格式为WAV，并将其命名为 "source_audio.wav"');
    }
  } else {
    console.log(`✅ 音频文件已存在: ${audioPath}`);
  }
  
  console.log('\n模板设置完成！您现在可以运行 test-tts-api.js 测试 TTS API。');
}

// 执行设置
setupTemplate().catch(console.error);
