const axios = require('axios');
require('dotenv').config();

async function testGameStats() {
  try {
    const query = `query GetGameStats($titleId: ID!, $filter: GameStatisticsFilter!) {
      gameStatistics(titleId: $titleId, filter: $filter) {
        count
        games {
          gameId
          seriesId
          team1Id
          team2Id
          team1Score
          team2Score
          winnerId
          startTime
          endTime
          map {
            name
          }
        }
      }
    }`;

    const response = await axios.post('https://api-op.grid.gg/statistics-feed/graphql', {
      query,
      variables: {
        titleId: 'cs2',
        filter: {
          teamId: '1',
          startedAt: { period: 'LAST_30_DAYS' }
        }
      }
    }, {
      headers: {
        'x-api-key': process.env.VITE_GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('Game stats response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testGameStats();