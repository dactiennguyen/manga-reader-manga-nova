import { AI_TIMEOUT_MS, AiError, normalizeBaseUrl, type AiClient, type AiRequest } from '../core/ai/port';

export type AiConfig = { baseUrl: string; apiKey: string; model: string; timeoutMs?: number };

const DEFAULT_MODEL = 'gemini-3.6-flash';

function readPath(data: unknown, path: (string | number)[]): string {
  let current: unknown = data;
  for (const key of path) {
    if (current === null || typeof current !== 'object') {
      return '';
    }
    current = (current as Record<string | number, unknown>)[key];
  }
  return typeof current === 'string' ? current : '';
}

async function send(config: AiConfig, request: AiRequest, signal?: AbortSignal): Promise<string> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  if (!baseUrl) {
    throw new AiError('not-configured', 'Set the AI server address in Profile first.');
  }
  const apiKey = config.apiKey.trim();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs ?? AI_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  if (signal?.aborted) {
    controller.abort();
  }
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : null) },
      body: JSON.stringify({ model: config.model.trim() || DEFAULT_MODEL, messages: request.messages }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: unknown = null;
    try {
      data = JSON.parse(raw);
    } catch {}
    if (!response.ok) {
      const detail = readPath(data, ['error', 'message']);
      throw new AiError(
        'server',
        response.status === 401 || response.status === 403
          ? 'The AI server rejected the API key.'
          : `The AI server answered with an error (${response.status})${detail ? `: ${detail.slice(0, 120)}` : '.'}`,
      );
    }
    const content = readPath(data, ['choices', 0, 'message', 'content']);
    if (!content || !content.trim()) {
      throw new AiError('empty', 'The AI returned an empty answer. Try again.');
    }
    return content;
  } catch (error) {
    if (error instanceof AiError) {
      throw error;
    }
    if (signal?.aborted) {
      throw new AiError('cancelled', 'Cancelled.');
    }
    if (timedOut) {
      throw new AiError('timeout', 'The AI took too long to answer. Try again.');
    }
    throw new AiError('network', 'Could not reach the AI server. Check the address and your connection.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function createAiClient(config: () => AiConfig): AiClient {
  return { complete: (request, signal) => send(config(), request, signal) };
}

export function testConnection(config: AiConfig): Promise<string> {
  return send(
    { ...config, timeoutMs: 30000 },
    { messages: [{ role: 'user', content: 'Reply with the single word: ready' }] },
  );
}
