
-- Migration pour ajouter le support Mastodon dans la table sources_targets

-- Vérifier si les colonnes n'existent pas déjà pour éviter les erreurs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'sources_targets' 
        AND column_name = 'mastodon_id') 
    THEN
        -- Ajouter les nouvelles colonnes pour Mastodon
        ALTER TABLE "public"."sources_targets"
        ADD COLUMN "mastodon_id" text,
        ADD COLUMN "has_follow_mastodon" boolean DEFAULT false,
        ADD COLUMN "followed_at_mastodon" timestamp with time zone;
    END IF;
END $$;

-- Créer un index pour optimiser les recherches sur mastodon_id
-- L'instruction IF NOT EXISTS évite les erreurs si l'index existe déjà
CREATE INDEX IF NOT EXISTS idx_sources_targets_mastodon_id 
ON "public"."sources_targets"(mastodon_id);

-- Mettre à jour les mastodon_id existants depuis mastodon_twitter_users
UPDATE "public"."sources_targets" st
SET mastodon_id = mtu.mastodon_id
FROM "public"."twitter_mastodon_users" mtu
WHERE st.target_twitter_id = mtu.twitter_id
AND st.mastodon_id IS NULL;