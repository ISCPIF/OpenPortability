// import { NextResponse } from 'next/server'
// import { auth } from "@/app/auth"
// import { UserService } from '@/lib/services/userServices'
// import logger, { withLogging } from '@/lib/log_utils'

// async function newsletterPostHandler(request: Request) {
//   try {
//     const session = await auth()
    
//     if (!session?.user?.id) {
//       console.log('API', 'POST /api/newsletter', 'Unauthorized newsletter subscription attempt: No valid session')
//       return NextResponse.json(
//         { error: 'Unauthorized' },
//         { status: 401 }
//       )
//     }

//     const { email, acceptHQX, acceptOEP, research_accepted, dm_consent } = await request.json()
    
//     const userService = new UserService()
    
//     // Mise à jour des préférences newsletter dans la table user (comme avant)
//     await userService.updatePreferencesNewsletter(session.user.id, {
//       email,
//       acceptHQX,
//       acceptOEP,
//       research_accepted
//     })

//     // Récupérer le user-agent pour l'audit
//     const userAgent = request.headers.get('user-agent') || undefined;
    
//     // Récupérer l'adresse IP du client
//     const forwardedFor = request.headers.get('x-forwarded-for');
//     const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
    
//     const metadata = { userAgent, ip };

//     // Enregistrement des consentements dans la nouvelle table avec historique
//     if (typeof acceptHQX !== 'undefined') {
//       await userService.recordConsent(session.user.id, 'email_newsletter', !!acceptHQX, metadata);
//     }
    
//     if (typeof acceptOEP !== 'undefined') {
//       await userService.recordConsent(session.user.id, 'oep_newsletter', !!acceptOEP, metadata);
//     }
    
//     if (typeof research_accepted !== 'undefined') {
//       await userService.recordConsent(session.user.id, 'research_participation', !!research_accepted, metadata);
//     }
    
//     // Nouveau consentement pour les DM Bluesky s'il est fourni
//     if (typeof dm_consent !== 'undefined') {
//       await userService.recordConsent(session.user.id, 'bluesky_dm', !!dm_consent, metadata);
//     }

//     return NextResponse.json({ success: true })
//   } catch (error) {
//     const userId = (await auth())?.user?.id || 'unknown'
    
//     if (error instanceof Error && error.message === 'Invalid email format') {
//       console.log('API', 'POST /api/newsletter', error.message, userId, { 
//         context: 'Newsletter subscription validation'
//       })
//       return NextResponse.json({ error: error.message }, { status: 400 })
//     }
    
//     console.log('API', 'POST /api/newsletter', error, userId, { 
//       context: 'Newsletter subscription process'
//     })
//     return NextResponse.json(
//       { error: 'Failed to subscribe to newsletter' },
//       { status: 500 }
//     )
//   }
// }

// async function newsletterGetHandler() {
//   try {
//     const session = await auth();
    
//     if (!session?.user?.id) {
//       console.log('API', 'GET /api/newsletter', 'Unauthorized access attempt')
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const userService = new UserService()
//     const preferences = await userService.getNewsletterPreferences(session.user.id)

//     return NextResponse.json({ data: preferences });
//   } catch (error) {
//     const userId = (await auth())?.user?.id || 'unknown'
    
//     if (error instanceof Error && error.message === 'User not found') {
//       console.log('API', 'GET /api/newsletter', 'User not found', userId)
//       return NextResponse.json({ error: 'User not found' }, { status: 404 });
//     }
    
//     console.log('API', 'GET /api/newsletter', error, userId, {
//       context: 'Retrieving newsletter preferences'
//     })
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }

// export const POST = withLogging(newsletterPostHandler)
// export const GET = withLogging(newsletterGetHandler)
