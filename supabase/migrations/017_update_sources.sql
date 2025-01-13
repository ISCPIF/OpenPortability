-- Add columns to sources_targets
ALTER TABLE sources_targets
ADD COLUMN IF NOT EXISTS bluesky_handle text,
ADD COLUMN IF NOT EXISTS has_follow_bluesky boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS followed_at_bluesky timestamp with time zone;

-- Create function for updating sources_targets
CREATE OR REPLACE FUNCTION update_sources_targets_handle() RETURNS TRIGGER AS $$
BEGIN
    -- Update sources_targets when a new mapping is inserted or updated
    UPDATE sources_targets
    SET bluesky_handle = NEW.bluesky_handle
    WHERE target_twitter_id = NEW.twitter_id
    AND (bluesky_handle IS NULL OR bluesky_handle != NEW.bluesky_handle);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger
DROP TRIGGER IF EXISTS trigger_update_sources_targets ON bluesky_mappings;
CREATE TRIGGER trigger_update_sources_targets
    AFTER INSERT OR UPDATE OF bluesky_handle
    ON bluesky_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_sources_targets_handle();

-- Initial sync of existing data
WITH to_update AS (
    SELECT DISTINCT ON (st.target_twitter_id)
           st.target_twitter_id,
           bm.bluesky_handle
    FROM sources_targets st
    JOIN bluesky_mappings bm ON st.target_twitter_id = bm.twitter_id
    WHERE st.bluesky_handle IS NULL OR st.bluesky_handle != bm.bluesky_handle
)
UPDATE sources_targets st
SET bluesky_handle = tu.bluesky_handle
FROM to_update tu
WHERE st.target_twitter_id = tu.target_twitter_id;