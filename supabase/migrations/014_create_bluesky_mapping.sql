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