const axios = require('axios');
require('dotenv').config();

async function getSeriesBySeriesSchema() {
  try {
    const query = `query {
      __type(name: "SeriesStatisticsBySeries") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
          description
        }
      }
    }`;

    const response = await axios.post('https://api-op.grid.gg/statistics-feed/graphql', {
      query
    }, {
      headers: {
        'x-api-key': process.env.VITE_GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('SeriesStatisticsBySeries type schema:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

getSeriesBySeriesSchema();