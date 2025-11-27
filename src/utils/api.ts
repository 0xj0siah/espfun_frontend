import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

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

// Grid.gg API interfaces for esports data
export interface GridPlayerStats {
  playerId: string;
  kills: number;
  deaths: number;
  assists: number;
  rating: number;
  winRate: number;
}

export interface GridDetailedPlayerStats {
  id: string;
  series: {
    count: number;
    kills: {
      sum: number;
      avg: number;
      min: number;
      max: number;
      ratePerMinute: {
        min: number;
        max: number;
        avg: number;
      };
    };
    deaths: {
      sum: number;
      avg: number;
      min: number;
      max: number;
      ratePerMinute: {
        min: number;
        max: number;
        avg: number;
      };
    };
    killAssistsGiven: {
      sum: number;
      avg: number;
      min: number;
      max: number;
      ratePerMinute: {
        min: number;
        max: number;
        avg: number;
      };
    };
    wins: Array<{
      value: boolean;
      count: number;
      percentage: number;
    }>;
  };
  game: {
    count: number;
    kills: {
      sum: number;
      avg: number;
      min: number;
      max: number;
      ratePerMinute: {
        min: number;
        max: number;
        avg: number;
      };
    };
    deaths: {
      sum: number;
      avg: number;
      min: number;
      max: number;
      ratePerMinute: {
        min: number;
        max: number;
        avg: number;
      };
    };
    killAssistsGiven: {
      sum: number;
      avg: number;
      min: number;
      max: number;
      ratePerMinute: {
        min: number;
        max: number;
        avg: number;
      };
    };
    wins: Array<{
      value: boolean;
      count: number;
      percentage: number;
    }>;
  };
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

// Grid.gg API functions for esports data (now proxied through backend)
export const getPlayerStatistics = async (playerIds: string[]): Promise<GridPlayerStats[]> => {
  // This function is deprecated - use getDetailedPlayerStatistics instead which is proxied through backend
  console.warn('getPlayerStatistics is deprecated - use getDetailedPlayerStatistics instead');
  return [];
};

export const getDetailedPlayerStatistics = async (playerId: string): Promise<GridDetailedPlayerStats | null> => {
  try {
    console.log(`🔄 Fetching detailed player statistics for ${playerId} from backend...`);
    const response = await axios.get(`${API_BASE_URL}/api/grid/player-stats/${playerId}`);

    if (response.status === 200 && response.data) {
      console.log(`✅ Successfully fetched player stats for ${playerId}`);
      return response.data;
    }

    return null;
  } catch (error: any) {
    console.error(`Error fetching detailed player statistics for ${playerId}:`, error);

    if (error.response?.status === 429) {
      console.warn('⚠️ Backend is rate limited, may be serving cached data');
    }

    return null;
  }
};

// Get team statistics to retrieve recent series IDs for matches
export const getTeamStatistics = async (teamId: string): Promise<string[]> => {
  try {
    console.log(`🔄 Fetching team statistics for ${teamId} from backend...`);
    const response = await axios.get(`${API_BASE_URL}/api/grid/team-series/${teamId}`);

    if (response.status === 200 && response.data) {
      const seriesIds = response.data.seriesIds || [];
      console.log(`✅ Found ${seriesIds.length} series IDs for team ${teamId}`);
      return seriesIds;
    }

    return [];
  } catch (error: any) {
    console.error(`Error fetching team statistics for ${teamId}:`, error);

    if (error.response?.status === 429) {
      console.warn('⚠️ Backend is rate limited, may be serving cached data');
    }

    return [];
  }
};

// Grid.gg Series State API interfaces
export interface SeriesTeam {
  id: string;
  name: string;
  won: boolean;
  score: number;
}

export interface SeriesGame {
  finished: boolean;
  teams: Array<{
    name: string;
    won: boolean;
  }>;
}

export interface SeriesState {
  valid: boolean;
  format: string;
  finished: boolean;
  teams: SeriesTeam[];
  games: SeriesGame[];
}

// Get series state for live match data
export const getSeriesState = async (seriesId: string): Promise<SeriesState | null> => {
  try {
    console.log(`🔄 Fetching series state for ${seriesId} from backend...`);
    const response = await axios.get(`${API_BASE_URL}/api/grid/series-state/${seriesId}`);

    if (response.status === 200 && response.data) {
      console.log(`✅ Successfully fetched series state for ${seriesId}`);
      return response.data;
    }

    return null;
  } catch (error: any) {
    console.error(`Error fetching series state for ${seriesId}:`, error);

    if (error.response?.status === 429) {
      console.warn('⚠️ Backend is rate limited, may be serving cached data');
    }

    if (error.response?.status === 404) {
      console.warn(`⚠️ Series ${seriesId} not found`);
    }

    return null;
  }
};