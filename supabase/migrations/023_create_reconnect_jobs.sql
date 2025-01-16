-- Create enum for job types
create type public.reconnect_job_type as enum ('initial_sync', 'realtime_sync');
create type public.reconnect_job_status as enum ('pending', 'processing', 'completed', 'failed');

-- Create reconnect_jobs table
create table public.reconnect_jobs (
    id uuid not null default uuid_generate_v4(),
    user_id uuid not null references "next-auth".users(id),
    job_type reconnect_job_type not null,
    status reconnect_job_status not null default 'pending',
    priority integer not null default 0,
    last_attempt timestamptz,
    next_attempt timestamptz not null default now(),
    attempt_count integer not null default 0,
    error_log text,
    stats jsonb,
    interval_seconds integer not null default 3600,
    max_interval_seconds integer not null default 28800,
    backoff_multiplier integer not null default 2,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (id)
);

-- Add indexes
create index reconnect_jobs_status_idx on public.reconnect_jobs(status);
create index reconnect_jobs_next_attempt_idx on public.reconnect_jobs(next_attempt);
create index reconnect_jobs_user_id_idx on public.reconnect_jobs(user_id);

-- Create trigger to update updated_at
create trigger update_reconnect_jobs_updated_at
    before update on public.reconnect_jobs
    for each row
    execute function update_updated_at_column();

-- Add RLS policies
alter table public.reconnect_jobs enable row level security;

create policy "Users can view their own reconnect jobs"
    on public.reconnect_jobs for select
    using (auth.uid() = user_id);

create policy "Service role can manage all reconnect jobs"
    on public.reconnect_jobs for all
    using (auth.role() = 'service_role');