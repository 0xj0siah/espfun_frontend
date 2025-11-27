import { GridMatch } from '../types/grid';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Helper function to fetch upcoming matches from backend (which proxies GRID API with caching)
export async function fetchUpcomingMatches(): Promise<GridMatch[]> {
  try {
    console.log('🔄 Fetching upcoming matches from backend...');
    const response = await fetch(`${API_BASE_URL}/api/grid/upcoming-matches?titleId=28&limit=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API response not ok:', errorText);

      // If rate limited or backend error, return empty array (backend serves cached data on rate limit)
      if (response.status === 429) {
        console.warn('⚠️ Backend is rate limited, returning empty array');
      }

      return [];
    }

    const responseData = await response.json();
    console.log('✅ Backend upcoming matches response:', responseData);

    // Backend returns { titleId, limit, matches, count }
    if (!responseData?.matches || !Array.isArray(responseData.matches)) {
      console.error('Invalid backend response structure:', responseData);
      return [];
    }

    return responseData.matches;
  } catch (error) {
    console.error('Error fetching upcoming matches from backend:', error);
    return [];
  }
}

// Helper function to fetch live and recent matches (past 12 hours) from backend (which proxies GRID API with caching)
export async function fetchLiveAndRecentMatches(): Promise<GridMatch[]> {
  try {
    console.log('🔄 Fetching live/recent matches from backend...');
    const response = await fetch(`${API_BASE_URL}/api/grid/live-recent-matches?titleId=28&limit=20`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API response not ok:', errorText);

      // If rate limited or backend error, return empty array (backend serves cached data on rate limit)
      if (response.status === 429) {
        console.warn('⚠️ Backend is rate limited, returning empty array');
      }

      return [];
    }

    const responseData = await response.json();
    console.log('✅ Backend live/recent matches response:', responseData);

    // Backend returns { titleId, limit, matches, count }
    if (!responseData?.matches || !Array.isArray(responseData.matches)) {
      console.error('Invalid backend response structure:', responseData);
      return [];
    }

    return responseData.matches;
  } catch (error) {
    console.error('Error fetching live/recent matches from backend:', error);
    return [];
  }
}