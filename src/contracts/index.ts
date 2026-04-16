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
  FeeManager: import.meta.env.VITE_CONTRACT_FEE_MANAGER || '0xAF0eD1A19083a23B88B82f6ceda6f5FC6896384C',
  Player: import.meta.env.VITE_CONTRACT_PLAYER || '0x6aDb9ab8c994E2a7ebCa508c9eC3738d1c46252b',
  DevelopmentPlayers: import.meta.env.VITE_CONTRACT_DEV_PLAYERS || '0xcEe2b94Bf384755d3B288270d3DECCcdA459aB1e',
  PlayerContracts: import.meta.env.VITE_CONTRACT_PLAYER_CONTRACTS || '0xeD44a192B10941B6536FD68A4164b8e39d20E12C',
  PlayerPack: import.meta.env.VITE_CONTRACT_PLAYER_PACK || '0x7e16F401e69877EB6a9798fBb674043400671d08',
  FDFPair: import.meta.env.VITE_CONTRACT_FDF_PAIR || '0x84aec88fcA92E58f5aD00e922C648b51749CD777',
  TUSDC: import.meta.env.VITE_CONTRACT_TUSDC || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ESPStaking: import.meta.env.VITE_CONTRACT_ESP_STAKING || '0xf1a251b501481c379cF51bA5EAaCbE1A23Ef06Ca',
  ESP: import.meta.env.VITE_CONTRACT_ESP || '0x626494A7CD08D31e7554B2dF8F7e7Cb1bffdC70C',
  BondingCurve: import.meta.env.VITE_CONTRACT_BONDING_CURVE || '0x6989C402C70481B3A8D74936f808f93B404A5D47',
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

// Network configuration (Base Mainnet)
export const NETWORK_CONFIG = {
  chainId: 8453,
  name: 'Base',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
} as const;
