-- Grant permissions to the service_role
grant usage on schema "next-auth" to service_role;
grant all privileges on all tables in schema "next-auth" to service_role;
grant all privileges on all sequences in schema "next-auth" to service_role;

-- Grant permissions to the authenticated role
grant usage on schema "next-auth" to authenticated;
grant all privileges on all tables in schema "next-auth" to authenticated;
grant all privileges on all sequences in schema "next-auth" to authenticated;

-- Grant permissions to the anon role
grant usage on schema "next-auth" to anon;
grant all privileges on all tables in schema "next-auth" to anon;

-- Grant specific table permissions
grant all privileges on table "next-auth".users to service_role, authenticated, anon;
grant all privileges on table "next-auth".accounts to service_role, authenticated, anon;
grant all privileges on table "next-auth".sessions to service_role, authenticated, anon;
grant all privileges on table "next-auth".verification_tokens to service_role, authenticated, anon;

create or replace function "next-auth".verify_twitter_token(token_param text)
returns table (
    user_id text,
    user_name text,
    user_email text,
    provider text,
    provider_account_id text
)
security definer
set search_path = public, "next-auth"
as $$
begin
    return query
    select
        u.id::text as user_id,
        u.name as user_name,
        u.email as user_email,
        a.provider,
        a.provider_account_id
    from "next-auth".accounts a
    join "next-auth".users u on u.id = a.user_id::uuid
    where a.provider = 'twitter'
    and a.access_token = token_param
    and a.expires_at > extract(epoch from now())::bigint;
end;
$$ language plpgsql;



-- Grant execute permission to authenticated users
grant execute on function "next-auth".verify_twitter_token(text) to authenticated;
grant execute on function "next-auth".verify_twitter_token(text) to anon;
grant execute on function "next-auth".verify_twitter_token(text) to service_role;

create table "public"."user_data" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    primary key ("id")
);