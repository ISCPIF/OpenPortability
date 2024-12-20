create table "next-auth"."verification_tokens" (
    "identifier" text not null,
    "token" text not null,
    "expires" timestamptz not null,
    "created_at" timestamptz not null default now(),
    primary key ("identifier", "token")
);