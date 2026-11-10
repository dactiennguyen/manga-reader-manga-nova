import { CATALOG, CATALOG_PARTS } from '../src/core/i18n/catalog';

declare const require: (name: string) => {
  readdirSync: (path: string, options: { withFileTypes: true }) => { name: string; isDirectory: () => boolean }[];
  readFileSync: (path: string, encoding: string) => string;
};
declare const __dirname: string;

const fs = require('fs');
const SRC = `${__dirname}/../src`;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return path.endsWith('/core/i18n') ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const STRING = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"`;
const CALL = new RegExp(String.raw`(?<![\w.])(t|msg)\(\s*(${STRING})`, 'g');
// tn(count, one, other): the count comes first and is never a string.
const COUNT_CALL = new RegExp(String.raw`(?<![\w.])tn\(\s*[^'"\n]*?,\s*(${STRING})\s*,\s*(${STRING})`, 'g');
const TEMPLATE_CALL = /(?<![\w.])(t|tn|msg)\(\s*`/;

function unquote(literal: string): string {
  // eslint-disable-next-line no-new-func
  return new Function(`return ${literal}`)() as string;
}

/** Every English text the code asks for, with one place it is used. */
function usedKeys(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    const name = file.slice(SRC.length + 1);
    if (TEMPLATE_CALL.test(source)) {
      throw new Error(`${name}: t(), tn() and msg() take a plain string. Use t('Hi {name}', { name }) and not a template string.`);
    }
    for (const match of source.matchAll(CALL)) {
      used.set(unquote(match[2]), name);
    }
    for (const match of source.matchAll(COUNT_CALL)) {
      used.set(unquote(match[1]), name);
      used.set(unquote(match[2]), name);
    }
  }
  return used;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',');

describe('translation catalog', () => {
  const used = usedKeys();

  it('has Vietnamese and Japanese for every text in the code', () => {
    const missing = [...used].filter(([key]) => !CATALOG[key]).map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('has no entry the code no longer uses', () => {
    expect(Object.keys(CATALOG).filter(key => !used.has(key))).toEqual([]);
  });

  it('keeps each text in one part only', () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const [part, entries] of Object.entries(CATALOG_PARTS)) {
      for (const key of Object.keys(entries)) {
        if (seen.has(key)) {
          twice.push(`${key} (${seen.get(key)}, ${part})`);
        }
        seen.set(key, part);
      }
    }
    expect(twice).toEqual([]);
  });

  it('keeps the same placeholders in every language, and no empty text', () => {
    const wrong = Object.entries(CATALOG).filter(
      ([key, entry]) =>
        !entry.vi.trim() ||
        !entry.ja.trim() ||
        placeholders(entry.vi) !== placeholders(key) ||
        placeholders(entry.ja) !== placeholders(key),
    );
    expect(wrong.map(([key]) => key)).toEqual([]);
  });
});
