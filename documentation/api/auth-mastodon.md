# Mastodon Authentication API

## Overview

The Mastodon authentication endpoint provides a list of available Mastodon instances that users can authenticate with. This endpoint serves as a discovery service for Mastodon instances that have been registered in the system, enabling users to select their preferred instance for OAuth authentication through the main NextAuth.js flow.

## Endpoint Details

**Route:** `/api/auth/mastodon`  
**File:** `src/app/api/auth/mastodon/route.ts`  
**Methods:** `GET`  
**Authentication:** Public (no authentication required)  
**Rate Limiting:** Standard rate limiting applied

## Methods

### GET - Fetch Available Mastodon Instances

**Purpose:** Retrieve a list of all registered Mastodon instances available for authentication

**Authentication:** Public (no prior authentication required)  
**Validation:** Uses `withValidation` middleware with `EmptySchema` (no body validation needed)

#### Request

**Method:** `GET`  
**Body:** None (GET request)  
**Query Parameters:** None  
**Headers:** Standard HTTP headers only

#### Response Formats

**Success (200)**
```typescript
{
  instances: string[]  // Array of Mastodon instance domains
}
```

**Example Success Response:**
```json
{
  "instances": [
    "mastodon.social",
    "mastodon.world",
    "fosstodon.org",
    "mas.to",
    "mstdn.social"
  ]
}
```

**Database Error (500)**
```typescript
{
  error: "Failed to fetch instances"
}
```

**Server Error (500)**
```typescript
{
  error: "Internal server error"
}
```

#### Response Headers

**Cache Control:**
- `Cache-Control: public, max-age=86400` (24 hours)
- Enables client-side caching for performance optimization

## Data Flow

### Instance Retrieval Process

1. **Request Validation:** Validates empty request body using Zod schema
2. **Database Query:** Fetches instances from `mastodon_instances` table
3. **Data Processing:** Extracts instance domains from database results
4. **Redis Caching:** Stores instances list in Redis with permanent cache
5. **Response:** Returns formatted instances array with cache headers

### Caching Strategy

**Redis Cache:**
- **Key:** `mastodon:instances`
- **Type:** Permanent cache (no TTL)
- **Invalidation:** Only via PostgreSQL triggers
- **Purpose:** Performance optimization for frequently accessed data

**HTTP Cache:**
- **Duration:** 24 hours (`max-age=86400`)
- **Type:** Public cache (can be cached by CDNs/proxies)
- **Purpose:** Reduces server load for static data

## Architecture Components

### Database Integration

#### mastodon_instances Table
- **Purpose:** Stores registered Mastodon instances and their OAuth credentials
- **Key Fields:**
  - `instance` - Domain name of the Mastodon instance
  - `client_id` - OAuth client ID for the instance
  - `client_secret` - OAuth client secret for the instance
- **Query:** `SELECT instance FROM mastodon_instances ORDER BY instance`

### Caching Layer

#### Redis Integration
- **Client:** Uses custom Redis client from `@/lib/redis`
- **Operation:** `redis.set('mastodon:instances', JSON.stringify(instancesList))`
- **Strategy:** Write-through caching after database query
- **Persistence:** Permanent cache until manually invalidated

### Validation Middleware

#### withValidation Configuration
```typescript
{
  requireAuth: false,         // Public endpoint
  applySecurityChecks: false, // No body to validate
  skipRateLimit: false       // Apply standard rate limiting
}
```

## Integration Points

### NextAuth.js Integration

This endpoint supports the main NextAuth.js authentication flow by providing instance discovery:

1. **Instance Selection:** Users select from available instances
2. **OAuth App Creation:** System creates OAuth apps for new instances (handled in `auth.ts`)
3. **Authentication Flow:** Users authenticate via NextAuth.js Mastodon provider
4. **Account Linking:** Successful authentication links Mastodon account to user

### Dynamic Instance Registration

The system supports automatic registration of new Mastodon instances:

- **Detection:** When users provide new instance URLs
- **App Creation:** System calls `/api/v1/apps` on the new instance
- **Storage:** OAuth credentials stored in `mastodon_instances` table
- **Availability:** New instances immediately available via this endpoint

## Security Features

### Input Validation
- **Schema Validation:** Uses Zod `EmptySchema` for GET requests
- **No Security Checks:** Disabled since no user input to validate
- **Rate Limiting:** Standard rate limiting prevents abuse

### Data Exposure
- **Public Data Only:** Only exposes instance domain names
- **No Credentials:** OAuth secrets never exposed to clients
- **Safe Response:** No sensitive information in responses

## Performance Optimization

### Redis-First Caching Strategy
1. **Redis Cache Hit:** Instances served directly from `mastodon:instances` (optimal performance)
2. **Cache Miss/Redis Down:** Fallback to PostgreSQL database query
3. **Cache Update:** Database results automatically cached in Redis permanently
4. **Cache Invalidation:** Only via PostgreSQL trigger on `mastodon_instances` table changes

### Error Handling
- **Redis Errors:** Graceful fallback to database without breaking the request
- **Database Errors:** Proper error responses with logging
- **Cache Failures:** Non-blocking - request succeeds even if caching fails

## Logging

### Log Flow
- **Cache Hit:** `"Mastodon instances served from Redis cache"` (Info level)
- **Cache Miss:** `"Redis cache miss or error, falling back to database"` (Warning level)  
- **Database Success:** `"Mastodon instances fetched from DB and cached"` (Info level)
- **Cache Failure:** `"Failed to cache instances in Redis"` (Warning level)

### Log Context
```typescript
{
  context: 'Cache hit - Redis data served',
  count: instancesList.length
}
```

## Environment Variables

### Required
```env
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Redis Configuration
REDIS_URL=your-redis-url
REDIS_PASSWORD=your-redis-password
```

### Optional
```env
# Additional Redis configuration
REDIS_PORT=6379
REDIS_HOST=localhost
```

## Database Schema

### mastodon_instances Table
```sql
CREATE TABLE mastodon_instances (
  id SERIAL PRIMARY KEY,
  instance VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_secret VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes
- **Primary Key:** `id`
- **Unique Constraint:** `instance` (prevents duplicate instances)
- **Ordering:** Results ordered by `instance` field

## Usage Examples

### Client-Side Request
```typescript
// Fetch available Mastodon instances
const response = await fetch('/api/auth/mastodon');
const data = await response.json();

if (response.ok) {
  console.log('Available instances:', data.instances);
  // Display instances in UI for user selection
} else {
  console.error('Error:', data.error);
}
```

### React Component Integration
```typescript
import { useEffect, useState } from 'react';

function MastodonInstanceSelector() {
  const [instances, setInstances] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/mastodon')
      .then(res => res.json())
      .then(data => {
        if (data.instances) {
          setInstances(data.instances);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading instances...</div>;

  return (
    <select>
      {instances.map(instance => (
        <option key={instance} value={instance}>
          {instance}
        </option>
      ))}
    </select>
  );
}
```

### Server-Side Integration
```typescript
// Use in other API routes or server components
async function getMastodonInstances() {
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/mastodon`);
  const data = await response.json();
  return data.instances || [];
}
```

## Related Endpoints

- **Main Auth:** `/api/auth/[...nextauth]` - NextAuth.js main handler with Mastodon provider
- **Mastodon OAuth:** `/api/auth/callback/mastodon` - OAuth callback handler
- **Session:** `/api/auth/session` - Current session data

## Integration with Authentication Flow

### Complete Mastodon Authentication Process

1. **Instance Discovery:** Client calls `/api/auth/mastodon` to get available instances
2. **Instance Selection:** User selects preferred Mastodon instance
3. **OAuth Initiation:** Client calls NextAuth.js with selected instance
4. **App Creation:** System creates OAuth app if instance is new (handled in `auth.ts`)
5. **OAuth Flow:** User redirected to Mastodon instance for authentication
6. **Callback Processing:** OAuth callback processed by NextAuth.js
7. **Account Linking:** Mastodon account linked to user profile

### Dynamic Instance Support

The system supports adding new Mastodon instances dynamically:

- **New Instance Detection:** When user provides unknown instance URL
- **Automatic Registration:** System calls Mastodon API to create OAuth app
- **Database Storage:** New instance and credentials stored in database
- **Immediate Availability:** New instance appears in next API call

## Monitoring and Metrics

### Performance Metrics
- **Response Time:** Typically <50ms with Redis cache
- **Cache Hit Rate:** Should be >95% for production traffic
- **Database Query Frequency:** Only on cache misses or new instances

### Health Indicators
- **Instance Count:** Monitor for sudden changes
- **Error Rate:** Should be <1% under normal conditions
- **Cache Performance:** Redis availability and response times

## Troubleshooting

### Common Issues

1. **Empty Instances List**
   - Check database connectivity
   - Verify `mastodon_instances` table has data
   - Check Redis cache status

2. **Database Connection Errors**
   - Verify Supabase credentials
   - Check network connectivity
   - Review database permissions

3. **Cache Issues**
   - Check Redis connectivity
   - Verify Redis credentials
   - Monitor Redis memory usage

4. **Performance Issues**
   - Monitor database query performance
   - Check Redis response times
   - Review HTTP cache effectiveness

### Debug Information

Enable detailed logging by checking console output for:
- Request context information
- Database query results
- Cache operation status
- Error details and stack traces

This endpoint provides a simple but essential service for Mastodon instance discovery, enabling users to authenticate with their preferred Mastodon instance while maintaining performance through intelligent caching strategies.
