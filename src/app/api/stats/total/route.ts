import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { StatsService } from '@/lib/services/statsServices';
import { StatsRepository } from '@/lib/repositories/statsRepository';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repository = new StatsRepository();
    const statsService = new StatsService(repository);

    console.log("statsService:", statsService)
    const stats = await statsService.getTotalStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    // Gestion des erreurs
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}