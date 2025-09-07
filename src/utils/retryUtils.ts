/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryCondition: (error: any) => {
    // Retry on network errors, timeouts, and 429 (rate limit) errors
    if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
      return true;
    }
    if (error?.response?.status === 429) {
      return true;
    }
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      return true;
    }
    return false;
  },
};

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!config.retryCondition(error)) {
        console.log(`❌ Non-retryable error on attempt ${attempt}:`, error?.message || error);
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === config.maxAttempts) {
        console.log(`❌ Max retry attempts (${config.maxAttempts}) reached`);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );

      console.log(`🔄 Retrying in ${delay}ms (attempt ${attempt}/${config.maxAttempts})...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a retryable version of an async function
 */
export function makeRetryable<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: RetryOptions = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return retryWithBackoff(() => fn(...args), options);
  };
}

/**
 * Debounce utility for API calls
 */
export function debounce<T extends any[]>(
  fn: (...args: T) => Promise<any>,
  delay: number
): (...args: T) => Promise<any> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastPromise: Promise<any> | null = null;

  return (...args: T): Promise<any> => {
    return new Promise((resolve, reject) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set new timeout
      timeoutId = setTimeout(async () => {
        try {
          // If there's already a pending promise, wait for it
          if (lastPromise) {
            await lastPromise;
          }
          
          // Execute the function
          lastPromise = fn(...args);
          const result = await lastPromise;
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          lastPromise = null;
        }
      }, delay);
    });
  };
}
