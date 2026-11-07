module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod ships `export * as`, which the React Native preset leaves alone.
    '@babel/plugin-transform-export-namespace-from',
    // The worklets plugin (used by Reanimated and Skia) must be listed last.
    'react-native-worklets/plugin',
  ],
};
