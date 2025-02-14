-- Drop existing tables and views
DROP VIEW IF EXISTS "public"."twitter_bluesky_users";
DROP TABLE IF EXISTS "public"."twitter_bluesky_users";

-- Create the physical table for Twitter and Bluesky users
CREATE TABLE "public"."twitter_bluesky_users" (
    "id" uuid not null,
    "name" text,
    "email" text,
    "twitter_id" text,
    "twitter_username" text,
    "twitter_image" text,
    "bluesky_id" text,
    "bluesky_username" text,
    "bluesky_image" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    primary key ("id")
);

-- Import existing users who have both Twitter and Bluesky accounts
INSERT INTO "public"."twitter_bluesky_users" (
    id,
    name,
    email,
    twitter_id,
    twitter_username,
    twitter_image,
    bluesky_id,
    bluesky_username,
    bluesky_image,
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
    bluesky_id,
    bluesky_username,
    bluesky_image,
    created_at,
    updated_at
FROM "next-auth"."users"
WHERE twitter_id IS NOT NULL 
AND bluesky_id IS NOT NULL;

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.update_twitter_bluesky_users_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_twitter_bluesky_users_updated_at
    BEFORE UPDATE ON "public"."twitter_bluesky_users"
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_twitter_bluesky_users_updated_at();

-- Create function to handle synchronization
CREATE OR REPLACE FUNCTION public.sync_twitter_bluesky_users()
RETURNS trigger AS $$
BEGIN
    -- If user has both Twitter and Bluesky IDs, add/update them in twitter_bluesky_users
    IF NEW.twitter_id IS NOT NULL AND NEW.bluesky_id IS NOT NULL THEN
        INSERT INTO public.twitter_bluesky_users (
            id,
            name,
            email,
            twitter_id,
            twitter_username,
            twitter_image,
            bluesky_id,
            bluesky_username,
            bluesky_image,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.name,
            NEW.email,
            NEW.twitter_id,
            NEW.twitter_username,
            NEW.twitter_image,
            NEW.bluesky_id,
            NEW.bluesky_username,
            NEW.bluesky_image,
            NEW.created_at,
            NEW.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            twitter_id = EXCLUDED.twitter_id,
            twitter_username = EXCLUDED.twitter_username,
            twitter_image = EXCLUDED.twitter_image,
            bluesky_id = EXCLUDED.bluesky_id,
            bluesky_username = EXCLUDED.bluesky_username,
            bluesky_image = EXCLUDED.bluesky_image,
            updated_at = now();
    -- If user no longer has both IDs, remove them from twitter_bluesky_users
    ELSE
        DELETE FROM public.twitter_bluesky_users WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on next-auth.users table
DROP TRIGGER IF EXISTS sync_twitter_bluesky_users_trigger ON "next-auth".users;
CREATE TRIGGER sync_twitter_bluesky_users_trigger
    AFTER INSERT OR UPDATE ON "next-auth".users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_twitter_bluesky_users();

-- Now we can populate bluesky_mappings from twitter_bluesky_users
INSERT INTO public.bluesky_mappings (
    twitter_id,
    bluesky_handle
)
SELECT 
    twitter_id,
    bluesky_username as bluesky_handle
FROM public.twitter_bluesky_users
ON CONFLICT (twitter_id) DO UPDATE SET
    bluesky_handle = EXCLUDED.bluesky_handle,
    imported_at = timezone('utc'::text, now());