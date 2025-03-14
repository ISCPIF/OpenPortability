import { NextResponse } from 'next/server'
import { auth } from "@/app/auth"
import { UserService } from '@/lib/services/userServices'
import logger, { withLogging } from '@/lib/log_utils'

async function newsletterPostHandler(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/newsletter', 'Unauthorized newsletter subscription attempt: No valid session')
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
    const userId = (await auth())?.user?.id || 'unknown'
    
    if (error instanceof Error && error.message === 'Invalid email format') {
      logger.logWarning('API', 'POST /api/newsletter', error.message, userId, { 
        context: 'Newsletter subscription validation'
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    logger.logError('API', 'POST /api/newsletter', error, userId, { 
      context: 'Newsletter subscription process'
    })
    return NextResponse.json(
      { error: 'Failed to subscribe to newsletter' },
      { status: 500 }
    )
  }
}

async function newsletterGetHandler() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'GET /api/newsletter', 'Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userService = new UserService()
    const preferences = await userService.getNewsletterPreferences(session.user.id)

    return NextResponse.json({ data: preferences });
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown'
    
    if (error instanceof Error && error.message === 'User not found') {
      logger.logWarning('API', 'GET /api/newsletter', 'User not found', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    logger.logError('API', 'GET /api/newsletter', error, userId, {
      context: 'Retrieving newsletter preferences'
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withLogging(newsletterPostHandler)
export const GET = withLogging(newsletterGetHandler)
