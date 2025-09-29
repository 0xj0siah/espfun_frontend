import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { getDetailedPlayerStatistics, getLiveMatches } from '../utils/api';

export default function ApiDebugTester() {
  const [loading, setLoading] = useState(false);
  const [testPlayerId, setTestPlayerId] = useState('120868'); // apEX's gridID

  const runApiTests = async () => {
    setLoading(true);
    console.log('🧪 Testing API functions with Player ID:', testPlayerId);

    try {
      console.log('🎮 Testing getDetailedPlayerStatistics...');
      const playerStats = await getDetailedPlayerStatistics(testPlayerId);
      console.log('✅ Player stats result:', playerStats);
    } catch (error) {
      console.error('❌ Player stats error:', error);
    }

    try {
      console.log('🏆 Testing getLiveMatches...');
      const liveMatches = await getLiveMatches();
      console.log('✅ Live matches result:', liveMatches);
    } catch (error) {
      console.error('❌ Live matches error:', error);
    }

    setLoading(false);
    console.log('✅ API testing complete!');
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🔧 API Debug Tester</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Test the Grid.gg API functions to debug recent matches issues
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

        <Button onClick={runApiTests} disabled={loading}>
          {loading ? '🧪 Testing...' : '🚀 Run API Tests'}
        </Button>

        <div className="text-sm text-muted-foreground">
          Check the browser console (F12) for detailed test results!
        </div>
      </div>
    </Card>
  );
}