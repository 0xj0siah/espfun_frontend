// Browser Console Test Script for Grid.gg API Debugging
// Run this in the browser console to test API functions

// Import the functions (this assumes they're available globally or through window)
const { getPlayerGameStatistics, getRecentMatches } = window;

// Test function
window.testApiDebug = async (playerId = '12345') => {
  console.log(`🧪 Testing API functions with player/team ID: ${playerId}`);
  console.log('='.repeat(60));

  // Test 1: getPlayerGameStatistics
  console.log('🎮 Testing getPlayerGameStatistics...');
  try {
    const playerStats = await getPlayerGameStatistics(playerId);
    console.log('✅ Player Game Statistics:', playerStats);

    if (playerStats?.games) {
      console.log(`📊 Found ${playerStats.games.length} individual games`);

      // Show sample games
      playerStats.games.slice(0, 3).forEach((game, index) => {
        console.log(`🏆 Game ${index + 1}: ${game.team?.name} vs ${game.opponentTeam?.name}`);
        console.log(`   KDA: ${game.kills}/${game.deaths}/${game.killAssistsGiven}`);
        console.log(`   Result: ${game.won ? 'WIN' : 'LOSS'}`);
        console.log(`   Map: ${game.map?.name}`);
        console.log(`   Score: ${game.score}`);
      });

      // Test transformation
      console.log('🔄 Testing data transformation...');
      const transformed = playerStats.games.slice(0, 4).map(game => ({
        result: game.won ? 'win' : 'loss',
        opponent: game.opponentTeam?.name || 'Unknown Team',
        score: `${game.kills}/${game.deaths}/${game.killAssistsGiven}`,
        performance: game.score || 0
      }));
      console.log('✅ Transformed data:', transformed);

    } else {
      console.log('❌ No games found in player statistics');
    }
  } catch (error) {
    console.error('❌ getPlayerGameStatistics failed:', error);
  }

  console.log('\n' + '-'.repeat(30) + '\n');

  // Test 2: getRecentMatches (fallback)
  console.log('🏆 Testing getRecentMatches (fallback)...');
  try {
    const teamMatches = await getRecentMatches(playerId);
    console.log('✅ Team Recent Matches:', teamMatches);

    if (Array.isArray(teamMatches) && teamMatches.length > 0) {
      console.log(`📊 Found ${teamMatches.length} team matches`);

      // Show sample matches
      teamMatches.slice(0, 3).forEach((match, index) => {
        console.log(`🏆 Match ${index + 1}: vs ${match.opponent}`);
        console.log(`   Result: ${match.result.toUpperCase()}`);
        console.log(`   Score: ${match.score}`);
        console.log(`   Performance: ${match.performance} pts`);
      });
    } else {
      console.log('❌ No team matches found');
    }
  } catch (error) {
    console.error('❌ getRecentMatches failed:', error);
  }

  console.log('\n✅ API testing complete!');
  console.log('💡 Check the console output above for detailed results');
};

// Helper function to test with different IDs
window.testMultipleIds = async (ids = ['12345', '67890', '11111']) => {
  for (const id of ids) {
    await window.testApiDebug(id);
    console.log('\n' + '='.repeat(80) + '\n');
  }
};

// Quick test with default ID
console.log('🚀 API Debug Tools Loaded!');
console.log('💡 Run: testApiDebug("playerId") to test a specific player/team ID');
console.log('💡 Run: testMultipleIds(["id1", "id2"]) to test multiple IDs');
console.log('💡 Run: testApiDebug() to test with default ID (12345)');