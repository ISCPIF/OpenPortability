create table "next-auth"."users" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text,
    "twitter_id" text not null unique,
    "twitter_username" text,
    "twitter_image" text,
    "bluesky_id" text unique,
    "bluesky_username" text,
    "bluesky_image" text,
    "email" text,
    "email_verified" timestamptz,
    "image" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    "has_onboarded" boolean not null default false,
    primary key ("id"),
    unique("email")
);

-- Create a trigger to automatically update the updated_at column
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_users_updated_at
    before update on "next-auth"."users"
    for each row
    execute procedure update_updated_at_column();