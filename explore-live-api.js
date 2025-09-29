const axios = require('axios');
require('dotenv').config();

async function exploreLiveDataAPI() {
  try {
    const response = await axios.post('https://api-op.grid.gg/live-data-feed/series-state/graphql', {
      query: `query { __schema { queryType { fields { name description args { name type { name } } } } } }`
    }, {
      headers: {
        'x-api-key': process.env.VITE_GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const fields = response.data.data.__schema.queryType.fields;
    const matchFields = fields.filter(f => f.name.toLowerCase().includes('match') ||
                                          f.name.toLowerCase().includes('series') ||
                                          f.name.toLowerCase().includes('game'));

    console.log('Live data feed queries:');
    matchFields.forEach(field => {
      console.log(`- ${field.name}: ${field.description || 'No description'}`);
      if (field.args.length > 0) {
        console.log('  Args:', field.args.map(a => `${a.name}: ${a.type.name}`).join(', '));
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

exploreLiveDataAPI();