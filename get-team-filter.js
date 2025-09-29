const axios = require('axios');
require('dotenv').config();

async function getGameTeamStateFilter() {
  try {
    const query = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
            description
            inputFields {
              name
              description
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios.post('https://api-op.grid.gg/statistics-feed/graphql', {
      query
    }, {
      headers: {
        'x-api-key': process.env.VITE_GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const gameTeamStateFilter = response.data.data.__schema.types.find(type => type.name === 'GameTeamStateFilter');
    if (gameTeamStateFilter) {
      console.log('GameTeamStateFilter:');
      console.log(`Type: ${gameTeamStateFilter.kind}`);
      console.log(`Description: ${gameTeamStateFilter.description || 'No description'}`);
      if (gameTeamStateFilter.inputFields && gameTeamStateFilter.inputFields.length > 0) {
        console.log('Input fields:');
        gameTeamStateFilter.inputFields.forEach(field => {
          console.log(`- ${field.name}: ${field.type.name || field.type.kind} (${field.description || 'No description'})`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getGameTeamStateFilter();