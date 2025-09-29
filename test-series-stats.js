const axios = require('axios');
require('dotenv').config();

async function testSeriesStats() {
  try {
    const query = `query GetSeriesStats($titleId: ID!, $filter: SeriesStatisticsFilter!) {
      seriesStatistics(titleId: $titleId, filter: $filter) {
        id
        title
        startTime
        endTime
        status
        teams {
          id
          name
        }
        score {
          team1
          team2
        }
        winner {
          id
          name
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

    console.log('Series stats response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testSeriesStats();