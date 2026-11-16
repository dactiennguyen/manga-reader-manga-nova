/* eslint-env jest */
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The photo picker is native only; under Jest it is closed straight away.
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
  launchCamera: jest.fn(async () => ({ didCancel: true })),
}));
