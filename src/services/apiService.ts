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
}

export const apiService = new ApiService();
