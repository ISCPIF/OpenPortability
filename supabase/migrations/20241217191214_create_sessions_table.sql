create table "next-auth"."sessions" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "expires" timestamptz not null,
    "session_token" text not null,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    primary key ("id"),
    foreign key ("user_id") references "next-auth"."users"("id") on delete cascade,
    unique("session_token")
);

create trigger update_sessions_updated_at
    before update on "next-auth"."sessions"
    for each row
    execute procedure update_updated_at_column();