import { getRedis } from './redisClient';
import logger from '../log_utils';

/**
 * Rate Limiting Service for Bluesky API calls
 * 
 * Bluesky rate limits (from ATProto docs):
 * - 5000 points/hour
 * - 35000 points/day
 * - 3 points per create operation (follow, post, like, etc.)
 * 
 * This means:
 * - ~1666 follows/hour max
 * - ~11666 follows/day max
 */

// Redis key prefixes
const RATE_KEY_PREFIX = 'rate:bluesky';

// Rate limit configuration
export interface RateLimitConfig {
  pointsPerHour: number;
  pointsPerDay: number;
  pointsPerFollow: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  pointsPerHour: 5000,
  pointsPerDay: 35000,
  pointsPerFollow: 3,
};

// Result of a rate limit check
export interface RateLimitResult {
  allowed: boolean;
  remainingHour: number;
  remainingDay: number;
  maxFollowsAllowed: number;  // How many follows can be done right now
  retryAfterSeconds?: number; // If not allowed, when to retry
  reason?: string;
}

// Result after consuming points
export interface ConsumeResult {
  success: boolean;
  remainingHour: number;
  remainingDay: number;
  error?: string;
}

/**
 * Get Redis keys for a user's rate limits
 */
function getKeys(userId: string) {
  return {
    hour: `${RATE_KEY_PREFIX}:${userId}:hour`,
    day: `${RATE_KEY_PREFIX}:${userId}:day`,
  };
}

/**
 * Check if a user can perform follows without consuming points
 */
export async function checkRateLimit(
  userId: string,
  followCount: number = 1,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const redis = getRedis();
  const keys = getKeys(userId);
  const pointsNeeded = followCount * config.pointsPerFollow;

  try {
    // Get current usage
    const [hourUsageStr, dayUsageStr] = await Promise.all([
      redis.get(keys.hour),
      redis.get(keys.day),
    ]);

    const hourUsage = parseInt(hourUsageStr || '0', 10);
    const dayUsage = parseInt(dayUsageStr || '0', 10);

    const remainingHour = config.pointsPerHour - hourUsage;
    const remainingDay = config.pointsPerDay - dayUsage;

    // Calculate max follows allowed based on both limits
    const maxByHour = Math.floor(remainingHour / config.pointsPerFollow);
    const maxByDay = Math.floor(remainingDay / config.pointsPerFollow);
    const maxFollowsAllowed = Math.min(maxByHour, maxByDay);

    // Check if we can perform the requested follows
    if (pointsNeeded > remainingHour) {
      // Get TTL to know when hour limit resets
      const ttl = await redis.ttl(keys.hour);
      return {
        allowed: false,
        remainingHour,
        remainingDay,
        maxFollowsAllowed,
        retryAfterSeconds: ttl > 0 ? ttl : 3600,
        reason: `Hourly rate limit exceeded. ${maxFollowsAllowed} follows remaining this hour.`,
      };
    }

    if (pointsNeeded > remainingDay) {
      // Get TTL to know when day limit resets
      const ttl = await redis.ttl(keys.day);
      return {
        allowed: false,
        remainingHour,
        remainingDay,
        maxFollowsAllowed,
        retryAfterSeconds: ttl > 0 ? ttl : 86400,
        reason: `Daily rate limit exceeded. ${maxFollowsAllowed} follows remaining today.`,
      };
    }

    return {
      allowed: true,
      remainingHour,
      remainingDay,
      maxFollowsAllowed,
    };
  } catch (error: any) {
    logger.logError('RateLimit', 'checkRateLimit', error.message, userId);
    // On error, allow the request (fail open) but log it
    return {
      allowed: true,
      remainingHour: config.pointsPerHour,
      remainingDay: config.pointsPerDay,
      maxFollowsAllowed: Math.floor(config.pointsPerHour / config.pointsPerFollow),
    };
  }
}

/**
 * Consume rate limit points after successful follows
 * Call this AFTER the follows succeed, not before
 */
export async function consumeRateLimit(
  userId: string,
  followCount: number,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<ConsumeResult> {
  const redis = getRedis();
  const keys = getKeys(userId);
  const pointsToConsume = followCount * config.pointsPerFollow;

  try {
    // Use Redis MULTI for atomic operations
    const pipeline = redis.multi();
    
    // Increment hour counter
    pipeline.incrby(keys.hour, pointsToConsume);
    // Set TTL to 1 hour if key is new (EXPIRE only sets if key exists, so we use a trick)
    pipeline.expire(keys.hour, 3600); // 1 hour
    
    // Increment day counter
    pipeline.incrby(keys.day, pointsToConsume);
    // Set TTL to 24 hours
    pipeline.expire(keys.day, 86400); // 24 hours

    const results = await pipeline.exec();
    
    // Get updated values
    const [hourUsageStr, dayUsageStr] = await Promise.all([
      redis.get(keys.hour),
      redis.get(keys.day),
    ]);

    const hourUsage = parseInt(hourUsageStr || '0', 10);
    const dayUsage = parseInt(dayUsageStr || '0', 10);

    logger.logInfo(
      'RateLimit',
      'consumeRateLimit',
      `User ${userId} consumed ${pointsToConsume} points (${followCount} follows). Hour: ${hourUsage}/${config.pointsPerHour}, Day: ${dayUsage}/${config.pointsPerDay}`
    );

    return {
      success: true,
      remainingHour: config.pointsPerHour - hourUsage,
      remainingDay: config.pointsPerDay - dayUsage,
    };
  } catch (error: any) {
    logger.logError('RateLimit', 'consumeRateLimit', error.message, userId);
    return {
      success: false,
      remainingHour: 0,
      remainingDay: 0,
      error: error.message,
    };
  }
}

/**
 * Get current rate limit status for a user (for display in UI)
 */
export async function getRateLimitStatus(
  userId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{
  hourUsage: number;
  dayUsage: number;
  remainingHour: number;
  remainingDay: number;
  maxFollowsHour: number;
  maxFollowsDay: number;
  hourResetSeconds: number;
  dayResetSeconds: number;
}> {
  const redis = getRedis();
  const keys = getKeys(userId);

  try {
    const [hourUsageStr, dayUsageStr, hourTtl, dayTtl] = await Promise.all([
      redis.get(keys.hour),
      redis.get(keys.day),
      redis.ttl(keys.hour),
      redis.ttl(keys.day),
    ]);

    const hourUsage = parseInt(hourUsageStr || '0', 10);
    const dayUsage = parseInt(dayUsageStr || '0', 10);

    return {
      hourUsage,
      dayUsage,
      remainingHour: config.pointsPerHour - hourUsage,
      remainingDay: config.pointsPerDay - dayUsage,
      maxFollowsHour: Math.floor((config.pointsPerHour - hourUsage) / config.pointsPerFollow),
      maxFollowsDay: Math.floor((config.pointsPerDay - dayUsage) / config.pointsPerFollow),
      hourResetSeconds: hourTtl > 0 ? hourTtl : 0,
      dayResetSeconds: dayTtl > 0 ? dayTtl : 0,
    };
  } catch (error: any) {
    logger.logError('RateLimit', 'getRateLimitStatus', error.message, userId);
    return {
      hourUsage: 0,
      dayUsage: 0,
      remainingHour: config.pointsPerHour,
      remainingDay: config.pointsPerDay,
      maxFollowsHour: Math.floor(config.pointsPerHour / config.pointsPerFollow),
      maxFollowsDay: Math.floor(config.pointsPerDay / config.pointsPerFollow),
      hourResetSeconds: 0,
      dayResetSeconds: 0,
    };
  }
}

/**
 * Reset rate limits for a user (admin function)
 */
export async function resetRateLimit(userId: string): Promise<void> {
  const redis = getRedis();
  const keys = getKeys(userId);

  await Promise.all([
    redis.del(keys.hour),
    redis.del(keys.day),
  ]);

  logger.logInfo('RateLimit', 'resetRateLimit', `Rate limits reset for user ${userId}`);
}
