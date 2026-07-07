import type { ProviderType } from './ai-provider-constants';

// Model ids offered by OpenAI's /models that cannot be used with the chat
// completions API this app calls — filtered out so the picker only shows models
// that will actually work (instruct = legacy completions, codex/-pro = Responses API only).
const OPENAI_NON_CHAT = /embed|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|davinci|babbage|computer-use|sora|instruct|codex|deep-research|-pro\b/i;

/**
 * Fetch the live model list from a provider's API.
 * Runs server-side; base URLs are resolved from the app container,
 * consistent with how the actual AI calls are made.
 */
export async function fetchAvailableModels(type: ProviderType, apiKey: string, baseUrl: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, '');
  const signal = AbortSignal.timeout(15000);

  switch (type) {
    case 'openai':
    case 'openai-compatible': {
      const headers: Record<string, string> = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(`${base}/models`, { headers, signal });
      if (!res.ok) throw new Error(`Modell-Liste fehlgeschlagen: HTTP ${res.status}`);
      const data = await res.json() as { data?: Array<{ id?: unknown }> };
      const ids = (Array.isArray(data?.data) ? data.data : [])
        .map(m => String(m?.id || ''))
        .filter(Boolean);
      const usable = type === 'openai' ? ids.filter(id => !OPENAI_NON_CHAT.test(id)) : ids;
      return Array.from(new Set(usable)).sort();
    }

    case 'anthropic': {
      const res = await fetch(`${base}/models?limit=100`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        signal,
      });
      if (!res.ok) throw new Error(`Modell-Liste fehlgeschlagen: HTTP ${res.status}`);
      const data = await res.json() as { data?: Array<{ id?: unknown }> };
      const ids = (Array.isArray(data?.data) ? data.data : [])
        .map(m => String(m?.id || ''))
        .filter(Boolean);
      return Array.from(new Set(ids)).sort();
    }

    case 'ollama':
    case 'ollama-cloud': {
      const headers: Record<string, string> = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(`${base}/api/tags`, { headers, signal });
      if (!res.ok) throw new Error(`Modell-Liste fehlgeschlagen: HTTP ${res.status}`);
      const data = await res.json() as { models?: Array<{ name?: unknown; model?: unknown }> };
      const names = (Array.isArray(data?.models) ? data.models : [])
        .map(m => String(m?.name || m?.model || ''))
        .filter(Boolean);
      return Array.from(new Set(names)).sort();
    }

    default:
      throw new Error(`Unbekannter Anbieter-Typ: ${type}`);
  }
}
