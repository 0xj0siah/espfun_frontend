// Contract ABIs and addresses for ESP.fun
// All contracts deployed on Monad Testnet

// Import ABIs (these are raw ABI arrays)
import FeeManagerABI from './abis/FeeManager.json';
import PlayerABI from './abis/Player.json';
import DevelopmentPlayersABI from './abis/DevelopmentPlayers.json';
import PlayerContractsABI from './abis/PlayerContracts.json';
import PlayerPackABI from './abis/PlayerPack.json';
import FDFPairABI from './abis/FDFPair.json';

// Export ABIs
export {
  FeeManagerABI,
  PlayerABI,
  DevelopmentPlayersABI,
  PlayerContractsABI,
  PlayerPackABI,
  FDFPairABI,
};

// Contract addresses (Updated from setup.md - ESP Fun System Fully Operational!)
export const CONTRACT_ADDRESSES = {
  FeeManager: '0x5a354beb8ddA64A72D30b48980b56b989410448f',
  Player: '0xb316ace8422975c644E723Cc391Db33e14c05460',
  DevelopmentPlayers: '0xF57a67090fE0B6746c7285FEfE00cd188649393c',
  PlayerContracts: '0xB62dccd11348bfA2Ba29e0c50Da85b1804A6f9d2',
  PlayerPack: '0x6351A397a17718Ba614b1dffF183557aca55F24A',
  FDFPair: '0xF41Ab3e0dE047E53e9D75ebCfc65D0ac727C7B59',
  TUSDC: '0xEc25C405ec25BB24Ad004198D1B3111e8de808f8',
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
    abi: [
      {
        "name": "decimals",
        "type": "function",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view"
      },
      {
        "name": "balanceOf",
        "type": "function",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view"
      },
      {
        "name": "allowance",
        "type": "function",
        "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view"
      },
      {
        "name": "approve",
        "type": "function",
        "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable"
      },
      {
        "name": "mint",
        "type": "function",
        "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
        "outputs": [],
        "stateMutability": "nonpayable"
      }
    ],
  },
} as const;

// Helper function to get contract data
export function getContractData(contractName: ContractName) {
  return CONTRACTS[contractName];
}

// Network configuration (Monad Testnet)
export const NETWORK_CONFIG = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
} as const;
