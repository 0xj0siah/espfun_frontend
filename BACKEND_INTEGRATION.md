# Backend API Integration for EIP-712 Signatures

## Overview

The ESP.fun frontend now uses a backend API for EIP-712 signature generation instead of local signature creation. This provides better security, centralized nonce management, and transaction tracking.

## Changes Made

### 1. New API Service (`src/services/apiService.ts`)

The API service handles all backend communication:

- **Authentication**: `getNonce()`, `login()`
- **Signature Generation**: `prepareSignature()` 
- **Transaction Management**: `confirmTransaction()`, `getTransactions()`
- **Nonce Management**: `getBuyTokensNonce()`

### 2. Updated PlayerPurchaseModal

The purchase flow now:

1. **Requests signature from backend** instead of generating locally
2. **Uses backend-provided nonce** instead of calling contract
3. **Confirms transaction** with backend after completion

### 3. Environment Configuration

Required environment variables in `.env.local`:

```bash
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_MONAD_CHAIN_ID=10143
REACT_APP_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
REACT_APP_FDF_PAIR_CONTRACT=0xA160B769d12A0F3B932113BB4F181544Af5Ee68d
```

## API Endpoints Used

### POST `/api/buyTokens/prepare-signature`
Generates EIP-712 signature for token purchase.

**Request:**
```json
{
  "playerTokenIds": ["1"],
  "amounts": ["1000000000000000000"],
  "maxCurrencySpend": "1000000",
  "deadline": 1703123456
}
```

**Response:**
```json
{
  "signature": "0x...",
  "txData": {
    "nonce": 5,
    "playerTokenIds": ["1"],
    "amounts": ["1000000000000000000"],
    "maxCurrencySpend": "1000000",
    "deadline": 1703123456
  },
  "transactionId": "uuid-string"
}
```

### POST `/api/buyTokens/transaction/{id}/confirm`
Confirms transaction completion with backend.

**Request:**
```json
{
  "txHash": "0x..."
}
```

## Transaction Flow

1. **User initiates purchase** in PlayerPurchaseModal
2. **Frontend calls** `apiService.prepareSignature()` 
3. **Backend generates** EIP-712 signature with managed nonce
4. **Frontend executes** contract transaction with signature
5. **Frontend confirms** transaction with backend via `confirmTransaction()`

## Benefits

- ✅ **Centralized nonce management** - no race conditions
- ✅ **Better security** - signatures generated server-side
- ✅ **Transaction tracking** - backend maintains transaction history
- ✅ **Replay protection** - backend validates nonce usage
- ✅ **Error handling** - comprehensive API error responses

## Development Notes

- Backend must be running on `http://localhost:5000` (configurable via env)
- Authentication system ready but not yet implemented in UI
- Transaction confirmation is optional - won't fail the purchase if backend is down
- All existing transaction logic remains unchanged, just signature generation moved to backend

## Next Steps

1. Implement user authentication flow
2. Add transaction history UI
3. Add retry logic for API failures
4. Implement caching for better performance
