-- First, create a function to get the current user's ID from the next-auth session
create or replace function public.get_session_user_id()
returns uuid as $$
declare
  session_record record;
  user_id uuid;
begin
  -- Get the most recent valid session for the current request
  select s.user_id into user_id
  from "next-auth".sessions s
  where s.session_token = current_setting('request.cookie.next-auth.session-token', true)
  and s.expires > now();
  
  return user_id;
end;
$$ language plpgsql security definer;

-- Drop existing policies if they exist
drop policy if exists "Users can view and edit their own data" on "public"."user_data";

-- Enable RLS on the user_data table
alter table "public"."user_data" enable row level security;

-- Create policy for reading user data
create policy "Users can view their own data"
    on "public"."user_data"
    for select
    using (
        user_id = public.get_session_user_id()
    );

-- Create policy for inserting user data
create policy "Users can insert their own data"
    on "public"."user_data"
    for insert
    with check (
        user_id = public.get_session_user_id()
    );

-- Create policy for updating user data
create policy "Users can update their own data"
    on "public"."user_data"
    for update
    using (
        user_id = public.get_session_user_id()
    )
    with check (
        user_id = public.get_session_user_id()
    );

-- Create policy for deleting user data
create policy "Users can delete their own data"
    on "public"."user_data"
    for delete
    using (
        user_id = public.get_session_user_id()
    );

-- Grant necessary permissions to the authenticated users
grant usage on schema public to authenticated;
grant all on public.user_data to authenticated;
grant execute on function public.get_session_user_id to authenticated;

-- Create a trigger to ensure user_id matches the session user on insert
create or replace function public.ensure_user_id_matches_session()
returns trigger as $$
begin
    if new.user_id != public.get_session_user_id() then
        raise exception 'user_id must match the session user';
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger ensure_user_id_matches_session_trigger
    before insert or update on public.user_data
    for each row
    execute function public.ensure_user_id_matches_session();

-- Add an index to improve performance of user_id lookups
create index if not exists idx_user_data_user_id on public.user_data(user_id);