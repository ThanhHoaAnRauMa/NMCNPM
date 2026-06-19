function createRateLimiter({ windowMs, max, key = (req) => req.userId || req.ip }) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = String(key(req) || "unknown");
    const current = buckets.get(bucketKey);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (buckets.size > 10000) {
      for (const [storedKey, stored] of buckets) {
        if (stored.resetAt <= now) buckets.delete(storedKey);
      }
    }

    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ success: false, message: "Too many requests. Try again later.", code: "RATE_LIMITED" });
    }
    return next();
  };
}

module.exports = { createRateLimiter };
