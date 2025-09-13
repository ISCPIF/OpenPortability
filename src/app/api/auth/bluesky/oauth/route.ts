import { NextRequest, NextResponse } from "next/server";
import { createBlueskyOAuthClient } from "@/lib/services/blueskyOAuthClient";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle");
  const state = request.nextUrl.searchParams.get("state") || undefined;

  if (!handle) {
    return NextResponse.json({ error: "Missing 'handle' query parameter" }, { status: 400 });
  }

  try {
    console.log('[Bluesky OAuth] Start authorize()', { handle, state });
    const client = await createBlueskyOAuthClient();
    const url = await client.authorize(handle, { state });
    console.log('[Bluesky OAuth] authorize() redirect URL', { url: String(url) });
    return NextResponse.redirect(url);
  } catch (err: any) {
    console.error('[Bluesky OAuth] authorize() failed', {
      message: err?.message,
      stack: err?.stack,
    });
    return NextResponse.json({ error: err?.message || "Failed to initiate Bluesky OAuth" }, { status: 500 });
  }
}
