import axios from 'axios';
import { parseUnits } from 'viem';
import { requestCache } from '../utils/requestCache';
import { retryWithBackoff, debounce } from '../utils/retryUtils';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface BuyTokensRequest {
  playerTokenIds: string[];
  amounts: string[];
  maxCurrencySpend: string;
  deadline: number;
}

export interface SellTokensRequest {
  playerTokenIds: string[];
  amounts: string[];
  minCurrencyToReceive: number;
  deadline: number;
}

export interface SignatureResponse {
  signature: string;
  txData: {
    nonce: number;
    playerTokenIds: string[];
    amounts: string[];
    maxCurrencySpend?: string;
    minCurrencyToReceive?: number;
    deadline: number;
  };
  transactionId: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
    tournamentPoints: number;
    skillPoints: number;
  };
}

export interface PackInfo {
  id: string;
  name: string;
  type: string;
  price: number;
  description: string;
  isActive: boolean;
}

export interface PackPurchaseRequest {
  packType: string;
  paymentMethod?: 'tournament_points' | 'usdc';
}

export interface UserPoints {
  tournamentPoints: number;
  skillPoints: number;
}

export interface PackPurchaseResponse {
  message: string;
  pack: {
    type: string;
    cost: number;
    pointType: string;
  };
  transaction: {
    txHash: string;
    playerIds: number[];
    shares: string[];
  };
  remainingPoints: number;
}

class ApiService {
  private token: string | null = null;
  private authErrorHandler?: (error: any) => void;
  private autoReAuthHandler?: () => Promise<boolean>;
  private isReAuthenticating = false;

  constructor() {
    this.token = localStorage.getItem('authToken');
    this.setupAxiosInterceptors();
  }

  // Set up axios interceptors for automatic token handling
  private setupAxiosInterceptors() {
    // Response interceptor to handle 401 errors
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.warn('🔐 401 Unauthorized detected - attempting automatic reauthentication');
          
          // Prevent multiple simultaneous reauthentication attempts
          if (this.isReAuthenticating) {
            console.log('🔄 Reauthentication already in progress, waiting...');
            // Wait for existing reauthentication to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Retry the original request
            return axios(error.config!);
          }

          this.isReAuthenticating = true;
          
          try {
            // Clear the invalid token first
            this.clearAuthToken();
            
            // Attempt automatic reauthentication
            if (this.autoReAuthHandler) {
              const reAuthSuccess = await this.autoReAuthHandler();
              if (reAuthSuccess) {
                console.log('🔄 Reauthentication successful, retrying request');
                // Retry the original request with new token
                return axios(error.config!);
              } else {
                console.warn('🔄 Reauthentication failed, notifying error handler');
                // Reauthentication failed, notify error handler
                if (this.authErrorHandler) {
                  this.authErrorHandler(error);
                }
              }
            } else {
              console.warn('🔄 No auto reauth handler available, notifying error handler');
              // No auto reauth handler, fall back to manual error handling
              if (this.authErrorHandler) {
                this.authErrorHandler(error);
              }
            }
          } catch (reAuthError) {
            console.error('🔄 Reauthentication error:', reAuthError);
            if (this.authErrorHandler) {
              this.authErrorHandler(error);
            }
          } finally {
            this.isReAuthenticating = false;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Set authentication error handler (called by useAuthentication hook)
  setAuthErrorHandler(handler: (error: any) => void) {
    this.authErrorHandler = handler;
  }

  // Set automatic reauthentication handler
  setAutoReAuthHandler(handler: () => Promise<boolean>) {
    this.autoReAuthHandler = handler;
  }

  setAuthToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
    // Clear user-specific cache when auth token changes
    requestCache.clear();
  }

  clearAuthToken() {
    this.token = null;
    localStorage.removeItem('authToken');
    // Clear all cache when user logs out
    requestCache.clear();
  }

  // Check if current token is valid by making a test request
  async validateToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      // Make a lightweight request to validate the token
      await axios.get(`${API_BASE_URL}/api/points/balance`, {
        headers: this.getHeaders()
      });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.warn('Token validation failed - token is invalid');
        this.clearAuthToken();
        return false;
      }
      // For other errors (network, server issues), assume token might still be valid
      console.warn('Token validation failed due to network/server error:', error);
      return true; // Don't invalidate token for network issues
    }
  }

  // Get current authentication status
  isAuthenticated(): boolean {
    return !!this.token;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Authentication - Fixed to match API docs
  async getNonce(address: string): Promise<{ nonce: string; message: string }> {
    try {
      console.log('🔐 Requesting nonce from backend:', {
        url: `${API_BASE_URL}/api/auth/nonce`,
        walletAddress: address
      });

      // According to API docs, this should be POST /api/auth/nonce
      const response = await axios.post(`${API_BASE_URL}/api/auth/nonce`, {
        walletAddress: address
      });

      console.log('🔐 Nonce response received:', {
        status: response.status,
        nonce: response.data?.nonce,
        message: response.data?.message
      });

      return response.data;
    } catch (error) {
      console.error('🔐 Nonce request failed:', {
        url: `${API_BASE_URL}/api/auth/nonce`,
        error: error,
        response: axios.isAxiosError(error) ? {
          status: error.response?.status,
          data: error.response?.data
        } : 'Unknown error'
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Bad request';
          throw new Error(`Failed to get nonce: ${errorMessage}`);
        }
        if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
          throw new Error('Backend server is not available. Please check your connection and try again.');
        }
      }
      throw new Error('Failed to get authentication nonce from backend');
    }
  }

  async login(address: string, signature: string, message: string): Promise<AuthResponse> {
    try {
      console.log('🔐 Sending login request to backend:', {
        url: `${API_BASE_URL}/api/auth/login`,
        data: {
          walletAddress: address,
          signature: signature.substring(0, 20) + '...',
          message: message
        }
      });

      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        walletAddress: address,
        signature,
        message
      });

      console.log('🔐 Login response received:', {
        status: response.status,
        hasToken: !!response.data?.token,
        userId: response.data?.user?.id
      });

      return response.data;
    } catch (error) {
      console.error('🔐 Login request failed:', {
        url: `${API_BASE_URL}/api/auth/login`,
        error: error,
        response: axios.isAxiosError(error) ? {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        } : 'Unknown error'
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid signature. Please try signing again.');
        }
        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Bad request';
          throw new Error(`Authentication failed: ${errorMessage}`);
        }
        if (error.response?.status === 500) {
          const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Internal server error';
          throw new Error(`Backend error: ${errorMessage}`);
        }
      }
      throw new Error('Authentication failed');
    }
  }

  // BuyTokens EIP712 Signature
  async prepareSignature(request: BuyTokensRequest): Promise<SignatureResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/buyTokens/prepare-signature`,
        request,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to prepare signature:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication required. Please authenticate your wallet first.');
        }
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
        throw new Error(`Backend signature preparation failed: ${errorMessage}`);
      }
      throw new Error('Failed to prepare signature from backend');
    }
  }

  // SellTokens EIP712 Signature
  async prepareSellSignature(request: SellTokensRequest): Promise<SignatureResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/sell-tokens/prepare-signature`,
        request,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to prepare sell signature:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication required. Please authenticate your wallet first.');
        }
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
        throw new Error(`Backend sell signature preparation failed: ${errorMessage}`);
      }
      throw new Error('Failed to prepare sell signature from backend');
    }
  }

  async getBuyTokensNonce(address: string): Promise<{ nonce: number; address: string }> {
    const cacheKey = `buyTokens-nonce:${address}`;
    const endpoint = 'buyTokens/nonce';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/buyTokens/nonce/${address}`);
          });
          return response.data;
        },
        { ttl: 30000 } // Cache nonce for 30 seconds
      );
    } catch (error) {
      console.error('Failed to get buyTokens nonce:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
      }
      throw new Error('Failed to get nonce from backend');
    }
  }

  async getSellTokensNonce(address: string): Promise<{ nonce: number; address: string }> {
    const cacheKey = `sellTokens-nonce:${address}`;
    const endpoint = 'sell-tokens/nonce';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/sell-tokens/nonce/${address}`);
          });
          return response.data;
        },
        { ttl: 30000 } // Cache nonce for 30 seconds
      );
    } catch (error) {
      console.error('Failed to get sellTokens nonce:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
      }
      throw new Error('Failed to get sell nonce from backend');
    }
  }

  async getTransactions(address: string, status?: string): Promise<any> {
    try {
      const params = status ? `?status=${status}` : '';
      const response = await axios.get(
        `${API_BASE_URL}/api/buyTokens/transactions/${address}${params}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get transactions:', error);
      throw new Error('Failed to get transactions from backend');
    }
  }

  async confirmTransaction(transactionId: string, txHash: string): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/buyTokens/transaction/${transactionId}/confirm`,
        { txHash },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to confirm transaction:', error);
      throw new Error('Failed to confirm transaction with backend');
    }
  }

  async confirmSellTransaction(transactionId: string, txHash: string): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/sell-tokens/transaction/${transactionId}/confirm`,
        { txHash },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to confirm sell transaction:', error);
      throw new Error('Failed to confirm sell transaction with backend');
    }
  }

  // Pack-related API functions
  async getAvailablePacks(): Promise<PackInfo[]> {
    const cacheKey = 'available-packs';
    const endpoint = 'packs';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          // Don't require authentication for getting available packs
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/packs`);
          });
          return response.data;
        },
        { ttl: 300000 } // Cache for 5 minutes since pack info changes infrequently
      );
    } catch (error) {
      console.error('Failed to get available packs:', error);
      throw new Error('Failed to get available packs from backend');
    }
  }

  // User points API functions
  async getUserPoints(): Promise<UserPoints> {
    const cacheKey = `user-points:${this.token?.substring(0, 10) || 'anonymous'}`;
    const endpoint = 'points/balance';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/points/balance`, {
              headers: this.getHeaders()
            });
          });
          
          // Add detailed logging to see what the API actually returns
          console.log('🔍 Raw API response from /api/points/balance:', response);
          console.log('🔍 Raw response.data:', response.data);
          console.log('🔍 Response data type:', typeof response.data);
          console.log('🔍 Response data keys:', Object.keys(response.data || {}));
          
          // Check if the data needs transformation
          let userData = response.data;
          
          // If the response is nested, extract the correct data
          if (userData && typeof userData === 'object') {
            if ('balance' in userData) {
              console.log('🔄 Found nested balance data:', userData.balance);
              userData = userData.balance;
            } else if ('data' in userData) {
              console.log('🔄 Found nested data:', userData.data);
              userData = userData.data;
            }
          }
          
          console.log('🎯 Final transformed userData:', userData);
          console.log('🎯 Tournament points value:', userData?.tournamentPoints);
          
          return userData;
        },
        { ttl: 15000 } // Cache for 15 seconds since points change more frequently
      );
    } catch (error) {
      console.error('Failed to get user points:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication required. Please authenticate your wallet first.');
        }
        if (error.response?.status === 404) {
          throw new Error('User points not found.');
        }
      }
      throw new Error('Failed to get user points from backend');
    }
  }

  async purchasePack(request: PackPurchaseRequest): Promise<PackPurchaseResponse> {
    try {
      // Use pack type as string (PRO, EPIC, LEGENDARY) as per API docs
      const packType = request.packType;

      const response = await axios.post(
        `${API_BASE_URL}/api/packs/${packType}/purchase`,
        {}, // Empty body - backend only expects pack type in URL
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to purchase pack:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication required. Please authenticate your wallet first.');
        }
        if (error.response?.status === 402) {
          throw new Error('Insufficient points or funds for pack purchase.');
        }
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.response?.data?.detail || error.message;
        throw new Error(`Pack purchase failed: ${errorMessage}`);
      }
      throw new Error('Failed to purchase pack from backend');
    }
  }

  // Player management API functions
  async getPromotionCost(playerIds: string[], shares: number[] = []): Promise<{ [playerId: string]: number }> {
    // If no shares provided, default to 1 for each player to get per-share cost
    const sharesToSend = shares.length > 0 ? shares : playerIds.map(() => 1);
    const cacheKey = `promotion-cost:${playerIds.sort().join(',')}-${sharesToSend.join(',')}`;
    const endpoint = 'players/promotion-cost';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.post(
              `${API_BASE_URL}/api/players/promotion-cost`,
              { 
                playerIds: playerIds.map(id => parseInt(id)),
                shares: sharesToSend
              },
              { headers: this.getHeaders() }
            );
          });
          
          // The API might return { promotionCost: number } or { [playerId]: cost }
          // Let's handle both formats
          if (response.data.promotionCost !== undefined) {
            // Single promotion cost returned, map it to the playerId
            const result: { [playerId: string]: number } = {};
            playerIds.forEach(id => {
              result[id] = response.data.promotionCost;
            });
            return result;
          }
          
          return response.data;
        },
        { ttl: 60000 } // Cache for 1 minute since costs don't change frequently
      );
    } catch (error) {
      console.error('Failed to get promotion cost:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Authentication required. Please authenticate your wallet first.');
      }
      throw new Error('Failed to get promotion cost from backend');
    }
  }

  async getCutValue(playerIds: string[], shares: number[] = []): Promise<{ [playerId: string]: number }> {
    // If no shares provided, default to 1 for each player to get per-share value
    const sharesToSend = shares.length > 0 ? shares : playerIds.map(() => 1);
    const cacheKey = `cut-value:${playerIds.sort().join(',')}-${sharesToSend.join(',')}`;
    const endpoint = 'players/cut-value';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.post(
              `${API_BASE_URL}/api/players/cut-value`,
              { 
                playerIds: playerIds.map(id => parseInt(id)),
                shares: sharesToSend
              },
              { headers: this.getHeaders() }
            );
          });
          
          // The API returns { cutValue, totalShares, breakdown[] }
          // We need to convert this to { [playerId]: points } format
          const result: { [playerId: string]: number } = {};
          
          if (response.data.breakdown && Array.isArray(response.data.breakdown)) {
            response.data.breakdown.forEach((item: any) => {
              result[item.playerId.toString()] = item.points || 0;
            });
          } else if (response.data.cutValue !== undefined) {
            // Fallback: use cutValue for all requested players
            playerIds.forEach(id => {
              result[id] = response.data.cutValue;
            });
          }
          
          return result;
        },
        { ttl: 60000 } // Cache for 1 minute since values don't change frequently
      );
    } catch (error) {
      console.error('Failed to get cut value:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Authentication required. Please authenticate your wallet first.');
      }
      throw new Error('Failed to get cut value from backend');
    }
  }

  // Method to get promotion cost for specific amounts (used for real-time calculation)
  async getPromotionCostForAmount(playerId: string, shares: number): Promise<number> {
    try {
      const response = await this.getPromotionCost([playerId], [shares]);
      return response[playerId] || 0;
    } catch (error) {
      console.error('Failed to get promotion cost for amount:', error);
      throw error;
    }
  }

  // Method to get cut value for specific amounts (used for real-time calculation)  
  async getCutValueForAmount(playerId: string, shares: number): Promise<number> {
    try {
      const response = await this.getCutValue([playerId], [shares]);
      return response[playerId] || 0;
    } catch (error) {
      console.error('Failed to get cut value for amount:', error);
      throw error;
    }
  }

  async promotePlayer(playerId: string, shares: number): Promise<any> {
    try {
      // Convert shares to proper decimal format (18 decimals for player tokens)
      const sharesWithDecimals = parseUnits(shares.toString(), 18);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/players/promote`,
        { 
          playerIds: [parseInt(playerId)], 
          shares: [sharesWithDecimals.toString()] 
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to promote player:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication required. Please authenticate your wallet first.');
        }
        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Invalid promotion request';
          throw new Error(errorMessage);
        }
        if (error.response?.status === 402) {
          throw new Error('Insufficient skill points for promotion.');
        }
      }
      throw new Error('Failed to promote player');
    }
  }

  async cutPlayer(playerId: string, shares: number): Promise<any> {
    try {
      // Convert shares to proper decimal format (18 decimals for player tokens)
      const sharesWithDecimals = parseUnits(shares.toString(), 18);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/players/cut`,
        { 
          playerIds: [parseInt(playerId)], 
          shares: [sharesWithDecimals.toString()] 
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to cut player:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication required. Please authenticate your wallet first.');
        }
        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Invalid cut request';
          throw new Error(errorMessage);
        }
      }
      throw new Error('Failed to cut player');
    }
  }
}

export const apiService = new ApiService();
