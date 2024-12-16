import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { getServerSession } from 'next-auth';
import { auth } from "@/app/auth";

console.log(' Initializing Supabase client with URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

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

export async function POST(request: Request) {
  console.log(' Share API called');
  
  const session = await auth();
  console.log(' Session:', {
    userId: session?.user?.id,
    email: session?.user?.email
  });

  if (!session?.user?.id) {
    console.log(' No session found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log(' Request body:', body);

    console.log(' Inserting share event into Supabase...');
    const { error } = await supabase
      .from('share_events')
      .insert({
        source_id: session.user.id,
        platform: body.platform,
        success: body.success,
        shared_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error(' Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(' Share event recorded successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(' Server error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  console.log('🔍 Share events GET API called');
  
  const session = await auth();
  console.log('👤 Session:', {
    userId: session?.user?.id,
    email: session?.user?.email
  });

  if (!session?.user?.id) {
    console.log('❌ No session found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('📊 Fetching share events for user:', session.user.id);
    const { data, error } = await supabase
      .from('share_events')
      .select('*')
      .eq('source_id', session.user.id);

    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Share events fetched:', data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('❌ Failed to fetch share events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share events' },
      { status: 500 }
    );
  }
}