-- Create import_jobs table
create table if not exists public.import_jobs (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references "next-auth"."users"(id),
    status text check (status in ('pending', 'processing', 'completed', 'failed')),
    total_items integer default 0,
    error_log text,
    job_type text check (job_type in ('large_file_import', 'direct_import')),
    file_paths text[],
    stats jsonb default '{"followers": 0, "following": 0, "total": 0, "processed": 0}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);

-- Add indexes
create index if not exists import_jobs_status_idx on import_jobs(status);
create index if not exists import_jobs_user_id_idx on import_jobs(user_id);
create index if not exists import_jobs_created_at_idx on import_jobs(created_at);

-- Create the function to claim the next pending job
CREATE OR REPLACE FUNCTION claim_next_pending_job(worker_id_input TEXT)
RETURNS SETOF import_jobs AS $$
BEGIN
    RETURN QUERY
    WITH next_job AS (
        UPDATE import_jobs
        SET 
            status = 'processing',
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = (
            SELECT id
            FROM import_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING *
    )
    SELECT * FROM next_job;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS but allow service role full access
alter table import_jobs enable row level security;

create policy "Service role can manage import jobs"
    on import_jobs for all
    using (true)
    with check (true);

-- Add policy for users to view their own jobs
create policy "Users can view their own import jobs"
    on import_jobs for select
    using (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import jobs"
    ON import_jobs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
    ON import_jobs FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);