// import { NextResponse } from 'next/server';
// import { auth } from "@/app/auth";
// import { authClient } from '@/lib/supabase'
// import logger, { withLogging } from '@/lib/log_utils';

// /**
//  * Gère les requêtes POST pour mettre à jour le statut have_seen_bot_newsletter de l'utilisateur
//  */
// async function botNewsletterHandler(request: Request) {
//   try {
//     const session = await auth();
    
//     if (!session?.user?.id) {
//       logger.logWarning('API', 'POST /api/users/bot-newsletter', 'Unauthorized', 'anonymous');
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const { haveSeenBotNewsletter } = await request.json();

//     if (typeof haveSeenBotNewsletter !== 'boolean') {
//       logger.logWarning('API', 'POST /api/users/bot-newsletter', 'Invalid value for haveSeenBotNewsletter', session.user.id);
//       return NextResponse.json({ error: 'Invalid value for haveSeenBotNewsletter' }, { status: 400 });
//     }

//     // // Mettre à jour dans Supabase
//     // const { error: updateError } = await authClient
//     //   .from('users')
//     //   .update({ have_seen_bot_newsletter: haveSeenBotNewsletter })
//     //   .eq('id', session.user.id);

//     // if (updateError) {
//     //   logger.logError('API', 'POST /api/users/bot-newsletter', updateError, session.user.id, {
//     //     context: 'Updating have_seen_bot_newsletter setting'
//     //   });
//     //   return NextResponse.json({ error: 'Failed to update have_seen_bot_newsletter' }, { status: 500 });
//     // }

//     return NextResponse.json({ success: true, have_seen_bot_newsletter: haveSeenBotNewsletter });

//   } catch (error) {
//     const userId = (await auth())?.user?.id || 'unknown';
//     logger.logError('API', 'POST /api/users/bot-newsletter', error, userId, {
//       context: 'Processing bot newsletter request'
//     });
//     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
//   }
// }

// export const POST = withLogging(botNewsletterHandler);