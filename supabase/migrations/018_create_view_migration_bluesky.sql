-- Créer la vue qui combine followers et following avec leurs handles Bluesky
CREATE OR REPLACE VIEW migration_bluesky_view AS
WITH followers AS (
  SELECT 
    sf.source_id as user_id,
    sf.follower_id as twitter_id,
    sf.bluesky_handle,
    sf.has_follow_bluesky,
    'follower' as relationship_type
  FROM sources_followers sf
),
following AS (
  SELECT 
    st.source_id as user_id,
    st.target_twitter_id as twitter_id,
    st.bluesky_handle,
    st.has_follow_bluesky,
    'following' as relationship_type
  FROM sources_targets st
)
SELECT * FROM followers
UNION ALL
SELECT * FROM following;

-- Créer un index sur user_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_migration_bluesky_view_user_id 
ON sources_followers(source_id);

CREATE INDEX IF NOT EXISTS idx_migration_bluesky_view_user_id_targets 
ON sources_targets(source_id);

-- Ajouter des commentaires sur la vue
COMMENT ON VIEW migration_bluesky_view IS 'Vue combinant les followers et following avec leurs handles Bluesky pour la migration';
COMMENT ON COLUMN migration_bluesky_view.user_id IS 'ID de l''utilisateur';
COMMENT ON COLUMN migration_bluesky_view.twitter_id IS 'ID Twitter du follower ou following';
COMMENT ON COLUMN migration_bluesky_view.bluesky_handle IS 'Handle Bluesky s''il existe';
COMMENT ON COLUMN migration_bluesky_view.has_follow_bluesky IS 'Si l''utilisateur suit déjà ce compte sur Bluesky';
COMMENT ON COLUMN migration_bluesky_view.relationship_type IS 'Type de relation (follower ou following)';