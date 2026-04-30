module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    // MUST be last — required by react-native-reanimated 4 + gesture-handler on New Arch
    'react-native-reanimated/plugin',
  ],
};
