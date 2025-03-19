// src/app/api/tasks/[taskId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const paramsData = await params;
    const taskId = paramsData.taskId;
    
    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Créer une connexion à Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Récupérer la tâche par son ID
    const { data, error } = await supabase
      .from('python_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (error) {
      console.error('API', 'GET /api/tasks/[taskId]', error);
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    
    // Vérifier que l'utilisateur est autorisé à accéder à cette tâche
    if (data.user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Task belongs to another user' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({
      success: true,
      task: data
    });
    
  } catch (error) {
    console.error('API', 'GET /api/tasks/[taskId]', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}