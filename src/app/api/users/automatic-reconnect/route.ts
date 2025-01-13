import { NextResponse } from 'next/server';
import { auth } from "@/app/auth";
import { createClient } from '@supabase/supabase-js';

const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: "next-auth"
      }
    }
  )


export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { automatic_reconnect } = await request.json();

    if (typeof automatic_reconnect !== 'boolean') {
      return NextResponse.json({ error: 'Invalid value for automatic_reconnect' }, { status: 400 });
    }

    // Mettre à jour dans Supabase
    const { error: updateError } = await authClient
      .from('users')
      .update({ automatic_reconnect })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating automatic_reconnect:', updateError);
      return NextResponse.json({ error: 'Failed to update automatic_reconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true, automatic_reconnect });

  } catch (error) {
    console.error('Error in automatic-reconnect route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}