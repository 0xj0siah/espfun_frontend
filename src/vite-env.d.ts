/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_RPC_URL: string
  readonly VITE_CHAIN_ID: string
  readonly VITE_BLOCK_EXPLORER_URL: string
  readonly VITE_CONTRACT_ADDRESS_FEE_MANAGER: string
  readonly VITE_CONTRACT_ADDRESS_PLAYER: string
  readonly VITE_CONTRACT_ADDRESS_DEVELOPMENT_PLAYERS: string
  readonly VITE_CONTRACT_ADDRESS_PLAYER_CONTRACTS: string
  readonly VITE_CONTRACT_ADDRESS_PLAYER_PACK: string
  readonly VITE_CONTRACT_ADDRESS_FDF_PAIR: string
  readonly VITE_CONTRACT_ADDRESS_TUSDC: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}