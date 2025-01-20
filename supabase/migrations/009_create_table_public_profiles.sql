-- Create sources table (authenticated users)
create table if not exists "public"."sources" (
    "id" uuid references "next-auth"."users" on delete cascade primary key
);

-- Enable RLS on sources
alter table "public"."sources" enable row level security;

-- Create RLS policies for sources
create policy "Public sources are viewable by everyone"
    on sources for select using ( true );

create policy "Users can update their own source"
    on sources for update using ( auth.uid() = id );

-- Create targets table (Twitter accounts to follow)
create table if not exists "public"."targets" (
    "twitter_id" text primary key,
    "bluesky_handle" text,
    "bluesky_did" text
);

-- Create sources_targets junction table
create table if not exists "public"."sources_targets" (
    "source_id" uuid references "public"."sources"(id) on delete cascade,
    "target_twitter_id" text references "public"."targets"(twitter_id) on delete cascade,
    "bluesky_handle" text,
    "has_follow_bluesky" boolean DEFAULT false,
    "followed_at_bluesky" timestamp with time zone,
    primary key (source_id, target_twitter_id)
);

-- Enable RLS
alter table "public"."targets" enable row level security;
alter table "public"."sources_targets" enable row level security;

-- RLS policies for targets
create policy "Targets are viewable by everyone"
    on targets for select using ( true );

create policy "Authenticated users can create targets"
    on targets for insert with check ( auth.uid() in (select id from public.sources) );

-- RLS policies for sources_targets
create policy "Anyone can view source-target relationships"
    on sources_targets for select using ( true );

create policy "Sources can create their own relationships"
    on sources_targets for insert 
    with check ( auth.uid() = source_id );

create policy "Sources can delete their own relationships"
    on sources_targets for delete 
    using ( auth.uid() = source_id );

create policy "Sources can update their own relationships"
    on sources_targets for update
    using ( auth.uid() = source_id );