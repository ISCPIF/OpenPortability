import NextAuth from "next-auth"
import type { Profile } from "next-auth"
import { authConfig } from "./auth.config"
import type { TwitterData, MastodonProfile, BlueskyProfile } from "@/lib/supabase-adapter"
import { supabase } from "@/lib/supabase"

export type { TwitterData as TwitterProfile } from "@/lib/supabase-adapter"
export type { MastodonProfile }
export type { BlueskyProfile }


async function createMastodonApp(instance: string){
const { data: instances } = await supabase.from("mastodon_instances").select();
let cachedValue = instances.find(r => r.instance == instance)
  if (!cachedValue) {
    console.log("no cached value")
    const url = `https://${instance}/api/v1/apps`
    const formData = {
        "client_name": "HelloQuitX",
        "redirect_uris": [`${process.env.NEXTAUTH_URL}/api/auth/callback/mastodon`],
        // TODO: limiter ?
        "scopes": "read",
        "website": "https://app.helloquitx.com"
    }
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(formData),
            headers: {
                "Content-Type": "application/json",
            }
        })
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const json = await response.json();
        console.log(json)
        cachedValue = {
            instance,
            client_id: json.client_id,
            client_secret: json.client_secret
        }

        const insertResult = await supabase.from("mastodon_instances").insert(cachedValue);
        console.log("inserted", insertResult)
        } catch (error) {
        console.error(error.message);
        }
  }
  return cachedValue
}

// https://authjs.dev/reference/nextjs#lazy-initialization
export const { auth, signIn, signOut, handlers } = NextAuth(async req => { 
    if (req?.url.includes("api/auth/signin/mastodon")) {
        console.log(req) // do something with the request
        const { searchParams } = new URL(req.url)
        const instance = searchParams.get('instance') || "mastodon.social"
        console.log("instance", instance)
        const res = await createMastodonApp(instance)
        console.log(res)
        const mastodonProvider = authConfig.providers.find(prov => prov.id === "mastodon")
        mastodonProvider.issuer = `https://${instance}`;
        mastodonProvider.clientId = res.client_id;
        mastodonProvider.clientSecret = res.client_secret;
        mastodonProvider.authorization = `${mastodonProvider.issuer}/oauth/authorize?scope=read`;
        mastodonProvider.token = `${mastodonProvider.issuer}/oauth/token`;
        mastodonProvider.userinfo = `${mastodonProvider.issuer}/api/v1/accounts/verify_credentials`;
        console.log(authConfig)
    }
    return authConfig;
})

// Type guards
export function isTwitterProfile(profile: any): profile is TwitterData {
    return profile && 'data' in profile;
}

export function isMastodonProfile(profile: Profile): profile is MastodonProfile {
    return profile && 'url' in profile;
}

export function isBlueskyProfile(profile: Profile): profile is BlueskyProfile {
    return profile && 'handle' in profile;
}
