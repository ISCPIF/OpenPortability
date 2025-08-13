# Token Refresh API

## Overview

The token refresh endpoint verifies and refreshes OAuth tokens for connected social media accounts (Bluesky and Mastodon). It ensures that stored tokens are still valid and automatically refreshes them when possible, or indicates when re-authentication is required.

## Endpoint Details

**Route:** `/api/auth/refresh`  
**File:** `src/app/api/auth/refresh/route.ts`  
**Methods:** `POST`  
**Authentication:** Required  
**Rate Limiting:** Standard rate limiting applied

## Method

### POST - Refresh Social Media Tokens

**Purpose:** Verify and refresh OAuth tokens for all connected social media accounts

**Authentication:** Required (uses `withValidation` middleware)  
**Validation:** Uses `EmptySchema` (no request body needed)

#### Request

**Method:** `POST`  
**Body:** Empty object `{}`  
**Headers:** Standard authentication headers

#### Response Formats

**Success (200)**
```typescript
{
  success: true,
  results: {
    bluesky?: {
      success: boolean,
      refreshed: boolean,
      error?: string
    },
    mastodon?: {
      success: boolean,
      refreshed: boolean,
      error?: string
    }
  }
}
```

**Re-authentication Required (401)**
```typescript
{
  success: false,
  error: "Token refresh failed",
  requiresReauth: true,
  providers: string[]  // Array of providers needing re-auth
}
```

**No Accounts Configured (200)**
```typescript
{
  success: false,
  error: "No social accounts configured"
}
```

**Server Error (500)**
```typescript
{
  error: "Failed to refresh tokens"
}
```

## Process Flow

### Token Verification Process

1. **Authentication Check:** Validates user session
2. **Account Detection:** Checks which social accounts are linked
3. **Token Verification:** For each connected account:
   - Retrieves encrypted tokens from database
   - Attempts to verify/refresh tokens with provider APIs
   - Updates database with new tokens if refreshed
4. **Response Generation:** Returns status for each provider

### Provider-Specific Logic

#### Bluesky Token Refresh
- Uses `@atproto/api` BskyAgent
- Attempts to resume session with stored tokens
- Automatically refreshes tokens if needed
- Updates database with new encrypted tokens

#### Mastodon Token Refresh
- Verifies token with Mastodon instance API
- Handles instance-specific token validation
- Updates tokens if refresh is supported

## Architecture Components

### Services Used

#### AccountService
- **File:** `src/lib/services/accountService.ts`
- **Methods:**
  - `verifyAndRefreshBlueskyToken(userId)` - Bluesky token handling
  - `verifyAndRefreshMastodonToken(userId)` - Mastodon token handling

### Repositories Used

#### AccountRepository
- **File:** `src/lib/repositories/accountRepository.ts`
- **Methods:**
  - `getProviderAccount(userId, provider)` - Retrieve account tokens
  - `updateTokens(userId, provider, tokens)` - Update refreshed tokens

### External Dependencies

- **@atproto/api (BskyAgent)** - Bluesky token verification
- **Mastodon APIs** - Instance-specific token validation
- **Encryption/Decryption** - Token security

## Security Features

- **Token Encryption:** All tokens encrypted before database storage
- **Session Validation:** Requires valid user session
- **Provider Isolation:** Each provider handled independently
- **Secure Updates:** Atomic token updates in database

## Error Handling

### Common Scenarios
- **Missing Tokens:** Indicates re-authentication needed
- **Expired Tokens:** Attempts refresh, falls back to re-auth
- **Network Issues:** Graceful error handling
- **Provider Unavailable:** Isolated failure per provider

## Usage Examples

### Client-Side Request
```typescript
const response = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({})
});

const result = await response.json();

if (result.success) {
  console.log('Tokens refreshed:', result.results);
} else if (result.requiresReauth) {
  console.log('Re-authentication needed for:', result.providers);
  // Redirect to authentication flow
} else {
  console.error('Error:', result.error);
}
```

### Integration Example
```typescript
// Check token status before API operations
async function ensureValidTokens() {
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({})
  });
  
  const result = await refreshResponse.json();
  
  if (result.requiresReauth) {
    // Handle re-authentication
    return { needsReauth: true, providers: result.providers };
  }
  
  return { needsReauth: false, results: result.results };
}
```

## Related Endpoints

- **Main Auth:** `/api/auth/[...nextauth]` - Main authentication handler
- **Bluesky Auth:** `/api/auth/bluesky` - Bluesky authentication
- **Session:** `/api/auth/session` - Current session data

## Environment Variables

### Required
```env
# Database
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Encryption
ENCRYPTION_KEY=your-encryption-key

# NextAuth
NEXTAUTH_SECRET=your-secret-key
```

## Troubleshooting

### Common Issues

1. **Re-authentication Required**
   - Normal behavior when tokens expire
   - Redirect users to appropriate OAuth flow

2. **Token Refresh Failures**
   - Check provider API availability
   - Verify encryption/decryption working
   - Review database token storage

3. **No Accounts Configured**
   - User hasn't linked any social accounts
   - Guide user through account linking process

This endpoint provides essential token management functionality, ensuring that social media integrations remain functional by proactively managing OAuth token lifecycle.
