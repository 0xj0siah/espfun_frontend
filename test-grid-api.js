require('dotenv').config();
const axios = require('axios');
const GRID_API_KEY = process.env.VITE_GRID_API_KEY;
const GRID_BASE_URL = 'https://api-op.grid.gg';

console.log('Grid API Key loaded:', GRID_API_KEY ? 'Yes' : 'No');

const gridGraphQLRequest = async (endpoint, query, variables) => {
  try {
    const response = await axios.post(`${GRID_BASE_URL}${endpoint}`, {
      query,
      variables
    }, {
      headers: {
        'x-api-key': GRID_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error('Grid.gg API error:', error.response?.data || error.message);
    throw error;
  }
};

// Test the getRecentMatches function
async function testGetRecentMatches() {
  console.log('Testing getRecentMatches function with actual score data from Grid.gg API...');

  try {
    // Test with a known team ID (NaVi) - trying different IDs
    const teamId = '1'; // Try a simple ID
    const query = `
      query GetTeamGameStatistics($teamId: ID!) {
        teamGameStatistics(teamId: $teamId) {
          kills {
            sum
            avg
          }
          deaths {
            sum
            avg
          }
          score {
            sum
            avg
          }
          wins {
            value
            count
          }
        }
      }
    `;

    const variables = {
      teamId
    };

    console.log('Query variables:', variables);
    const response = await gridGraphQLRequest('/statistics-feed/graphql', query, variables);
    console.log('Raw response:', JSON.stringify(response, null, 2));

    if (!response?.data?.teamGameStatistics) {
      console.log('No teamGameStatistics data returned');
      return;
    }

    const stats = response.data.teamGameStatistics;
    const winsData = stats.wins.find(w => w.value === true);
    const totalWins = winsData ? winsData.count : 0;

    // Return actual team performance data using the score function from Grid.gg API
    const performanceMatch = {
      id: `team-performance-${teamId}`,
      game: "CS2",
      tournament: "Recent Performance",
      opponent: "Various Teams",
      result: totalWins > 0 ? "win" : "loss",
      score: `${stats.score.sum} total points`,
      performance: Math.round(stats.kills.avg - stats.deaths.avg + stats.score.avg),
      date: new Date().toISOString()
    };

    console.log('Success! Team performance data using actual score function:', JSON.stringify(performanceMatch, null, 2));
    console.log(`Retrieved actual team performance data for team ${teamId} using score function from Grid.gg API`);
  } catch (error) {
    console.error('Error testing getRecentMatches:', error.message);
  }
}

// Run the test
testGetRecentMatches();