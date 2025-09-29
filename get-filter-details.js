const axios = require('axios');
require('dotenv').config();

async function getGameStateFilter() {
  try {
    const query = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
            description
            enumValues {
              name
              description
            }
            inputFields {
              name
              type {
                name
                kind
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

    console.log('GameStateFilter details:');
    const gameStateFilter = response.data.data.__schema.types.find(type => type.name === 'GameStateFilter');
    if (gameStateFilter) {
      console.log(`Type: ${gameStateFilter.kind}`);
      console.log(`Description: ${gameStateFilter.description || 'No description'}`);
      if (gameStateFilter.enumValues && gameStateFilter.enumValues.length > 0) {
        console.log('Enum values:');
        gameStateFilter.enumValues.forEach(value => {
          console.log(`- ${value.name}: ${value.description || 'No description'}`);
        });
      }
    }

    // Also look for the return type of teamGameStatistics
    const teamGameStatsField = response.data.data.__schema.types
      .find(type => type.name === 'Query')
      ?.fields?.find(field => field.name === 'teamGameStatistics');

    if (teamGameStatsField) {
      console.log(`\nteamGameStatistics return type: ${teamGameStatsField.type.name || teamGameStatsField.type.kind}`);
      if (teamGameStatsField.type.ofType) {
        console.log(`Of type: ${teamGameStatsField.type.ofType.name || teamGameStatsField.type.ofType.kind}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getGameStateFilter();