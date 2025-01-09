-- Add columns to sources_targets
ALTER TABLE sources_targets
ADD COLUMN IF NOT EXISTS bluesky_handle text,
ADD COLUMN IF NOT EXISTS has_follow_bluesky boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS followed_at_bluesky timestamp with time zone;

-- Add columns to sources_followers
ALTER TABLE sources_followers
ADD COLUMN IF NOT EXISTS bluesky_handle text,
ADD COLUMN IF NOT EXISTS has_follow_bluesky boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS followed_at_bluesky timestamp with time zone;

-- Function to update sources_targets in batches
CREATE OR REPLACE FUNCTION update_sources_targets_batch() RETURNS integer AS $$
DECLARE
    batch_size INTEGER := 1000;
    total_updated INTEGER := 0;
    batch_updated INTEGER;
BEGIN
    WITH to_update AS (
        SELECT st.target_twitter_id, 
               bm.bluesky_handle,
               row_number() OVER (PARTITION BY st.target_twitter_id ORDER BY bm.twitter_id) as rn
        FROM sources_targets st
        JOIN bluesky_mappings bm ON st.target_twitter_id = bm.twitter_id
        WHERE st.bluesky_handle IS NULL
        LIMIT batch_size
    )
    UPDATE sources_targets st
    SET bluesky_handle = tu.bluesky_handle
    FROM (SELECT target_twitter_id, bluesky_handle FROM to_update WHERE rn = 1) tu
    WHERE st.target_twitter_id = tu.target_twitter_id;

    GET DIAGNOSTICS batch_updated = ROW_COUNT;
    RETURN batch_updated;
END;
$$ LANGUAGE plpgsql;

-- Function to update sources_followers in batches
CREATE OR REPLACE FUNCTION update_sources_followers_batch() RETURNS integer AS $$
DECLARE
    batch_size INTEGER := 1000;
    total_updated INTEGER := 0;
    batch_updated INTEGER;
BEGIN
    WITH to_update AS (
        SELECT sf.follower_id, 
               bm.bluesky_handle,
               row_number() OVER (PARTITION BY sf.follower_id ORDER BY bm.twitter_id) as rn
        FROM sources_followers sf
        JOIN bluesky_mappings bm ON sf.follower_id = bm.twitter_id
        WHERE sf.bluesky_handle IS NULL
        LIMIT batch_size
    )
    UPDATE sources_followers sf
    SET bluesky_handle = tu.bluesky_handle
    FROM (SELECT follower_id, bluesky_handle FROM to_update WHERE rn = 1) tu
    WHERE sf.follower_id = tu.follower_id;

    GET DIAGNOSTICS batch_updated = ROW_COUNT;
    RETURN batch_updated;
END;
$$ LANGUAGE plpgsql;

-- Execute the batch updates in a loop
DO $$
DECLARE
    batch_count INTEGER;
    total_targets INTEGER := 0;
    total_followers INTEGER := 0;
BEGIN
    LOOP
        SELECT update_sources_targets_batch() INTO batch_count;
        EXIT WHEN batch_count = 0;
        total_targets := total_targets + batch_count;
        RAISE NOTICE 'Updated % total sources_targets rows', total_targets;
    END LOOP;

    LOOP
        SELECT update_sources_followers_batch() INTO batch_count;
        EXIT WHEN batch_count = 0;
        total_followers := total_followers + batch_count;
        RAISE NOTICE 'Updated % total sources_followers rows', total_followers;
    END LOOP;
END $$;

-- Clean up
DROP FUNCTION update_sources_targets_batch();
DROP FUNCTION update_sources_followers_batch();