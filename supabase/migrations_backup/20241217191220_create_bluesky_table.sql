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

-- Create followers table to store Twitter followers
create table if not exists "public"."followers" (
    "twitter_id" text primary key,
    "username" text,
    "name" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on followers
alter table "public"."followers" enable row level security;

-- Create RLS policies for followers
create policy "Followers are viewable by everyone"
    on followers for select using ( true );

create policy "Authenticated users can create followers"
    on followers for insert 
    with check ( auth.uid() in (select id from public.sources) );

-- Create sources_followers table to store relationships
create table if not exists "public"."sources_followers" (
    "source_id" uuid references public.sources(id) on delete cascade,
    "source_twitter_id" text references public.sources(twitter_id) on delete cascade,
    "follower_id" text references public.followers(twitter_id) on delete cascade,
    "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (source_id, follower_id)
);

-- Enable RLS on sources_followers
alter table "public"."sources_followers" enable row level security;

-- Create RLS policies for sources_followers
create policy "Sources followers are viewable by everyone"
    on sources_followers for select using ( true );

create policy "Users can manage their own followers"
    on sources_followers for all
    using ( auth.uid() = source_id );

-- Add indexes for better query performance
create index if not exists idx_followers_twitter_id 
    on public.followers(twitter_id);
create index if not exists idx_sources_followers_source_id 
    on public.sources_followers(source_id);
create index if not exists idx_sources_followers_follower_id 
    on public.sources_followers(follower_id);

-- Vue pour les utilisateurs connectés avec Twitter et Bluesky
create or replace view "public"."connected_users_bluesky_mapping" as
select 
    s.id as user_id,
    s.username as twitter_username,
    s.full_name as twitter_name,
    s.twitter_id,
    s.bluesky_id,
    s.updated_at,
    count(distinct st.target_twitter_id) as following_count,
    count(distinct sf.follower_id) as followers_count
from public.sources s
left join public.sources_targets st on st.source_id = s.id
left join public.sources_followers sf on sf.source_id = s.id
where s.twitter_id is not null 
and s.bluesky_id is not null
group by s.id, s.username, s.full_name, s.twitter_id, s.bluesky_id, s.updated_at;