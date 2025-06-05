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
  
  // 为 Matrix SDK 添加额外的 polyfills (只添加存在的包)
  path: require.resolve('path-browserify'),
  os: require.resolve('os-browserify/browser'),
  https: require.resolve('https-browserify'),
  http: require.resolve('stream-http'),
  timers: require.resolve('timers-browserify'),
  console: require.resolve('console-browserify'),
  constants: require.resolve('constants-browserify'),
  domain: require.resolve('domain-browser'),
  punycode: require.resolve('punycode'),
  process: require.resolve('process/browser'),
  vm: require.resolve('vm-browserify'),
  zlib: require.resolve('browserify-zlib'),
  
  // React Native 特定的映射
  'react-native-get-random-values': require.resolve('react-native-get-random-values'),
  'text-encoding-polyfill': require.resolve('text-encoding-polyfill'),
  'react-native-url-polyfill': require.resolve('react-native-url-polyfill'),
};

// 确保能够处理 mjs 文件和其他扩展
config.resolver.sourceExts.push('mjs', 'cjs');
config.resolver.assetExts.push('wasm', 'bin');

// 添加对Matrix SDK的特殊处理
config.resolver.alias = {
  ...config.resolver.alias,
  // 确保使用正确的Buffer实现
  'buffer': require.resolve('buffer/'),
  // 确保事件发射器正常工作
  'events': require.resolve('events/'),
  // 添加 Matrix SDK 的别名
  'matrix-js-sdk': path.resolve(__dirname, 'node_modules/matrix-js-sdk'),
};

// 添加 resolver platforms
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// 在生产环境中移除console语句
if (process.env.NODE_ENV === 'production') {
  config.transformer.minifierConfig = {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
    compress: {
      drop_console: false, // 暂时保留 console 以便调试
      drop_debugger: true,
    },
  };
}

// 确保 Metro 能够正确处理 ES6 模块
config.transformer.unstable_allowRequireContext = true;

module.exports = config;