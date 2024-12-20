-- Enable RLS on public.user_data
alter table "public"."user_data" enable row level security;

-- Create policy for user_data table
create policy "Users can view and edit their own data"
    on "public"."user_data"
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);