import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import { createClient } from "@supabase/supabase-js"


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  
export async function DELETE() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
        console.error('Unauthorized deletion attempt: No valid session')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

    const userId = session.user.id

    // 1. Si l'utilisateur a has_onboarded = true
    if (session.user.has_onboarded) {
        console.log(`User ${userId} has onboarded, cleaning up public schema data`)

        // Supprimer l'import_job dans le schema public
        const { error: importJobError } = await supabase
          .from('import_jobs')
          .delete()
          .eq('user_id', userId)
  
        if (importJobError) {
          console.error('Error deleting import_job:', importJobError)
          throw new Error(`{importJobError.message}`)
        }
        console.log('Successfully deleted import_job')

        const { error: userStatsError } = await supabase
        .from('user_stats_cache')
        .delete()
        .eq('user_id', userId)

      if (userStatsError) {
        console.error('Error deleting userStatsError:', userStatsError)
        throw new Error(`{userStatsError.message}`)
      }
      console.log('Successfully deleted userStatsCache')

        const { error: sourceError } = await supabase
        .from('sources')
        .delete()
        .eq('id', userId)

      if (sourceError) {
        console.error('Error deleting source:', sourceError)
        throw new Error(`{sourceError.message}`)
      }
      console.log('Successfully deleted source')

      // Mettre à jour has_onboarded à false dans next-auth
      const { error: hasBoardError } = await authClient
      .from('users')
      .update({ has_onboarded: false })
      .eq('id', session.user.id);

      if (hasBoardError) {
        console.error('Error updating has_onboarded:', hasBoardError)
        throw new Error(`{updateError.message}`)
      }
      console.log('Successfully updated has_onboarded to false')
    // }

    }

    const { error: deleteError } = await authClient
    .from('users')
    .delete()
    .eq('id', userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      throw new Error(`{deleteError.message}`)
    }
    console.log('Successfully deleted user')
    
    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}