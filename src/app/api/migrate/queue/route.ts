import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
  
      const { accounts } = await request.json();
  
      const { data, error } = await supabase
        .from('reconnect_queue')
        .insert({
          user_id: session.user.id,
          accounts: accounts,
          status: 'pending'
        })
        .select()
        .single();
  
      if (error) throw error;
  
      return NextResponse.json({ user_id: session.user.id });
    } catch (error) {
      console.error('Error queueing migration:', error);
      return NextResponse.json(
        { error: 'Failed to queue migration' },
        { status: 500 }
      );
    }
  }