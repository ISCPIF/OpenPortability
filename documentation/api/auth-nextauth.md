# Authentication API - NextAuth.js

## Overview

The authentication system for OpenPortability is built using NextAuth.js v5 and handles OAuth authentication for multiple social media platforms. This endpoint manages all authentication flows including sign-in, sign-out, callbacks, and session management.

## Endpoint Details

**Route:** `/api/auth/[...nextauth]`  
**File:** `src/app/api/auth/[...nextauth]/route.ts`  
**Methods:** `GET`, `POST`  
**Authentication:** Public (handles authentication itself)  
**Rate Limiting:** Standard NextAuth.js rate limiting

## Supported Providers

### 1. Twitter/X OAuth 2.0
- **Provider ID:** `twitter`
- **Scopes:** `tweet.read`, `users.read`, `follows.read`
- **Profile Fields:** `profile_image_url`, `description`
- **Environment Variables:**
  - `TWITTER_CLIENT_ID`
  - `TWITTER_CLIENT_SECRET`

### 2. Mastodon OAuth 2.0
- **Provider ID:** `mastodon`
- **Scopes:** `read`, `write:follows`
- **Dynamic Instance Support:** Yes (auto-creates OAuth apps)
- **Environment Variables:**
  - Dynamically created per instance
- **Special Features:**
  - Automatic OAuth app creation for new instances
  - Instance validation and caching
  - Support for custom Mastodon instances

### 3. Bluesky (Custom Provider)
- **Provider ID:** `bluesky`
- **Type:** Custom credentials provider
- **Authentication Method:** Username/password
- **Environment Variables:** None (uses user credentials)

### 4. Facebook OAuth 2.0
- **Provider ID:** `facebook`
- **Environment Variables:**
  - `FACEBOOK_CLIENT_ID`
  - `FACEBOOK_CLIENT_SECRET`

## Configuration

### Session Configuration
```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
```

### Cookie Configuration
- **Session Token:** `next-auth.session-token`
- **Security:** HttpOnly, SameSite=Lax
- **Secure:** Production only
- **PKCE Code Verifier:** 15 minutes expiry

### Database Adapter
- **Type:** Custom Supabase Adapter
- **File:** `@/lib/supabase-adapter`
- **Database:** PostgreSQL via Supabase

## Authentication Flow

### Sign-In Process
1. **Provider Selection:** User chooses authentication provider
2. **OAuth Redirect:** User redirected to provider's OAuth page
3. **Callback Processing:** Provider redirects back with authorization code
4. **Profile Retrieval:** System fetches user profile from provider
5. **Account Linking:** System links or creates user account
6. **Session Creation:** JWT token created with user data

### Account Linking Logic
- **New User:** Creates new account with provider data
- **Existing User:** Links additional provider to existing account
- **Validation:** Checks for existing connections and prevents duplicates

## Callbacks

### signIn Callback
- **Purpose:** Validates sign-in attempts and handles account linking
- **Special Logic:**
  - Mastodon account verification for existing users
  - Error handling and logging
  - Account provider validation

### jwt Callback
- **Purpose:** Populates JWT token with user data
- **Data Included:**
  - User ID and basic profile
  - All connected social media accounts
  - User preferences and settings
  - Onboarding status

### session Callback
- **Purpose:** Shapes session object sent to client
- **Security:** Filters sensitive data before client transmission

### redirect Callback
- **Purpose:** Controls post-authentication redirects
- **Logic:** Redirects to dashboard or specified callback URL

## User Data Structure

### Session User Object
```typescript
interface SessionUser {
  id: string
  email?: string
  name?: string
  image?: string
  has_onboarded: boolean
  hqx_newsletter: boolean
  oep_accepted: boolean
  research_accepted: boolean
  have_seen_newsletter: boolean
  automatic_reconnect: boolean
  have_seen_bot_newsletter: boolean
  
  // Social Media Accounts
  twitter_id?: string | null
  twitter_username?: string | null
  twitter_image?: string | null
  mastodon_id?: string | null
  mastodon_username?: string | null
  mastodon_image?: string | null
  mastodon_instance?: string | null
  bluesky_id?: string | null
  bluesky_username?: string | null
  bluesky_image?: string | null
  facebook_id?: string | null
  facebook_image?: string | null
}
```

## API Endpoints

### GET `/api/auth/[...nextauth]`
**Purpose:** Handles authentication pages and session requests

**Common Paths:**
- `/api/auth/signin` - Sign-in page
- `/api/auth/signout` - Sign-out page
- `/api/auth/session` - Current session data
- `/api/auth/providers` - Available providers
- `/api/auth/csrf` - CSRF token

### POST `/api/auth/[...nextauth]`
**Purpose:** Handles authentication actions

**Common Actions:**
- Sign-in requests
- Sign-out requests
- Callback processing
- Session updates

## Special Features

### Dynamic Mastodon Instance Support
The system automatically creates OAuth applications for new Mastodon instances:

1. **Instance Detection:** When user provides Mastodon instance URL
2. **App Creation:** System calls `/api/v1/apps` on the instance
3. **Credential Storage:** OAuth credentials stored in `mastodon_instances` table
4. **Caching:** Subsequent users from same instance reuse credentials

### Bluesky Custom Authentication
Bluesky uses a custom credentials provider:
- **Input:** Username and password
- **Validation:** Direct API call to Bluesky
- **Session:** Stores Bluesky handle and profile data

## Error Handling

### Common Error Scenarios
- **Invalid Credentials:** Returns authentication error
- **Provider Unavailable:** Graceful degradation
- **Network Issues:** Retry logic for provider calls
- **Database Errors:** Logged but don't break authentication flow

### Error Pages
- **Sign-in Error:** `/auth/error`
- **Custom Error Messages:** Based on error type

## Security Features

### CSRF Protection
- **Token Generation:** Automatic CSRF token generation
- **Validation:** All state-changing requests validated
- **Cookie Security:** HttpOnly, Secure in production

### Session Security
- **JWT Signing:** All tokens cryptographically signed
- **Expiration:** 30-day session expiry
- **Refresh:** Automatic token refresh on activity

### OAuth Security
- **PKCE:** Enabled for supported providers
- **State Parameter:** Prevents CSRF attacks
- **Secure Redirects:** Validates redirect URLs

## Environment Variables

### Required
```env
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com
```

### Provider-Specific
```env
# Twitter
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# Facebook
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret

# Mastodon - Dynamically created
# Bluesky - Uses user credentials
```

## Database Schema

### Users Table (`"next-auth".users`)
- Stores user profile and preferences
- Links to multiple social media accounts
- Tracks onboarding and consent status

### Accounts Table (`"next-auth".accounts`)
- Stores OAuth tokens and provider data
- Links users to their social media accounts
- Handles token refresh for supported providers

### Sessions Table (`"next-auth".sessions`)
- Tracks active user sessions
- Used for database session strategy (if enabled)

## Logging

### Log Categories
- **Authentication Events:** Sign-in, sign-out, errors
- **Provider Interactions:** OAuth flows, API calls
- **Account Linking:** New connections, updates
- **Errors:** Authentication failures, provider issues

### Log Levels
- **Info:** Successful operations
- **Warning:** Recoverable issues
- **Error:** Authentication failures
- **Debug:** Detailed flow information

## Related Files

- **Configuration:** `src/app/auth.config.ts`
- **Main Auth:** `src/app/auth.ts`
- **Type Definitions:** `next-auth.d.ts`
- **Supabase Adapter:** `src/lib/supabase-adapter.ts`
- **Custom Pages:** `src/app/auth/signin/page.tsx`, `src/app/auth/error/page.tsx`

## Usage Examples

### Client-Side Authentication
```typescript
import { signIn, signOut, useSession } from "next-auth/react"

// Sign in with specific provider
await signIn('twitter')
await signIn('mastodon', { instance: 'mastodon.social' })
await signIn('bluesky', { username: 'user.bsky.social', password: 'password' })

// Sign out
await signOut()

// Get session
const { data: session, status } = useSession()
```

### Server-Side Authentication
```typescript
import { auth } from "@/app/auth"

// Get session in server component
const session = await auth()

// Protect API routes
if (!session) {
  return new Response('Unauthorized', { status: 401 })
}
```

## Troubleshooting

### Common Issues
1. **Provider Configuration:** Verify environment variables
2. **Callback URLs:** Ensure correct redirect URIs in provider settings
3. **Database Connection:** Check Supabase connection and schema
4. **CORS Issues:** Verify domain configuration in provider settings

### Debug Mode
Enable debug logging by setting:
```env
NEXTAUTH_DEBUG=true
```

This endpoint serves as the foundation for all authentication in the OpenPortability application, handling multiple OAuth providers and custom authentication flows while maintaining security and user experience standards.
