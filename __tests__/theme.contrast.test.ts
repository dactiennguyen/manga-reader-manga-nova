import { readFileSync } from './helpers/fs';

const css = readFileSync('global.css');

function tokens(variant: 'dark' | 'light'): Record<string, string> {
  const block = new RegExp(`@variant ${variant} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/g)) {
    out[match[1]] = match[2];
  }
  return out;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ['bg', 'surface', 'raised', 'overlay'];
const READABLE = ['text', 'text-secondary', 'text-muted', 'accent', 'ai', 'danger', 'success', 'warning'];

describe.each(['dark', 'light'] as const)('%s theme contrast', variant => {
  const t = tokens(variant);

  it('finds every token in global.css', () => {
    [...SURFACES, ...READABLE, 'on-accent', 'on-ai', 'control-border'].forEach(name => expect(t[name]).toBeDefined());
  });

  it.each(READABLE)('%s reaches 4.5:1 on every surface', name => {
    SURFACES.forEach(surface => expect(ratio(t[name], t[surface])).toBeGreaterThanOrEqual(4.5));
  });

  it('keeps text on filled buttons at 4.5:1', () => {
    expect(ratio(t['on-accent'], t.accent)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t['on-ai'], t.ai)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps text on printed art at 4.5:1', () => {
    expect(ratio(t['on-paper'], t.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps control borders at 3:1 on every surface', () => {
    SURFACES.forEach(surface => expect(ratio(t['control-border'], t[surface])).toBeGreaterThanOrEqual(3));
  });
});
