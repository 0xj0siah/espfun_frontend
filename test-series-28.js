const axios = require('axios');
require('dotenv').config();

const SERIES_STATE_URL = 'https://api-op.grid.gg/live-data-feed/series-state/graphql';
const API_KEY = process.env.VITE_GRID_API_KEY;

async function testSeries28() {
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
        valid
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
          map {
            name
          }
          teams {
            id
            name
            side
            won
            score
            kills
            deaths
          }
        }
        updatedAt
        startedAt
        duration
      }
    }
  `;

  try {
    console.log('Testing series 28...');
    const response = await axios.post(SERIES_STATE_URL, {
      query,
      variables: { id: '28' }
    }, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('Response status:', response.status);
    console.log('Response data keys:', Object.keys(response.data));
    console.log('Response data.data keys:', Object.keys(response.data.data || {}));

    if (response.data.data && response.data.data.seriesState) {
      const series = response.data.data.seriesState;
      console.log('Series title:', series.title?.nameShortened);
      console.log('Series format:', series.format);
      console.log('Number of games:', series.games?.length || 0);
      console.log('Games:', JSON.stringify(series.games, null, 2));
    } else {
      console.log('No seriesState found');
      console.log('Full response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.statusText);
    console.error('Error data:', error.response?.data);
  }
}

testSeries28();