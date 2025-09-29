import { getPlayerGameStatistics, getRecentMatches } from './api.js';

// Test data - replace with actual player IDs from your app
const testPlayerIds = [
  '12345', // Replace with actual Grid.gg player ID
  '67890', // Replace with another player ID
];

async function testPlayerGameStatistics() {
  console.log('🧪 Testing getPlayerGameStatistics function...\n');

  for (const playerId of testPlayerIds) {
    console.log(`🎮 Testing player ID: ${playerId}`);
    console.log('='.repeat(50));

    try {
      const result = await getPlayerGameStatistics(playerId);
      console.log('✅ API Response:', JSON.stringify(result, null, 2));

      if (result?.games && result.games.length > 0) {
        console.log(`🎯 Found ${result.games.length} games for player ${playerId}`);
        console.log('📊 Sample game data:');
        console.log(JSON.stringify(result.games[0], null, 2));
      } else {
        console.log('❌ No games found for this player');
      }
    } catch (error) {
      console.error('❌ Error fetching player games:', error);
    }

    console.log('\n' + '-'.repeat(50) + '\n');
  }
}

async function testRecentMatches() {
  console.log('🧪 Testing getRecentMatches function (fallback)...\n');

  for (const teamId of testPlayerIds) {
    console.log(`🏆 Testing team ID: ${teamId}`);
    console.log('='.repeat(50));

    try {
      const result = await getRecentMatches(teamId);
      console.log('✅ API Response:', JSON.stringify(result, null, 2));

      if (result && result.length > 0) {
        console.log(`🎯 Found ${result.length} matches for team ${teamId}`);
      } else {
        console.log('❌ No matches found for this team');
      }
    } catch (error) {
      console.error('❌ Error fetching team matches:', error);
    }

    console.log('\n' + '-'.repeat(50) + '\n');
  }
}

async function testDataTransformation() {
  console.log('🧪 Testing data transformation logic...\n');

  // Mock data that should come from getPlayerGameStatistics
  const mockPlayerStats = {
    games: [
      {
        id: 'game1',
        startedAt: '2024-01-15T10:00:00Z',
        finished: true,
        map: { name: 'Dust2' },
        kills: 18,
        deaths: 12,
        killAssistsGiven: 5,
        score: 85,
        won: true,
        team: { id: 'team1', name: 'Team Liquid' },
        opponentTeam: { id: 'team2', name: 'FaZe Clan' }
      },
      {
        id: 'game2',
        startedAt: '2024-01-14T15:30:00Z',
        finished: true,
        map: { name: 'Mirage' },
        kills: 15,
        deaths: 18,
        killAssistsGiven: 3,
        score: 65,
        won: false,
        team: { id: 'team1', name: 'Team Liquid' },
        opponentTeam: { id: 'team3', name: 'Cloud9' }
      }
    ]
  };

  console.log('📝 Mock player stats input:');
  console.log(JSON.stringify(mockPlayerStats, null, 2));

  // Test the transformation logic from PlayerPurchaseModal
  if (mockPlayerStats?.games && mockPlayerStats.games.length > 0) {
    const matches = mockPlayerStats.games.slice(0, 4).map((game) => ({
      result: game.won ? 'win' : 'loss',
      opponent: game.opponentTeam?.name || 'Unknown Team',
      score: `${game.kills}/${game.deaths}/${game.killAssistsGiven}`,
      performance: game.score || 0
    }));

    console.log('🔄 Transformed matches output:');
    console.log(JSON.stringify(matches, null, 2));
  } else {
    console.log('❌ No games to transform');
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting API Debug Tests\n');
  console.log('='.repeat(60));
  console.log('📋 Make sure to set your VITE_GRID_API_KEY environment variable!');
  console.log('📋 Update testPlayerIds array with actual Grid.gg player IDs');
  console.log('='.repeat(60) + '\n');

  await testDataTransformation();
  await testPlayerGameStatistics();
  await testRecentMatches();

  console.log('✅ All tests completed!');
}

// Export for use in browser console or as module
if (typeof window !== 'undefined') {
  // Browser environment
  window.runApiTests = runAllTests;
  console.log('🌐 Browser mode: Call runApiTests() in console to run tests');
} else {
  // Node.js environment
  runAllTests().catch(console.error);
}