import { GridApiResponse, GridMatch } from '../types/grid';

// Helper function to fetch upcoming matches from GRID API
export async function fetchUpcomingMatches(): Promise<GridMatch[]> {
  const currentDate = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(currentDate.getMonth() + 1);

  const query = `
    query FetchUpcomingMatches {
      allSeries(
        filter: {
          startTimeScheduled: {
            gte: "${currentDate.toISOString()}",
            lte: "${nextMonth.toISOString()}"
          }
        },
        orderBy: StartTimeScheduled,
        orderDirection: ASC,
        first: 50
      ) {
        edges {
          node {
            id
            title {
              nameShortened
            }
            tournament {
              nameShortened
            }
            startTimeScheduled
            format {
              name
              nameShortened
            }
            teams {
              baseInfo {
                name
                nameShortened
              }
              scoreAdvantage
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api-op.grid.gg/central-data/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': import.meta.env.VITE_GRID_API_KEY,
      },
      body: JSON.stringify({ 
        query,
        variables: {} 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API response not ok:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('API Response:', responseData);

    if (!responseData?.data?.allSeries?.edges) {
      console.error('Invalid API response structure:', responseData);
      if (responseData.errors) {
        console.error('GraphQL Errors:', responseData.errors);
      }
      return [];
    }

    const edges = responseData.data.allSeries.edges as GridApiResponse['data']['allSeries']['edges'];
    
    // Filter for CS2 matches, sort by start time, and take the 4 closest matches
    return edges
      .filter((edge: GridApiResponse['data']['allSeries']['edges'][0]) => 
        edge.node.title.nameShortened.toLowerCase() === 'cs2'
      )
      .sort((a, b) => 
        new Date(a.node.startTimeScheduled).getTime() - new Date(b.node.startTimeScheduled).getTime()
      )
      .slice(0, 4)
      .map((edge: GridApiResponse['data']['allSeries']['edges'][0]) => ({
        id: edge.node.id,
        tournament: edge.node.tournament.nameShortened,
        team1: edge.node.teams[0]?.baseInfo.name || 'TBD',
        team2: edge.node.teams[1]?.baseInfo.name || 'TBD',
        time: new Date(edge.node.startTimeScheduled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(edge.node.startTimeScheduled).toLocaleDateString(),
        game: 'CS2',
        format: edge.node.format.nameShortened
      }));
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
}

// Helper function to fetch live and recent matches (past 12 hours) from GRID API
export async function fetchLiveAndRecentMatches(): Promise<GridMatch[]> {
  const currentDate = new Date();
  const twelveHoursAgo = new Date();
  twelveHoursAgo.setHours(currentDate.getHours() - 12);

  const query = `
    query FetchLiveAndRecentMatches {
      allSeries(
        filter: {
          startTimeScheduled: {
            gte: "${twelveHoursAgo.toISOString()}",
            lte: "${currentDate.toISOString()}"
          }
          types: ESPORTS
        },
        orderBy: StartTimeScheduled,
        orderDirection: DESC,
        first: 50
      ) {
        edges {
          node {
            id
            title {
              nameShortened
            }
            tournament {
              nameShortened
            }
            startTimeScheduled
            format {
              name
              nameShortened
            }
            teams {
              baseInfo {
                name
                nameShortened
              }
              scoreAdvantage
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api-op.grid.gg/central-data/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': import.meta.env.VITE_GRID_API_KEY,
      },
      body: JSON.stringify({ 
        query,
        variables: {} 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API response not ok:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Live/Recent API Response:', responseData);

    if (!responseData?.data?.allSeries?.edges) {
      console.error('Invalid API response structure:', responseData);
      if (responseData.errors) {
        console.error('GraphQL Errors:', responseData.errors);
      }
      return [];
    }

    const edges = responseData.data.allSeries.edges as GridApiResponse['data']['allSeries']['edges'];
    
    // Filter for CS2 matches, sort by start time (most recent first), and take the 4 most recent matches
    return edges
      .filter((edge: GridApiResponse['data']['allSeries']['edges'][0]) => 
        edge.node.title.nameShortened.toLowerCase() === 'cs2'
      )
      .sort((a, b) => 
        new Date(b.node.startTimeScheduled).getTime() - new Date(a.node.startTimeScheduled).getTime()
      )
      .slice(0, 4)
      .map((edge: GridApiResponse['data']['allSeries']['edges'][0]) => ({
        id: edge.node.id,
        tournament: edge.node.tournament.nameShortened,
        team1: edge.node.teams[0]?.baseInfo.name || 'TBD',
        team2: edge.node.teams[1]?.baseInfo.name || 'TBD',
        time: new Date(edge.node.startTimeScheduled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(edge.node.startTimeScheduled).toLocaleDateString(),
        game: 'CS2',
        format: edge.node.format.nameShortened
      }));
  } catch (error) {
    console.error('Error fetching live/recent matches:', error);
    return [];
  }
}