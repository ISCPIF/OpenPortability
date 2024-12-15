-- Create the share_events table
create table if not exists public.share_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id),
    platform text not null,
    shared_at timestamp with time zone default timezone('utc'::text, now()),
    success boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add RLS policies
alter table public.share_events enable row level security;

-- Allow insert for authenticated users
create policy "Users can insert their own share events"
    on public.share_events
    for insert
    with check (auth.uid() = user_id);

-- Allow select for authenticated users
create policy "Users can view their own share events"
    on public.share_events
    for select
    using (auth.uid() = user_id);

-- Grant access to authenticated users
grant insert, select on public.share_events to authenticated;