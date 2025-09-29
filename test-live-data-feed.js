const axios = require('axios');
require('dotenv').config();

const LIVE_DATA_FEED_URL = 'https://api-op.grid.gg/live-data-feed/graphql';
const CENTRAL_DATA_FEED_URL = 'https://api-op.grid.gg/central-data-feed/graphql';
const STATS_FEED_URL = 'https://api-op.grid.gg/statistics-feed/graphql';
const API_KEY = process.env.VITE_GRID_API_KEY;

async function testIntrospection(endpoint, name) {
  console.log(`Testing ${name} API introspection...`);

  const query = `
    query IntrospectionQuery {
      __schema {
        queryType {
          name
          fields {
            name
            description
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(endpoint, {
      query
    }, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log(`${name} API available queries:`);
    if (response.data?.data?.__schema?.queryType?.fields) {
      response.data.data.__schema.queryType.fields.forEach(field => {
        console.log(`- ${field.name}: ${field.description || 'No description'}`);
      });
    }
    return true;
  } catch (error) {
    console.error(`Error with ${name} API:`, error.response?.status, error.response?.statusText);
    return false;
  }
}

async function testSeriesStateQuery() {
  console.log('Testing seriesState query on Live Data Feed...');

  const query = `
    query GetSeriesState($id: ID!) {
      seriesState(id: $id) {
        id
        title {
          nameShortened
        }
        format
        started
        finished
        teams {
          id
          name
          score
          won
        }
        games {
          id
          sequenceNumber
          started
          finished
          teams {
            id
            name
            side
            won
            score
          }
        }
      }
    }
  `;

  // Try with a simple ID
  const seriesId = "1";

  try {
    const response = await axios.post(LIVE_DATA_FEED_URL, {
      query,
      variables: { id: seriesId }
    }, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Live Data Feed - Series State Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error with seriesState query:', error.response?.data || error.message);
  }
}

async function testLatestSeriesByPlayerQuery() {
  console.log('Testing latestSeriesStateByPlayerId query on Live Data Feed...');

  const query = `
    query GetLatestSeriesByPlayer($id: ID!) {
      latestSeriesStateByPlayerId(id: $id) {
        id
        title {
          nameShortened
        }
        format
        started
        finished
        teams {
          id
          name
          score
          won
        }
        games {
          id
          sequenceNumber
          started
          finished
          teams {
            id
            name
            side
            won
            score
          }
        }
      }
    }
  `;

  // Try with a simple player ID
  const playerId = "1";

  try {
    const response = await axios.post(LIVE_DATA_FEED_URL, {
      query,
      variables: { id: playerId }
    }, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('Live Data Feed - Latest Series by Player Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error with latestSeriesStateByPlayerId query:', error.response?.data || error.message);
  }
}

// Test all endpoints
async function runTests() {
  await testIntrospection(STATS_FEED_URL, 'Statistics Feed');
  await testIntrospection(CENTRAL_DATA_FEED_URL, 'Central Data Feed');
  await testIntrospection(LIVE_DATA_FEED_URL, 'Live Data Feed');

  // Test specific queries
  await testSeriesStateQuery();
  await testLatestSeriesByPlayerQuery();
}

runTests();