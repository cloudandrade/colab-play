type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

/**
 * Rate limit in-memory (adequado a single-instance / serverless warm).
 * Em multi-região use Redis/Upstash se precisar de limites globais.
 */
export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: options.limit - 1, resetAt };
  }

  if (current.count >= options.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return {
      ok: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSec,
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return {
    ok: true,
    remaining: options.limit - current.count,
    resetAt: current.resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult, limit: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.ok
      ? {}
      : { "Retry-After": String(result.retryAfterSec) }),
  };
}
