-- Create followers table to store Twitter followers
create table if not exists "public"."followers" (
    "twitter_id" text primary key,
    "bluesky_handle" text,
    "bluesky_did" text
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
    "follower_id" text references public.followers(twitter_id) on delete cascade,
    "bluesky_handle" text,
    "has_follow_bluesky" boolean DEFAULT false,
    "followed_at_bluesky" timestamp with time zone,
    primary key (source_id, follower_id)
);

-- Enable RLS on sources_followers
alter table "public"."sources_followers" enable row level security;

-- Create RLS policies for sources_followers
create policy "Sources followers are viewable by everyone"
    on sources_followers for select using ( true );

create policy "Users can manage their own followers"
    on sources_followers for all
    using ( auth.uid() = source_id );q