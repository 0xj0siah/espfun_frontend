import { useState, useCallback } from 'react';
import { GridDetailedPlayerStats, SeriesState, getDetailedPlayerStatistics, getTeamStatistics, getSeriesState } from '../utils/api';

interface PlayerCache {
  timestamp: number;
  stats: GridDetailedPlayerStats;
}

interface TeamCache {
  timestamp: number;
  seriesIds: string[];
}

interface SeriesCache {
  timestamp: number;
  data: SeriesState;
}

// Cache expiration time (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;

// Local storage keys
const STORAGE_KEYS = {
  PLAYER_STATS: 'grid_player_stats_cache',
  TEAM_SERIES: 'grid_team_series_cache',
  SERIES_STATE: 'grid_series_state_cache'
};

// Load cache from localStorage or initialize empty
const loadCache = <T>(key: string): Map<string, T> => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return new Map(JSON.parse(stored));
    }
  } catch (err) {
    console.warn(`Failed to load cache for ${key}:`, err);
  }
  return new Map();
};

// Save cache to localStorage
const saveCache = <T>(key: string, cache: Map<string, T>) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(cache.entries())));
  } catch (err) {
    console.warn(`Failed to save cache for ${key}:`, err);
  }
};

// Global cache storage
const playerStatsCache = loadCache<PlayerCache>(STORAGE_KEYS.PLAYER_STATS);
const teamSeriesCache = loadCache<TeamCache>(STORAGE_KEYS.TEAM_SERIES);
const seriesStateCache = loadCache<SeriesCache>(STORAGE_KEYS.SERIES_STATE);

export function useGridCache() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getCachedPlayerStats = useCallback(async (gridId: string): Promise<GridDetailedPlayerStats | null> => {
    const now = Date.now();
    const cached = playerStatsCache.get(gridId);

    // Return cached data if it exists and hasn't expired
    if (cached && (now - cached.timestamp) < CACHE_EXPIRATION) {
      console.log('📦 Using cached player stats for', gridId);
      return cached.stats;
    }

    try {
      console.log('🔄 Fetching fresh player stats for', gridId);
      const stats = await getDetailedPlayerStatistics(gridId);
      if (stats) {
        playerStatsCache.set(gridId, {
          timestamp: now,
          stats
        });
        saveCache(STORAGE_KEYS.PLAYER_STATS, playerStatsCache);
      }
      return stats;
    } catch (err) {
      console.error('Error fetching player stats:', err);
      setError(err as Error);
      return null;
    }
  }, []);

  const getCachedTeamSeries = useCallback(async (teamGridId: string): Promise<string[]> => {
    const now = Date.now();
    const cached = teamSeriesCache.get(teamGridId);

    if (cached && (now - cached.timestamp) < CACHE_EXPIRATION) {
      console.log('📦 Using cached team series IDs for', teamGridId);
      return cached.seriesIds;
    }

    try {
      console.log('🔄 Fetching fresh team series IDs for', teamGridId);
      const seriesIds = await getTeamStatistics(teamGridId);
      if (seriesIds) {
        teamSeriesCache.set(teamGridId, {
          timestamp: now,
          seriesIds
        });
        saveCache(STORAGE_KEYS.TEAM_SERIES, teamSeriesCache);
      }
      return seriesIds || [];
    } catch (err) {
      console.error('Error fetching team series:', err);
      setError(err as Error);
      return [];
    }
  }, []);

  const getCachedSeriesState = useCallback(async (seriesId: string): Promise<SeriesState | null> => {
    const now = Date.now();
    const cached = seriesStateCache.get(seriesId);

    if (cached && (now - cached.timestamp) < CACHE_EXPIRATION) {
      console.log('📦 Using cached series state for', seriesId);
      return cached.data;
    }

    try {
      console.log('🔄 Fetching fresh series state for', seriesId);
      const state = await getSeriesState(seriesId);
      if (state) {
        seriesStateCache.set(seriesId, {
          timestamp: now,
          data: state
        });
        saveCache(STORAGE_KEYS.SERIES_STATE, seriesStateCache);
      }
      return state;
    } catch (err) {
      console.error('Error fetching series state:', err);
      setError(err as Error);
      return null;
    }
  }, []);

  // Utility function to load all data for a player
  const loadPlayerData = useCallback(async (gridId: string, teamGridId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Load player stats
      const stats = await getCachedPlayerStats(gridId);

      // Load team series IDs
      const seriesIds = await getCachedTeamSeries(teamGridId);

      // Load series states in parallel
      const seriesStates = await Promise.all(
        seriesIds.map(id => getCachedSeriesState(id))
      );

      // Filter out null values and only keep finished matches
      const validSeriesStates = seriesStates.filter((series): series is SeriesState => 
        series !== null && series.finished
      );

      return {
        stats,
        seriesStates: validSeriesStates
      };
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getCachedPlayerStats, getCachedTeamSeries, getCachedSeriesState]);

  return {
    getCachedPlayerStats,
    getCachedTeamSeries,
    getCachedSeriesState,
    loadPlayerData,
    isLoading,
    error
  };
}