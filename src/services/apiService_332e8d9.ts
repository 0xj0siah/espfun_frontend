import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface BuyTokensRequest {
  playerTokenIds: string[];
  amounts: string[];
  maxCurrencySpend: string;
  deadline: number;
}

export interface SignatureResponse {
  signature: string;
  txData: {
    nonce: number;
    playerTokenIds: string[];
    amounts: string[];
    maxCurrencySpend: string;
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

  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  setAuthToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearAuthToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      console.log('🔐 Auth token present:', this.token.substring(0, 20) + '...');
    } else {
      console.log('⚠️ No auth token found');
    }

    return headers;
  }

  // Authentication - Fixed to match API docs
  async getNonce(address: string): Promise<{ nonce: string; message: string }> {
    try {
      // According to API docs, this should be POST /api/auth/nonce
      const response = await axios.post(`${API_BASE_URL}/api/auth/nonce`, {
        walletAddress: address
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get authentication nonce:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
          throw new Error('Backend server is not available. Please ensure the server is running on http://localhost:5000');
        }
      }
      throw new Error('Failed to get authentication nonce from backend');
    }
  }

  async login(address: string, signature: string, message: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        walletAddress: address,
        signature,
        message
      });
      return response.data;
    } catch (error) {
      console.error('Authentication failed:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid signature. Please try signing again.');
        }
      }
      throw new Error('Authentication failed');
    }
  }

  // BuyTokens EIP712 Signature
  async prepareSignature(request: BuyTokensRequest): Promise<SignatureResponse> {
    try {
      console.log('🌐 Requesting signature from backend API:', {
        url: `${API_BASE_URL}/api/buyTokens/prepare-signature`,
        request
      });

      const response = await axios.post(
        `${API_BASE_URL}/api/buyTokens/prepare-signature`,
        request,
        { headers: this.getHeaders() }
      );

      console.log('✅ Backend signature response:', response.data);
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

  async getBuyTokensNonce(address: string): Promise<{ nonce: number; address: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/buyTokens/nonce/${address}`);
      return response.data;
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

  // Pack-related API functions
  async getAvailablePacks(): Promise<PackInfo[]> {
    try {
      // Don't require authentication for getting available packs
      const response = await axios.get(`${API_BASE_URL}/api/packs`);
      return response.data;
    } catch (error) {
      console.error('Failed to get available packs:', error);
      throw new Error('Failed to get available packs from backend');
    }
  }

  // User points API functions
  async getUserPoints(): Promise<UserPoints> {
    try {
      console.log('🔍 Fetching user points from backend...');
      const response = await axios.get(`${API_BASE_URL}/api/points/balance`, {
        headers: this.getHeaders()
      });
      console.log('✅ User points response:', JSON.stringify(response.data, null, 2));
      return response.data;
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
      console.log('🎁 Purchasing pack via backend API:', request);

      // Use pack type as string (PRO, EPIC, LEGENDARY) as per API docs
      const packType = request.packType;

      console.log('📡 API Request Details:');
      console.log('- URL:', `${API_BASE_URL}/api/packs/${packType}/purchase`);
      console.log('- Method: POST');
      console.log('- Headers:', this.getHeaders());
      console.log('- Body: {} (empty - pack type only in URL)');

      const response = await axios.post(
        `${API_BASE_URL}/api/packs/${packType}/purchase`,
        {}, // Empty body - backend only expects pack type in URL
        { headers: this.getHeaders() }
      );

      console.log('✅ Pack purchase response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to purchase pack:', error);
      if (axios.isAxiosError(error)) {
        console.error('❌ API Error Details:');
        console.error('- Status:', error.response?.status);
        console.error('- Status Text:', error.response?.statusText);
        console.error('- Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('- Request URL:', error.config?.url);
        console.error('- Request Method:', error.config?.method);
        console.error('- Request Headers:', JSON.stringify(error.config?.headers, null, 2));

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
        console.error('❌ Full error message:', errorMessage);
        console.error('❌ Full response data:', JSON.stringify(error.response?.data, null, 2));
        throw new Error(`Pack purchase failed: ${errorMessage}`);
      }
      throw new Error('Failed to purchase pack from backend');
    }
  }
}

export const apiService = new ApiService();
