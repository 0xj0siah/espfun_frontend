import { apiService } from './apiService';

export interface WalletSigner {
  signMessage: (message: string) => Promise<string>;
}

export const authenticateWallet = async (
  address: string,
  signer: WalletSigner
): Promise<string> => {
  try {
    // Get nonce and message from backend
    const { nonce, message } = await apiService.getNonce(address);

    // Sign the message provided by the backend (not our own message)
    const signature = await signer.signMessage(message);

    // Check for pending referral code (from ?ref= URL param)
    const pendingReferralCode = localStorage.getItem('pendingReferralCode');

    // Login with signature and the original message from backend
    const authResponse = await apiService.login(address, signature, message, pendingReferralCode || undefined);

    // Clear pending referral code after successful login
    if (pendingReferralCode) {
      localStorage.removeItem('pendingReferralCode');
    }

    // Store token
    apiService.setAuthToken(authResponse.token);

    return authResponse.token;
  } catch (error) {
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
