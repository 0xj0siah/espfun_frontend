import { NETWORK_CONFIG } from '../contracts';

export const EIP712_DOMAIN = {
  name: 'FDF Pair',
  version: '1',
  chainId: NETWORK_CONFIG.chainId, // Monad testnet
};

export const BUY_TOKENS_TYPES = {
  BuyTokens: [
    { name: 'buyer', type: 'address' },
    { name: 'playerTokenIds', type: 'uint256[]' },
    { name: 'amounts', type: 'uint256[]' },
    { name: 'maxCurrencySpend', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

/**
 * Creates EIP712 domain for buyTokens signature
 * @param verifyingContract - FDFPair contract address
 * @returns EIP712 domain object
 */
export function createEIP712Domain(verifyingContract: string) {
  return {
    ...EIP712_DOMAIN,
    verifyingContract: verifyingContract as `0x${string}`
  };
}

/**
 * Creates typed data for buyTokens signature
 * @param domain - EIP712 domain
 * @param messageData - The transaction data
 * @returns Typed data object ready for signing
 */
export function createBuyTokensTypedData(domain: any, messageData: {
  buyer: string;
  playerTokenIds: number[];
  amounts: string[]; // BigInt string values from parseUnits
  maxCurrencySpend: string; // BigInt.toString() - NOT decimal string like "1.03"
  deadline: number;
  nonce: number;
}) {
  console.log('🔧 Creating EIP712 typed data with arrays:', {
    playerTokenIds: messageData.playerTokenIds,
    amounts: messageData.amounts
  });
  
  // For Privy, we use decimal string representation to avoid BigInt serialization issues
  const formattedMessage = {
    buyer: messageData.buyer as `0x${string}`,
    playerTokenIds: messageData.playerTokenIds.map(id => BigInt(id).toString()), // Convert to decimal string
    amounts: messageData.amounts.map(amt => BigInt(amt).toString()), // Keep as decimal string
    maxCurrencySpend: BigInt(messageData.maxCurrencySpend).toString(), // Convert to decimal string
    deadline: BigInt(messageData.deadline).toString(), // Convert to decimal string
    nonce: BigInt(messageData.nonce).toString() // Convert to decimal string
  };
  
  console.log('✅ Formatted message for EIP712 (decimal string values):', formattedMessage);
  
  return {
    domain,
    types: BUY_TOKENS_TYPES,
    primaryType: 'BuyTokens' as const,
    message: formattedMessage
  };
}

/**
 * Validates EIP712 signature parameters match expected contract format
 * @param messageData - The message data to validate
 * @returns true if valid, throws error if invalid
 */
export function validateSignatureParams(messageData: any): boolean {
  const required = ['buyer', 'playerTokenIds', 'amounts', 'maxCurrencySpend', 'deadline', 'nonce'];
  
  for (const field of required) {
    if (!(field in messageData)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  if (!Array.isArray(messageData.playerTokenIds)) {
    throw new Error('playerTokenIds must be an array');
  }
  
  if (!Array.isArray(messageData.amounts)) {
    throw new Error('amounts must be an array');
  }
  
  if (messageData.playerTokenIds.length !== messageData.amounts.length) {
    throw new Error('playerTokenIds and amounts arrays must have same length');
  }
  
  // Validate that amounts are valid BigInt strings
  for (const amount of messageData.amounts) {
    try {
      BigInt(amount);
    } catch (error) {
      throw new Error(`Invalid amount value: ${amount}`);
    }
  }
  
  try {
    BigInt(messageData.maxCurrencySpend);
  } catch (error) {
    throw new Error(`Invalid maxCurrencySpend value: ${messageData.maxCurrencySpend}`);
  }
  
  console.log('✅ EIP712 signature parameters validated with string conversion');
  return true;
}
