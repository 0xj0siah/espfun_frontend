import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { getDetailedPlayerStatistics, getSeriesState } from '../utils/api';
import { fetchUpcomingMatches, fetchLiveAndRecentMatches } from '../utils/gridApi';

export default function ApiDebugTester() {
  const [loading, setLoading] = useState(false);
  const [testPlayerId, setTestPlayerId] = useState('120868'); // apEX's gridID
  const [testSeriesId, setTestSeriesId] = useState('');

  const runApiTests = async () => {
    setLoading(true);
    console.log('🧪 Testing Backend-Proxied Grid API functions with Player ID:', testPlayerId);

    try {
      console.log('🎮 Testing getDetailedPlayerStatistics (via backend)...');
      const playerStats = await getDetailedPlayerStatistics(testPlayerId);
      console.log('✅ Player stats result:', playerStats);
    } catch (error) {
      console.error('❌ Player stats error:', error);
    }

    try {
      console.log('🏆 Testing fetchUpcomingMatches (via backend)...');
      const upcomingMatches = await fetchUpcomingMatches();
      console.log('✅ Upcoming matches result:', upcomingMatches);
    } catch (error) {
      console.error('❌ Upcoming matches error:', error);
    }

    try {
      console.log('📊 Testing fetchLiveAndRecentMatches (via backend)...');
      const liveMatches = await fetchLiveAndRecentMatches();
      console.log('✅ Live/recent matches result:', liveMatches);

      // If we got matches, test series state with the first match
      if (liveMatches.length > 0 && liveMatches[0].id) {
        const firstSeriesId = liveMatches[0].id;
        console.log(`🎯 Testing getSeriesState for series ${firstSeriesId} (via backend)...`);
        const seriesState = await getSeriesState(firstSeriesId);
        console.log('✅ Series state result:', seriesState);
      }
    } catch (error) {
      console.error('❌ Live matches error:', error);
    }

    // Test custom series ID if provided
    if (testSeriesId) {
      try {
        console.log(`🎯 Testing getSeriesState for custom series ${testSeriesId} (via backend)...`);
        const seriesState = await getSeriesState(testSeriesId);
        console.log('✅ Series state result:', seriesState);
      } catch (error) {
        console.error('❌ Series state error:', error);
      }
    }

    setLoading(false);
    console.log('✅ All API tests complete!');
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🔧 API Debug Tester (Backend-Proxied)</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Test the Grid.gg API functions proxied through backend with caching and fallback
      </p>

      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Player Grid ID:</label>
          <input
            type="text"
            value={testPlayerId}
            onChange={(e) => setTestPlayerId(e.target.value)}
            className="px-3 py-1 border rounded text-sm w-32"
            placeholder="120868"
          />
          <span className="text-xs text-muted-foreground">(e.g., 120868 for apEX)</span>
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Series ID (optional):</label>
          <input
            type="text"
            value={testSeriesId}
            onChange={(e) => setTestSeriesId(e.target.value)}
            className="px-3 py-1 border rounded text-sm w-32"
            placeholder=""
          />
          <span className="text-xs text-muted-foreground">(leave empty to auto-detect from matches)</span>
        </div>

        <Button onClick={runApiTests} disabled={loading}>
          {loading ? '🧪 Testing...' : '🚀 Run Backend API Tests'}
        </Button>

        <div className="text-sm text-muted-foreground">
          Check the browser console (F12) for detailed test results!
          <br />
          All Grid API calls now route through the backend with caching and fallback support.
        </div>
      </div>
    </Card>
  );
}