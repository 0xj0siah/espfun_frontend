import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Trophy, Crown, Award, TrendingUp, DollarSign, Star } from 'lucide-react';

export default function LeaderboardSection() {
  const leaderboard = [
    { rank: 1, username: 'CryptoMaster', points: 2847, teamValue: '8.3 ETH', reward: '5.0 ETH' },
    { rank: 2, username: 'EsportsKing', points: 2698, teamValue: '7.9 ETH', reward: '3.0 ETH' },
    { rank: 3, username: 'DigitalNinja', points: 2534, teamValue: '7.2 ETH', reward: '2.0 ETH' },
    { rank: 4, username: 'GameTheory', points: 2421, teamValue: '6.8 ETH', reward: '1.5 ETH' },
    { rank: 5, username: 'BlockchainBoss', points: 2398, teamValue: '6.5 ETH', reward: '1.0 ETH' },
    { rank: 6, username: 'MetaGamer', points: 2287, teamValue: '6.1 ETH', reward: '0.8 ETH' },
    { rank: 7, username: 'ProPlayer99', points: 2156, teamValue: '5.9 ETH', reward: '0.6 ETH' },
    { rank: 8, username: 'EliteStrat', points: 2098, teamValue: '5.7 ETH', reward: '0.5 ETH' },
    { rank: 9, username: 'TechSavvy', points: 1987, teamValue: '5.4 ETH', reward: '0.4 ETH' },
    { rank: 10, username: 'QuantumGamer', points: 1876, teamValue: '5.2 ETH', reward: '0.3 ETH' },
    { rank: 15, username: 'You', points: 1227, teamValue: '5.5 ETH', reward: '0.1 ETH', isCurrentUser: true }
  ];

  const weeklyLeaders = [
    { username: 'RisingPhoenix', weeklyPoints: 456, change: '+12' },
    { username: 'FlashGaming', weeklyPoints: 423, change: '+8' },
    { username: 'StormBreaker', weeklyPoints: 398, change: '+15' }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-3"
        >
          <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-3 rounded-xl">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Leaderboard
            </h2>
            <p className="text-sm text-muted-foreground">Global rankings and rewards</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 border-0">
          Season 3 • Week 8
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Leaderboard */}
        <Card className="p-6 lg:col-span-2 border-0 shadow-lg">
          <h3 className="mb-6 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
            Global Rankings
          </h3>
          <div className="space-y-3">
            {leaderboard.map((player, index) => (
              <motion.div 
                key={player.rank}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-4 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${
                  player.isCurrentUser ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-primary/30' : 'bg-accent/30'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    player.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <span className="text-sm">
                      {player.rank <= 3 ? (
                        player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : '🥉'
                      ) : (
                        player.rank
                      )}
                    </span>
                  </div>
                  
                  <ImageWithFallback
                    src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.rank}`}
                    alt={player.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  
                  <div>
                    <h4 className={`text-sm ${player.isCurrentUser ? 'text-primary' : ''}`}>
                      {player.username}
                    </h4>
                    <p className="text-xs text-muted-foreground">Team Value: {player.teamValue}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-primary">{player.points.toLocaleString()} pts</p>
                  <p className="text-xs text-muted-foreground">Reward: {player.reward}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Weekly Leaders */}
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
              Weekly Leaders
            </h3>
            <div className="space-y-3">
              {weeklyLeaders.map((player, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ImageWithFallback
                      src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${index + 20}`}
                      alt={player.username}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <p className="text-sm">{player.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-primary">{player.weeklyPoints}</p>
                    <p className="text-xs text-green-500">{player.change}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Prize Pool */}
          <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10">
            <h3 className="mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-500" />
              Prize Pool
            </h3>
            <div className="text-center space-y-2">
              <p className="text-2xl text-primary">125.7 ETH</p>
              <p className="text-sm text-muted-foreground">Total Prize Pool</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>1st Place</span>
                  <span className="text-primary">5.0 ETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Top 10</span>
                  <span className="text-primary">20.5 ETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Top 100</span>
                  <span className="text-primary">65.2 ETH</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Your Stats */}
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="mb-4 flex items-center">
              <Star className="w-5 h-5 mr-2 text-blue-500" />
              Your Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Current Rank</span>
                <span className="text-primary">#15</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Points This Week</span>
                <span className="text-primary">178</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Best Rank</span>
                <span className="text-primary">#8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Seasons Played</span>
                <span className="text-primary">3</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}