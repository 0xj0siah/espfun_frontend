import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import { Activity, Clock, Trophy, Users } from 'lucide-react';

export default function LiveScoresSection() {
  const liveMatches = [
    {
      id: 1,
      game: 'CS2',
      tournament: 'IEM Katowice',
      team1: 'G2 Esports',
      team2: 'Astralis',
      score1: 16,
      score2: 8,
      status: 'Finished',
      map: 'Dust2'
    },
    {
      id: 2,
      game: 'League of Legends',
      tournament: 'Worlds 2024',
      team1: 'T1',
      team2: 'JDG',
      score1: 2,
      score2: 1,
      status: 'Live',
      map: 'Game 4'
    }
  ];

  const upcomingMatches = [
    {
      id: 1,
      game: 'CS2',
      tournament: 'ESL Pro League',
      team1: 'FaZe Clan',
      team2: 'Vitality',
      time: '20:30',
      date: 'Tomorrow'
    }
  ];

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
            Live & Recent
          </h3>
          <div className="space-y-4">
            {liveMatches.map((match, index) => (
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
                    <Badge variant={match.status === 'Live' ? 'default' : 'secondary'}>
                      {match.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{match.tournament}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-sm">{match.team1}</p>
                    <p className="text-2xl text-primary mt-1">{match.score1}</p>
                  </div>
                  
                  <div className="text-center px-4">
                    <p className="text-xs text-muted-foreground">VS</p>
                    <p className="text-xs text-muted-foreground mt-2">{match.map}</p>
                  </div>
                  
                  <div className="text-center flex-1">
                    <p className="text-sm">{match.team2}</p>
                    <p className="text-2xl text-primary mt-1">{match.score2}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Upcoming Matches */}
        <Card className="p-6 border-0 shadow-lg">
          <h3 className="mb-6 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-500" />
            Upcoming Matches
          </h3>
          <div className="space-y-4">
            {upcomingMatches.map((match, index) => (
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
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}