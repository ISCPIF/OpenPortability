import { NextResponse } from 'next/server';

const MOSAIC_BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.DUCKDB_MOSAIC_BASE_URL ??
  'http://duckdb-server:8765';

export async function POST(request: Request) {
  if (!MOSAIC_BASE_URL) {
    return NextResponse.json({ error: 'DUCKDB_MOSAIC_BASE_URL is not configured' }, { status: 500 });
  }

  try {
    const body = await request.text();
    const forwardUrl = new URL('/mosaic/query', MOSAIC_BASE_URL);

    const upstreamResponse = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/vnd.apache.arrow.stream',
      },
      body,
      cache: 'no-store',
    });

    if (!upstreamResponse.ok) {
      const errorPayload = await upstreamResponse.json().catch(() => ({ error: 'Unknown coordinator error' }));
      return NextResponse.json(
        {
          error: 'Failed to execute Mosaic query',
          details: errorPayload,
        },
        { status: upstreamResponse.status }
      );
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'content-type': 'application/vnd.apache.arrow.stream',
        'content-length': String(arrayBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('[MosaicQuery]', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
