-- Drop existing tables and views
DROP VIEW IF EXISTS "public"."twitter_mastodon_users";
DROP TABLE IF EXISTS "public"."twitter_mastodon_users";

-- Create the physical table for Twitter and Mastodon users
CREATE TABLE "public"."twitter_mastodon_users" (
    "id" uuid not null,
    "name" text,
    "email" text,
    "twitter_id" text,
    "twitter_username" text,
    "twitter_image" text,
    "mastodon_id" text,
    "mastodon_username" text,
    "mastodon_image" text,
    "mastodon_instance" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    primary key ("id")
);

-- Import existing users who have both Twitter and Mastodon accounts
INSERT INTO "public"."twitter_mastodon_users" (
    id,
    name,
    email,
    twitter_id,
    twitter_username,
    twitter_image,
    mastodon_id,
    mastodon_username,
    mastodon_image,
    mastodon_instance,
    created_at,
    updated_at
)
SELECT 
    id,
    name,
    email,
    twitter_id,
    twitter_username,
    twitter_image,
    mastodon_id,
    mastodon_username,
    mastodon_image,
    mastodon_instance,
    created_at,
    updated_at
FROM "next-auth"."users"
WHERE twitter_id IS NOT NULL 
AND mastodon_id IS NOT NULL;

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_twitter_mastodon_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_twitter_mastodon_users_updated_at
    BEFORE UPDATE ON "public"."twitter_mastodon_users"
    FOR EACH ROW
    EXECUTE FUNCTION update_twitter_mastodon_users_updated_at();

-- Create a function to sync users
CREATE OR REPLACE FUNCTION sync_twitter_mastodon_users()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT or UPDATE operations
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- If user has both Twitter and Mastodon IDs
        IF (NEW.twitter_id IS NOT NULL AND NEW.mastodon_id IS NOT NULL) THEN
            INSERT INTO public.twitter_mastodon_users (
                id,
                name,
                email,
                twitter_id,
                twitter_username,
                twitter_image,
                mastodon_id,
                mastodon_username,
                mastodon_image,
                mastodon_instance,
                created_at,
                updated_at
            )
            VALUES (
                NEW.id,
                NEW.name,
                NEW.email,
                NEW.twitter_id,
                NEW.twitter_username,
                NEW.twitter_image,
                NEW.mastodon_id,
                NEW.mastodon_username,
                NEW.mastodon_image,
                NEW.mastodon_instance,
                NEW.created_at,
                NEW.updated_at
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                twitter_id = EXCLUDED.twitter_id,
                twitter_username = EXCLUDED.twitter_username,
                twitter_image = EXCLUDED.twitter_image,
                mastodon_id = EXCLUDED.mastodon_id,
                mastodon_username = EXCLUDED.mastodon_username,
                mastodon_image = EXCLUDED.mastodon_image,
                mastodon_instance = EXCLUDED.mastodon_instance,
                updated_at = now();
        -- If user no longer has both IDs, remove from the table
        ELSE
            DELETE FROM public.twitter_mastodon_users WHERE id = NEW.id;
        END IF;
    END IF;

    -- For DELETE operations
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM public.twitter_mastodon_users WHERE id = OLD.id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on next-auth.users
DROP TRIGGER IF EXISTS sync_twitter_mastodon_users_trigger ON "next-auth"."users";
CREATE TRIGGER sync_twitter_mastodon_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "next-auth"."users"
    FOR EACH ROW
    EXECUTE FUNCTION sync_twitter_mastodon_users();