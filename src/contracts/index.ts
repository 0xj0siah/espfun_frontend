// Contract ABIs and addresses for ESP.fun
// All contracts deployed on Base Sepolia

// Import ABIs (these are raw ABI arrays)
import FeeManagerABI from './abis/FeeManager.json';
import PlayerABI from './abis/Player.json';
import DevelopmentPlayersABI from './abis/DevelopmentPlayers.json';
import PlayerContractsABI from './abis/PlayerContracts.json';
import PlayerPackABI from './abis/PlayerPack.json';
import FDFPairABI from './abis/FDFPair.json';
import ESPStakingABI from './abis/ESPStaking.json';
import BondingCurveABI from './abis/BondingCurve.json';
import TUSDCABI from './abis/TUSDC.json';
import ESPABI from './abis/ESP.json';

// Export ABIs
export {
  FeeManagerABI,
  PlayerABI,
  DevelopmentPlayersABI,
  PlayerContractsABI,
  PlayerPackABI,
  FDFPairABI,
  ESPStakingABI,
  BondingCurveABI,
  TUSDCABI,
  ESPABI,
};

// Contract addresses — override via VITE_CONTRACT_* env vars for different deployments
export const CONTRACT_ADDRESSES = {
  FeeManager: import.meta.env.VITE_CONTRACT_FEE_MANAGER || '0x5a354beb8ddA64A72D30b48980b56b989410448f',
  Player: import.meta.env.VITE_CONTRACT_PLAYER || '0xb316ace8422975c644E723Cc391Db33e14c05460',
  DevelopmentPlayers: import.meta.env.VITE_CONTRACT_DEV_PLAYERS || '0xF57a67090fE0B6746c7285FEfE00cd188649393c',
  PlayerContracts: import.meta.env.VITE_CONTRACT_PLAYER_CONTRACTS || '0xB62dccd11348bfA2Ba29e0c50Da85b1804A6f9d2',
  PlayerPack: import.meta.env.VITE_CONTRACT_PLAYER_PACK || '0x6351A397a17718Ba614b1dffF183557aca55F24A',
  FDFPair: import.meta.env.VITE_CONTRACT_FDF_PAIR || '0xF41Ab3e0dE047E53e9D75ebCfc65D0ac727C7B59',
  TUSDC: import.meta.env.VITE_CONTRACT_TUSDC || '0xEc25C405ec25BB24Ad004198D1B3111e8de808f8',
  ESPStaking: import.meta.env.VITE_CONTRACT_ESP_STAKING || '0x9c288d1c0279a6b2404D483a0c0563C5981Ea845',
  ESP: import.meta.env.VITE_CONTRACT_ESP || '0x11AD735D35d9baD6e7489D8Bc2295F0E32d26CE7',
  BondingCurve: import.meta.env.VITE_CONTRACT_BONDING_CURVE || '0x20b8685651082943D7d8A2cceB41430664a5274F',
} as const;

// Type definitions for the contracts
export type ContractName = keyof typeof CONTRACT_ADDRESSES;

// Contract configuration objects
export const CONTRACTS = {
  FeeManager: {
    address: CONTRACT_ADDRESSES.FeeManager,
    abi: FeeManagerABI,
  },
  Player: {
    address: CONTRACT_ADDRESSES.Player,
    abi: PlayerABI,
  },
  DevelopmentPlayers: {
    address: CONTRACT_ADDRESSES.DevelopmentPlayers,
    abi: DevelopmentPlayersABI,
  },
  PlayerContracts: {
    address: CONTRACT_ADDRESSES.PlayerContracts,
    abi: PlayerContractsABI,
  },
  PlayerPack: {
    address: CONTRACT_ADDRESSES.PlayerPack,
    abi: PlayerPackABI,
  },
  FDFPair: {
    address: CONTRACT_ADDRESSES.FDFPair,
    abi: FDFPairABI,
  },
  TUSDC: {
    address: CONTRACT_ADDRESSES.TUSDC,
    abi: TUSDCABI,
  },
  ESPStaking: {
    address: CONTRACT_ADDRESSES.ESPStaking,
    abi: ESPStakingABI,
  },
  BondingCurve: {
    address: CONTRACT_ADDRESSES.BondingCurve,
    abi: BondingCurveABI,
  },
  ESP: {
    address: CONTRACT_ADDRESSES.ESP,
    abi: ESPABI,
  },
} as const;

// Helper function to get contract data
export function getContractData(contractName: ContractName) {
  return CONTRACTS[contractName];
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** Check whether a contract has a real deployed address (not zero-address). */
export function isContractDeployed(contractName: ContractName): boolean {
  return CONTRACT_ADDRESSES[contractName] !== ZERO_ADDRESS;
}

// Network configuration (Base Sepolia)
// TODO: Align Privy chain config in main.tsx with NETWORK_CONFIG
export const NETWORK_CONFIG = {
  chainId: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrl: 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
} as const;
