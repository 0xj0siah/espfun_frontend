interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private rateLimits = new Map<string, RateLimitEntry>();
  private pendingRequests = new Map<string, Promise<any>>();

  // Cache TTL in milliseconds
  private readonly DEFAULT_TTL = 30000; // 30 seconds
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per endpoint

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    this.cache.set(key, entry);
  }

  /**
   * Check if request is rate limited
   */
  isRateLimited(endpoint: string): boolean {
    const now = Date.now();
    const rateLimit = this.rateLimits.get(endpoint);

    if (!rateLimit) {
      // First request for this endpoint
      this.rateLimits.set(endpoint, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return false;
    }

    // Reset if window has passed
    if (now > rateLimit.resetTime) {
      this.rateLimits.set(endpoint, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return false;
    }

    // Check if limit exceeded
    if (rateLimit.count >= this.MAX_REQUESTS_PER_WINDOW) {
      return true;
    }

    // Increment counter
    rateLimit.count++;
    return false;
  }

  /**
   * Get time until rate limit resets
   */
  getTimeUntilReset(endpoint: string): number {
    const rateLimit = this.rateLimits.get(endpoint);
    if (!rateLimit) return 0;
    return Math.max(0, rateLimit.resetTime - Date.now());
  }

  /**
   * Deduplicate concurrent requests to the same endpoint
   */
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If there's already a pending request for this key, return that promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request and store the promise
    const promise = requestFn().finally(() => {
      // Remove from pending requests when done
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Execute request with caching, rate limiting, and deduplication
   */
  async executeRequest<T>(
    cacheKey: string,
    endpoint: string,
    requestFn: () => Promise<T>,
    options: {
      ttl?: number;
      skipCache?: boolean;
      skipRateLimit?: boolean;
    } = {}
  ): Promise<T> {
    const { ttl = this.DEFAULT_TTL, skipCache = false, skipRateLimit = false } = options;

    // Check cache first (unless skipped)
    if (!skipCache) {
      const cached = this.get<T>(cacheKey);
      if (cached) {
        console.log('🎯 Cache hit for:', cacheKey);
        return cached;
      }
    }

    // Check rate limit (unless skipped)
    if (!skipRateLimit && this.isRateLimited(endpoint)) {
      const resetTime = this.getTimeUntilReset(endpoint);
      throw new Error(`Rate limit exceeded for ${endpoint}. Try again in ${Math.ceil(resetTime / 1000)} seconds.`);
    }

    // Execute request with deduplication
    const result = await this.deduplicate(cacheKey, requestFn);

    // Cache the result (unless skipped)
    if (!skipCache) {
      this.set(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Clear expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      activeRateLimits: this.rateLimits.size,
    };
  }
}

// Export singleton instance
export const requestCache = new RequestCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  requestCache.cleanup();
}, 5 * 60 * 1000);
