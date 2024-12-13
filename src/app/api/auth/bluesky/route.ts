import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";
import { auth } from "@/app/auth"
import { authConfig } from "@/app/auth.config";

// Create a single Supabase client for the API route
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    // Authenticate with BlueSky
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'BlueSky authentication failed');
    }

    const blueskyData = await response.json();

    // Fetch BlueSky profile details
    const profileResponse = await fetch(`https://bsky.social/xrpc/app.bsky.actor.getProfile?actor=${blueskyData.handle}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${blueskyData.accessJwt}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('Failed to fetch BlueSky profile:', await profileResponse.text());
      throw new Error('Failed to fetch BlueSky profile');
    }

    const profileData = await profileResponse.json();

    // Return the BlueSky authentication data
    return NextResponse.json({
      did: blueskyData.did,
      handle: blueskyData.handle,
      accessJwt: blueskyData.accessJwt,
      refreshJwt: blueskyData.refreshJwt,
      profile: {
        displayName: profileData.displayName,
        avatar: profileData.avatar
      }
    });

  } catch (error) {
    console.error('Error in BlueSky authentication:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}