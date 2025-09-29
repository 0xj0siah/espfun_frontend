const axios = require('axios');
require('dotenv').config();

const query = `query GetDetailedPlayerStatistics($playerId: ID!, $filter: PlayerStatisticsFilter!) {
  playerStatistics(playerId: $playerId, filter: $filter) {
    id
    series {
      count
      kills { avg }
      deaths { avg }
      killAssistsGiven { avg }
      wins { value count percentage }
    }
  }
}`;

const variables = {
  playerId: '120868',
  filter: {
    startedAt: {
      period: "LAST_6_MONTHS"
    }
  }
};

async function testAPI() {
  try {
    console.log('Testing Grid.gg API with statistics-feed endpoint...');
    console.log('API Key:', process.env.VITE_GRID_API_KEY ? 'Set' : 'Not set');

    const response = await axios.post('https://api-op.grid.gg/statistics-feed/graphql', {
      query,
      variables
    }, {
      headers: {
        'x-api-key': process.env.VITE_GRID_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('Success! API Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
  }
}

testAPI();