const axios = require('axios');
require('dotenv').config();

async function getDetailedTypes() {
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
            fields {
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

    // Find GameStateFilter
    const gameStateFilter = response.data.data.__schema.types.find(type => type.name === 'GameStateFilter');
    if (gameStateFilter) {
      console.log('GameStateFilter:');
      console.log(`Type: ${gameStateFilter.kind}`);
      console.log(`Description: ${gameStateFilter.description || 'No description'}`);
      if (gameStateFilter.inputFields && gameStateFilter.inputFields.length > 0) {
        console.log('Input fields:');
        gameStateFilter.inputFields.forEach(field => {
          console.log(`- ${field.name}: ${field.type.name || field.type.kind} (${field.description || 'No description'})`);
        });
      }
    }

    // Find the return type of teamGameStatistics
    const queryType = response.data.data.__schema.types.find(type => type.name === 'Query');
    const teamGameStatsField = queryType?.fields?.find(field => field.name === 'teamGameStatistics');
    if (teamGameStatsField) {
      const returnTypeName = teamGameStatsField.type.ofType?.name || teamGameStatsField.type.name;
      console.log(`\nteamGameStatistics return type: ${returnTypeName}`);

      // Find the actual return type details
      const returnType = response.data.data.__schema.types.find(type => type.name === returnTypeName);
      if (returnType) {
        console.log(`${returnTypeName} fields:`);
        returnType.fields?.forEach(field => {
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

getDetailedTypes();