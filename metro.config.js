// Learn more https://docs.expo.dev/guides/customizing-metro

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 添加 Node.js 模块的 polyfills
config.resolver.extraNodeModules = {
  ...require('node-libs-react-native'),
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('crypto-browserify'),
  buffer: require.resolve('buffer/'),
};

// 确保能够处理 mjs 文件
config.resolver.sourceExts.push('mjs');

module.exports = config;
