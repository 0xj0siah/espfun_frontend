import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://espfun-backend.vercel.app';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API endpoints
export const endpoints = {
  players: '/api/players',
  player: (id: number) => `/api/players/${id}`,
  user: {
    owned: '/api/user/owned-players',
    development: '/api/user/development-players',
  },
  leaderboard: '/api/leaderboard',
  liveScores: '/api/live-scores',
  transfers: '/api/transfers',
};

// Player data interfaces
export interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  winRate: number;
}

export interface MatchResult {
  opponent: string;
  result: "win" | "loss";
  score: string;
  performance: number;
}

export interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  price: string;
  points: number;
  trend: "up" | "down" | "stable";
  rating: number;
  stats: PlayerStats;
  recentMatches: MatchResult[];
  level: number;
  xp: number;
  potential: number;
  lockedShares?: string;
  ownedShares?: bigint;
  totalValue?: string;
}

// API functions
export const fetchPlayers = async (): Promise<Player[]> => {
  try {
    const response = await api.get(endpoints.players);
    return response.data;
  } catch (error) {
    console.error('Error fetching players:', error);
    throw error;
  }
};

export const fetchPlayer = async (id: number): Promise<Player> => {
  try {
    const response = await api.get(endpoints.player(id));
    return response.data;
  } catch (error) {
    console.error(`Error fetching player ${id}:`, error);
    throw error;
  }
};

export const fetchUserOwnedPlayers = async (userAddress: string): Promise<Player[]> => {
  try {
    const response = await api.get(endpoints.user.owned, {
      params: { address: userAddress }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user owned players:', error);
    throw error;
  }
};

export const fetchUserDevelopmentPlayers = async (userAddress: string): Promise<{
  playerIds: bigint[];
  lockedBalances: bigint[];
  totalPlayers: number;
}> => {
  try {
    const response = await api.get(endpoints.user.development, {
      params: { address: userAddress }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user development players:', error);
    throw error;
  }
};

export const fetchLeaderboard = async () => {
  try {
    const response = await api.get(endpoints.leaderboard);
    return response.data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

export const fetchLiveScores = async () => {
  try {
    const response = await api.get(endpoints.liveScores);
    return response.data;
  } catch (error) {
    console.error('Error fetching live scores:', error);
    throw error;
  }
};

export const fetchTransfers = async () => {
  try {
    const response = await api.get(endpoints.transfers);
    return response.data;
  } catch (error) {
    console.error('Error fetching transfers:', error);
    throw error;
  }
};