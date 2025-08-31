# Contract Integration Guide

## Overview
This app now fetches player data from local `fakedata.json` and pricing from the FDFPair contract on Monad Testnet.

## Current Implementation

### Data Source
- **Player Info**: `src/fakedata.json` (local file)
- **Pricing**: FDFPair contract `0x97cd3677188D12fF8C21013523f572412eb2812F`

### Architecture

```
src/
├── components/
│   ├── TeamSection.tsx      # Uses usePlayerPrices hook
│   └── TransfersSection.tsx # Uses usePlayerPrices hook
├── hooks/
│   └── usePlayerPricing.ts  # Contract pricing logic
├── utils/
│   └── contractUtils.ts     # Price formatting utilities
└── contracts/
    └── abis/
        └── FDFPair.json     # Contract ABI
```

### Pricing Logic

Currently simulated but ready for real contract integration:

```typescript
// Current (simulated)
const simulatedPrice = generateRealisticPrice(basePrice, playerId);

// Ready for production (uncomment when ready)
const contract = new Contract(address, abi, provider);
const priceWei = await contract.getCurrentPrice(playerId);
const price = formatPriceToETH(priceWei);
```

## Features

### ✅ Implemented
- Local player data from `fakedata.json`
- Simulated contract pricing with realistic volatility
- Price updates every 30 seconds
- Proper TypeScript interfaces
- Error handling and fallbacks

### 🔄 Ready for Contract Integration
- FDFPair contract ABI loaded
- Contract interaction methods prepared
- Price formatting utilities
- Batch price fetching support

### 🚀 Future Enhancements
- WebSocket for real-time price updates
- Transaction history from contract events
- Advanced price charts and analytics

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
