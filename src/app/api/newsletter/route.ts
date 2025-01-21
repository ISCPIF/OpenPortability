import { NextResponse } from 'next/server'
import { auth } from "@/app/auth"
import { createClient } from "@supabase/supabase-js"
import { isValidEmail } from '@/lib/utils'

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

    const { email, acceptHQX, acceptOEP, research_accepted } = await request.json()

    // Construction de l'objet de mise à jour
    const updateData: Record<string, any> = {
      have_seen_newsletter: true
    }
    
    // Si un email est fourni, on valide et on active OEP
    if (email) {
      const sanitizedEmail = sanitizeInput(email)
      if (!isValidEmail(sanitizedEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
      updateData.email = sanitizedEmail
      updateData.oep_accepted = true
    }
    
    // Si pas d'email, c'est forcément acceptHQX only
    if (!email) {
      updateData.hqx_newsletter = true
    }

    if (research_accepted) {
      updateData.research_accepted = true
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

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await authClient
      .from('users')
      .update({ have_seen_newsletter: true })
      .eq('id', session.user.id);

    if (error) {
      console.error('Error updating have_seen_newsletter:', error);
      return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in newsletter GET route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
