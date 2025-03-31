/**
 * Replicate 库兼容性补丁
 * 
 * 此脚本用于修复老版本 Node.js 中使用 Replicate 库时出现的兼容性问题
 * 主要修复 "Headers is not defined" 和 "_fetch is not a function" 等错误
 */

const fs = require('fs');
const path = require('path');

console.log('开始应用 Replicate 兼容性补丁...');

// 1. 确保安装了 node-fetch
try {
  require('node-fetch');
  console.log('node-fetch 已安装');
} catch (error) {
  console.error('未找到 node-fetch，请先安装: npm install node-fetch@2');
  process.exit(1);
}

// 2. 查找 Replicate 模块路径
try {
  const replicatePath = require.resolve('replicate');
  console.log(`找到 Replicate 模块路径: ${replicatePath}`);
  
  const replicateDir = path.dirname(replicatePath);
  let replicateIndexPath;
  
  // 根据不同版本的 Replicate，找到主文件
  const possiblePaths = [
    path.join(replicateDir, 'dist', 'index.js'),
    path.join(replicateDir, 'dist', 'cjs', 'index.js'),
    replicatePath
  ];
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      replicateIndexPath = possiblePath;
      console.log(`找到 Replicate 主文件: ${replicateIndexPath}`);
      break;
    }
  }
  
  if (!replicateIndexPath) {
    throw new Error('无法找到 Replicate 库主文件');
  }
  
  // 3. 读取文件内容
  let content = fs.readFileSync(replicateIndexPath, 'utf8');
  
  // 4. 检查是否已经打过补丁
  if (content.includes('// COMPATIBILITY PATCH APPLIED')) {
    console.log('兼容性补丁已经应用，跳过');
  } else {
    // 5. 添加补丁代码
    const patch = `
// COMPATIBILITY PATCH APPLIED
const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;
const Headers = nodeFetch.Headers;
const Request = nodeFetch.Request;
const Response = nodeFetch.Response;

// 确保全局对象可用
if (typeof global.fetch === 'undefined') global.fetch = fetch;
if (typeof global.Headers === 'undefined') global.Headers = Headers;
if (typeof global.Request === 'undefined') global.Request = Request;
if (typeof global.Response === 'undefined') global.Response = Response;

// 修复 _fetch 不是函数的问题
if (typeof Replicate !== 'undefined' && Replicate.prototype) {
  Replicate.prototype._fetch = fetch;
}
`;
    
    // 在文件开头插入补丁代码
    content = patch + content;
    
    // 写回文件
    fs.writeFileSync(replicateIndexPath, content, 'utf8');
    console.log('兼容性补丁已成功应用!');
  }
  
  console.log('补丁应用完成，请重启应用');
  
} catch (error) {
  console.error('应用补丁时出错:', error);
  process.exit(1);
}
