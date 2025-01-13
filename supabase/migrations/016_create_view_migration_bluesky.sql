-- Create the migration_matches table
CREATE TABLE IF NOT EXISTS "public"."migration_matches" (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    twitter_id text NOT NULL,
    relationship_type text NOT NULL CHECK (relationship_type IN ('following')),
    bluesky_handle text,
    mapping_date timestamp with time zone,
    has_follow boolean DEFAULT false,
    followed_at timestamp with time zone,
    
    UNIQUE(user_id, twitter_id, relationship_type)
);

-- Add RLS policies
ALTER TABLE "public"."migration_matches" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches"
    ON "public"."migration_matches" FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own matches"
    ON "public"."migration_matches" FOR UPDATE
    USING (auth.uid() = user_id);

-- Insert initial data from the existing relationships
INSERT INTO "public"."migration_matches" (user_id, twitter_id, relationship_type, bluesky_handle, mapping_date)
SELECT DISTINCT
    st.source_id as user_id,
    st.target_twitter_id as twitter_id,
    'following' as relationship_type,
    bm.bluesky_handle,
    bm.imported_at as mapping_date
FROM sources_targets st
LEFT JOIN bluesky_mappings bm ON st.target_twitter_id = bm.twitter_id;