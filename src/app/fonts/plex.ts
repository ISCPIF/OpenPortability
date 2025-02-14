import { IBM_Plex_Mono, Caveat } from 'next/font/google'

export const plex = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ["300", "400", "700"]
})

export const caveat = Caveat({
  subsets: ['latin'],
  weight: ["400", "700"]
})
