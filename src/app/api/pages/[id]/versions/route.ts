export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getPageVersions, restorePageVersion } from '@/lib/document-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const versions = getPageVersions(id);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    return NextResponse.json({ error: 'Failed to get versions' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { versionId } = await request.json();
    restorePageVersion(id, versionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Restore version error:', error);
    return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 });
  }
}