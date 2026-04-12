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
  // In-memory only — never persisted to localStorage (prevents XSS token theft)
  private token: string | null = null;
  private authErrorHandler?: (error: any) => void;
  private autoReAuthHandler?: () => Promise<boolean>;
  private isReAuthenticating = false;

  constructor() {
    // Set withCredentials globally so httpOnly cookies are sent with every request
    axios.defaults.withCredentials = true;
    this.setupAxiosInterceptors();
  }

  // Set up axios interceptors for automatic token handling
  private setupAxiosInterceptors() {
    // Response interceptor to handle 401 errors
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          // Prevent multiple simultaneous reauthentication attempts
          if (this.isReAuthenticating) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return axios(error.config!);
          }

          this.isReAuthenticating = true;

          try {
            this.clearAuthToken();

            if (this.autoReAuthHandler) {
              const reAuthSuccess = await this.autoReAuthHandler();
              if (reAuthSuccess) {
                return axios(error.config!);
              } else {
                if (this.authErrorHandler) {
                  this.authErrorHandler(error);
                }
              }
            } else {
              if (this.authErrorHandler) {
                this.authErrorHandler(error);
              }
            }
          } catch (reAuthError) {
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
    // Token also stored as httpOnly cookie by the backend — in-memory copy is for state tracking only
    requestCache.clear();
  }

  clearAuthToken() {
    this.token = null;
    requestCache.clear();
    // Tell the backend to clear the httpOnly cookie
    axios.post(`${API_BASE_URL}/api/auth/logout`).catch(() => {});
  }

  // Check if current token is valid by making a test request
  async validateToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      await axios.get(`${API_BASE_URL}/api/points/balance`, {
        headers: this.getHeaders()
      });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.clearAuthToken();
        return false;
      }
      // Network/server error — don't invalidate, but don't assume valid either
      return false;
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

    // Keep Authorization header as fallback alongside httpOnly cookie
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Authentication - Fixed to match API docs
  async getNonce(address: string): Promise<{ nonce: string; message: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/nonce`, {
        walletAddress: address
      });

      return response.data;
    } catch (error) {
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

  async login(address: string, signature: string, message: string, referralCode?: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        walletAddress: address,
        signature,
        message,
        ...(referralCode ? { referralCode } : {})
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        if (error.response?.status === 401) {
          const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Invalid signature';
          throw new Error(`Authentication failed: ${errorMsg}. Please try signing again.`);
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
          
          // Check if the data needs transformation
          let userData = response.data;

          // If the response is nested, extract the correct data
          if (userData && typeof userData === 'object') {
            if ('balance' in userData) {
              userData = userData.balance;
            } else if ('data' in userData) {
              userData = userData.data;
            }
          }

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

  // Grid.gg API methods (proxied through backend for caching and rate limiting)
  async getGridPlayerStats(playerId: string): Promise<any> {
    const cacheKey = `grid-player-stats:${playerId}`;
    const endpoint = `grid/player-stats/${playerId}`;

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/grid/player-stats/${playerId}`);
          });
          return response.data;
        },
        { ttl: 300000 } // Cache for 5 minutes (backend has its own cache too)
      );
    } catch (error) {
      console.error('Failed to get Grid player stats:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.warn('Grid API rate limited - backend will serve cached data');
          throw new Error('Grid API temporarily rate limited. Showing cached data.');
        }
      }
      throw new Error('Failed to get player statistics from backend');
    }
  }

  async getGridTeamSeries(teamId: string): Promise<string[]> {
    const cacheKey = `grid-team-series:${teamId}`;
    const endpoint = `grid/team-series/${teamId}`;

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/grid/team-series/${teamId}`);
          });
          return response.data.seriesIds || [];
        },
        { ttl: 300000 } // Cache for 5 minutes
      );
    } catch (error) {
      console.error('Failed to get Grid team series:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.warn('Grid API rate limited - backend will serve cached data');
          throw new Error('Grid API temporarily rate limited. Showing cached data.');
        }
      }
      throw new Error('Failed to get team series from backend');
    }
  }

  async getGridSeriesState(seriesId: string): Promise<any> {
    const cacheKey = `grid-series-state:${seriesId}`;
    const endpoint = `grid/series-state/${seriesId}`;

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/grid/series-state/${seriesId}`);
          });
          return response.data;
        },
        { ttl: 300000 } // Cache for 5 minutes
      );
    } catch (error) {
      console.error('Failed to get Grid series state:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.warn('Grid API rate limited - backend will serve cached data');
          throw new Error('Grid API temporarily rate limited. Showing cached data.');
        }
      }
      throw new Error('Failed to get series state from backend');
    }
  }

  // ── Referral System ──

  async generateReferralCode(customCode?: string): Promise<{ code: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/referrals/generate`,
        customCode ? { code: customCode } : {},
        { headers: this.getHeaders() },
      );
      return response.data;
    } catch (error) {
      console.error('Failed to generate referral code:', error);
      throw new Error('Failed to generate referral code');
    }
  }

  async getReferralStats(): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/referrals/stats`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get referral stats:', error);
      throw new Error('Failed to get referral stats');
    }
  }

  async getReferralLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/referrals/leaderboard`, {
        params: { limit },
      });
      return response.data.leaderboard || [];
    } catch (error) {
      console.error('Failed to get referral leaderboard:', error);
      return [];
    }
  }

  async applyReferralCode(code: string): Promise<{ success: boolean }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/referrals/apply`, { code }, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Failed to apply referral code:', error);
      throw new Error('Failed to apply referral code');
    }
  }

  // ── Analytics & Dashboard ──

  async getAnalyticsOverview(): Promise<any> {
    const cacheKey = 'analytics-overview';
    const endpoint = 'analytics/overview';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/analytics/overview`);
          });
          return response.data;
        },
        { ttl: 60000 } // Cache for 1 minute
      );
    } catch (error) {
      console.error('Failed to get analytics overview:', error);
      throw new Error('Failed to get analytics overview');
    }
  }

  async getPlayerPriceHistory(playerTokenId: string, days: number = 30): Promise<any> {
    const cacheKey = `player-price-history:${playerTokenId}:${days}`;
    const endpoint = `market-cap/players/${playerTokenId}/history`;

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/market-cap/players/${playerTokenId}/history?days=${days}`);
          });
          return response.data;
        },
        { ttl: 60000 }
      );
    } catch (error) {
      console.error('Failed to get player price history:', error);
      throw new Error('Failed to get player price history');
    }
  }

  async getPlayerOHLC(
    playerTokenId: string,
    interval: '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    days: number = 7
  ): Promise<any> {
    const cacheKey = `player-ohlc:${playerTokenId}:${interval}:${days}`;
    const endpoint = `market-cap/players/${playerTokenId}/ohlc`;

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(
              `${API_BASE_URL}/api/market-cap/players/${playerTokenId}/ohlc?interval=${interval}&days=${days}`
            );
          });
          return response.data;
        },
        { ttl: 30000 } // 30s cache for live chart data
      );
    } catch (error) {
      console.error('Failed to get player OHLC data:', error);
      throw new Error('Failed to get player OHLC data');
    }
  }

  async getTVLHistory(days: number = 30): Promise<any> {
    const cacheKey = `tvl-history:${days}`;
    const endpoint = 'tvl/history';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/tvl/history?days=${days}`);
          });
          return response.data;
        },
        { ttl: 120000, skipCache: true } // Always fetch fresh — avoid caching empty/zero data
      );
    } catch (error) {
      console.error('Failed to get TVL history:', error);
      throw new Error('Failed to get TVL history');
    }
  }

  async getTVLLatest(): Promise<any> {
    const cacheKey = 'tvl-latest';
    const endpoint = 'tvl/latest';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/tvl/latest`);
          });
          return response.data;
        },
        { ttl: 60000 }
      );
    } catch (error) {
      console.error('Failed to get latest TVL:', error);
      throw new Error('Failed to get latest TVL');
    }
  }

  async getRevenueHistory(period: 'hourly' | 'daily' = 'daily', days: number = 30): Promise<any> {
    const cacheKey = `revenue-history:${period}:${days}`;
    const endpoint = 'analytics/fees/distributed';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/analytics/fees/distributed?period=${period}&days=${days}`);
          });
          return response.data;
        },
        { ttl: 120000 }
      );
    } catch (error) {
      console.error('Failed to get revenue history:', error);
      throw new Error('Failed to get revenue history');
    }
  }

  async getPortfolio(): Promise<{ totalValue: number; holdings: any[] }> {
    const cacheKey = `portfolio:${this.token?.substring(0, 10) || 'anonymous'}`;
    const endpoint = 'portfolio';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/portfolio`, {
              headers: this.getHeaders(),
            });
          });
          return response.data;
        },
        { ttl: 30000 } // 30s cache
      );
    } catch (error) {
      console.error('Failed to get portfolio:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error('Failed to get portfolio');
    }
  }

  async getPlayerPriceChanges(): Promise<any> {
    const cacheKey = 'player-price-changes';
    const endpoint = 'market-cap/players/changes';

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/market-cap/players/changes`);
          });
          return response.data;
        },
        { ttl: 60000 }
      );
    } catch (error) {
      console.error('Failed to get player price changes:', error);
      throw new Error('Failed to get player price changes');
    }
  }

  async getRecentTrades(playerTokenId?: string, limit: number = 20): Promise<any> {
    const params = new URLSearchParams();
    if (playerTokenId) params.set('playerTokenId', playerTokenId);
    params.set('limit', String(limit));
    const qs = params.toString();
    const cacheKey = `recent-trades:${qs}`;
    const endpoint = `analytics/trades/recent?${qs}`;

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/analytics/trades/recent?${qs}`);
          });
          return response.data;
        },
        { ttl: 15000 }
      );
    } catch (error) {
      console.error('Failed to get recent trades:', error);
      throw new Error('Failed to get recent trades');
    }
  }
  /**
   * GET /api/market-cap/players/live
   * Returns live player prices from the chain (Redis-cached 5s on backend).
   * Pass bustCache=true to force a fresh chain read.
   */
  async getLivePrices(bustCache = false): Promise<{
    prices: Array<{ playerTokenId: number; price: number }>;
    count: number;
    timestamp: number;
  }> {
    const bust = bustCache ? '?bust=1' : '';
    const cacheKey = `live-prices${bust}`;
    const endpoint = `market-cap/players/live${bust}`;

    try {
      return await requestCache.executeRequest(
        cacheKey,
        endpoint,
        async () => {
          const response = await retryWithBackoff(async () => {
            return axios.get(`${API_BASE_URL}/api/market-cap/players/live${bust}`);
          });
          return response.data;
        },
        { ttl: bustCache ? 0 : 4000 } // 4s client cache (slightly less than 5s server cache)
      );
    } catch (error) {
      console.error('Failed to get live prices:', error);
      throw new Error('Failed to get live prices');
    }
  }
}

export const apiService = new ApiService();
