import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://espfun-backend.vercel.app';
const GRID_API_KEY = import.meta.env.VITE_GRID_API_KEY;
const GRID_BASE_URL = 'https://api-op.grid.gg';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Grid.gg GraphQL client
const gridGraphQLRequest = async (endpoint: string, query: string, variables?: any) => {
  const fullUrl = `${GRID_BASE_URL}${endpoint}`;
  console.log(`🔗 Making request to: ${fullUrl}`);
  console.log(`🔑 API Key present: ${!!GRID_API_KEY}`);

  try {
    const response = await axios.post(fullUrl, {
      query,
      variables
    }, {
      headers: {
        'x-api-key': GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    console.log(`✅ HTTP ${response.status}: ${response.statusText}`);
    return response.data;
  } catch (error: any) {
    console.error('❌ Grid.gg API HTTP error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

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

// Grid.gg API functions for esports data
export const getPlayerStatistics = async (playerIds: string[]): Promise<GridPlayerStats[]> => {
  const query = `
    query GetPlayerStatistics($playerIds: [ID!]!) {
      players(ids: $playerIds) {
        id
        statistics {
          kills
          deaths
          assists
          rating
          winRate
        }
      }
    }
  `;

  try {
    const response = await gridGraphQLRequest('/statistics-feed/graphql', query, { playerIds });
    return response.data.players.map((player: any) => ({
      playerId: player.id,
      kills: player.statistics.kills,
      deaths: player.statistics.deaths,
      assists: player.statistics.assists,
      rating: player.statistics.rating,
      winRate: player.statistics.winRate,
    }));
  } catch (error) {
    console.error('Error fetching player statistics:', error);
    return [];
  }
};

export const getDetailedPlayerStatistics = async (playerId: string): Promise<GridDetailedPlayerStats | null> => {
  const query = `
    query GetDetailedPlayerStatistics($playerId: ID!, $filter: PlayerStatisticsFilter!) {
      playerStatistics(playerId: $playerId, filter: $filter) {
        id
        series {
          count
          kills {
            sum
            avg
            min
            max
            ratePerMinute {
              min
              max
              avg
            }
          }
          deaths {
            sum
            avg
            min
            max
            ratePerMinute {
              min
              max
              avg
            }
          }
          killAssistsGiven {
            sum
            avg
            min
            max
            ratePerMinute {
              min
              max
              avg
            }
          }
          wins {
            value
            count
            percentage
          }
        }
        game {
          count
          kills {
            sum
            avg
            min
            max
            ratePerMinute {
              min
              max
              avg
            }
          }
          deaths {
            sum
            avg
            min
            max
            ratePerMinute {
              min
              max
              avg
            }
          }
          killAssistsGiven {
            sum
            avg
            min
            max
            ratePerMinute {
              min
              max
              avg
            }
          }
          wins {
            value
            count
            percentage
          }
        }
      }
    }
  `;

  // Filter for last 6 months of data
  const variables = {
    playerId,
    filter: {
      startedAt: {
        period: "LAST_6_MONTHS"
      }
    }
  };

  try {
    const response = await gridGraphQLRequest('/statistics-feed/graphql', query, variables);

    if (!response) {
      console.error('No response from Grid.gg API');
      return null;
    }

    if (!response.data) {
      console.error('No data property in Grid.gg API response');
      return null;
    }

    if (response.data.errors) {
      console.error('GraphQL errors in response:', response.data.errors);
      return null;
    }

    return response.data.playerStatistics;
  } catch (error) {
    console.error('Error fetching detailed player statistics:', error);
    return null;
  }
};

// Get team statistics to retrieve recent series IDs for matches
export const getTeamStatistics = async (teamId: string): Promise<string[]> => {
  const query = `
    query GetTeamStatistics($teamId: ID!, $filter: TeamStatisticsFilter!) {
      teamStatistics(teamId: $teamId, filter: $filter) {
        id
        aggregationSeriesIds
      }
    }
  `;

  // Filter for last 3 months of data to get recent matches
  const variables = {
    teamId,
    filter: {
      startedAt: {
        period: "LAST_3_MONTHS"
      }
    }
  };

  try {
    const response = await gridGraphQLRequest('/statistics-feed/graphql', query, variables);

    if (!response) {
      console.error('No response from Grid.gg API for team statistics');
      return [];
    }

    if (!response.data) {
      console.error('No data property in Grid.gg API response for team statistics');
      return [];
    }

    if (response.data.errors) {
      console.error('GraphQL errors in team statistics response:', response.data.errors);
      return [];
    }

    const teamStats = response.data.teamStatistics;
    if (!teamStats || !teamStats.aggregationSeriesIds) {
      console.warn(`No aggregation series IDs found for team ${teamId}`);
      return [];
    }

    console.log(`✅ Found ${teamStats.aggregationSeriesIds.length} series IDs for team ${teamId}`);
    return teamStats.aggregationSeriesIds;
  } catch (error) {
    console.error('Error fetching team statistics:', error);
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
  const query = `
    query GetSeriesState($id: ID!) {
      seriesState(id: $id) {
        valid
        format
        finished
        teams {
          id
          name
          won
          score
        }
        games {
          finished
          teams {
            name
            won
          }
        }
      }
    }
  `;

  const variables = { id: seriesId };

  try {
    const response = await gridGraphQLRequest('/live-data-feed/series-state/graphql', query, variables);

    if (!response) {
      console.error('No response from Grid.gg Series State API');
      return null;
    }

    if (!response.data) {
      console.error('No data property in Grid.gg Series State API response');
      return null;
    }

    if (response.data.errors) {
      console.error('GraphQL errors in series state response:', response.data.errors);
      return null;
    }

    return response.data.seriesState;
  } catch (error) {
    console.error('Error fetching series state:', error);
    return null;
  }
};