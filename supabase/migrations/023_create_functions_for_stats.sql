-- Fonction pour compter les followers
CREATE OR REPLACE FUNCTION count_followers()
RETURNS TABLE (count bigint)
LANGUAGE sql
STABLE    -- Indique que la fonction ne modifie pas la BD
PARALLEL SAFE  -- Peut s'exécuter en parallèle
AS $$
  SELECT reltuples::bigint as count
  FROM pg_class
  WHERE relname = 'sources_followers';
$$;

-- Fonction pour compter les targets (following)
CREATE OR REPLACE FUNCTION count_targets()
RETURNS TABLE (count bigint)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT reltuples::bigint as count
  FROM pg_class
  WHERE relname = 'sources_targets';
$$;

-- Fonction pour compter les targets avec handle
CREATE OR REPLACE FUNCTION count_targets_with_handle()
RETURNS TABLE (count bigint)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT (
    reltuples::bigint * (
      COALESCE(
        (SELECT n_distinct 
         FROM pg_stats 
         WHERE tablename = 'sources_targets' 
         AND attname IN ('bluesky_handle', 'mastodon_id')
         AND n_distinct > 0
         LIMIT 1
        ), 0.1)
    )
  )::bigint as count
  FROM pg_class
  WHERE relname = 'sources_targets';
$$;

-- Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION count_followers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION count_targets() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION count_targets_with_handle() TO authenticated, service_role;

-- Ajouter un ANALYZE pour mettre à jour les statistiques
ANALYZE sources_followers;
ANALYZE sources_targets;