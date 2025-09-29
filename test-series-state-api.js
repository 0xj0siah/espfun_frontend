const axios = require('axios');
require('dotenv').config();

const SERIES_STATE_URL = 'https://api-op.grid.gg/live-data-feed/series-state/graphql';
const API_KEY = process.env.VITE_GRID_API_KEY;

async function testSeriesStateAPI() {
  console.log('Testing Series State API at:', SERIES_STATE_URL);

  // Test introspection first
  const introspectionQuery = `
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
    console.log('\n1. Testing API availability with introspection...');
    const response = await axios.post(SERIES_STATE_URL, {
      query: introspectionQuery
    }, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Series State API is accessible!');
    console.log('Available queries:');
    if (response.data?.data?.__schema?.queryType?.fields) {
      response.data.data.__schema.queryType.fields.forEach(field => {
        console.log(`- ${field.name}: ${field.description || 'No description'}`);
      });
    }

  } catch (error) {
    console.log('❌ Series State API introspection failed:', error.response?.status, error.response?.statusText || error.message);
    return;
  }

  // Test seriesState query
  console.log('\n2. Testing seriesState query...');
  const seriesStateQuery = `
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

  // Try with different series IDs
  const testSeriesIds = ['1', '2', '3'];

  for (const seriesId of testSeriesIds) {
    try {
      console.log(`\nTesting seriesState with ID: ${seriesId}`);
      const response = await axios.post(SERIES_STATE_URL, {
        query: seriesStateQuery,
        variables: { id: seriesId }
      }, {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data?.data?.seriesState) {
        const series = response.data.data.seriesState;
        console.log(`✅ Found series: ${series.title?.nameShortened || 'Unknown'} (${series.format})`);
        console.log(`Status: ${series.finished ? 'Finished' : 'Ongoing'}`);
        console.log(`Teams: ${series.teams.map(t => `${t.name} (${t.score})`).join(' vs ')}`);

        if (series.games && series.games.length > 0) {
          console.log(`Games (${series.games.length}):`);
          series.games.forEach((game, index) => {
            if (game.teams && game.teams.length >= 2) {
              const team1 = game.teams[0];
              const team2 = game.teams[1];
              const winner = team1.won ? team1.name : team2.name;
              console.log(`  Game ${index + 1}: ${team1.name} (${team1.score}) vs ${team2.name} (${team2.score}) - Winner: ${winner}`);
            }
          });
        } else {
          console.log('No games found in this series');
        }

        // This looks promising! Let's break out of the loop
        break;
      } else if (response.data?.errors) {
        console.log(`❌ GraphQL errors for series ${seriesId}:`, response.data.errors.map(e => e.message).join(', '));
      } else {
        console.log(`❌ No data returned for series ${seriesId}`);
      }

    } catch (error) {
      console.log(`❌ Failed to query series ${seriesId}:`, error.response?.status, error.response?.statusText || error.message);
    }
  }

  // Test latestSeriesStateByPlayerId query
  console.log('\n3. Testing latestSeriesStateByPlayerId query...');
  const playerSeriesQuery = `
    query GetLatestSeriesByPlayer($id: ID!) {
      latestSeriesStateByPlayerId(id: $id) {
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

  // Try with different player IDs
  const testPlayerIds = ['1', '2', '3'];

  for (const playerId of testPlayerIds) {
    try {
      console.log(`\nTesting latestSeriesStateByPlayerId with player ID: ${playerId}`);
      const response = await axios.post(SERIES_STATE_URL, {
        query: playerSeriesQuery,
        variables: { id: playerId }
      }, {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data?.data?.latestSeriesStateByPlayerId) {
        const series = response.data.data.latestSeriesStateByPlayerId;
        console.log(`✅ Found latest series for player ${playerId}: ${series.title?.nameShortened || 'Unknown'} (${series.format})`);
        console.log(`Status: ${series.finished ? 'Finished' : 'Ongoing'}`);
        console.log(`Teams: ${series.teams.map(t => `${t.name} (${t.score})`).join(' vs ')}`);

        if (series.games && series.games.length > 0) {
          console.log(`Games (${series.games.length}):`);
          series.games.forEach((game, index) => {
            if (game.teams && game.teams.length >= 2) {
              const team1 = game.teams[0];
              const team2 = game.teams[1];
              const winner = team1.won ? team1.name : team2.name;
              console.log(`  Game ${index + 1}: ${team1.name} (${team1.score}) vs ${team2.name} (${team2.score}) - Winner: ${winner}`);
            }
          });
        } else {
          console.log('No games found in this series');
        }

        // This looks promising! Let's break out of the loop
        break;
      } else if (response.data?.errors) {
        console.log(`❌ GraphQL errors for player ${playerId}:`, response.data.errors.map(e => e.message).join(', '));
      } else {
        console.log(`❌ No data returned for player ${playerId}`);
      }

    } catch (error) {
      console.log(`❌ Failed to query player ${playerId}:`, error.response?.status, error.response?.statusText || error.message);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('If the above tests found series with individual game results,');
  console.log('we can use this API to replace "vs Various Teams" with actual opponent names and scores!');
}

testSeriesStateAPI();