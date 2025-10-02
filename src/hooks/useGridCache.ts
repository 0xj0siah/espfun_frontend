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

// Cache expiration time (48 hours)
const CACHE_EXPIRATION = 48 * 60 * 60 * 1000;

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

  const isValidPlayerStats = (stats: GridDetailedPlayerStats | null): stats is GridDetailedPlayerStats => {
    return !!(stats && stats.game && stats.series);
  };

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

      // If we get valid data from the API, update the cache
      if (isValidPlayerStats(stats)) {
        // Only update cache if data is different
        if (!cached || JSON.stringify(cached.stats) !== JSON.stringify(stats)) {
          console.log('📝 Updating cached player stats with new data');
          playerStatsCache.set(gridId, {
            timestamp: now,
            stats: stats
          });
          saveCache(STORAGE_KEYS.PLAYER_STATS, playerStatsCache);
        }
        return stats;
      }
      
      // If API returns invalid data but we have valid cached data, keep using cache
      if (cached) {
        console.log('⚠️ API returned invalid data, using cached data');
        return cached.stats;
      }

      // No valid data from API and no cache
      return null;
    } catch (err) {
      console.error('Error fetching player stats:', err);
      setError(err as Error);
      // Return cached data if available on error
      return cached ? cached.stats : null;
    }
  }, []);

  const isValidTeamSeries = (seriesIds: string[] | null): seriesIds is string[] => {
    return Array.isArray(seriesIds) && seriesIds.every(id => typeof id === 'string');
  };

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

      // If we get valid data from the API, update the cache
      if (isValidTeamSeries(seriesIds)) {
        // Only update cache if data is different
        if (!cached || JSON.stringify(cached.seriesIds) !== JSON.stringify(seriesIds)) {
          console.log('📝 Updating cached team series with new data');
          teamSeriesCache.set(teamGridId, {
            timestamp: now,
            seriesIds
          });
          saveCache(STORAGE_KEYS.TEAM_SERIES, teamSeriesCache);
        }
        return seriesIds;
      }
      
      // If API returns invalid data but we have valid cached data, keep using cache
      if (cached) {
        console.log('⚠️ API returned invalid data, using cached data');
        return cached.seriesIds;
      }

      // No valid data from API and no cache
      return [];
    } catch (err) {
      console.error('Error fetching team series:', err);
      setError(err as Error);
      // Return cached data if available on error
      return cached ? cached.seriesIds : [];
    }
  }, []);

  const isValidSeriesState = (state: SeriesState | null): state is SeriesState => {
    return !!(state && 'valid' in state && 'finished' in state && Array.isArray(state.teams));
  };

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

      // If we get valid data from the API, update the cache
      if (isValidSeriesState(state)) {
        // Only update cache if data is different
        if (!cached || JSON.stringify(cached.data) !== JSON.stringify(state)) {
          console.log('📝 Updating cached series state with new data');
          seriesStateCache.set(seriesId, {
            timestamp: now,
            data: state
          });
          saveCache(STORAGE_KEYS.SERIES_STATE, seriesStateCache);
        }
        return state;
      }
      
      // If API returns invalid data but we have valid cached data, keep using cache
      if (cached) {
        console.log('⚠️ API returned invalid data, using cached data');
        return cached.data;
      }

      // No valid data from API and no cache
      return null;
    } catch (err) {
      console.error('Error fetching series state:', err);
      setError(err as Error);
      // Return cached data if available on error
      return cached ? cached.data : null;
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