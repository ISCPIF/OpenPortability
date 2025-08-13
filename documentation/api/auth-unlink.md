# Account Unlink API

## Overview

The account unlink endpoint allows users to disconnect social media accounts from their OpenPortability profile. It safely removes the connection while ensuring users maintain at least one linked account for authentication purposes.

## Endpoint Details

**Route:** `/api/auth/unlink`  
**File:** `src/app/api/auth/unlink/route.ts`  
**Methods:** `POST`  
**Authentication:** Required  
**Rate Limiting:** Standard rate limiting applied

## Method

### POST - Unlink Social Media Account

**Purpose:** Remove connection between user profile and specified social media provider

**Authentication:** Required (uses `withValidation` middleware)  
**Validation:** Uses `UnlinkSchema` with provider validation

#### Request Body
```typescript
{
  provider: "twitter" | "bluesky" | "mastodon"
}
```

#### Response Formats

**Success (200)**
```typescript
{
  success: true
}
```

**Account Not Linked (400)**
```typescript
{
  error: "Account not found",
  code: "NOT_LINKED"
}
```

**Last Account Protection (400)**
```typescript
{
  error: "Cannot unlink last account",
  code: "LAST_ACCOUNT"
}
```

**User Not Found (404)**
```typescript
{
  error: "User not found",
  code: "NOT_FOUND"
}
```

**Server Error (500)**
```typescript
{
  error: "Failed to unlink account"
}
```

## Safety Features

### Last Account Protection
- **Prevents Account Lockout:** Users cannot unlink their last remaining social media account
- **Minimum One Account:** Ensures users always have at least one way to authenticate
- **Clear Error Message:** Informs users why unlinking is blocked

### Validation Checks
1. **User Existence:** Verifies user exists in database
2. **Account Linkage:** Confirms the specified provider is actually linked
3. **Remaining Accounts:** Counts linked providers before allowing unlink
4. **Provider Validation:** Only allows valid providers (twitter, bluesky, mastodon)

## Unlink Process

1. **Authentication Check:** Validates user session
2. **User Lookup:** Retrieves user profile from database
3. **Account Verification:** Confirms specified provider is linked
4. **Safety Check:** Ensures at least one other account will remain
5. **Database Cleanup:** Removes account from `accounts` table
6. **Profile Update:** Clears provider fields in `users` table
7. **Success Response:** Confirms successful unlink

## Database Operations

### Tables Modified
- **`accounts` table:** Removes OAuth account record
- **`users` table:** Clears provider-specific fields

### Fields Cleared
For each provider, the following fields are set to `null`:
- `{provider}_id`
- `{provider}_username` 
- `{provider}_image`
- `mastodon_instance` (for Mastodon accounts)

### Special Handling
- **Piaille Instance:** Mastodon accounts from `piaille.fr` are handled with provider name `piaille`

## Error Handling

### Custom Error Class
```typescript
class UnlinkError extends Error {
  code: 'LAST_ACCOUNT' | 'NOT_FOUND' | 'NOT_LINKED' | 'DATABASE_ERROR'
  status: number
}
```

### Error Scenarios
- **Database Errors:** Graceful handling with proper logging
- **Missing Accounts:** Continues operation even if account record doesn't exist
- **Validation Failures:** Clear error messages for invalid requests

## Usage Example

```typescript
// Unlink Twitter account
const response = await fetch('/api/auth/unlink', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    provider: 'twitter'
  })
});

const result = await response.json();

if (result.success) {
  console.log('Account unlinked successfully');
} else {
  console.error('Unlink failed:', result.error);
  if (result.code === 'LAST_ACCOUNT') {
    // Show message about needing at least one account
  }
}
```

## Security Features

- **Session Validation:** Requires valid user authentication
- **Input Validation:** Strict provider validation via Zod schema
- **SQL Injection Protection:** Uses parameterized queries
- **Comprehensive Logging:** All operations logged for audit trail

## Related Operations

After unlinking an account, users may need to:
- Link a different social media account via `/api/auth/[provider]`
- Refresh remaining tokens via `/api/auth/refresh`
- Update their profile information

This endpoint provides safe account management while protecting users from accidentally losing all authentication methods.
