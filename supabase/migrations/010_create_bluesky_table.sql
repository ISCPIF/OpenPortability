-- Create bluesky_mappings table to store Twitter to Bluesky handle mappings
create table if not exists "public"."bluesky_mappings" (
    "twitter_id" text primary key,
    "bluesky_handle" text not null,
    "imported_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on bluesky_mappings
alter table "public"."bluesky_mappings" enable row level security;

-- Create RLS policies for bluesky_mappings
create policy "Bluesky mappings are viewable by everyone"
    on bluesky_mappings for select using ( true );

create policy "Authenticated users can create bluesky mappings"
    on bluesky_mappings for insert 
    with check ( auth.uid() in (select id from public.sources) );

-- Add indexes for better query performance
create index if not exists idx_bluesky_mappings_twitter_id 
    on public.bluesky_mappings(twitter_id);
create index if not exists idx_bluesky_mappings_bluesky_handle 
    on public.bluesky_mappings(bluesky_handle);

-- Create views for different mapping scenarios
create or replace view "public"."matched_bluesky_mappings" as
select 
    bm.twitter_id,
    bm.bluesky_handle,
    t.username as twitter_username,
    t.name as twitter_name,
    st.source_twitter_id,
    bm.imported_at
from public.bluesky_mappings bm
join public.targets t on t.twitter_id = bm.twitter_id
join public.sources_targets st on st.target_twitter_id = t.twitter_id;

create or replace view "public"."unmatched_bluesky_mappings" as
select 
    bm.twitter_id,
    bm.bluesky_handle,
    bm.imported_at
from public.bluesky_mappings bm
left join public.targets t on t.twitter_id = bm.twitter_id
where t.twitter_id is null;

-- Vue pour les utilisateurs connectés avec Twitter et Bluesky
create or replace view "public"."connected_users_bluesky_mapping" as
select 
    id as user_id,
    username as twitter_username,
    full_name as twitter_name,
    twitter_id,
    bluesky_id,
    updated_at
from public.sources
where twitter_id is not null 
and bluesky_id is not null;