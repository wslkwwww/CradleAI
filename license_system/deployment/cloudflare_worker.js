/**
 * Cloudflare Worker 脚本 - 许可证管理系统
 * 
 * 部署在 cradleintro.top 域名下
 * 提供额外的安全层和API请求处理
 */

// 配置项
const config = {
  // API路径前缀
  apiPathPrefix: 'api/v1',
  
  // 许可证验证接口路径
  licenseVerifyPath: 'api/v1/license/verify',
  
  // 源服务器
  origin: {
    hostname: 'cradleintro.top',
    protocol: 'https',
  },
  
  // 安全设置
  security: {
    // 允许的请求来源域名（CORS）
    allowedOrigins: ['https://cradleintro.top', 'https://www.cradleintro.top', 'capacitor://localhost', 'http://localhost'],
    
    // 速率限制
    rateLimit: {
      enabled: true,
      maxRequests: 10,  // 窗口期内最大请求数
      windowSize: 60,   // 窗口期大小（秒）
      keyPrefix: 'rl:',  // 速率限制键前缀
    },
    
    // DDoS保护
    ddosProtection: true,
    
    // 敏感头部
    sensitiveHeaders: ['authorization', 'cookie', 'x-admin-token'],
  }
};

/**
 * 处理HTTP请求的主函数
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // CORS预检请求处理
  if (method === 'OPTIONS') {
    return handleCorsPreflightRequest(request);
  }
  
  // 检查是否为API请求
  if (path.startsWith(config.apiPathPrefix)) {
    // API请求日志记录（不记录敏感信息）
    console.log(`API请求: ${method} ${path}`);
    
    // 处理许可证验证请求
    if (path === config.licenseVerifyPath && method === 'POST') {
      return handleLicenseVerify(request);
    }
    
    // 所有其他API请求
    return handleApiRequest(request);
  }
  
  // 非API请求，透传
  return fetch(request);
}

/**
 * 处理CORS预检请求
 */
function handleCorsPreflightRequest(request) {
  // 获取请求源
  const origin = request.headers.get('Origin') || '*';
  
  // 确定正确的CORS头部
  const corsHeaders = {
    'Access-Control-Allow-Origin': config.security.allowedOrigins.includes(origin) ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-License-Key, X-Device-ID, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
  
  // 返回CORS预检响应
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * 处理许可证验证请求
 */
async function handleLicenseVerify(request) {
  // 获取客户端IP
  const clientIp = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  
  // 检查速率限制
  const rateLimited = await checkRateLimit(clientIp, config.licenseVerifyPath);
  if (rateLimited) {
    return new Response(JSON.stringify({
      success: false,
      error: '请求频率过高，请稍后再试'
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    });
  }
  
  // 克隆请求，添加客户端IP头
  const modifiedRequest = new Request(request);
  const requestInit = {
    method: request.method,
    headers: new Headers(request.headers),
    body: request.body,
    redirect: 'follow'
  };
  
  // 添加客户端真实IP
  requestInit.headers.set('X-Forwarded-For', clientIp);
  
  // 转发到源服务器
  let response;
  try {
    response = await fetch(request.url, requestInit);
  } catch (error) {
    console.error(`许可证验证请求处理错误: ${error}`);
    return new Response(JSON.stringify({
      success: false,
      error: '服务暂时不可用，请稍后再试'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 添加CORS头并返回响应
  return addCorsHeaders(response, request);
}

/**
 * 处理普通API请求
 */
async function handleApiRequest(request) {
  // 转发到源服务器
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    console.error(`API请求处理错误: ${error}`);
    return new Response(JSON.stringify({
      success: false,
      error: '服务暂时不可用，请稍后再试'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 添加CORS头并返回响应
  return addCorsHeaders(response, request);
}

/**
 * 为响应添加CORS头
 */
function addCorsHeaders(response, request) {
  const origin = request.headers.get('Origin') || '*';
  
  // 创建新的响应头
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', config.security.allowedOrigins.includes(origin) ? origin : '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-License-Key, X-Device-ID');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  
  // 添加安全头
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('X-XSS-Protection', '1; mode=block');
  
  // 返回带有新头的响应
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * 检查速率限制
 * 注意：需要KV命名空间，需要在Cloudflare Workers管理界面中创建
 * 命名空间名称: LICENSE_SYSTEM_KV
 */
async function checkRateLimit(clientIp, path) {
  // 如果速率限制被禁用，直接返回false（不限制）
  if (!config.security.rateLimit.enabled) {
    return false;
  }
  
  try {
    // 构建速率限制键
    const key = `${config.security.rateLimit.keyPrefix}${clientIp}:${path}`;
    
    // 从KV存储获取当前计数
    let currentCount = await LICENSE_SYSTEM_KV.get(key);
    currentCount = currentCount ? parseInt(currentCount) : 0;
    
    // 检查是否超出限制
    if (currentCount >= config.security.rateLimit.maxRequests) {
      return true; // 速率限制已触发
    }
    
    // 递增计数
    await LICENSE_SYSTEM_KV.put(key, (currentCount + 1).toString(), {
      expirationTtl: config.security.rateLimit.windowSize
    });
    
    return false; // 未触发速率限制
  } catch (error) {
    console.error(`速率限制检查错误: ${error}`);
    return false; // 出错时不应用速率限制
  }
}

// 请求处理入口
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
