export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiErrorCode = 'not-configured' | 'network' | 'timeout' | 'server' | 'empty' | 'format' | 'cancelled';

export class AiError extends Error {
  code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const AI_TIMEOUT_MS = 90000;

export type AiRequest = {
  messages: AiMessage[];
  json?: boolean;
};

export interface AiClient {
  complete(request: AiRequest, signal?: AbortSignal): Promise<string>;
}

let client: AiClient | null = null;

/** The app layer registers the real client at startup, so core never imports data. */
export function configureAi(next: AiClient | null): void {
  client = next;
}

export function chat(messages: AiMessage[], options: { signal?: AbortSignal } = {}): Promise<string> {
  if (!client) {
    return Promise.reject(new AiError('not-configured', 'Set the AI server address in Profile first.'));
  }
  return client.complete({ messages }, options.signal);
}

export function normalizeBaseUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!url) {
    return '';
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // A URL with a path is complete: Gemini's is /v1beta/openai.
  return /^https?:\/\/[^/]+$/i.test(url) ? `${url}/v1` : url;
}

export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiError) {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

export function repairJson(source: string): string {
  const text = source.replace(/[“”]/g, '"');
  const stack: string[] = [];
  let out = '';
  let inString = false;
  let escaped = false;
  let last = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        last = '"';
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch) && (last === '{' || last === ',')) {
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))?.[0] ?? ch;
      const after = text.slice(i + word.length);
      const key = /^"?\s*:/.exec(after);
      if (key) {
        out += `"${word}"`;
        i += word.length + (after[0] === '"' ? 1 : 0);
      } else {
        out += word;
        i += word.length;
      }
      last = 'w';
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      out = out.replace(/,\s*$/, '');
      stack.pop();
    }
    out += ch;
    if (!/\s/.test(ch)) {
      last = ch;
    }
    i += 1;
  }
  if (inString) {
    out += '"';
  }
  return out.replace(/,\s*$/, '') + stack.reverse().join('');
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  const source = (fenced ? fenced[1] : text).trim();
  const starts = [source.indexOf('{'), source.indexOf('[')].filter(index => index >= 0);
  if (!starts.length) {
    throw new AiError('format', 'The AI answer was not in the expected format. Try again.');
  }
  const start = Math.min(...starts);
  const end = Math.max(source.lastIndexOf('}'), source.lastIndexOf(']'));
  const candidates = [
    source.slice(start, end + 1),
    repairJson(source.slice(start, end + 1)),
    repairJson(source.slice(start)),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new AiError('format', 'The AI answer was not in the expected format. Try again.');
}
