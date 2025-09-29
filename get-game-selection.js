const axios = require('axios');
require('dotenv').config();

async function getGameSelectionSchema() {
  try {
    const query = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
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

    console.log('Looking for GameSelection type:');
    const gameSelectionType = response.data.data.__schema.types.find(type => type.name === 'GameSelection');
    if (gameSelectionType) {
      console.log('GameSelection fields:');
      gameSelectionType.fields.forEach(field => {
        console.log(`- ${field.name}: ${field.type.name || field.type.kind}`);
      });
    } else {
      console.log('GameSelection type not found');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getGameSelectionSchema();