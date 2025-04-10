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

  // 添加 argon2.wasm 的映射
  'argon2-browser/dist/argon2.wasm': path.resolve(__dirname, 'node_modules/argon2-browser/dist/argon2.wasm'),
};

// 确保能够处理 mjs 文件
config.resolver.sourceExts.push('mjs');

module.exports = config;