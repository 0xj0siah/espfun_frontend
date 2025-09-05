import { apiService } from './apiService';

export interface WalletSigner {
  signMessage: (message: string) => Promise<string>;
}

export const authenticateWallet = async (
  address: string,
  signer: WalletSigner
): Promise<string> => {
  try {
    // Check if backend is available first
    console.log('🔐 Attempting JWT authentication with backend...');
    console.log('🔐 Using address:', address);
    
    // Get nonce and message from backend
    const { nonce, message } = await apiService.getNonce(address);
    console.log('🔐 Received nonce:', nonce);
    console.log('🔐 Message to sign:', message);
    
    // Sign the message provided by the backend (not our own message)
    const signature = await signer.signMessage(message);
    console.log('🔐 Signature created:', signature.slice(0, 20) + '...');
    
    // Login with signature and the original message from backend
    const authResponse = await apiService.login(address, signature, message);
    
    // Store token
    apiService.setAuthToken(authResponse.token);
    
    console.log('✅ JWT authentication successful');
    return authResponse.token;
  } catch (error) {
    console.error('🔐 JWT authentication failed:', error);
    
    // Check if it's a backend connectivity issue
    if (error.message.includes('Failed to get authentication nonce') || 
        error.message.includes('Network Error') ||
        error.message.includes('ERR_NETWORK')) {
      throw new Error('Backend server is not available. Enhanced features will use local signatures instead.');
    }
    
    // Re-throw other authentication errors
    throw error;
  }
};
