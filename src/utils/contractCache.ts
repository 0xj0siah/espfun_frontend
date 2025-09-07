import { createPublicClient, http } from 'viem';
import { getContractData, NETWORK_CONFIG } from '../contracts';

interface ContractReadCache {
  [key: string]: {
    data: any;
    timestamp: number;
    expiresAt: number;
  };
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class ContractCacheManager {
  private cache: ContractReadCache = {};
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map();
  
  // Cache TTL settings (in milliseconds)
  private readonly DEFAULT_TTL = 60000; // 1 minute
  private readonly PRICE_TTL = 60000; // 1 minute for prices (reduced frequency)
  private readonly POOL_INFO_TTL = 120000; // 2 minutes for pool info
  private readonly STATIC_DATA_TTL = 600000; // 10 minutes for static data like player IDs
  
  // Rate limiting settings
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_MINUTE = 30; // Reduced from previous settings
  
  private publicClient = createPublicClient({
    chain: {
      id: NETWORK_CONFIG.chainId,
      name: NETWORK_CONFIG.name,
      rpcUrls: {
        default: { http: [NETWORK_CONFIG.rpcUrl] },
        public: { http: [NETWORK_CONFIG.rpcUrl] },
      },
      blockExplorers: {
        default: { name: 'MonadScan', url: NETWORK_CONFIG.blockExplorer },
      },
      nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
      },
      testnet: true,
    },
    transport: http(NETWORK_CONFIG.rpcUrl, {
      batch: true,
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    }),
  });

  /**
   * Generate cache key for contract read
   */
  private generateCacheKey(
    address: string,
    functionName: string,
    args: any[]
  ): string {
    // Custom stringify function that handles BigInt
    const argsStr = JSON.stringify(args, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n'; // Add 'n' suffix to distinguish BigInt
      }
      return value;
    });
    return `${address}:${functionName}:${argsStr}`;
  }

  /**
   * Get TTL based on function name
   */
  private getTTL(functionName: string): number {
    switch (functionName) {
      case 'getPrices':
        return this.PRICE_TTL;
      case 'getPoolInfo':
        return this.POOL_INFO_TTL;
      case 'getAllPlayerIds':
      case 'getCurrencyInfo':
        return this.STATIC_DATA_TTL;
      default:
        return this.DEFAULT_TTL;
    }
  }

  /**
   * Check if request is rate limited
   */
  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const tracker = this.rateLimitTracker.get(key);

    if (!tracker) {
      this.rateLimitTracker.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return false;
    }

    // Reset if window has passed
    if (now > tracker.resetTime) {
      this.rateLimitTracker.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return false;
    }

    // Check if limit exceeded
    if (tracker.count >= this.MAX_REQUESTS_PER_MINUTE) {
      return true;
    }

    // Increment counter
    tracker.count++;
    return false;
  }

  /**
   * Get data from cache if available and not expired
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache[key];
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      delete this.cache[key];
      return null;
    }

    console.log('🎯 Contract cache hit for:', key);
    return entry.data;
  }

  /**
   * Store data in cache
   */
  private setCache(key: string, data: any, ttl: number): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };
  }

  /**
   * Main method to read from contract with caching and deduplication
   */
  async readContract(params: {
    address: `0x${string}`;
    abi: any[];
    functionName: string;
    args?: any[];
  }): Promise<any> {
    const { address, abi, functionName, args = [] } = params;
    const cacheKey = this.generateCacheKey(address, functionName, args);
    const rateLimitKey = `${address}:${functionName}`;

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Check rate limit
    if (this.isRateLimited(rateLimitKey)) {
      const tracker = this.rateLimitTracker.get(rateLimitKey);
      const resetTime = tracker ? Math.ceil((tracker.resetTime - Date.now()) / 1000) : 60;
      throw new Error(`Rate limit exceeded for ${functionName}. Try again in ${resetTime} seconds.`);
    }

    // Check for pending request (deduplication)
    const pendingKey = cacheKey;
    const existingRequest = this.pendingRequests.get(pendingKey);
    
    if (existingRequest) {
      console.log('🔄 Deduplicating contract request for:', cacheKey);
      return existingRequest.promise;
    }

    // Create new request
    const requestPromise = this.executeContractRead(params);
    
    // Store as pending
    this.pendingRequests.set(pendingKey, {
      promise: requestPromise,
      timestamp: Date.now(),
    });

    try {
      const result = await requestPromise;
      
      // Cache the result
      const ttl = this.getTTL(functionName);
      this.setCache(cacheKey, result, ttl);
      
      console.log(`✅ Contract read successful: ${functionName} (cached for ${ttl/1000}s)`);
      return result;
    } finally {
      // Remove from pending requests
      this.pendingRequests.delete(pendingKey);
    }
  }

  /**
   * Execute the actual contract read
   */
  private async executeContractRead(params: {
    address: `0x${string}`;
    abi: any[];
    functionName: string;
    args?: any[];
  }): Promise<any> {
    const { address, abi, functionName, args = [] } = params;
    
    console.log(`🔗 Making RPC call: ${functionName} on ${address}`);
    
    return this.publicClient.readContract({
      address,
      abi,
      functionName,
      args,
    });
  }

  /**
   * Clear all cache (useful when switching networks or on errors)
   */
  clearCache(): void {
    this.cache = {};
    this.pendingRequests.clear();
    this.rateLimitTracker.clear();
    console.log('🧹 Contract cache cleared');
  }

  /**
   * Clean up expired entries and old pending requests
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean expired cache entries
    Object.keys(this.cache).forEach(key => {
      if (this.cache[key].expiresAt < now) {
        delete this.cache[key];
      }
    });

    // Clean old pending requests (older than 5 minutes)
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > 300000) {
        this.pendingRequests.delete(key);
      }
    });

    // Clean expired rate limit trackers
    this.rateLimitTracker.forEach((tracker, key) => {
      if (now > tracker.resetTime) {
        this.rateLimitTracker.delete(key);
      }
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const validEntries = Object.values(this.cache).filter(entry => entry.expiresAt > now);
    
    return {
      totalCacheEntries: Object.keys(this.cache).length,
      validCacheEntries: validEntries.length,
      pendingRequests: this.pendingRequests.size,
      activeRateLimits: this.rateLimitTracker.size,
    };
  }

  /**
   * Invalidate cache for specific function or address
   */
  invalidateCache(address?: string, functionName?: string): void {
    Object.keys(this.cache).forEach(key => {
      const shouldInvalidate = 
        (!address || key.includes(address)) &&
        (!functionName || key.includes(functionName));
      
      if (shouldInvalidate) {
        delete this.cache[key];
      }
    });
    
    console.log(`🗑️ Invalidated cache for ${address || 'all'}:${functionName || 'all'}`);
  }
}

// Export singleton instance
export const contractCache = new ContractCacheManager();

// Clean up expired entries every 2 minutes
setInterval(() => {
  contractCache.cleanup();
}, 2 * 60 * 1000);

// Export helper function for easy usage
export const readContractCached = (params: {
  address: `0x${string}`;
  abi: any[];
  functionName: string;
  args?: any[];
}) => contractCache.readContract(params);

// Export initialization function to set up the cache with proper network config
export const initializeContractCache = () => {
  console.log('🔄 Contract cache initialized and ready');
  return contractCache;
};
