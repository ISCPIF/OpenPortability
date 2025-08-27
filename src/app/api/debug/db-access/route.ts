import { NextRequest, NextResponse } from 'next/server'
import { authClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const results: any[] = []

  try {
    // Test 1: Vérifier la configuration du client
    results.push({
      test: 'Client Configuration',
      success: true,
      details: {
        hasAuthClient: !!authClient,
        clientConfig: 'authClient configured with service role key'
      }
    })

    // Test 2: Test d'accès direct au schéma next-auth via la table users
    try {
      const { data: countData, error: countError } = await authClient
        .from('users')
        .select('id', { count: 'exact', head: true })

      if (countError) {
        results.push({
          test: 'Count Users (schema client)',
          success: false,
          error: countError.message,
          details: {
            code: countError.code,
            hint: countError.hint,
            details: countError.details
          }
        })
      } else {
        results.push({
          test: 'Count Users (schema client)',
          success: true,
          details: {
            count: countData?.length || 0,
            method: 'authClient.from(users).select with count'
          }
        })
      }
    } catch (err: any) {
      results.push({
        test: 'Count Users (schema client)',
        success: false,
        error: err.message,
        details: { exception: true }
      })
    }

    // Test 3: Test avec nom de table qualifié
    try {
      const { data: qualifiedData, error: qualifiedError } = await authClient
        .from('"next-auth".users')
        .select('id')
        .limit(1)

      if (qualifiedError) {
        results.push({
          test: 'Qualified Table Name',
          success: false,
          error: qualifiedError.message,
          details: {
            code: qualifiedError.code,
            table: '"next-auth".users'
          }
        })
      } else {
        results.push({
          test: 'Qualified Table Name',
          success: true,
          details: {
            found: qualifiedData?.length || 0,
            method: 'authClient.from("next-auth".users)'
          }
        })
      }
    } catch (err: any) {
      results.push({
        test: 'Qualified Table Name',
        success: false,
        error: err.message,
        details: { exception: true }
      })
    }

    // Test 4: Appel de la fonction de diagnostic PostgreSQL
    try {
      const { data: pgData, error: pgError } = await authClient
        .rpc('debug_service_role_nextauth_access')

      if (pgError) {
        results.push({
          test: 'PostgreSQL Function Call',
          success: false,
          error: pgError.message,
          details: {
            code: pgError.code,
            function: 'debug_service_role_nextauth_access'
          }
        })
      } else {
        results.push({
          test: 'PostgreSQL Function Call',
          success: true,
          details: {
            pgResults: pgData,
            method: 'authClient.rpc(debug_service_role_nextauth_access)'
          }
        })
      }
    } catch (err: any) {
      results.push({
        test: 'PostgreSQL Function Call',
        success: false,
        error: err.message,
        details: { exception: true }
      })
    }

    // Test 5: Test de lecture d'un utilisateur spécifique
    try {
      const { data: userData, error: userError } = await authClient
        .from('users')
        .select('id, name, email, twitter_id, bluesky_id, mastodon_id')
        .limit(1)
        .single()

      if (userError) {
        results.push({
          test: 'Read Single User',
          success: false,
          error: userError.message,
          details: {
            code: userError.code,
            operation: 'SELECT single user'
          }
        })
      } else {
        results.push({
          test: 'Read Single User',
          success: true,
          details: {
            userFound: !!userData,
            userId: userData?.id,
            method: 'authClient.from(users).select().single()'
          }
        })
      }
    } catch (err: any) {
      results.push({
        test: 'Read Single User',
        success: false,
        error: err.message,
        details: { exception: true }
      })
    }

    return NextResponse.json({
      status: 'completed',
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      },
      results
    })

  } catch (globalError: any) {
    return NextResponse.json({
      status: 'error',
      error: globalError.message,
      timestamp: new Date().toISOString(),
      results
    }, { status: 500 })
  }
}
