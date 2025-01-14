import { createClient } from '@supabase/supabase-js'
import { BskyAgent } from '@atproto/api'
import 'dotenv/config'


console.log(' [Worker] Configuration du worker de refresh des tokens...')

// Vérifier les variables d'environnement
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(' [Worker] NEXT_PUBLIC_SUPABASE_URL non définie')
  process.exit(1)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(' [Worker] SUPABASE_SERVICE_ROLE_KEY non définie')
  process.exit(1)
}

console.log(' [Worker] Variables d\'environnement vérifiées')
console.log(' [Worker] URL Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL)

const supabase = createClient(
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

function decodeJwt(token: string): { exp: number } | null {
    try {
      const jwt = token.split('.')
      if (jwt.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payload = JSON.parse(Buffer.from(jwt[1], 'base64').toString())
      return payload
    } catch (error) {
      console.error('❌ [Adapter] Erreur décodage JWT:', error)
      return null
    }
  }
  

// Tester la connexion à Supabase
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('accounts').select('count').limit(1)
    if (error) throw error
    console.log(' [Worker] Connexion à Supabase établie')
    return true
  } catch (error) {
    console.error(' [Worker] Erreur de connexion à Supabase:', error)
    return false
  }
}

async function refreshSession(account: { 
  provider_account_id: string, 
  refresh_token: string 
}): Promise<{ accessJwt: string, refreshJwt: string } | null> {
  try {
    const agent = new BskyAgent({ 
      service: 'https://bsky.social'
    })

    const result = await agent.api.com.atproto.server.refreshSession(
      undefined,
      { headers: { Authorization: `Bearer ${account.refresh_token}` } }
    )

    return {
      accessJwt: result.data.accessJwt,
      refreshJwt: result.data.refreshJwt
    }
  } catch (error) {
    console.error(' [Worker] Erreur refresh:', error)
    return null
  }
}

async function checkAndRefreshTokens() {
  try {
    console.log('\n [Worker] Vérification des tokens à rafraîchir...')
    
    // Liste des user IDs à vérifier
    const TEST_USER_IDS = [
      'b1160921-81f1-4e00-9d51-65220e2ddfa6',
      '2a4b0f2d-0547-426e-b30b-8b5398bfeec3'
    ]
    
    // Récupérer les comptes qui expirent dans moins de 5 minutes
    const expirationLimit = Math.floor(Date.now() / 1000) + 300 // maintenant + 5 minutes
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('provider_account_id, access_token, refresh_token, expires_at')
      .eq('type', 'oauth')
      .eq('provider', 'bluesky')
      .in('user_id', TEST_USER_IDS)
      .or(`expires_at.lt.${expirationLimit},expires_at.is.null`)

    if (error) {
      console.error(' [Worker] Erreur Supabase:', error)
      throw error
    }

    if (accounts && accounts.length > 0) {
      console.log(` [Worker] ${accounts.length} compte(s) à rafraîchir`)
      
      for (const account of accounts) {
        console.log(`\n [Worker] Rafraîchissement pour ${account.provider_account_id}`)
        if (account.expires_at) {
          console.log(`   Expire à: ${new Date(account.expires_at * 1000).toISOString()}`)
        } else {
          console.log('   Token expiré (expires_at est null)')
        }
        
        const result = await refreshSession(account)
        
        if (result) {
          // Décoder le nouveau token pour obtenir l'expiration
          const payload = decodeJwt(result.accessJwt)
          if (!payload?.exp) {
            console.error(' [Worker] Impossible de décoder le nouveau token')
            continue
          }

          const { error: updateError } = await supabase
            .from('accounts')
            .update({
              access_token: result.accessJwt,
              refresh_token: result.refreshJwt,
              expires_at: payload.exp
            })
            .eq('provider_account_id', account.provider_account_id)
            .eq('provider', 'bluesky')

          if (updateError) {
            console.error(' [Worker] Erreur mise à jour:', updateError)
            continue
          }
          
          console.log(' [Worker] Tokens rafraîchis avec succès')
          console.log(`   Nouvelle expiration: ${new Date(payload.exp * 1000).toISOString()}`)
        } else {
          console.log(' [Worker] Échec du refresh, marquage comme expiré...')
          await supabase
            .from('accounts')
            .update({ expires_at: null })
            .eq('provider_account_id', account.provider_account_id)
            .eq('provider', 'bluesky')
        }
      }
    } else {
      console.log(' [Worker] Aucun compte à rafraîchir')
    }

  } catch (error: any) {
    console.error(' [Worker] Erreur:', error.message)
  }
}

// Tester la connexion avant de démarrer le worker
testSupabaseConnection().then(isConnected => {
  if (isConnected) {
    console.log(' [Worker] Démarrage du worker de refresh des tokens')
    setInterval(checkAndRefreshTokens, 30000)
    checkAndRefreshTokens() // Première exécution
  } else {
    console.error(' [Worker] Impossible de démarrer le worker - Problème de connexion à Supabase')
    process.exit(1)
  }
})