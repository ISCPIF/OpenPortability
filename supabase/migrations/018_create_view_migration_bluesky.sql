-- Créer la vue qui combine followers et following avec leurs handles Bluesky
CREATE OR REPLACE VIEW migration_bluesky_view AS
SELECT 
    st.source_id as user_id,
    st.target_twitter_id as twitter_id,
    COALESCE(bm.bluesky_handle, st.bluesky_handle) as bluesky_handle,
    st.has_follow_bluesky,
    'following' as relationship_type
FROM sources_targets st
LEFT JOIN bluesky_mappings bm ON st.target_twitter_id = bm.twitter_id;

-- Créer un index sur user_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_migration_bluesky_view_user_id_targets 
ON sources_targets(source_id);

-- Ajouter des commentaires sur la vue
COMMENT ON VIEW migration_bluesky_view IS 'Vue des following avec leurs handles Bluesky pour la migration';
COMMENT ON COLUMN migration_bluesky_view.user_id IS 'ID de l''utilisateur';
COMMENT ON COLUMN migration_bluesky_view.twitter_id IS 'ID Twitter du following';
COMMENT ON COLUMN migration_bluesky_view.bluesky_handle IS 'Handle Bluesky s''il existe';
COMMENT ON COLUMN migration_bluesky_view.has_follow_bluesky IS 'Si l''utilisateur suit déjà ce compte sur Bluesky';
COMMENT ON COLUMN migration_bluesky_view.relationship_type IS 'Type de relation (following)';