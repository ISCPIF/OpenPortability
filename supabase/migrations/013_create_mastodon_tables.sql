create table "public"."mastodon_instances" (
    "id" uuid not null default uuid_generate_v4(),
    "instance" text not null,
    "client_id" text not null,
    "client_secret" text not null,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    primary key ("id")
);

create trigger update_mastodon_instances_updated_at
    before update on "public"."mastodon_instances"
    for each row
    execute procedure update_updated_at_column();
