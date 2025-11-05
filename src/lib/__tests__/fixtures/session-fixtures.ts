import type { DBSession } from '../../types/database'

/**
 * Fixtures pour les tests des sessions
 */

export const mockSession = (userId: string): { sessionToken: string; userId: string; expires: Date } => ({
  sessionToken: `session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  userId,
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
})

export const mockExpiredSession = (userId: string): { sessionToken: string; userId: string; expires: Date } => ({
  sessionToken: `expired_session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  userId,
  expires: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expiré il y a 1 jour
})

export const mockShortSession = (userId: string): { sessionToken: string; userId: string; expires: Date } => ({
  sessionToken: `short_session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  userId,
  expires: new Date(Date.now() + 60 * 60 * 1000), // 1 heure
})

export const mockLongSession = (userId: string): { sessionToken: string; userId: string; expires: Date } => ({
  sessionToken: `long_session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  userId,
  expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 jours
})

export const mockSessionUpdate = {
  expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 jours
}
