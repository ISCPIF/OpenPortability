import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      console.log('API', 'POST /api/bluesky/test-dm', 'Unauthorized test DM attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId, handle } = await request.json();

    // Vérifier que l'utilisateur est autorisé à tester les DMs pour ce compte
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID mismatch' },
        { status: 403 }
      );
    }

    // Créer une connexion à Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Créer une nouvelle tâche Python pour le test DM
    const { data, error } = await supabase
      .from('python_tasks')
      .insert({
        user_id: userId,
        status: 'pending',
        task_type: 'test-dm',
        payload: { handle }
      })
      .select()
      .single();
    
    if (error) {
      console.error('API', 'POST /api/bluesky/test-dm', error);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      task_id: data.id
    });
    
  } catch (error) {
    console.error('API', 'POST /api/bluesky/test-dm', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}