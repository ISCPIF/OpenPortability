import { NextResponse } from 'next/server'
import { auth } from "@/app/auth"
import { UserService } from '@/lib/services/userServices'


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
    
    const userService = new UserService()
    await userService.updatePreferencesNewsletter(session.user.id, {
      email,
      acceptHQX,
      acceptOEP,
      research_accepted
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    if (error instanceof Error && error.message === 'Invalid email format') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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

    const userService = new UserService()
    const preferences = await userService.getNewsletterPreferences(session.user.id)

    return NextResponse.json({ data: preferences });
  } catch (error) {
    console.error('Error in newsletter GET route:', error);
    if (error instanceof Error && error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
