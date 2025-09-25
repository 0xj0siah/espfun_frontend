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
  FeeManager: '0x419297541e3Da2493f77ADd65216F1431A890b78',
  Player: '0x35163e4FA25c05E756aA8012a33827bE60aC0D52',
  DevelopmentPlayers: '0xCEa8bC8F79C3af4Db7D4c7b09C851FAc6128F202',
  PlayerContracts: '0x3f87a9376ec29426d0367fa6eA2E39bD12e1A1aA',
  PlayerPack: '0x482E69701c96E600e524d55ae15904142f63691b',
  FDFPair: '0xA160B769d12A0F3B932113BB4F181544Af5Ee68d',
  TUSDC: '0xbAa8EF1B3e1384F1F67e208eEE64c01b42D8aB0E',
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
  chainId: 10143,
  name: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz', // Fixed RPC URL (was https://testnet1.monad.xyz)
  blockExplorer: 'https://testnet.monadexplorer.com',
} as const;
