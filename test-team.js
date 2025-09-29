const axios = require('axios');
require('dotenv').config();

async function testTeamQuery() {
  try {
    const query = `query GetTeam($id: ID!) {
      team(id: $id) {
        id
        name
        shortName
      }
    }`;

    const response = await axios.post('https://api-op.grid.gg/statistics-feed/graphql', {
      query,
      variables: { id: '1' }
    }, {
      headers: {
        'x-api-key': process.env.VITE_GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('Team query response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTeamQuery();