import { NextResponse } from "next/server";
import { BskyAgent } from '@atproto/api';
import { auth } from "@/app/auth";
import { BlueskyService } from "@/lib/services/blueskyServices";
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository";
import { AccountService } from "@/lib/services/accountService"
import { decrypt } from '@/lib/encryption';

const blueskyRepository = new BlueskyRepository();
const blueskyService = new BlueskyService(blueskyRepository);
const accountService = new AccountService()

export async function POST(req: Request) {
  console.log('[BlueSky Share API] Starting share process');
  try {
    const { text } = await req.json();
    console.log('[BlueSky Share API] Received text to share:', text);
    
    const session = await auth();
    console.log('[BlueSky Share API] User session:', session?.user?.id ? `User ID: ${session.user.id}` : 'No user session');
    
    if (!session?.user?.id) {
      console.log('[BlueSky Share API] Error: User not authenticated');
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    console.log('[BlueSky Share API] Getting BlueSky account for user:', session.user.id);
    const account = await accountService.getAccountByProviderAndUserId('bluesky', session.user.id);
    console.log('[BlueSky Share API] Account found:', account ? 'Yes' : 'No');
    
    if (!account || (!account.access_token && !account.refresh_token)) {
      console.log('[BlueSky Share API] Error: Not authorized to share on BlueSky');
      return NextResponse.json(
        { success: false, error: 'Not authorized to share on Bluesky' },
        { status: 401 }
      );
    }

    const agent = new BskyAgent({ service: 'https://bsky.social' });
    try {
        console.log('[BlueSky Share API] Decrypting tokens');
        const accessToken = decrypt(account.access_token);
        const refreshToken = decrypt(account.refresh_token);
        
        console.log('[BlueSky Share API] Resuming BlueSky session for handle:', account.provider_account_id.split('.')[0]);
        await agent.resumeSession({
          accessJwt: accessToken,
          refreshJwt: refreshToken,
          handle: account.provider_account_id.split('.')[0],
          did: account.provider_account_id,
          active: true
        });

        if (!agent.session) {
          console.log('[BlueSky Share API] Error: Failed to resume session on BlueSky');
          return NextResponse.json(
            { success: false, error: 'Failed to resume session on Bluesky' },
            { status: 500 }
          );
        }
        
        console.log('[BlueSky Share API] Session resumed successfully, creating post');
        const result = await agent.post({
            text: text,
            createdAt: new Date().toISOString()
          });
        console.log('[BlueSky Share API] Post created successfully:', result);
        
        return NextResponse.json({
          success: true,
          uri: result.uri,
          cid: result.cid
        });
    }
    catch (error) {
        console.error('[BlueSky Share API] Error during share process:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
          );
      }
  } catch (error) {
    console.error('[BlueSky Share API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}