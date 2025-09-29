const axios = require('axios');
require('dotenv').config();

async function testSeriesQuery() {
  try {
    const query = `
      query GetTeamSeries($teamId: ID!) {
        teamSeries(teamId: $teamId, first: 10) {
          edges {
            node {
              id
              title
              startTime
              endTime
              status
              teams {
                id
                name
              }
              games {
                id
                map {
                  name
                }
                status
                score {
                  team1
                  team2
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios.post('https://api-op.grid.gg/statistics-feed/graphql', {
      query,
      variables: { teamId: '1' }
    }, {
      headers: {
        'x-api-key': process.env.VITE_GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('Series query response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testSeriesQuery();