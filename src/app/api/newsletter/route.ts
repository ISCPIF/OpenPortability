import { NextResponse } from 'next/server'
import { auth } from "@/app/auth"
import { createClient } from "@supabase/supabase-js"

// Regex plus stricte pour la validation des emails
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// Client Supabase avec les droits d'administration
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

// Fonction de validation d'email plus complète
const validateEmail = (email: string): boolean => {
  // Vérification de la longueur
  if (email.length > 254) return false

  // Vérification du format avec regex
  if (!EMAIL_REGEX.test(email)) return false

  // Vérifications supplémentaires
  const [localPart, domain] = email.split('@')
  
  // Vérification de la partie locale
  if (localPart.length > 64) return false
  if (/^[.-]|[.-]$/.test(localPart)) return false // Ne peut pas commencer ou finir par . ou -
  
  // Vérification du domaine
  if (domain.length > 255) return false
  if (/^[.-]|[.-]$/.test(domain)) return false // Ne peut pas commencer ou finir par . ou -
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return false // Caractères autorisés pour le domaine
  
  return true
}

// Fonction de nettoyage des entrées
const sanitizeInput = (input: string): string => {
  return input
    .trim()
    // Échapper les caractères spéciaux SQL
    .replace(/['";\\]/g, '')
    // Limiter la longueur
    .slice(0, 254)
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      console.error('Unauthorized newsletter subscription attempt: No valid session')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { email, acceptHQX, acceptOEP } = await request.json()

    // Validation de base
    if (!email || !acceptHQX) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Nettoyage et validation de l'email
    const sanitizedEmail = sanitizeInput(email)
    if (!validateEmail(sanitizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Mise à jour de l'utilisateur avec le client auth
    const { error: updateError } = await authClient
      .from('users')
      .update({
        hqx_newsletter: acceptHQX,
        email: sanitizedEmail,
        oep_accepted: acceptOEP,
      })
      .eq('id', session.user.id)

    if (updateError) {
      console.error('Database error:', updateError)
      throw new Error('Failed to update user newsletter preferences')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe to newsletter' },
      { status: 500 }
    )
  }
}