import type { DBSession } from '../../types/database'

/**
 * Fixtures pour les tests des sessions
 */

export const mockSession = (userId: string): { session_token: string; user_id: string; expires: Date } => ({
  session_token: `session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  user_id: userId,
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
})

export const mockExpiredSession = (userId: string): { session_token: string; user_id: string; expires: Date } => ({
  session_token: `expired_session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  user_id: userId,
  expires: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expiré il y a 1 jour
})

export const mockShortSession = (userId: string): { session_token: string; user_id: string; expires: Date } => ({
  session_token: `short_session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  user_id: userId,
  expires: new Date(Date.now() + 60 * 60 * 1000), // 1 heure
})

export const mockLongSession = (userId: string): { session_token: string; user_id: string; expires: Date } => ({
  session_token: `long_session_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  user_id: userId,
  expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 jours
})

export const mockSessionUpdate = {
  expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 jours
}
