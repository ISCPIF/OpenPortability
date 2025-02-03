-- Fonction pour mettre à jour sources_targets depuis bluesky_mappings
CREATE OR REPLACE FUNCTION update_sources_targets_from_mappings() RETURNS TRIGGER AS $$
BEGIN
    UPDATE sources_targets
    SET 
        bluesky_handle = NEW.bluesky_handle
    WHERE target_twitter_id = NEW.twitter_id
    AND (bluesky_handle IS NULL OR bluesky_handle != NEW.bluesky_handle);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour sources_targets depuis twitter_bluesky_users
CREATE OR REPLACE FUNCTION update_sources_targets_from_bluesky_users() RETURNS TRIGGER AS $$
BEGIN
    UPDATE sources_targets
    SET 
        bluesky_handle = NEW.bluesky_username
    WHERE target_twitter_id = NEW.twitter_id
    AND (bluesky_handle IS NULL OR bluesky_handle != NEW.bluesky_username);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour sources_targets depuis twitter_mastodon_users
CREATE OR REPLACE FUNCTION update_sources_targets_from_mastodon_users() RETURNS TRIGGER AS $$
BEGIN
    UPDATE sources_targets
    SET 
        mastodon_id = NEW.mastodon_id,
        mastodon_username = NEW.mastodon_username,
        mastodon_instance = NEW.mastodon_instance
    WHERE target_twitter_id = NEW.twitter_id
    AND (mastodon_id IS NULL OR mastodon_id != NEW.mastodon_id
         OR mastodon_username IS NULL OR mastodon_username != NEW.mastodon_username
         OR mastodon_instance IS NULL OR mastodon_instance != NEW.mastodon_instance);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les nouvelles entrées dans sources_targets
CREATE OR REPLACE FUNCTION update_new_sources_targets() RETURNS TRIGGER AS $$
BEGIN
    -- Mise à jour depuis bluesky_mappings
    UPDATE sources_targets
    SET bluesky_handle = bm.bluesky_handle
    FROM bluesky_mappings bm
    WHERE sources_targets.target_twitter_id = bm.twitter_id
    AND sources_targets.source_id = NEW.source_id
    AND (sources_targets.bluesky_handle IS NULL OR sources_targets.bluesky_handle != bm.bluesky_handle);

    -- Mise à jour depuis twitter_bluesky_users
    UPDATE sources_targets
    SET bluesky_handle = tbu.bluesky_username
    FROM twitter_bluesky_users tbu
    WHERE sources_targets.target_twitter_id = tbu.twitter_id
    AND sources_targets.source_id = NEW.source_id
    AND (sources_targets.bluesky_handle IS NULL OR sources_targets.bluesky_handle != tbu.bluesky_username);

    -- Mise à jour depuis twitter_mastodon_users
    UPDATE sources_targets
    SET 
        mastodon_id = tmu.mastodon_id,
        mastodon_username = tmu.mastodon_username,
        mastodon_instance = tmu.mastodon_instance
    FROM twitter_mastodon_users tmu
    WHERE sources_targets.target_twitter_id = tmu.twitter_id
    AND sources_targets.source_id = NEW.source_id
    AND (sources_targets.mastodon_id IS NULL OR sources_targets.mastodon_id != tmu.mastodon_id
         OR sources_targets.mastodon_username IS NULL OR sources_targets.mastodon_username != tmu.mastodon_username
         OR sources_targets.mastodon_instance IS NULL OR sources_targets.mastodon_instance != tmu.mastodon_instance);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS trigger_update_sources_targets_mappings ON bluesky_mappings;
CREATE TRIGGER trigger_update_sources_targets_mappings
    AFTER INSERT OR UPDATE OF bluesky_handle
    ON bluesky_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_sources_targets_from_mappings();

DROP TRIGGER IF EXISTS trigger_update_sources_targets_bluesky ON twitter_bluesky_users;
CREATE TRIGGER trigger_update_sources_targets_bluesky
    AFTER INSERT OR UPDATE OF bluesky_username
    ON twitter_bluesky_users
    FOR EACH ROW
    EXECUTE FUNCTION update_sources_targets_from_bluesky_users();

DROP TRIGGER IF EXISTS trigger_update_sources_targets_mastodon ON twitter_mastodon_users;
CREATE TRIGGER trigger_update_sources_targets_mastodon
    AFTER INSERT OR UPDATE OF mastodon_id, mastodon_username, mastodon_instance
    ON twitter_mastodon_users
    FOR EACH ROW
    EXECUTE FUNCTION update_sources_targets_from_mastodon_users();

DROP TRIGGER IF EXISTS trigger_update_new_sources_targets ON sources_targets;
CREATE TRIGGER trigger_update_new_sources_targets
    AFTER INSERT
    ON sources_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_new_sources_targets();

-- Synchronisation initiale des données existantes pour bluesky_mappings
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

-- Synchronisation initiale des données existantes pour twitter_bluesky_users
WITH to_update AS (
    SELECT DISTINCT ON (st.target_twitter_id)
           st.target_twitter_id,
           tbu.bluesky_username
    FROM sources_targets st
    JOIN twitter_bluesky_users tbu ON st.target_twitter_id = tbu.twitter_id
    WHERE st.bluesky_handle IS NULL OR st.bluesky_handle != tbu.bluesky_username
)
UPDATE sources_targets st
SET bluesky_handle = tu.bluesky_username
FROM to_update tu
WHERE st.target_twitter_id = tu.target_twitter_id;

-- Synchronisation initiale des données existantes pour Mastodon
WITH to_update AS (
    SELECT DISTINCT ON (st.target_twitter_id)
           st.target_twitter_id,
           tmu.mastodon_id,
           tmu.mastodon_username,
           tmu.mastodon_instance
    FROM sources_targets st
    JOIN twitter_mastodon_users tmu ON st.target_twitter_id = tmu.twitter_id
    WHERE st.mastodon_id IS NULL OR st.mastodon_id != tmu.mastodon_id
    OR st.mastodon_username IS NULL OR st.mastodon_username != tmu.mastodon_username
    OR st.mastodon_instance IS NULL OR st.mastodon_instance != tmu.mastodon_instance
)
UPDATE sources_targets st
SET 
    mastodon_id = tu.mastodon_id,
    mastodon_username = tu.mastodon_username,
    mastodon_instance = tu.mastodon_instance
FROM to_update tu
WHERE st.target_twitter_id = tu.target_twitter_id;