import NextAuth, { NextAuthConfig } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import CredentialsProvider from "next-auth/providers/credentials"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import type { TwitterProfile } from "next-auth/providers/twitter"

export const authConfig = {
  adapter: supabaseAdapter,
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true
      }
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: true
      }
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true
      }
    },
    pkceCodeVerifier: {
      name: `__Secure-next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        maxAge: 900
      }
    },
    state: {
      name: `__Secure-next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        maxAge: 900
      }
    },
  },
  providers: [
    // Mock provider pour le développement
    // process.env.NODE_ENV === "development"
    //   ? CredentialsProvider({
    //       id: "mock-twitter",
    //       name: "Mock Twitter",
    //       credentials: {},
    //       async authorize() {
    //         return {
    //           id: "mock-user-id",
    //           name: "Mock User",
    //           email: "mock@example.com",
    //           emailVerified: null,
    //           image: "https://pbs.twimg.com/profile_images/1590713963528032256/XSpysA3J_normal.jpg",
    //           twitter_id: "mock-twitter-id"
    //         }
    //       },
    //     })
    //   : null,
    
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      profile(profile: TwitterProfile) {
        console.log(" Twitter Profile Raw Data:", profile)
        return {
          id: profile.data.id.toString(),
          name: profile.data.name,
          twitter_id: profile.data.id.toString(),
          twitter_username: profile.data.username,
          twitter_image: profile.data.profile_image_url,
          has_onboarded: false,
          bluesky_id: null,
          bluesky_username: null,
          bluesky_image: null
        }
      }
    }),

    // {
    //   id: "mastodon",
    //   name: "Mastodon",
    //   type: "oauth",
    //   clientId: process.env.MASTODON_CLIENT_ID,
    //   clientSecret: process.env.MASTODON_CLIENT_SECRET,
    //   authorization: {
    //     url: `https://${process.env.MASTODON_DOMAIN}/oauth/authorize`,
    //     params: {
    //       scope: "read write follow",
    //       response_type: "code",
    //       code_challenge_method: "S256"
    //     }
    //   },
    //   token: {
    //     url: `https://${process.env.MASTODON_DOMAIN}/oauth/token`,
    //     params: { grant_type: "authorization_code" }
    //   },
    //   userinfo: {
    //     url: `https://${process.env.MASTODON_DOMAIN}/api/v1/accounts/verify_credentials`,
    //     async request({ tokens }) {
    //       const response = await fetch(
    //         `https://${process.env.MASTODON_DOMAIN}/api/v1/accounts/verify_credentials`,
    //         {
    //           headers: {
    //             Authorization: `Bearer ${tokens.access_token}`,
    //           },
    //         }
    //       )
    //       if (!response.ok) {
    //         throw new Error("Failed to fetch user")
    //       }
    //       return await response.json()
    //     }
    //   },
    //   profile(profile) {
    //     return {
    //       id: profile.id,
    //       name: profile.display_name || profile.username,
    //       email: profile.email,
    //       image: profile.avatar,
    //       mastodon_id: profile.id,
    //       mastodon_username: profile.username,
    //       mastodon_image: profile.avatar,
    //       mastodon_instance: process.env.MASTODON_DOMAIN
    //     }
    //   },
    //   checks: ["pkce"],
    //   client: {
    //     token_endpoint_auth_method: "client_secret_post"
    //   }
    // },

    CredentialsProvider({
      id: "bluesky",
      name: "BlueSky",
      credentials: {
        identifier: { label: "Identifier", type: "text" },
        did: { label: "DID", type: "text" },
        name: { label: "Name", type: "text" },
        image: { label: "Image", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.did || !credentials?.identifier) {
          return null;
        }

        try {
          // Vérifier d'abord si l'utilisateur existe déjà
          const existingUser = await supabaseAdapter.getUserByAccount({
            provider: "bluesky",
            providerAccountId: credentials.did,
          });

          if (existingUser) {
            // Mettre à jour les informations de l'utilisateur si nécessaire
            const updatedUser = await supabaseAdapter.updateUser({
              id: existingUser.id,
              name: credentials.name || credentials.identifier,
              bluesky_username: credentials.identifier,
              bluesky_image: credentials.image,
            });
            return updatedUser;
          }

          // Si l'utilisateur n'existe pas, le créer
          const user = {
            name: credentials.name || credentials.identifier,
            email: `${credentials.did}@bsky.social`,
            email_verified: new Date().toISOString(),
            bluesky_id: credentials.did,
            bluesky_username: credentials.identifier,
            bluesky_image: credentials.image,
            has_onboarded: false
          };

          const newUser = await supabaseAdapter.createUser(user);

          if (!newUser) {
            throw new Error("Failed to create user");
          }

          // Créer le compte associé
          await supabaseAdapter.linkAccount({
            userId: newUser.id,
            type: "oauth",
            provider: "bluesky",
            providerAccountId: credentials.did,
          });

          return newUser;
        } catch (error) {
          console.error("Error in BlueSky authorize:", error);
          return null;
        }
      },
    }),

    CredentialsProvider({
      id: "mastodon",
      name: "Mastodon",
      credentials: {
        username: { label: "Username", type: "text" },
        id: { label: "ID", type: "text" },
        instance: { label: "Instance", type: "text" },
        name: { label: "Name", type: "text" },
        image: { label: "Image", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.id || !credentials?.username || !credentials?.instance) {
          return null;
        }

        try {
          // Créer ou mettre à jour l'utilisateur via l'adapter
          const user = {
            name: credentials.name || credentials.username,
            email: `${credentials.username}@${credentials.instance}`,
            email_verified: new Date().toISOString(),
            mastodon_id: credentials.id,
            mastodon_username: credentials.username,
            mastodon_image: credentials.image,
            mastodon_instance: credentials.instance,
            has_onboarded: false
          };

          // L'adapter va créer ou mettre à jour l'utilisateur
          const result = await supabaseAdapter.createUser(user);

          if (!result) {
            throw new Error("Failed to create user");
          }

          // Créer le compte associé
          await supabaseAdapter.linkAccount({
            userId: result.id,
            type: "oauth",
            provider: "mastodon",
            providerAccountId: `${credentials.id}@${credentials.instance}`,
          });

          return result;
        } catch (error) {
          console.error("Error in Mastodon authorize:", error);
          return null;
        }
      },
    }),
  ].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider)),

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.has_onboarded = user.has_onboarded
        token.twitter_id = user.twitter_id
        token.twitter_username = user.twitter_username
        token.twitter_image = user.twitter_image
        token.bluesky_id = user.bluesky_id
        token.bluesky_username = user.bluesky_username
        token.bluesky_image = user.bluesky_image
        token.mastodon_id = user.mastodon_id
        token.mastodon_username = user.mastodon_username
        token.mastodon_image = user.mastodon_image
        token.mastodon_instance = user.mastodon_instance
      }
      return token
    },

    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          has_onboarded: token.has_onboarded,
          twitter_id: token.twitter_id,
          twitter_username: token.twitter_username,
          twitter_image: token.twitter_image,
          bluesky_id: token.bluesky_id,
          bluesky_username: token.bluesky_username,
          bluesky_image: token.bluesky_image,
          mastodon_id: token.mastodon_id,
          mastodon_username: token.mastodon_username,
          mastodon_image: token.mastodon_image,
          mastodon_instance: token.mastodon_instance,
        },
      }
    },

    async redirect({ url, baseUrl }) {
      console.log(" Redirect Callback:", { url, baseUrl })

      // Si on est sur un callback d'authentification
      if (url.includes('/auth/callback')) {
        console.log(" Auth callback detected, redirecting to /dashboard")
        return `${baseUrl}/dashboard`
      }

      // Par défaut, on retourne l'URL demandée si elle commence par baseUrl
      console.log(" Default redirect to:", url)
      return url.startsWith(baseUrl) ? url : baseUrl
    }
  },

  pages: {
    signIn: '/auth/signin',
  },
} satisfies NextAuthConfig