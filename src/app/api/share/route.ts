import { NextResponse } from 'next/server';
import { auth } from "@/app/auth";
import { UserService } from '@/lib/services/userServices';
import { UserRepository } from '@/lib/repositories/userRepository';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const shareService = new UserService();
    await shareService.recordShareEvent(session.user.id, body.platform, body.success);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userRepo = new UserRepository();
    const hasShares = await userRepo.hasShareEvents(session.user.id);

    console.log(`User ${session.user.id} has shares: ${hasShares}`);
    return NextResponse.json({ hasShares });
  } catch (error) {
    console.error('Share check error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}