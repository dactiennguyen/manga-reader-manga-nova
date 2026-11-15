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
  'phosphor-react-native',
];

module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Agent worktrees under .claude/ hold whole copies of the repo.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/helpers/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  transformIgnorePatterns: [`node_modules/(?!(${ESM_PACKAGES.join('|')})/)`],
};
