-- Création des index pour optimiser les performances des jointures et recherches
CREATE INDEX IF NOT EXISTS idx_sources_targets_twitter_id ON sources_targets(target_twitter_id);
CREATE INDEX IF NOT EXISTS idx_bluesky_mappings_twitter_id ON bluesky_mappings(twitter_id);
CREATE INDEX IF NOT EXISTS idx_twitter_bluesky_users_twitter_id ON twitter_bluesky_users(twitter_id);
CREATE INDEX IF NOT EXISTS idx_twitter_mastodon_users_twitter_id ON twitter_mastodon_users(twitter_id);

-- Index pour optimiser les recherches sur les handles/usernames
CREATE INDEX IF NOT EXISTS idx_sources_targets_bluesky ON sources_targets(bluesky_handle) WHERE bluesky_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sources_targets_mastodon ON sources_targets(mastodon_id) WHERE mastodon_id IS NOT NULL;

-- Index composites pour optimiser les conditions multiples
CREATE INDEX IF NOT EXISTS idx_sources_targets_composite_bluesky 
ON sources_targets(target_twitter_id, bluesky_handle) 
WHERE bluesky_handle IS NULL;

CREATE INDEX IF NOT EXISTS idx_sources_targets_composite_mastodon 
ON sources_targets(target_twitter_id, mastodon_id) 
WHERE mastodon_id IS NULL;