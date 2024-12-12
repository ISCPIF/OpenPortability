insert into "next-auth"."users" (
    id,
    name,
    email,
    email_verified,
    image,
    has_onboarded,
    twitter_id
) values (
    uuid_generate_v4(),
    'Test User',
    'test@example.com',
    now(),
    null,
    false,
    '1234567890'
);

insert into "public"."user_data" (user_id) 
    select 
        id as user_id
    from "next-auth"."users"
    where email = 'test@example.com';