export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDocument, getPagesByDocument } from '@/lib/document-store';
import { analyzeTextForToolHints } from '@/lib/tool-analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = getDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const pages = getPagesByDocument(id);
    const allText = pages.map(p => p.raw_text).join('\n\n');
    const suggestions = analyzeTextForToolHints(allText);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Tool analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze document' }, { status: 500 });
  }
}