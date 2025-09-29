const axios = require('axios');
require('dotenv').config();

async function getTypesSchema() {
  try {
    const query = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
            description
            fields {
              name
              description
              type {
                name
                kind
                ofType {
                  name
                  kind
                  ofType {
                    name
                    kind
                  }
                }
              }
              args {
                name
                type {
                  name
                  kind
                }
              }
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

    console.log('All types:');
    response.data.data.__schema.types.forEach(type => {
      if (type.name === 'GameSelection') {
        console.log(`\nGameSelection (${type.kind}):`);
        console.log(`Description: ${type.description || 'No description'}`);
        if (type.inputFields && type.inputFields.length > 0) {
          console.log('Input fields:');
          type.inputFields.forEach(field => {
            console.log(`- ${field.name}: ${field.type.name || field.type.kind}`);
          });
        }
        if (type.fields && type.fields.length > 0) {
          console.log('Fields:');
          type.fields.forEach(field => {
            console.log(`- ${field.name}: ${field.type.name || field.type.kind}`);
          });
        }
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getTypesSchema();