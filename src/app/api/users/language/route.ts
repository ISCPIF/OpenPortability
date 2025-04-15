import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/auth"
import { UserService } from '@/lib/services/userServices';

const userService = new UserService();

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const languagePref = await userService.getLanguagePreference(session.user.id);
    return NextResponse.json(languagePref);
  } catch (error) {
    console.error('Error getting language preference:', error);
    return NextResponse.json(
      { error: 'Failed to get language preference' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { language } = data;

    if (!language) {
      return NextResponse.json(
        { error: 'Language is required' },
        { status: 400 }
      );
    }

    // const metadata = {
    //   ip_address: req.ip,
    //   user_agent: req.headers.get('user-agent')
    // };

    await userService.updateLanguagePreference(session.user.id, language);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating language preference:', error);
    return NextResponse.json(
      { error: 'Failed to update language preference' },
      { status: 500 }
    );
  }
}