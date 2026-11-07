import { listFiles, readFileSync } from './helpers/fs';

const REGISTRY = 'src/ui/icons.ts';
const registry = readFileSync(REGISTRY);

describe('icons', () => {
  it('reach the app only through src/ui/icons.ts', () => {
    const offenders = listFiles('src')
      .filter(file => /\.tsx?$/.test(file) && file !== REGISTRY)
      .filter(file => /^import (?!type ).*from 'phosphor-react-native/m.test(readFileSync(file)));
    expect(offenders).toEqual([]);
  });

  it('are imported one file at a time, so the bundle skips the rest of the set', () => {
    const exports = registry.split('\n').filter(line => line.startsWith('export'));
    expect(exports.length).toBeGreaterThan(100);
    exports.forEach(line => expect(line).toMatch(/from 'phosphor-react-native\/src\/icons\/\w+';$/));
  });

  it('have one name each', () => {
    const names = registry.match(/ as \w+/g) ?? [];
    expect(new Set(names).size).toBe(names.length);
  });
});
