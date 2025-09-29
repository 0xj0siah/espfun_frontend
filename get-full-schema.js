const axios = require('axios');
require('dotenv').config();

async function getSchema() {
  try {
    const query = `
      query IntrospectionQuery {
        __schema {
          queryType {
            name
            fields {
              name
              description
              args {
                name
                type {
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

    console.log('Available queries:');
    response.data.data.__schema.queryType.fields.forEach(field => {
      console.log(`- ${field.name}: ${field.description || 'No description'}`);
      if (field.args.length > 0) {
        console.log(`  Args: ${field.args.map(arg => `${arg.name}: ${arg.type.name || arg.type.kind}`).join(', ')}`);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getSchema();