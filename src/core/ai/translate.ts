import { t } from '../i18n';
import { AiError, type AiMessage } from './port';
import { askJson } from './story';

const TRANSLATOR =
  'You translate manga dialogue. Keep lines short, natural and in character; keep sound effects as onomatopoeia of the target language. Answer with JSON only: no markdown fences, no commentary.';

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function translateMessages(lines: string[], language: string, brief: string): AiMessage[] {
  return [
    { role: 'system', content: TRANSLATOR },
    {
      role: 'user',
      content: `${brief ? `${brief}\n\n` : ''}Translate these ${
        lines.length
      } speech bubble texts into ${language}. Keep the same order and count; translate each item on its own.\n${JSON.stringify(
        lines,
      )}\n\nReturn {"lines": [string, ...]} with exactly ${lines.length} items.`,
    },
  ];
}

export function parseTranslations(value: unknown, count: number): string[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(field(value, 'lines'))
    ? (field(value, 'lines') as unknown[])
    : [];
  const lines = source.map(item => (typeof item === 'string' ? item.trim() : ''));
  if (lines.length !== count || lines.some(line => !line)) {
    throw new AiError('format', t('The AI answer was not in the expected format. Try again.'));
  }
  return lines;
}

const TRANSLATE_BATCH = 25;

export async function translateLines(
  lines: string[],
  language: string,
  brief: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const out: string[] = [];
  for (let start = 0; start < lines.length; start += TRANSLATE_BATCH) {
    const batch = lines.slice(start, start + TRANSLATE_BATCH);
    const translated = await askJson(
      translateMessages(batch, language, brief),
      value => parseTranslations(value, batch.length),
      signal,
    );
    out.push(...translated);
  }
  return out;
}
