import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { instance, username, password } = await req.json();

    // Authentification Mastodon
    const response = await fetch(`https://${instance}/api/v1/accounts/verify_credentials`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Mastodon authentication failed');
    }

    const mastodonData = await response.json();

    // Return the Mastodon authentication data
    return NextResponse.json({
      id: mastodonData.id,
      username: mastodonData.username,
      instance: instance,
      profile: {
        displayName: mastodonData.display_name,
        avatar: mastodonData.avatar,
      }
    });

  } catch (error) {
    console.error('Error in Mastodon authentication:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}