# Bluesky Authentication API

## Overview

The Bluesky authentication endpoint handles direct authentication with Bluesky using username/password credentials. This endpoint supports both linking Bluesky accounts to existing users and creating new users from Bluesky accounts. It uses a custom credentials-based authentication flow rather than OAuth.

## Endpoint Details

**Route:** `/api/auth/bluesky`  
**File:** `src/app/api/auth/bluesky/route.ts`  
**Methods:** `POST`, `DELETE`  
**Authentication:** Public for POST, Required for DELETE  
**Rate Limiting:** Custom rate limiting with security checks

## Methods

### POST - Bluesky Authentication

**Purpose:** Authenticate user with Bluesky credentials and link/create account

**Authentication:** Public (no prior authentication required)  
**Validation:** Uses `withPublicValidation` middleware with `AuthCredentialsSchema`

#### Request Body
```typescript
{
  identifier: string,  // Bluesky handle (e.g., "user.bsky.social") or email
  password: string     // Bluesky password
}
```

#### Request Validation
- **Schema:** `AuthCredentialsSchema` from Zod validation
- **Security Checks:** SQL injection and XSS detection enabled
- **Password Exclusion:** Password field excluded from security scanning
- **Rate Limiting:** Custom rate limiting configuration (commented out)

#### Response Formats

**Success (200)**
```typescript
{
  success: true,
  user: {
    id: string,
    bluesky_id: string,      // Bluesky DID
    bluesky_username: string, // Bluesky handle
    bluesky_image?: string   // Avatar URL
  }
}
```

**Authentication Failed (401)**
```typescript
{
  success: false,
  error: string  // Error message from Bluesky API
}
```

**Account Conflict (409)**
```typescript
{
  success: false,
  error: "This Bluesky account is already linked to another user"
}
```

**Server Error (500)**
```typescript
{
  success: false,
  error: "Internal server error"
}
```

#### Authentication Flow

1. **Credential Validation:** Validates request body using Zod schema
2. **Bluesky Authentication:** Calls `BlueskyService.login()` with credentials
3. **Profile Retrieval:** Fetches user profile from Bluesky API
4. **User Resolution:** Determines if user exists or needs to be created
5. **Account Linking:** Links Bluesky account to user or creates new user
6. **Response:** Returns user data with Bluesky information

#### User Resolution Logic

**Existing Bluesky User:**
- User found by Bluesky DID
- Updates profile information
- Links account data
- Returns existing user ID

**Authenticated User (Session Exists):**
- Links Bluesky account to current session user
- Updates user profile with Bluesky data
- Prevents duplicate linking to different users

**New User:**
- Creates new user via `supabaseAdapter.createUser()`
- Links Bluesky account to new user
- Returns new user data

### DELETE - Bluesky Logout

**Purpose:** Logout user and clear session data

**Authentication:** Required (uses `withValidation` middleware)  
**Validation:** Empty schema (no body validation needed)

#### Request Headers
- **Required:** `x-csrf-token` - CSRF protection token

#### Response Formats

**Success (200)**
```typescript
{
  success: true
}
```

**CSRF Missing (403)**
```typescript
{
  error: "CSRF token missing"
}
```

**Server Error (500)**
```typescript
{
  error: "Logout failed"
}
```

#### Logout Process

1. **CSRF Validation:** Checks for required CSRF token in headers
2. **Session Deletion:** Removes session from database via adapter
3. **Cookie Clearing:** Clears all NextAuth session cookies
4. **Response:** Returns success with expired cookie headers

## Architecture Components

### Services Used

#### BlueskyService
- **File:** `src/lib/services/blueskyServices.ts`
- **Purpose:** Handles Bluesky API interactions
- **Key Methods:**
  - `login(identifier, password)` - Authenticates with Bluesky
  - `getProfile(handle)` - Fetches user profile
  - `resumeSession(sessionData)` - Resumes existing session
  - `logout()` - Terminates Bluesky session

#### BlueskyRepository
- **File:** `src/lib/repositories/blueskyRepository.ts`
- **Purpose:** Handles database operations for Bluesky data
- **Key Methods:**
  - `getUserByBlueskyId(did)` - Finds user by Bluesky DID
  - `linkBlueskyAccount(userId, sessionData)` - Links account to user
  - `updateBlueskyProfile(userId, profile)` - Updates user profile
  - `updateFollowStatus(userId, targetId)` - Updates follow status

### External Dependencies

#### @atproto/api (BskyAgent)
- **Purpose:** Official Bluesky AT Protocol client
- **Usage:** Direct API communication with Bluesky
- **Service:** `https://bsky.social`

#### Supabase Adapter
- **Purpose:** Database operations and user management
- **Methods Used:**
  - `createUser()` - Creates new user accounts
  - `deleteSession()` - Removes user sessions
  - `getUserByAccount()` - Finds users by provider account
  - `linkAccount()` - Links social media accounts
  - `updateUser()` - Updates user profile data

## Data Types

### BlueskySessionData
```typescript
interface BlueskySessionData {
  accessJwt: string,    // Access token
  refreshJwt: string,   // Refresh token
  handle: string,       // User handle (e.g., "user.bsky.social")
  did: string          // Decentralized Identifier
}
```

### BlueskyProfile
```typescript
interface BlueskyProfile {
  did: string,           // Decentralized Identifier
  handle: string,        // User handle
  displayName?: string,  // Display name
  avatar?: string       // Avatar URL
}
```

### BlueskyAuthResult
```typescript
interface BlueskyAuthResult {
  success: boolean,
  data?: BlueskySessionData,
  error?: string
}
```

## Security Features

### Input Validation
- **Zod Schema Validation:** Strict type checking for request data
- **SQL Injection Protection:** Automatic detection and prevention
- **XSS Protection:** Cross-site scripting attack prevention
- **Password Security:** Passwords excluded from security scanning

### CSRF Protection
- **DELETE Requests:** Requires CSRF token in headers
- **Token Validation:** Prevents cross-site request forgery
- **Session Security:** Validates request authenticity

### Session Management
- **JWT Tokens:** Encrypted session tokens
- **Cookie Security:** HttpOnly, SameSite protection
- **Secure Transmission:** HTTPS in production
- **Session Expiry:** Automatic session cleanup

### Account Linking Security
- **Duplicate Prevention:** Prevents linking same account to multiple users
- **User Validation:** Verifies user ownership before linking
- **Error Handling:** Secure error messages without data leakage

## Rate Limiting

### Configuration (Commented Out)
```typescript
customRateLimit: {
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 10,          // 10 attempts per window
  identifier: 'ip'          // Rate limit by IP address
}
```

### Current Status
- Rate limiting configuration exists but is disabled
- Can be enabled for production deployment
- Protects against brute force attacks

## Error Handling

### Bluesky API Errors
- **Authentication Failures:** Invalid credentials
- **Network Issues:** API unavailability
- **Rate Limiting:** Bluesky-side rate limits
- **Profile Errors:** Profile fetch failures

### Database Errors
- **Connection Issues:** Supabase connectivity
- **Constraint Violations:** Duplicate account linking
- **Transaction Failures:** Database operation errors

### Application Errors
- **Token Verification:** JWT token validation
- **Session Management:** Session creation/deletion
- **CSRF Validation:** Token verification failures

## Logging

### Log Categories
- **Authentication Events:** Login attempts and results
- **Account Operations:** Linking, creation, updates
- **Error Tracking:** Failures and exceptions
- **Security Events:** CSRF violations, suspicious activity

### Log Levels
- **Info:** Successful operations and flow tracking
- **Warning:** Recoverable issues and conflicts
- **Error:** Authentication failures and system errors
- **Debug:** Detailed flow information (console.log)

## Environment Variables

### Required
```env
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# NextAuth Configuration
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com
```

### Optional
```env
# Encryption for token storage
ENCRYPTION_KEY=your-encryption-key
```

## Database Schema

### Users Table (`"next-auth".users`)
- Stores user profile and Bluesky data
- Fields: `bluesky_id`, `bluesky_username`, `bluesky_image`
- Links to accounts table for OAuth data

### Accounts Table (`"next-auth".accounts`)
- Stores encrypted Bluesky tokens
- Provider: `'bluesky'`
- Account ID: Bluesky DID
- Tokens: Encrypted JWT tokens

### Sessions Table (`"next-auth".sessions`)
- Tracks active user sessions
- Used for session validation and cleanup

## Usage Examples

### Client-Side Authentication
```typescript
// Authenticate with Bluesky
const response = await fetch('/api/auth/bluesky', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    identifier: 'user.bsky.social',
    password: 'userpassword'
  })
});

const result = await response.json();

if (result.success) {
  // Authentication successful
  console.log('User:', result.user);
} else {
  // Handle error
  console.error('Error:', result.error);
}
```

### Logout Request
```typescript
// Get CSRF token first
const csrfResponse = await fetch('/api/auth/csrf');
const { csrfToken } = await csrfResponse.json();

// Logout
const response = await fetch('/api/auth/bluesky', {
  method: 'DELETE',
  headers: {
    'x-csrf-token': csrfToken
  }
});

const result = await response.json();
```

### Server-Side Integration
```typescript
import { BlueskyService } from '@/lib/services/blueskyServices';
import { BlueskyRepository } from '@/lib/repositories/blueskyRepository';

const repository = new BlueskyRepository();
const service = new BlueskyService(repository);

// Use in other parts of the application
const authResult = await service.login(identifier, password);
```

## Related Endpoints

- **Main Auth:** `/api/auth/[...nextauth]` - NextAuth.js main handler
- **Session:** `/api/auth/session` - Current session data
- **CSRF:** `/api/auth/csrf` - CSRF token generation

## Integration Points

### NextAuth.js Integration
- Works alongside NextAuth.js OAuth providers
- Uses same session management system
- Shares user database schema

### Migration System
- Integrates with `/api/migrate/send_follow` for following users
- Uses Bluesky tokens for API operations
- Supports batch operations for user migration

### Profile Management
- Updates user profiles with Bluesky data
- Synchronizes avatar and display name
- Maintains account linking relationships

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify Bluesky credentials are correct
   - Check Bluesky service availability
   - Ensure network connectivity

2. **Account Linking Conflicts**
   - Check if Bluesky account already linked
   - Verify user session state
   - Review database constraints

3. **Session Issues**
   - Validate CSRF tokens for DELETE requests
   - Check cookie configuration
   - Verify session adapter implementation

4. **Database Errors**
   - Check Supabase connection
   - Verify table schema matches expectations
   - Review constraint violations

### Debug Mode
Enable detailed logging by checking console output for `[Bluesky POST]` and `[Bluesky DELETE]` prefixed messages.

This endpoint provides a secure and robust way to authenticate users with Bluesky while integrating seamlessly with the existing NextAuth.js authentication system and OpenPortability's user management infrastructure.
