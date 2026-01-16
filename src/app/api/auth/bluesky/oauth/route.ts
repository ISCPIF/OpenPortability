import { NextRequest, NextResponse } from "next/server";
import { createBlueskyOAuthClient } from "@/lib/services/blueskyOAuthClient";
import { withPublicValidation } from "@/lib/validation/middleware";
import { z } from "zod";
import logger from "@/lib/log_utils";

export const runtime = 'nodejs';

// Strict query params validation for GET /api/auth/bluesky/oauth
const handleRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i;
const QuerySchema = z.object({
  handle: z.string()
    .trim()
    .transform((s) => (s.startsWith('@') ? s.slice(1) : s))
    // Auto-append .bsky.social if handle has no dot (e.g., "thiboz" -> "thiboz.bsky.social")
    .transform((s) => (s.includes('.') ? s : `${s}.bsky.social`))
    .refine((s) => s.length >= 1 && s.length <= 253, {
      message: 'Invalid Bluesky handle length',
    })
    .refine((s) => handleRegex.test(s), {
      message: 'Invalid Bluesky handle',
    }),
  state: z.string().max(512).optional(),
}).passthrough();

export const GET = withPublicValidation(
  z.object({}).passthrough(),
  async (request: NextRequest) => {
    let handle = request.nextUrl.searchParams.get("handle")!;
    const state = request.nextUrl.searchParams.get("state") || undefined;

    // Normalize handle: remove @ prefix and auto-append .bsky.social if no domain
    if (handle.startsWith('@')) {
      handle = handle.slice(1);
    }
    if (!handle.includes('.')) {
      handle = `${handle}.bsky.social`;
    }

    try {
      const client = await createBlueskyOAuthClient();
      const url = await client.authorize(handle, { state });
      return NextResponse.redirect(url);
    } catch (err: any) {
      logger.logError('API', 'GET /api/auth/bluesky/oauth', `Failed to resolve identity: ${handle}`, 'system', { 
        error: err?.message 
      });
      return NextResponse.json({ error: err?.message || "Failed to initiate Bluesky OAuth" }, { status: 500 });
    }
  },
  {
    // Validate URL params strictly
    validateQueryParams: true,
    queryParamsSchema: QuerySchema,
    applySecurityChecks: true,
    // Modest rate-limiting on authorize initiation by IP
    customRateLimit: { identifier: 'ip', windowMs: 60_000, maxRequests: 60 },
  }
);
