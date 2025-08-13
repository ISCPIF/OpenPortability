# Import Status API

## Overview

The import status endpoint provides real-time status updates for Twitter data import jobs. It tracks the progress of file processing, including followers and following data, with Redis-first caching for optimal performance during active imports.

## Endpoint Details

**Route:** `/api/import-status/[jobId]`  
**File:** `src/app/api/import-status/[jobId]/route.ts`  
**Methods:** `GET`  
**Authentication:** Required  
**Rate Limiting:** Disabled (frequent polling expected)

## Method

### GET - Check Import Job Status

**Purpose:** Retrieve current status and progress of a specific import job

**Authentication:** Required (uses `withValidation` middleware)  
**Validation:** Uses `EmptySchema` (no request body needed)

#### URL Parameters
- **jobId** (string): Unique identifier for the import job

#### Response Formats

**Success (200)**
```typescript
{
  id: string,           // Job ID
  status: string,       // "pending" | "processing" | "completed" | "failed"
  progress: number,     // Number of items processed
  totalItems: number,   // Total items to process
  stats: {
    total: number,
    processed: number,
    followers: {
      total: number,
      processed: number
    },
    following: {
      total: number,
      processed: number
    }
  },
  error?: string        // Error message if job failed
}
```

**Job Not Found (404)**
```typescript
{
  error: "Job not found"
}
```

**Unauthorized (401)**
```typescript
{
  error: "Not authenticated"
}
```

**Server Error (500)**
```typescript
{
  error: "Failed to check import status"
}
```

## Data Flow

### Redis-First Architecture
1. **Redis Cache Hit:** Job status served directly from `job:{jobId}` (optimal performance)
2. **Redis Miss/Error:** Fallback to PostgreSQL `import_jobs` table
3. **User Validation:** Ensures job belongs to authenticated user
4. **Response:** Returns formatted status with progress details

### Caching Strategy
- **Primary Source:** Redis cache for active jobs
- **Fallback:** PostgreSQL database for reliability
- **Performance:** No rate limiting to support frequent polling
- **Security:** User ownership validation on both Redis and DB data

## Job Status Values

- **`pending`** - Job queued but not started
- **`processing`** - Job actively being processed
- **`completed`** - Job finished successfully
- **`failed`** - Job encountered an error

## Progress Tracking

### Statistics Structure
```typescript
{
  total: number,        // Total items across all files
  processed: number,    // Items processed so far
  followers: {
    total: number,      // Total followers to process
    processed: number   // Followers processed
  },
  following: {
    total: number,      // Total following to process
    processed: number   // Following processed
  }
}
```

### Progress Calculation
- **Overall Progress:** `processed / total`
- **Percentage:** `(processed / total) * 100`
- **Remaining:** `total - processed`

## Security Features

- **User Ownership:** Jobs can only be accessed by their owner
- **Session Validation:** Requires valid user authentication
- **Job Isolation:** Users cannot access other users' job data
- **Error Sanitization:** Internal errors not exposed to client

## Usage Examples

### Polling for Status Updates
```typescript
async function pollJobStatus(jobId: string) {
  const response = await fetch(`/api/import-status/${jobId}`);
  const status = await response.json();
  
  if (status.error) {
    console.error('Error:', status.error);
    return null;
  }
  
  console.log(`Progress: ${status.progress}/${status.totalItems}`);
  console.log(`Status: ${status.status}`);
  
  return status;
}

// Poll every 10 seconds
const interval = setInterval(async () => {
  const status = await pollJobStatus('job-123');
  
  if (status?.status === 'completed' || status?.status === 'failed') {
    clearInterval(interval);
    console.log('Job finished:', status.status);
  }
}, 10000);
```

### React Hook for Job Monitoring
```typescript
function useJobStatus(jobId: string) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/import-status/${jobId}`);
        const data = await response.json();
        setStatus(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          setLoading(false);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    const interval = setInterval(poll, 2000);
    poll(); // Initial call
    
    return () => clearInterval(interval);
  }, [jobId]);
  
  return { status, loading };
}
```

## Performance Optimization

### Redis Benefits
- **Sub-millisecond Response:** Active jobs served from memory
- **Reduced Database Load:** Minimizes queries during heavy processing
- **Real-time Updates:** Workers update Redis cache directly
- **Scalability:** Handles high-frequency polling efficiently

### Fallback Reliability
- **Database Consistency:** Authoritative source for job data
- **Error Recovery:** Graceful handling when Redis unavailable
- **Data Persistence:** Jobs survive Redis restarts
- **Audit Trail:** Complete job history in database

## Error Handling

### Common Scenarios
- **Invalid Job ID:** Returns 404 with clear message
- **Unauthorized Access:** Blocks access to other users' jobs
- **Redis Unavailable:** Transparent fallback to database
- **Database Errors:** Proper error logging and user feedback

### Logging Strategy
- **Redis Operations:** Cache hits/misses logged
- **Database Fallbacks:** Fallback operations tracked
- **Access Violations:** Security events logged
- **Performance Metrics:** Response times and data sources

## Related Endpoints

- **Job Creation:** `/api/upload/large-files` - Creates import jobs
- **Job Management:** Various endpoints for job lifecycle
- **Data Access:** Endpoints to access imported data after completion

## Environment Variables

### Required
```env
# Database
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Redis
REDIS_URL=your-redis-url
REDIS_PASSWORD=your-redis-password
```

This endpoint is essential for providing users with real-time feedback during potentially long-running import operations, using a Redis-first architecture for optimal performance during active processing.
