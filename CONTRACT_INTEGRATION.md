# Contract Integration Guide

## Overview
This app now fetches player data from local `fakedata.json` and pricing from the FDFPair contract on Monad Testnet.

## Current Implementation

### Data Source
- **Player Info**: `src/fakedata.json` (local file)
- **Pricing**: FDFPair contract `0x97cd3677188D12fF8C21013523f572412eb2812F` ✅ **LIVE**

### Architecture

```
src/
├── components/
│   ├── TeamSection.tsx      # Uses usePlayerPrices hook
│   └── TransfersSection.tsx # Uses usePlayerPrices hook
├── hooks/
│   └── usePlayerPricing.ts  # Real contract pricing logic ✅
├── utils/
│   └── contractUtils.ts     # Price formatting utilities
└── contracts/
    └── abis/
        └── FDFPair.json     # Contract ABI
```

### Pricing Logic

**NOW USING REAL CONTRACT DATA:**

```typescript
// Real contract calls (ACTIVE)
const result = await publicClient.readContract({
  address: fdfPairContract.address,
  abi: fdfPairContract.abi,
  functionName: 'getCurrentPrice',
  args: [BigInt(playerId)],
});

const priceInEth = formatEther(result as bigint);
```

### Contract Integration

✅ **Live Contract Calls**:
- Using viem public client for efficient reads
- Monad Testnet RPC integration
- Real-time price fetching every 30 seconds
- Automatic fallback to simulated data on errors

✅ **Error Handling**:
- Individual player fallbacks on contract errors
- Network resilience with retry logic
- Graceful degradation to simulated prices

## Features

### ✅ Implemented & LIVE
- Local player data from `fakedata.json`
- **REAL contract pricing from FDFPair** 🔥
- Price updates every 30 seconds from blockchain
- Proper TypeScript interfaces
- Robust error handling with fallbacks
- Batch price fetching for efficiency
- Automatic retry and resilience mechanisms

### � Ready for Enhancement
- WebSocket for real-time price updates
- Transaction execution (buy/sell players)
- Advanced price charts and analytics
- Price impact calculations
- Reserve data display

### 🚀 Advanced Features Available
- `getReserveData()` - Fetch liquidity pool reserves
- `calculatePriceImpact()` - Preview trade impact
- Real-time blockchain price updates
- Network-aware error handling

## Usage

### Get Single Player Price
```typescript
import { usePlayerPrice } from '../hooks/usePlayerPricing';

const { price, loading } = usePlayerPrice(playerId);
```

### Get Multiple Prices (Efficient)
```typescript
import { usePlayerPrices } from '../hooks/usePlayerPricing';

const playerIds = [1, 2, 3, 4, 5];
const { prices, loading } = usePlayerPrices(playerIds);
```

## Contract Integration Steps

1. **Test Contract Connection**:
   ```typescript
   // Uncomment contract call sections in usePlayerPricing.ts
   // Test with a single player price first
   ```

2. **Add Transaction Methods**:
   ```typescript
   // Add buy/sell functions using Player contract
   // Integrate with existing PlayerPurchaseModal
   ```

3. **Real-time Updates**:
   ```typescript
   // Add WebSocket or event listeners
   // Update prices when trades occur
   ```

## Network Configuration

- **Chain**: Monad Testnet (41454)
- **Explorer**: https://testnet.monadexplorer.com
- **RPC**: https://testnet1.monad.xyz

## Contract Addresses

All contract addresses and ABIs are configured in `src/contracts/index.ts`:
- FDFPair: `0x97cd3677188D12fF8C21013523f572412eb2812F`
- Player: `0xc94CfCDF0c8217aE2E1E48DAa8765C937b4B3f82`
- FeeManager: `0x80B4DF38Cf27Fff956ff2f4225503128a08d3E75`
