-- Drop existing table if it exists
drop table if exists public.share_events;

-- Create the share_events table
create table if not exists public.share_events (
    id uuid default gen_random_uuid() primary key,
    source_id uuid references public.sources(id) on delete cascade,
    platform text not null,
    shared_at timestamp with time zone default timezone('utc'::text, now()),
    success boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.share_events enable row level security;

-- Create RLS policies
create policy "Users can view their own share events"
    on share_events for select
    using (auth.uid() = source_id);

create policy "Users can create their own share events"
    on share_events for insert
    with check (auth.uid() = source_id);

-- Create index for better query performance
create index if not exists idx_share_events_source_id
    on public.share_events(source_id);

-- Grant access to authenticated users
grant insert, select on public.share_events to authenticated;