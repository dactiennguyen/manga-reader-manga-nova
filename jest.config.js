// ESM-only packages must be compiled by Babel when running under Jest.
const ESM_PACKAGES = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  '@react-navigation',
  'react-native-.*',
  '@shopify/.*',
  '@dr.pogodin',
  '@react-native-documents',
  'uniwind',
  'lucide-react-native',
];

module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/helpers/'],
  transformIgnorePatterns: [`node_modules/(?!(${ESM_PACKAGES.join('|')})/)`],
};
