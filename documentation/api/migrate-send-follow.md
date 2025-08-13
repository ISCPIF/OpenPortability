# Migrate Send Follow API

## Overview

The migrate send follow endpoint performs batch follow operations across Bluesky and Mastodon platforms. It processes arrays of matched accounts and executes follow requests on both platforms simultaneously, updating database records to track follow status and handle errors gracefully.

## Endpoint Details

**Route:** `/api/migrate/send_follow`  
**File:** `src/app/api/migrate/send_follow/route.ts`  
**Methods:** `POST`  
**Authentication:** Required  
**Rate Limiting:** Custom (100 requests per minute for batch processing)

## Method

### POST - Batch Follow Accounts

**Purpose:** Send follow requests to multiple accounts across Bluesky and Mastodon platforms

**Authentication:** Required (uses `withValidation` middleware)  
**Validation:** Uses `SendFollowRequestSchema` with security checks enabled

#### Request Format

```typescript
{
  accounts: Array<MatchingTarget | MatchedFollower>  // 1-1000 accounts
}
```

#### Account Structure (MatchingTarget)
```typescript
{
  node_id: string,                    // Required for MatchingTarget
  bluesky_handle?: string,            // Bluesky username
  mastodon_username?: string,         // Mastodon username
  mastodon_instance?: string,         // Mastodon instance domain
  mastodon_id?: string,               // Mastodon account ID
  has_follow_bluesky?: boolean,       // Current Bluesky follow status
  has_follow_mastodon?: boolean       // Current Mastodon follow status
}
```

#### Account Structure (MatchedFollower)
```typescript
{
  source_twitter_id: string,              // Required for MatchedFollower
  bluesky_handle?: string,                // Bluesky username
  mastodon_username?: string,             // Mastodon username
  mastodon_instance?: string,             // Mastodon instance domain
  mastodon_id?: string,                   // Mastodon account ID
  has_been_followed_on_bluesky?: boolean, // Current Bluesky follow status
  has_been_followed_on_mastodon?: boolean // Current Mastodon follow status
}
```

#### Validation Rules
- **accounts**: Array of 1-1000 account objects
- **Account Type**: Must be either MatchingTarget or MatchedFollower
- **Platform Data**: At least one platform (Bluesky/Mastodon) data required
- **Follow Status**: Appropriate status fields based on account type

#### Response Formats

**Success (200)**
```typescript
{
  bluesky: {
    succeeded: number,
    failures: Array<{
      handle: string,
      error: string
    }>
  } | null,
  mastodon: {
    succeeded: number,
    failures: Array<{
      username: string,
      instance: string,
      error: string
    }>
  } | null
}
```

**Validation Error (400)**
```typescript
{
  error: "Validation error message"
}
```

**Unauthorized (401)**
```typescript
{
  error: "Unauthorized"
}
```

**Server Error (500)**
```typescript
{
  error: "Internal server error"
}
```

## Processing Flow

### Account Type Detection
1. **Type Guard:** Uses `isMatchedFollower()` to distinguish account types
2. **MatchedFollower:** Has `source_twitter_id` field
3. **MatchingTarget:** Has `node_id` field
4. **Processing Logic:** Different database updates based on type

### Bluesky Processing
1. **Account Filtering:** Filters accounts with Bluesky handles not yet followed
2. **Session Resume:** Resumes Bluesky session with decrypted tokens
3. **Batch Follow:** Calls `BlueskyService.batchFollow()` with handles array
4. **Status Update:** Updates database based on success/failure results
5. **Error Handling:** Logs failures and continues processing

### Mastodon Processing
1. **Account Filtering:** Filters accounts with Mastodon data not yet followed
2. **Target Preparation:** Formats accounts for Mastodon API calls
3. **Batch Follow:** Calls `MastodonService.batchFollow()` with targets
4. **Status Update:** Updates database based on success/failure results
5. **Error Handling:** Logs failures and continues processing

## Database Updates

### MatchedFollower Updates (`sources_followers` table)
```typescript
await matchingService.updateSourcesFollowersStatusBatch(
  session.user.twitter_id,
  matchedFollowers.map(acc => acc.source_twitter_id),
  platform, // 'bluesky' | 'mastodon'
  hasSuccess,
  errorMessage
);
```

### MatchingTarget Updates (`sources_targets` table)
```typescript
await matchingService.updateFollowStatusBatch(
  userId,
  matchingTargets.map(acc => acc.node_id),
  platform, // 'bluesky' | 'mastodon'
  hasSuccess,
  errorMessage
);
```

## Service Integration

### BlueskyService
- **Session Management:** Resumes session with encrypted tokens
- **Batch Operations:** Handles multiple follow requests efficiently
- **Error Reporting:** Provides detailed failure information

### MastodonService
- **OAuth Integration:** Uses stored access tokens for API calls
- **Instance Handling:** Manages different Mastodon instances
- **Batch Processing:** Optimized for multiple follow operations

### AccountService
- **Token Management:** Retrieves and decrypts stored OAuth tokens
- **Platform Detection:** Identifies available platforms for user
- **Session Validation:** Ensures valid authentication for operations

### MatchingService
- **Status Tracking:** Updates follow status in database
- **Batch Updates:** Efficient bulk database operations
- **Error Logging:** Comprehensive error tracking and reporting

## Security Features

- **User Authentication:** Requires valid session
- **Token Encryption:** OAuth tokens encrypted in database
- **User Isolation:** Users can only follow from their own accounts
- **Input Validation:** Comprehensive validation of account data
- **Rate Limiting:** Custom rate limits for batch operations (100/minute)
- **Error Sanitization:** Internal errors not exposed to client

## Usage Examples

### Basic Batch Follow
```typescript
async function batchFollowAccounts(accounts) {
  const response = await fetch('/api/migrate/send_follow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accounts })
  });
  
  const result = await response.json();
  
  console.log('Bluesky Results:', result.bluesky);
  console.log('Mastodon Results:', result.mastodon);
  
  return result;
}
```

### Process Follow Results
```typescript
function processFollowResults(results) {
  if (results.bluesky) {
    console.log(`Bluesky: ${results.bluesky.succeeded} successful follows`);
    if (results.bluesky.failures.length > 0) {
      console.log('Bluesky failures:', results.bluesky.failures);
    }
  }
  
  if (results.mastodon) {
    console.log(`Mastodon: ${results.mastodon.succeeded} successful follows`);
    if (results.mastodon.failures.length > 0) {
      console.log('Mastodon failures:', results.mastodon.failures);
    }
  }
}
```

### Chunked Processing for Large Lists
```typescript
async function processLargeFollowList(accounts, chunkSize = 100) {
  const chunks = [];
  for (let i = 0; i < accounts.length; i += chunkSize) {
    chunks.push(accounts.slice(i, i + chunkSize));
  }
  
  const results = [];
  for (const chunk of chunks) {
    const result = await batchFollowAccounts(chunk);
    results.push(result);
    
    // Wait between chunks to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
```

## Performance Optimization

### Batch Processing
- **Concurrent Operations:** Bluesky and Mastodon processed simultaneously
- **Efficient Filtering:** Pre-filters accounts to avoid unnecessary API calls
- **Database Batching:** Bulk database updates for better performance

### Rate Limiting
- **Custom Limits:** 100 requests per minute for batch operations
- **Platform Specific:** Different limits may apply to external APIs
- **User Protection:** Prevents overwhelming external services

### Error Resilience
- **Partial Success:** Continues processing even if some operations fail
- **Detailed Reporting:** Provides specific error information for failures
- **Database Consistency:** Updates database even with partial failures

## Error Handling

### Common Scenarios
- **Invalid Tokens:** Handles expired or invalid OAuth tokens
- **Platform Unavailability:** Graceful handling of service outages
- **Rate Limit Exceeded:** Proper error reporting for API limits
- **Invalid Accounts:** Handles accounts that no longer exist

### Logging Strategy
- **Operation Tracking:** Logs batch operations with success/failure counts
- **Error Details:** Comprehensive error logging with context
- **Performance Metrics:** Tracks processing times and throughput
- **User Context:** All logs include user identification

## Integration Points

### Migration Workflow
- **Final Step:** Executes the actual follow operations
- **Status Tracking:** Updates migration progress in database
- **User Feedback:** Provides detailed results for UI display

### Related Endpoints
- **Matching Found:** `/api/migrate/matching_found` - Provides accounts to follow
- **Ignore Management:** `/api/migrate/ignore` - Affects which accounts are processed
- **Import Status:** Various endpoints track overall migration progress

## Platform-Specific Considerations

### Bluesky Integration
- **AT Protocol:** Uses Bluesky's AT Protocol for follow operations
- **Session Management:** Maintains session state for batch operations
- **Handle Validation:** Ensures valid Bluesky handles before processing

### Mastodon Integration
- **Instance Diversity:** Handles multiple Mastodon instances
- **OAuth Complexity:** Manages OAuth tokens for different instances
- **Federation Awareness:** Respects Mastodon's federated nature

This endpoint serves as the execution engine for the migration process, taking the discovery data from other endpoints and performing the actual follow operations across multiple social media platforms efficiently and reliably.
