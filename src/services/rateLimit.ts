import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { headers } from 'next/headers';

// Initialize Redis only if keys are present (to avoid crashing in dev if they are skipped)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redisClient = redisUrl && redisToken ? new Redis({
  url: redisUrl,
  token: redisToken,
}) : null;

// Pre-configured limiters
const limiters = {
  // 5 requests per minute
  strict: redisClient ? new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
  }) : null,

  // 20 requests per minute
  moderate: redisClient ? new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    analytics: true,
  }) : null,
};

export type RateLimitTier = 'strict' | 'moderate';

/**
 * Checks the rate limit for the current request based on IP address.
 * Throws an error if the limit is exceeded.
 */
export async function enforceRateLimit(tier: RateLimitTier = 'strict', customIdentifier?: string): Promise<void> {
  if (!redisClient || !limiters[tier]) {
    // If Redis is not configured, bypass rate limiting quietly (e.g. for local dev without keys)
    return;
  }

  // Get IP address from headers, fallback to a global generic identifier
  const fallbackIp = '127.0.0.1';
  let ip = fallbackIp;
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp.trim();
    }
  } catch (err) {
    // headers() might throw outside of a server context, gracefully fallback
  }

  const identifier = customIdentifier || ip || fallbackIp;

  const { success, limit, remaining, reset } = await limiters[tier]!.limit(identifier);

  if (!success) {
    throw new Error(`HTTP 429: Too Many Requests. Please try again after a minute.`);
  }
}
