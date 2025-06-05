// Learn more https://docs.expo.dev/guides/customizing-metro

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path'); // 确保引入 path 模块

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 添加 Node.js 模块的 polyfills
config.resolver.extraNodeModules = {
  ...require('node-libs-react-native'),
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('crypto-browserify'),
  buffer: require.resolve('buffer/'),
  events: require.resolve('events/'),
  util: require.resolve('util/'),
  url: require.resolve('url/'),
  querystring: require.resolve('querystring-es3'),
  
  // 添加 argon2.wasm 的映射
  'argon2-browser/dist/argon2.wasm': path.resolve(__dirname, 'node_modules/argon2-browser/dist/argon2.wasm'),
};

// 确保能够处理 mjs 文件和其他扩展
config.resolver.sourceExts.push('mjs');
config.resolver.assetExts.push('wasm');

// 添加对Matrix SDK的特殊处理
config.resolver.alias = {
  ...config.resolver.alias,
  // 确保使用正确的Buffer实现
  'buffer': require.resolve('buffer/'),
  // 确保事件发射器正常工作
  'events': require.resolve('events/'),
};

// 在生产环境中移除console语句
if (process.env.NODE_ENV === 'production') {
  config.transformer.minifierConfig = {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
    compress: {
      drop_console: true,
      drop_debugger: true,
    },
  };
}

module.exports = config;