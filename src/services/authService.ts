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
    console.log('🔐 Message length:', message.length);
    console.log('🔐 Message bytes:', message.split('').map(c => c.charCodeAt(0)).join(','));
    
    // Sign the message provided by the backend (not our own message)
    const signature = await signer.signMessage(message);
    console.log('🔐 Signature created:', signature);
    console.log('🔐 Signature length:', signature.length);
    
    // Check for pending referral code (from ?ref= URL param)
    const pendingReferralCode = localStorage.getItem('pendingReferralCode');
    if (pendingReferralCode) {
      console.log('🔐 Including referral code in login:', pendingReferralCode);
    }

    // Login with signature and the original message from backend
    console.log('🔐 Calling login with:', {
      address,
      signature: signature.substring(0, 20) + '...',
      message,
      messageLength: message.length
    });
    const authResponse = await apiService.login(address, signature, message, pendingReferralCode || undefined);

    // Clear pending referral code after successful login
    if (pendingReferralCode) {
      localStorage.removeItem('pendingReferralCode');
      console.log('🔐 Referral code applied and cleared');
    }

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
