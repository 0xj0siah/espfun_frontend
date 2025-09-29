const WebSocket = require('ws');
require('dotenv').config();

const API_KEY = process.env.VITE_GRID_API_KEY;

// Test WebSocket connection to Series Events API
async function testSeriesEventsWebSocket() {
  console.log('Testing Series Events API WebSocket connection...');

  // Try different possible WebSocket URLs based on the documentation
  const possibleUrls = [
    'wss://live-data-feed.grid.gg/series-events',
    'wss://api-op.grid.gg/live-data-feed/series-events',
    'ws://live-data-feed.grid.gg/series-events',
    'ws://api-op.grid.gg/live-data-feed/series-events'
  ];

  for (const url of possibleUrls) {
    console.log(`\nTrying WebSocket URL: ${url}`);

    try {
      const ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'x-api-key': API_KEY
        }
      });

      // Set up event handlers
      ws.on('open', () => {
        console.log(`✅ WebSocket connection successful to ${url}`);

        // Send a subscription message (if needed)
        // Based on typical WebSocket APIs, we might need to subscribe to specific series
        const subscriptionMessage = {
          type: 'subscribe',
          seriesId: 'test-series' // Try with a test series ID
        };

        ws.send(JSON.stringify(subscriptionMessage));
        console.log('Sent subscription message:', subscriptionMessage);
      });

      ws.on('message', (data) => {
        console.log('Received message:', data.toString());
      });

      ws.on('error', (error) => {
        console.log(`❌ WebSocket error for ${url}:`, error.message);
      });

      ws.on('close', (code, reason) => {
        console.log(`WebSocket closed for ${url}:`, code, reason.toString());
      });

      // Wait a bit for connection attempt
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Close the connection
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }

    } catch (error) {
      console.log(`❌ Failed to connect to ${url}:`, error.message);
    }
  }
}

// Test if there are any REST endpoints for historical events
async function testSeriesEventsREST() {
  const axios = require('axios');

  console.log('\nTesting for REST endpoints related to Series Events...');

  // Try some possible REST endpoints
  const possibleEndpoints = [
    'https://api-op.grid.gg/live-data-feed/graphql',
    'https://live-data-feed.grid.gg/graphql'
  ];

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

  for (const endpoint of possibleEndpoints) {
    console.log(`\nTesting GraphQL introspection at: ${endpoint}`);

    try {
      const response = await axios.post(endpoint, {
        query
      }, {
        headers: {
          'x-api-key': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      console.log(`✅ ${endpoint} is accessible`);
      console.log('Available queries:');
      if (response.data?.data?.__schema?.queryType?.fields) {
        response.data.data.__schema.queryType.fields.forEach(field => {
          console.log(`- ${field.name}: ${field.description || 'No description'}`);
        });
      }

      // Check if there are event-related queries
      const eventQueries = response.data.data.__schema.queryType.fields.filter(
        field => field.name.toLowerCase().includes('event')
      );

      if (eventQueries.length > 0) {
        console.log('\nEvent-related queries found:');
        eventQueries.forEach(field => {
          console.log(`- ${field.name}: ${field.description || 'No description'}`);
        });
      } else {
        console.log('\nNo event-related queries found');
      }

    } catch (error) {
      console.log(`❌ ${endpoint} failed:`, error.response?.status, error.response?.statusText || error.message);
    }
  }
}

// Test if we can get historical series events via GraphQL
async function testHistoricalEvents() {
  const axios = require('axios');

  console.log('\nTesting for historical series events...');

  // Try to query for series events (if such a query exists)
  const queries = [
    {
      name: 'seriesEvents',
      query: `
        query GetSeriesEvents($seriesId: ID!) {
          seriesEvents(seriesId: $seriesId) {
            id
            type
            occurredAt
            actor {
              type
              id
            }
            action
            target {
              type
              id
            }
          }
        }
      `,
      variables: { seriesId: '1' }
    },
    {
      name: 'events',
      query: `
        query GetEvents($seriesId: ID!) {
          events(seriesId: $seriesId) {
            id
            type
            occurredAt
            actor {
              type
              id
            }
            action
            target {
              type
              id
            }
          }
        }
      `,
      variables: { seriesId: '1' }
    }
  ];

  const endpoints = [
    'https://api-op.grid.gg/live-data-feed/graphql',
    'https://live-data-feed.grid.gg/graphql'
  ];

  for (const endpoint of endpoints) {
    for (const { name, query, variables } of queries) {
      try {
        console.log(`\nTesting ${name} query at ${endpoint}`);
        const response = await axios.post(endpoint, {
          query,
          variables
        }, {
          headers: {
            'x-api-key': API_KEY,
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        if (response.data?.data && !response.data.errors) {
          console.log(`✅ ${name} query successful!`);
          console.log('Response:', JSON.stringify(response.data, null, 2));
        } else if (response.data?.errors) {
          console.log(`❌ ${name} query failed with GraphQL errors:`, response.data.errors);
        } else {
          console.log(`❌ ${name} query returned no data`);
        }

      } catch (error) {
        console.log(`❌ ${name} query at ${endpoint} failed:`, error.response?.status, error.response?.statusText || error.message);
      }
    }
  }
}

// Run all tests
async function runTests() {
  await testSeriesEventsWebSocket();
  await testSeriesEventsREST();
  await testHistoricalEvents();

  console.log('\n=== SUMMARY ===');
  console.log('The Series Events API appears to be WebSocket-based for real-time event streaming.');
  console.log('It may not provide historical match data with final scores.');
  console.log('For individual match results with opponent names and scores, we may need a different approach.');
}

runTests();