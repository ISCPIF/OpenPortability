// import { createClient } from '@supabase/supabase-js'

// if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
//   throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
// }

// if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
//   throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
// }

// if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
//   throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
// }

// export const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY,
//   {
//     auth: {
//       autoRefreshToken: true,
//       persistSession: true,
//       detectSessionInUrl: true
//     },
//   }
// )

// export const authClient = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!,
//   {
//     auth: {
//       autoRefreshToken: false,
//       persistSession: false
//     },
//     db: {
//       schema: "next-auth"
//     }
//   }
// )