-- Rollback pour 024_add_indexes_for_sources_targets.sql
DROP INDEX IF EXISTS idx_sources_targets_twitter_id;
DROP INDEX IF EXISTS idx_bluesky_mappings_twitter_id;
DROP INDEX IF EXISTS idx_twitter_bluesky_users_twitter_id;
DROP INDEX IF EXISTS idx_twitter_mastodon_users_twitter_id;
DROP INDEX IF EXISTS idx_sources_targets_bluesky;
DROP INDEX IF EXISTS idx_sources_targets_mastodon;
DROP INDEX IF EXISTS idx_sources_targets_composite_bluesky;
DROP INDEX IF EXISTS idx_sources_targets_composite_mastodon;

-- Rollback pour 023_create_functions_for_stats.sql
DROP FUNCTION IF EXISTS count_followers();
DROP FUNCTION IF EXISTS count_targets();
DROP FUNCTION IF EXISTS count_targets_with_handle();

-- Rollback pour 022_create_trigger_to_update_sources_targets.sql
DROP TRIGGER IF EXISTS trigger_update_sources_targets_mappings ON bluesky_mappings;
DROP TRIGGER IF EXISTS trigger_update_sources_targets_bluesky ON twitter_bluesky_users;
DROP TRIGGER IF EXISTS trigger_update_sources_targets_mastodon ON twitter_mastodon_users;
DROP TRIGGER IF EXISTS trigger_update_new_sources_targets ON sources_targets;

DROP FUNCTION IF EXISTS update_sources_targets_from_mappings();
DROP FUNCTION IF EXISTS update_sources_targets_from_bluesky_users();
DROP FUNCTION IF EXISTS update_sources_targets_from_mastodon_users();
DROP FUNCTION IF EXISTS update_new_sources_targets();