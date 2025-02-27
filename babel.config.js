module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // 如果您已经在使用 expo-router，这一行可能已经存在
      "@babel/plugin-transform-export-namespace-from",

      // 将 Reanimated 插件添加到这里，确保在最后
      "react-native-reanimated/plugin",
    ],
  };
};