import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import { Activity, Clock, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchUpcomingMatches, fetchLiveAndRecentMatches } from '../utils/gridApi';
import { GridMatch } from '../types/grid';

interface SeriesTeamState {
  id: string;
  name: string;
  score: number;
  won: boolean | null;
}

interface SeriesState {
  id: string;
  started: boolean;
  finished: boolean;
  teams: SeriesTeamState[];
}

interface MatchWithScore extends GridMatch {
  team1Score?: number;
  team2Score?: number;
  status: 'live' | 'finished' | 'upcoming';
  seriesId?: string;
}

export default function LiveScoresSection() {
  const [upcomingMatches, setUpcomingMatches] = useState<GridMatch[]>([]);
  const [liveAndRecentMatches, setLiveAndRecentMatches] = useState<MatchWithScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch series state from Grid.gg Live Data Feed API
  const fetchSeriesState = async (seriesId: string): Promise<SeriesState | null> => {
    const query = `
      query GetSeriesState($seriesId: ID!) {
        seriesState(id: $seriesId) {
          id
          started
          finished
          teams {
            id
            name
            score
            won
          }
        }
      }
    `;

    try {
      const response = await fetch('https://api-op.grid.gg/live-data-feed/series-state/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_GRID_API_KEY,
        },
        body: JSON.stringify({
          query,
          variables: { seriesId }
        }),
      });

      if (!response.ok) {
        console.error(`Failed to fetch series state for ${seriesId}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error(`GraphQL errors for series ${seriesId}:`, data.errors);
        return null;
      }

      return data.data?.seriesState || null;
    } catch (error) {
      console.error(`Error fetching series state for ${seriesId}:`, error);
      return null;
    }
  };

  // Enrich matches with live scores
  const enrichMatchesWithScores = async (matches: GridMatch[]): Promise<MatchWithScore[]> => {
    const enrichedMatches: MatchWithScore[] = [];

    for (const match of matches) {
      try {
        // Skip test data (series ID 28 is test data)
        if (match.id === '99') {
          console.log(`⚠️ Skipping test data series ID: ${match.id}`);
          enrichedMatches.push({
            ...match,
            status: 'upcoming'
          });
          continue;
        }

        // Use the match ID as the series ID
        const seriesState = await fetchSeriesState(match.id);
        
        if (seriesState && seriesState.teams.length >= 2) {
          // Determine match status
          let status: 'live' | 'finished' | 'upcoming' = 'upcoming';
          if (seriesState.finished) {
            status = 'finished';
          } else if (seriesState.started) {
            status = 'live';
          }

          // Match teams by name
          const team1Data = seriesState.teams.find(t => 
            t.name.toLowerCase().includes(match.team1.toLowerCase()) ||
            match.team1.toLowerCase().includes(t.name.toLowerCase())
          ) || seriesState.teams[0];
          
          const team2Data = seriesState.teams.find(t => 
            t.name.toLowerCase().includes(match.team2.toLowerCase()) ||
            match.team2.toLowerCase().includes(t.name.toLowerCase())
          ) || seriesState.teams[1];

          enrichedMatches.push({
            ...match,
            team1Score: team1Data.score,
            team2Score: team2Data.score,
            status,
            seriesId: seriesState.id
          });

          console.log(`✅ Enriched match ${match.id}: ${team1Data.name} ${team1Data.score}-${team2Data.score} ${team2Data.name} (${status})`);
        } else {
          // No series state available, use default status
          enrichedMatches.push({
            ...match,
            status: 'upcoming'
          });
        }
      } catch (error) {
        console.error(`Failed to enrich match ${match.id}:`, error);
        enrichedMatches.push({
          ...match,
          status: 'upcoming'
        });
      }
    }

    return enrichedMatches;
  };

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        // Fetch both upcoming and live/recent matches in parallel
        const [upcoming, liveRecent] = await Promise.all([
          fetchUpcomingMatches(),
          fetchLiveAndRecentMatches()
        ]);
        
        setUpcomingMatches(upcoming);
        
        // Enrich live/recent matches with real-time scores
        console.log('📊 Fetching live scores for recent matches...');
        const enrichedMatches = await enrichMatchesWithScores(liveRecent);
        setLiveAndRecentMatches(enrichedMatches);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatches();
    
    // Refresh every 30 seconds for live matches, 2 minutes for upcoming
    const interval = setInterval(fetchMatches, 30000); // 30 seconds for live updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center space-x-3"
      >
        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-3 rounded-xl">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Live Scores & Matches
          </h2>
          <p className="text-sm text-muted-foreground">Real-time updates and upcoming fixtures</p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live & Recent Matches */}
        <Card className="p-6 border-0 shadow-lg">
          <h3 className="mb-6 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-red-500" />
            Live & Recent (Last 12 Hours)
          </h3>
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading matches...
              </p>
            ) : liveAndRecentMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No matches in the last 12 hours
              </p>
            ) : (
              liveAndRecentMatches.map((match, index) => (
                <motion.div 
                  key={match.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border-0 bg-gradient-to-r from-accent/30 to-accent/10 rounded-xl shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{match.game}</Badge>
                      <Badge 
                        variant={match.status === 'live' ? 'default' : 'secondary'}
                        className={match.status === 'live' ? 'bg-red-500 animate-pulse' : ''}
                      >
                        {match.status === 'live' ? 'LIVE' : match.status === 'finished' ? 'Finished' : 'Upcoming'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-primary">{match.time}</p>
                      <p className="text-xs text-muted-foreground">{match.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <p className="text-sm font-medium">{match.team1}</p>
                      {match.team1Score !== undefined && (
                        <p className="text-2xl text-primary mt-1 font-bold">{match.team1Score}</p>
                      )}
                    </div>
                    
                    <div className="text-center px-4">
                      <p className="text-xs text-muted-foreground font-semibold">VS</p>
                    </div>
                    
                    <div className="text-center flex-1">
                      <p className="text-sm font-medium">{match.team2}</p>
                      {match.team2Score !== undefined && (
                        <p className="text-2xl text-primary mt-1 font-bold">{match.team2Score}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-2">{match.tournament}</p>
                </motion.div>
              ))
            )}
          </div>
        </Card>

        {/* Upcoming Matches */}
        <Card className="p-6 border-0 shadow-lg">
          <h3 className="mb-6 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-500" />
            Upcoming Matches
          </h3>
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading matches...
              </p>
            ) : upcomingMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming matches
              </p>
            ) : (
              upcomingMatches.map((match, index) => (
                <motion.div 
                  key={match.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border-0 bg-gradient-to-r from-accent/30 to-accent/10 rounded-xl shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline">{match.game}</Badge>
                    <div className="text-right">
                      <p className="text-sm text-primary">{match.time}</p>
                      <p className="text-xs text-muted-foreground">{match.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <p className="text-sm">{match.team1}</p>
                    </div>
                    
                    <div className="text-center px-4">
                      <p className="text-xs text-muted-foreground">VS</p>
                    </div>
                    
                    <div className="text-center flex-1">
                      <p className="text-sm">{match.team2}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-2">{match.tournament}</p>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}