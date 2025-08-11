import { z } from 'zod';

// Schéma vide pour les endpoints GET sans paramètres
export const EmptySchema = z.object({});

// Types réutilisables
export const EmailSchema = z.string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .transform(val => val.toLowerCase().trim());

export const ConsentTypeSchema = z.enum([
  'hqx_newsletter',
  'oep_newsletter',
  'research_participation',
  'automatic_reconnect',
  'email_newsletter',
  'personalized_support',
  'dm_consent',
  'bluesky_dm',
  'mastodon_dm'
]);

// Schémas pour /api/support
export const SupportRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long (max 2000 characters)')
    .trim(),
  email: EmailSchema
});

// Schémas pour /api/newsletter/request
export const ConsentUpdateSchema = z.object({
  type: ConsentTypeSchema,
  value: z.boolean()
});

export const NewsletterRequestSchema = z.union([
  // Format 1: Consentement unique directement dans l'objet racine
  z.object({
    type: ConsentTypeSchema,
    value: z.boolean(),
    email: EmailSchema.optional()
  }),
  // Format 2: Tableau de consentements
  z.object({
    consents: z.array(ConsentUpdateSchema)
      .min(1, 'At least one consent is required')
      .max(10, 'Too many consents'),
    email: EmailSchema.optional()
  })
]);

// Schémas pour /api/share
export const ShareEventSchema = z.object({
  platform: z.enum(['twitter', 'bluesky', 'mastodon']),
  success: z.boolean()
});

// Schémas pour /api/auth/bluesky et /api/auth/mastodon
export const AuthCredentialsSchema = z.object({
  identifier: z.string()
    .min(1, 'Identifier is required')
    .max(100, 'Identifier too long')
    .trim(),
  password: z.string()
    .min(1, 'Password is required')
    .max(200, 'Password too long')
});

// Schémas pour /api/migrate/send_follow
export const MatchingAccountSchema = z.object({
  // Pour MatchingTarget
  node_id: z.string().optional(),
  // Pour MatchedFollower
  source_twitter_id: z.string().optional(),
  
  bluesky_handle: z.string().nullable(),
  mastodon_username: z.string().nullable(),
  mastodon_instance: z.string().nullable(),
  mastodon_id: z.string().nullable(),
  
  // Pour MatchingTarget
  has_follow_bluesky: z.boolean().optional(),
  has_follow_mastodon: z.boolean().optional(),
  
  // Pour MatchedFollower
  has_been_followed_on_bluesky: z.boolean().optional(),
  has_been_followed_on_mastodon: z.boolean().optional()
}).refine(
  data => 
    (data.node_id && (data.has_follow_bluesky !== undefined || data.has_follow_mastodon !== undefined)) ||
    (data.source_twitter_id && (data.has_been_followed_on_bluesky !== undefined || data.has_been_followed_on_mastodon !== undefined)),
  {
    message: "Invalid account structure: must be either MatchingTarget or MatchedFollower"
  }
);

export const SendFollowRequestSchema = z.object({
  accounts: z.array(MatchingAccountSchema)
    .min(1, 'At least one account is required')
    .max(1000, 'Too many accounts (max 1000)')
});

// Schémas pour /api/users/automatic-reconnect
export const AutomaticReconnectSchema = z.object({
  automatic_reconnect: z.boolean()
});

// Schémas pour /api/users/language
export const LanguageUpdateSchema = z.object({
  language: z.enum(['fr', 'en', 'es', 'it', 'de', 'sv', 'pt'])
});

// Schémas pour /api/upload
export const UploadMetadataSchema = z.object({
  fileName: z.string()
    .max(255, 'File name too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid file name'),
  fileSize: z.number()
    .positive()
    .max(100 * 1024 * 1024, 'File too large (max 100MB)'),
  mimeType: z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9\/\-+.]+$/, 'Invalid MIME type')
});

// Schémas pour /api/stats
/**
 * Schéma pour les paramètres de requête de l'endpoint /api/stats
 * Aucun paramètre d'URL n'est autorisé
 */
export const StatsQueryParamsSchema = z.object({}).strict();

// Type exports pour TypeScript
export type SupportRequest = z.infer<typeof SupportRequestSchema>;
export type NewsletterRequest = z.infer<typeof NewsletterRequestSchema>;
export type ShareEvent = z.infer<typeof ShareEventSchema>;
export type AuthCredentials = z.infer<typeof AuthCredentialsSchema>;
export type SendFollowRequest = z.infer<typeof SendFollowRequestSchema>;
export type AutomaticReconnect = z.infer<typeof AutomaticReconnectSchema>;
export type LanguageUpdate = z.infer<typeof LanguageUpdateSchema>;
export type UploadMetadata = z.infer<typeof UploadMetadataSchema>;
