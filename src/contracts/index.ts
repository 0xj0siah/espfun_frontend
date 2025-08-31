// Contract ABIs and addresses for the Crypto Fantasy Esports App
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

// Contract addresses
export const CONTRACT_ADDRESSES = {
  FeeManager: '0x80B4DF38Cf27Fff956ff2f4225503128a08d3E75',
  Player: '0xc94CfCDF0c8217aE2E1E48DAa8765C937b4B3f82',
  DevelopmentPlayers: '0x2fA1B919c967040E184dDd038B13783829A5dEfd',
  PlayerContracts: '0x58cD9139a60732FBD57D46E66d26a18F43B8B9Ab',
  PlayerPack: '0x5E94655B1AeF4d55c31A83cDb1e86CB5977a196e',
  FDFPair: '0x97cd3677188D12fF8C21013523f572412eb2812F',
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
} as const;

// Helper function to get contract data
export function getContractData(contractName: ContractName) {
  return CONTRACTS[contractName];
}

// Network configuration (Monad Testnet)
export const NETWORK_CONFIG = {
  chainId: 41454, // Monad Testnet chain ID
  name: 'Monad Testnet',
  rpcUrl: 'https://testnet1.monad.xyz',
  blockExplorer: 'https://testnet.monadexplorer.com',
} as const;
