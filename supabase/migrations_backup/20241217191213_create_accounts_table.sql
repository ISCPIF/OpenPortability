create table "next-auth"."accounts" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "type" text not null,
    "provider" text not null,
    "provider_account_id" text not null,
    "refresh_token" text,
    "access_token" text,
    "expires_at" bigint,
    "token_type" text,
    "scope" text,
    "id_token" text,
    "session_state" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    primary key ("id"),
    foreign key ("user_id") references "next-auth"."users"("id") on delete cascade,
    unique("provider", "provider_account_id")
);

create trigger update_accounts_updated_at
    before update on "next-auth"."accounts"
    for each row
    execute procedure update_updated_at_column();