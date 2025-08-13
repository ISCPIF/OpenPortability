# Migrate Ignore API

## Overview

The migrate ignore endpoint allows users to ignore or unignore specific Twitter accounts during the migration process. This helps users manage which accounts they want to exclude from their migration workflow, providing granular control over the migration process.

## Endpoint Details

**Route:** `/api/migrate/ignore`  
**File:** `src/app/api/migrate/ignore/route.ts`  
**Methods:** `POST`  
**Authentication:** Required  
**Rate Limiting:** Enabled (standard rate limits)

## Method

### POST - Ignore or Unignore Target Account

**Purpose:** Mark a Twitter account as ignored or restore it to the migration process

**Authentication:** Required (uses `withValidation` middleware)  
**Validation:** Uses `IgnoreTargetSchema` with security checks enabled

#### Request Format

```typescript
{
  targetTwitterId: string,    // Twitter ID of the account to ignore/unignore
  action: "ignore" | "unignore"  // Action to perform (defaults to "ignore")
}
```

#### Validation Rules
- **targetTwitterId**: Required, non-empty string
- **action**: Must be either "ignore" or "unignore" (defaults to "ignore")

#### Response Formats

**Success (200)**
```typescript
{
  success: true
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
  error: "Failed to ignore target" | "Failed to unignore target"
}
```

## Functionality

### Ignore Process
1. **User Authentication:** Validates user session and permissions
2. **Input Validation:** Ensures targetTwitterId and action are valid
3. **Service Call:** Uses `MatchingService.ignoreTarget()` to update database
4. **Status Update:** Marks account as ignored in migration tables
5. **Response:** Returns success confirmation

### Unignore Process
1. **User Authentication:** Validates user session and permissions
2. **Input Validation:** Ensures targetTwitterId and action are valid
3. **Service Call:** Uses `MatchingService.ignoreTarget()` with "unignore" action
4. **Status Restoration:** Removes ignore flag from migration tables
5. **Response:** Returns success confirmation

## Service Integration

### MatchingService
- **Method:** `ignoreTarget(userId, targetTwitterId, action)`
- **Purpose:** Updates database records to mark accounts as ignored/unignored
- **Database Impact:** Modifies migration-related tables to exclude/include accounts

### Database Operations
- **Tables Affected:** Migration and matching tables
- **Action:** Sets ignore flags or removes them based on action
- **User Isolation:** Operations scoped to authenticated user only

## Security Features

- **User Authentication:** Requires valid session
- **Input Validation:** Zod schema validation with security checks
- **User Isolation:** Users can only ignore accounts in their own migration
- **Action Validation:** Only allows "ignore" and "unignore" actions
- **Rate Limiting:** Standard rate limits to prevent abuse

## Usage Examples

### Ignore an Account
```typescript
async function ignoreAccount(targetTwitterId: string) {
  const response = await fetch('/api/migrate/ignore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetTwitterId: targetTwitterId,
      action: 'ignore'
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Account ignored successfully');
  } else {
    console.error('Failed to ignore account:', result.error);
  }
}
```

### Unignore an Account
```typescript
async function unignoreAccount(targetTwitterId: string) {
  const response = await fetch('/api/migrate/ignore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetTwitterId: targetTwitterId,
      action: 'unignore'
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Account restored to migration');
  } else {
    console.error('Failed to unignore account:', result.error);
  }
}
```

### Batch Ignore Management
```typescript
async function manageIgnoreList(accounts: Array<{id: string, shouldIgnore: boolean}>) {
  const promises = accounts.map(account => 
    fetch('/api/migrate/ignore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetTwitterId: account.id,
        action: account.shouldIgnore ? 'ignore' : 'unignore'
      })
    })
  );
  
  const results = await Promise.all(promises);
  const responses = await Promise.all(results.map(r => r.json()));
  
  const successful = responses.filter(r => r.success).length;
  console.log(`${successful}/${accounts.length} operations completed successfully`);
}
```

## Error Handling

### Common Scenarios
- **Invalid Twitter ID:** Returns validation error with clear message
- **Unauthorized Access:** Blocks access for unauthenticated users
- **Service Failures:** Proper error logging and user feedback
- **Invalid Actions:** Only allows "ignore" and "unignore" actions

### Logging Strategy
- **Success Operations:** Logged with user context and target ID
- **Error Operations:** Detailed error logging with context
- **Security Events:** Authentication failures logged
- **Performance Tracking:** Operation timing and success rates

## Integration Points

### Migration Workflow
- **Account Filtering:** Ignored accounts excluded from migration suggestions
- **User Control:** Provides granular control over migration process
- **Reversible Actions:** Users can unignore accounts if needed

### Related Endpoints
- **Matching Found:** `/api/migrate/matching_found` - Respects ignore flags
- **Send Follow:** `/api/migrate/send_follow` - Excludes ignored accounts
- **Migration Status:** Various endpoints that check ignore status

## Performance Considerations

### Database Impact
- **Lightweight Operations:** Simple flag updates in database
- **Indexed Queries:** Operations use indexed columns for performance
- **User Scoped:** All operations limited to authenticated user's data

### Rate Limiting
- **Standard Limits:** Uses default rate limiting configuration
- **Abuse Prevention:** Prevents excessive ignore/unignore operations
- **Fair Usage:** Ensures system stability under load

This endpoint provides essential user control over the migration process, allowing users to curate which accounts they want to include in their social media migration workflow.
