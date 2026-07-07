export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { fetchAvailableModels } from '@/lib/model-listing';
import type { ProviderType } from '@/lib/ai-provider-constants';

const VALID_TYPES: ProviderType[] = ['openai', 'anthropic', 'ollama', 'ollama-cloud', 'openai-compatible'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body?.type as ProviderType;
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';
    const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl : '';

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Ungültiger Anbieter-Typ' }, { status: 400 });
    }
    if (!baseUrl) {
      return NextResponse.json({ error: 'Basis-URL fehlt' }, { status: 400 });
    }

    const models = await fetchAvailableModels(type, apiKey, baseUrl);
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Model listing error:', error);
    const msg = error instanceof Error ? error.message : 'Modelle konnten nicht geladen werden';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
