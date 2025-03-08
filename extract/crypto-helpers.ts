// 不再导入 argon2-browser，改为使用纯 JavaScript 实现

import sha256 from 'crypto-js/sha256';
import hmacSHA512 from 'crypto-js/hmac-sha512';
import Base64 from 'crypto-js/enc-base64';

/**
 * 简化版的访问密钥生成函数
 * 注意：这个实现不是安全的，仅用于测试目的
 * 实际应用中应使用服务器端计算 Argon2 密钥
 */
export async function calcAccessKey(email: string, password: string): Promise<string> {
  try {
    console.log('使用简化版访问密钥计算函数');
    
    // 创建盐值 (使用 email 和密码前缀)
    const salt = password.slice(0, 6) + email + 'novelai_data_access_key';
    
    // 使用 HMAC-SHA512 计算一个安全的哈希值
    const hash1 = hmacSHA512(password, salt);
    const hash2 = hmacSHA512(hash1.toString(), salt);
    
    // 转换为 Base64 并截取为合适长度
    return Base64.stringify(hash2).slice(0, 64);
  } catch (error) {
    console.error('计算访问密钥失败:', error);
    throw new Error('访问密钥计算失败');
  }
}

/**
 * 简化版的加密密钥生成函数
 * 注意：这个实现不是安全的，仅用于测试目的
 * 实际应用中应使用服务器端计算 Argon2 密钥
 */
export async function calcEncryptionKey(email: string, password: string): Promise<string> {
  try {
    console.log('使用简化版加密密钥计算函数');
    
    // 创建盐值 (使用 email 和密码前缀)
    const salt = password.slice(0, 6) + email + 'novelai_data_encryption_key';
    
    // 使用 SHA-256 和 HMAC-SHA512 组合计算哈希
    const initialHash = sha256(password + salt).toString();
    const finalHash = hmacSHA512(initialHash, salt);
    
    // 返回 Base64 编码的密钥
    return Base64.stringify(finalHash);
  } catch (error) {
    console.error('计算加密密钥失败:', error);
    throw new Error('加密密钥计算失败');
  }
}
