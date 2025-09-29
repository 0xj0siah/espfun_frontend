const { getRecentMatches } = require('./src/utils/api.ts');

async function testUpdatedGetRecentMatches() {
  console.log('Testing updated getRecentMatches function...');

  try {
    // Test with a team ID that should work with the series state API
    const matches = await getRecentMatches('DOTA-1');

    console.log(`\n✅ Retrieved ${matches.length} matches:`);
    matches.forEach((match, index) => {
      console.log(`\nMatch ${index + 1}:`);
      console.log(`  ID: ${match.id}`);
      console.log(`  Game: ${match.game}`);
      console.log(`  Tournament: ${match.tournament}`);
      console.log(`  Opponent: ${match.opponent}`);
      console.log(`  Result: ${match.result}`);
      console.log(`  Score: ${match.score}`);
      console.log(`  Performance: ${match.performance}`);
      console.log(`  Date: ${match.date}`);
    });

    // Check if we got individual matches (not aggregated)
    const hasIndividualMatches = matches.some(match => !match.opponent.includes('Various Teams'));
    if (hasIndividualMatches) {
      console.log('\n🎉 SUCCESS: Got individual match results with opponent names!');
    } else {
      console.log('\n⚠️  Still showing aggregated results, need to debug further');
    }

  } catch (error) {
    console.error('❌ Error testing getRecentMatches:', error);
  }
}

testUpdatedGetRecentMatches();