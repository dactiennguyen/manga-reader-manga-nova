const layer = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

const group = (names, message) => ({ group: names, message });

module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['android/', 'docs/', 'src/uniwind-types.d.ts'],
  overrides: [
    layer(
      ['src/core/**'],
      [
        group(['react', 'react-native', 'react-native-*', '@shopify/*', 'zustand'], 'core stays plain TypeScript.'),
        group(['**/data/*', '**/state/*', '**/ui/*', '**/ui', '**/render/*', '**/features/*', '**/native/*', '**/app/*'], 'core imports core only.'),
      ],
    ),
    layer(['src/data/**'], [group(['**/state/useStory', '**/ui', '**/ui/*', '**/features/*', '**/render/*'], 'data must not reach upward.')]),
    layer(['src/render/**'], [group(['**/state/*', '**/data/*', '**/ui', '**/ui/*', '**/features/*'], 'render imports core only.')]),
    layer(['src/state/**'], [group(['**/data/*', '@op-engineering/op-sqlite', '**/ui', '**/ui/*', '**/features/*'], 'state reaches data through ports.')]),
    layer(['src/ui/**'], [group(['**/state/*', '**/data/*', '**/render/*', '**/features/*'], 'ui knows nothing about the app.')]),
    {
      files: ['src/features/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          { patterns: [group(['**/data/*', '@op-engineering/op-sqlite', '**/app/*'], 'features go through state.')] },
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
            message: 'Use a token from global.css. Drawing palettes live in src/core.',
          },
          { selector: "Property[key.name='fontFamily']", message: 'Use <Text variant>.' },
          { selector: "Property[key.name='fontSize'][value.type='Literal']", message: 'Use <Text variant>.' },
        ],
      },
    },
  ],
};
