module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated 4 splits the babel plugin into the worklets package
      'react-native-worklets/plugin',
    ],
  };
};
