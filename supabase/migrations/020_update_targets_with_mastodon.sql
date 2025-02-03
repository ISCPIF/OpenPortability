
-- Migration pour ajouter le support Mastodon dans la table sources_targets

-- Ajouter les nouvelles colonnes pour Mastodon
ALTER TABLE "public"."sources_targets"
ADD COLUMN IF NOT EXISTS "mastodon_id" text,
ADD COLUMN IF NOT EXISTS "mastodon_username" text,
ADD COLUMN IF NOT EXISTS "mastodon_instance" text,
ADD COLUMN IF NOT EXISTS "has_follow_mastodon" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "followed_at_mastodon" timestamp with time zone;

-- Créer des index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_sources_targets_mastodon_id 
ON "public"."sources_targets"(mastodon_id);

CREATE INDEX IF NOT EXISTS idx_sources_targets_mastodon_username
ON "public"."sources_targets"(mastodon_username);

CREATE INDEX IF NOT EXISTS idx_sources_targets_mastodon_instance
ON "public"."sources_targets"(mastodon_instance);

-- Mettre à jour les données Mastodon depuis twitter_mastodon_users
UPDATE "public"."sources_targets" st
SET 
    mastodon_id = tmu.mastodon_id,
    mastodon_username = tmu.mastodon_username,
    mastodon_instance = tmu.mastodon_instance
FROM "public"."twitter_mastodon_users" tmu
WHERE st.target_twitter_id = tmu.twitter_id
AND (st.mastodon_id IS NULL OR st.mastodon_username IS NULL OR st.mastodon_instance IS NULL);