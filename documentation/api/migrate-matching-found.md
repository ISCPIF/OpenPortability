# Migrate Matching Found API

## Overview

The migrate matching found endpoint retrieves matched social media accounts that users can follow during migration. It provides different functionality based on user onboarding status: for new users, it finds sources from their Twitter followers; for onboarded users, it returns followable targets with cross-platform matches.

## Endpoint Details

**Route:** `/api/migrate/matching_found`  
**File:** `src/app/api/migrate/matching_found/route.ts`  
**Methods:** `GET`  
**Authentication:** Required  
**Rate Limiting:** Enabled (standard rate limits)

## Method

### GET - Retrieve Matching Accounts

**Purpose:** Get matched accounts available for following based on user's migration status

**Authentication:** Required (uses `withValidation` middleware)  
**Validation:** Uses `EmptySchema` (no request body needed)

#### Response Formats

**Success (200)**
```typescript
{
  matches: {
    following: Array<MatchingTarget | MatchedFollower>,
    stats: {
      total_following: number,
      matched_following: number,
      bluesky_matches: number,
      mastodon_matches: number
    }
  }
}
```

**Unauthorized (401)**
```typescript
{
  error: "Unauthorized"
}
```

**Missing Twitter ID (400)**
```typescript
{
  error: "Twitter ID not found in session"
}
```

**Server Error (500)**
```typescript
{
  error: "Internal server error"
}
```

## Data Flow

### User Onboarding Status Logic

#### Non-Onboarded Users (`!session.user.has_onboarded`)
1. **Twitter ID Validation:** Ensures user has Twitter ID in session
2. **ID Conversion:** Converts Twitter ID to string to prevent JavaScript precision loss
3. **Source Lookup:** Calls `MatchingService.getSourcesFromFollower(twitterIdString)`
4. **Response Formatting:** Wraps result in standard format with stats

#### Onboarded Users (`session.user.has_onboarded`)
1. **Target Retrieval:** Calls `MatchingService.getFollowableTargets(userId)`
2. **Comprehensive Results:** Returns full matching data with statistics
3. **Response Formatting:** Returns structured data with following array and stats

### Response Adaptation
- **Direct Array Results:** Wrapped in `matches.following` structure
- **Object Results:** Passed through with existing structure
- **Statistics Generation:** Creates stats object if not present
- **Consistent Format:** Ensures uniform response structure

## Account Types

### MatchingTarget (Onboarded Users)
```typescript
{
  node_id: string,
  bluesky_handle?: string,
  mastodon_username?: string,
  mastodon_instance?: string,
  mastodon_id?: string,
  has_follow_bluesky?: boolean,
  has_follow_mastodon?: boolean,
  // Additional target fields...
}
```

### MatchedFollower (Non-Onboarded Users)
```typescript
{
  source_twitter_id: string,
  bluesky_handle?: string,
  mastodon_username?: string,
  mastodon_instance?: string,
  mastodon_id?: string,
  has_been_followed_on_bluesky?: boolean,
  has_been_followed_on_mastodon?: boolean,
  // Additional follower fields...
}
```

## Service Integration

### MatchingService Methods

#### `getSourcesFromFollower(twitterId: string)`
- **Purpose:** Find sources that match user's Twitter followers
- **Usage:** Non-onboarded users discovering potential follows
- **Returns:** Array of MatchedFollower objects

#### `getFollowableTargets(userId: string)`
- **Purpose:** Get comprehensive matching data for onboarded users
- **Usage:** Full migration workflow with pagination support
- **Returns:** MatchingResult with following array and statistics

### Database Operations
- **Pagination:** Handles large datasets with efficient pagination
- **User Scoping:** All queries scoped to authenticated user
- **Cross-Platform Matching:** Finds accounts across Bluesky and Mastodon
- **Status Tracking:** Respects follow status and ignore flags

## Statistics Structure

### Comprehensive Stats
```typescript
{
  total_following: number,      // Total accounts user follows on Twitter
  matched_following: number,    // Accounts found on other platforms
  bluesky_matches: number,      // Accounts available on Bluesky
  mastodon_matches: number      // Accounts available on Mastodon
}
```

### Performance Metrics
- **Match Rate:** `matched_following / total_following`
- **Platform Distribution:** Bluesky vs Mastodon availability
- **Migration Potential:** Accounts ready for following

## Security Features

- **User Authentication:** Requires valid session
- **Data Isolation:** Users only see their own matching data
- **Twitter ID Protection:** Secure handling of Twitter ID conversion
- **Session Validation:** Comprehensive session checks
- **Error Sanitization:** Internal errors not exposed to client

## Usage Examples

### Fetch Matching Accounts
```typescript
async function getMatchingAccounts() {
  const response = await fetch('/api/migrate/matching_found');
  const data = await response.json();
  
  if (data.error) {
    console.error('Error:', data.error);
    return null;
  }
  
  console.log(`Found ${data.matches.following.length} matching accounts`);
  console.log(`Stats:`, data.matches.stats);
  
  return data.matches;
}
```

### Display Matching Statistics
```typescript
function displayMatchingStats(matches) {
  const { stats } = matches;
  
  console.log(`Migration Overview:`);
  console.log(`- Total Twitter Following: ${stats.total_following}`);
  console.log(`- Found on Other Platforms: ${stats.matched_following}`);
  console.log(`- Available on Bluesky: ${stats.bluesky_matches}`);
  console.log(`- Available on Mastodon: ${stats.mastodon_matches}`);
  
  const matchRate = ((stats.matched_following / stats.total_following) * 100).toFixed(1);
  console.log(`- Match Rate: ${matchRate}%`);
}
```

### Filter by Platform
```typescript
function filterByPlatform(matches, platform: 'bluesky' | 'mastodon') {
  return matches.following.filter(account => {
    if (platform === 'bluesky') {
      return account.bluesky_handle && !account.has_follow_bluesky && !account.has_been_followed_on_bluesky;
    } else {
      return account.mastodon_username && !account.has_follow_mastodon && !account.has_been_followed_on_mastodon;
    }
  });
}
```

## Performance Optimization

### Pagination Strategy
- **Large Dataset Handling:** Efficient pagination for users with many follows
- **Memory Management:** Processes data in chunks to prevent memory issues
- **Database Optimization:** Uses indexed queries for fast retrieval

### Caching Considerations
- **Session-Based:** Results tied to user session and migration status
- **Dynamic Data:** Real-time matching based on current follow status
- **No Long-Term Caching:** Ensures fresh data for migration decisions

## Error Handling

### Common Scenarios
- **Missing Twitter ID:** Clear error message for session issues
- **Unauthorized Access:** Blocks access for unauthenticated users
- **Service Failures:** Proper error logging and user feedback
- **Empty Results:** Graceful handling of users with no matches

### Logging Strategy
- **Match Statistics:** Logs successful retrievals with match counts
- **Error Context:** Detailed error logging with user context
- **Performance Metrics:** Tracks response times and data volumes
- **Security Events:** Logs authentication and authorization events

## Integration Points

### Migration Workflow
- **Discovery Phase:** First step in finding accounts to follow
- **Platform Selection:** Helps users choose between Bluesky and Mastodon
- **Follow Planning:** Provides data for batch follow operations

### Related Endpoints
- **Send Follow:** `/api/migrate/send_follow` - Uses this data for following
- **Ignore Management:** `/api/migrate/ignore` - Affects which accounts appear
- **Migration Status:** Various endpoints that track migration progress

## User Experience Considerations

### Onboarding Flow
- **New Users:** Simple discovery of potential follows from Twitter network
- **Experienced Users:** Comprehensive matching with detailed statistics
- **Progressive Enhancement:** Different features based on user experience level

### Data Presentation
- **Clear Statistics:** Easy-to-understand metrics about migration potential
- **Platform Breakdown:** Shows availability across different platforms
- **Actionable Data:** Provides information needed for follow decisions

This endpoint serves as the discovery engine for the migration process, helping users understand their migration potential and providing the data needed to make informed decisions about which accounts to follow on new platforms.
