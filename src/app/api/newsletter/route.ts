import { NextResponse } from 'next/server'
import { auth } from "@/app/auth"
import { createClient } from "@supabase/supabase-js"

// Regex plus stricte pour la validation des emails
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/

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

// Liste des TLDs communs pour une validation supplémentaire
const COMMON_TLDS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int',
  'fr', 'uk', 'de', 'it', 'es', 'eu', 'ca', 'au', 'jp',
  'co', 'io', 'me', 'info', 'biz', 'dev'
]);

// Fonction de validation d'email plus complète
const validateEmail = (email: string): boolean => {
  // Vérification de base
  if (!email || typeof email !== 'string') return false
  
  // Vérification de la longueur totale
  if (email.length < 3 || email.length > 254) return false

  // Vérification du format avec regex
  if (!EMAIL_REGEX.test(email)) return false

  const [localPart, domain] = email.split('@')
  
  // Vérification de la partie locale
  if (localPart.length > 64) return false
  if (/^[.-]|[.-]$/.test(localPart)) return false // Ne peut pas commencer ou finir par . ou -
  if (/[.]{2,}/.test(localPart)) return false // Pas de points consécutifs
  
  // Vérification du domaine
  if (domain.length > 255 || domain.length < 3) return false
  if (/[^a-zA-Z0-9.-]/.test(domain)) return false // Caractères invalides dans le domaine
  if (/^[.-]|[.-]$/.test(domain)) return false // Ne peut pas commencer ou finir par . ou -
  if (/[.]{2,}/.test(domain)) return false // Pas de points consécutifs
  
  // Vérification du TLD
  const tld = domain.split('.').pop()?.toLowerCase()
  if (!tld || tld.length < 2 || !COMMON_TLDS.has(tld)) return false
  
  // Vérification des sous-domaines
  const subdomains = domain.split('.')
  if (subdomains.some(sub => sub.length < 1 || sub.length > 63)) return false
  if (subdomains.some(sub => /^[0-9]/.test(sub))) return false // Les sous-domaines ne peuvent pas commencer par un chiffre
  
  return true
}

// Fonction de nettoyage des entrées
const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .toLowerCase()
    // Échapper les caractères spéciaux SQL et les caractères dangereux
    .replace(/['";\\<>]/g, '')
    // Supprimer les espaces multiples
    .replace(/\s+/g, ' ')
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
    if (!email || (!acceptHQX && !acceptOEP)) {
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

    // Construction de l'objet de mise à jour avec uniquement les champs à true
    const updateData: Record<string, any> = {
      email: sanitizedEmail
    }
    
    if (acceptHQX) {
      updateData.hqx_newsletter = true
    }
    
    if (acceptOEP) {
      updateData.oep_accepted = true
    }

    // Mise à jour de l'utilisateur avec le client auth
    const { error: updateError } = await authClient
      .from('users')
      .update(updateData)
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