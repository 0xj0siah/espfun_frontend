const axios = require('axios');
require('dotenv').config();

const SERIES_STATE_URL = 'https://api-op.grid.gg/live-data-feed/series-state/graphql';
const API_KEY = process.env.VITE_GRID_API_KEY;

// Simplified version of the getRecentMatches logic
async function testGetRecentMatches(teamId) {
  console.log(`Testing getRecentMatches for team: ${teamId}`);

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

  // Test CS2 series first, then fallback to others
  const testSeriesIds = ['28', '27', '26', '25', '2'];
  let matches = [];

  for (const seriesId of testSeriesIds) {
    try {
      console.log(`\nTrying series ID: ${seriesId}`);
      const response = await axios.post(SERIES_STATE_URL, {
        query,
        variables: { id: seriesId }
      }, {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log(`Direct check: response.data.seriesState =`, response.data.seriesState);
      console.log(`Bracket access: response.data['seriesState'] =`, response.data['seriesState']);
      console.log(`Object keys:`, Object.keys(response.data));

      if (response?.data?.data?.seriesState) {
        const series = response.data.data.seriesState;
        console.log(`✅ Found series: ${series.title?.nameShortened || 'Unknown'} (${series.format})`);

        if (series.games && series.games.length > 0) {
          series.games.forEach((game, index) => {
            if (game.teams && game.teams.length >= 2) {
              const team1 = game.teams[0];
              const team2 = game.teams[1];

              // For CS2 series 28, assume CS2-1 is our team
              const isTargetTeam1 = seriesId === '28' ? team1.name === 'CS2-1' : team1.name.toLowerCase().includes('dota-1');
              const targetTeam = isTargetTeam1 ? team1 : team2;
              const opponentTeam = isTargetTeam1 ? team2 : team1;

              const result = targetTeam.won ? "win" : "loss";
              const scoreString = `${targetTeam.score}-${opponentTeam.score}`;
              const performance = (targetTeam.kills || 0) - (targetTeam.deaths || 0) + (targetTeam.score || 0);

              const match = {
                id: `series-${seriesId}-game-${game.sequenceNumber}`,
                game: series.title?.nameShortened || "Unknown Game",
                tournament: `${series.format} Series`,
                opponent: opponentTeam.name,
                result,
                score: scoreString,
                performance,
                date: game.started || series.startedAt || new Date().toISOString()
              };

              matches.push(match);
              console.log(`  Game ${game.sequenceNumber}: ${targetTeam.name} ${result} vs ${opponentTeam.name} (${scoreString})`);
            }
          });

          if (matches.length > 0) {
            console.log(`\n🎉 SUCCESS: Retrieved ${matches.length} individual matches with opponent names!`);
            return matches.slice(0, 4);
          }
        } else {
          console.log('No games found in this series');
        }
      } else {
        console.log(`❌ No series data returned for series ${seriesId}`);
      }
    } catch (error) {
      console.log(`❌ Error with series ${seriesId}:`, error.response?.status, error.response?.statusText || error.message);
    }
  }

  console.log('\n❌ No individual matches found, would fall back to aggregated stats');
  return [];
}

async function main() {
  try {
    const matches = await testGetRecentMatches('CS2-1');
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Total matches returned: ${matches.length}`);
    matches.forEach((match, i) => {
      console.log(`${i+1}. ${match.game} - vs ${match.opponent}: ${match.result} (${match.score})`);
    });
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main();