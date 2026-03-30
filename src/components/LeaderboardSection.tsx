import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Trophy, Crown, TrendingUp, DollarSign, Star } from 'lucide-react';

export default memo(function LeaderboardSection() {
  const { t } = useTranslation();
  const leaderboard = [
    { rank: 1, address: '0x1a2B...3c4D', points: 2847, teamValue: '1,240 USDC', reward: '5,000 pts' },
    { rank: 2, address: '0x5e6F...7a8B', points: 2698, teamValue: '1,180 USDC', reward: '3,000 pts' },
    { rank: 3, address: '0x9c0D...1e2F', points: 2534, teamValue: '1,075 USDC', reward: '2,000 pts' },
    { rank: 4, address: '0x3a4B...5c6D', points: 2421, teamValue: '1,015 USDC', reward: '1,500 pts' },
    { rank: 5, address: '0x7e8F...9a0B', points: 2398, teamValue: '970 USDC', reward: '1,000 pts' },
    { rank: 6, address: '0x2c3D...4e5F', points: 2287, teamValue: '910 USDC', reward: '800 pts' },
    { rank: 7, address: '0x6a7B...8c9D', points: 2156, teamValue: '880 USDC', reward: '600 pts' },
    { rank: 8, address: '0x0e1F...2a3B', points: 2098, teamValue: '850 USDC', reward: '500 pts' },
    { rank: 9, address: '0x4c5D...6e7F', points: 1987, teamValue: '805 USDC', reward: '400 pts' },
    { rank: 10, address: '0x8a9B...0c1D', points: 1876, teamValue: '775 USDC', reward: '300 pts' },
    { rank: 15, address: 'You', points: 1227, teamValue: '820 USDC', reward: '100 pts', isCurrentUser: true }
  ];

  const weeklyLeaders = [
    { address: '0xd4E5...f6A7', weeklyPoints: 456, change: '+12' },
    { address: '0xb8C9...d0E1', weeklyPoints: 423, change: '+8' },
    { address: '0xf2A3...b4C5', weeklyPoints: 398, change: '+15' }
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
              {t('leaderboard.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('leaderboard.subtitle')}</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 border-0">
          {t('leaderboard.seasonWeek', { season: 3, week: 8 })}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Leaderboard */}
        <Card className="p-6 lg:col-span-2 border-0 shadow-lg">
          <h3 className="mb-6 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
            {t('leaderboard.globalRankings')}
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
                    alt={`Player rank ${player.rank}`}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  
                  <div>
                    <h4 className={`text-sm ${player.isCurrentUser ? 'text-primary' : ''}`}>
                      {player.address}
                    </h4>
                    <p className="text-xs text-muted-foreground">{t('leaderboard.teamValue')}: {player.teamValue}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-primary">{player.points.toLocaleString()} pts</p>
                  <p className="text-xs text-muted-foreground">{t('leaderboard.reward')}: {player.reward}</p>
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
              {t('leaderboard.weeklyLeaders')}
            </h3>
            <div className="space-y-3">
              {weeklyLeaders.map((player, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ImageWithFallback
                      src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${index + 20}`}
                      alt={`Player rank ${player.rank}`}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <p className="text-sm">{player.address}</p>
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
              <p className="text-2xl text-primary">125,000 pts</p>
              <p className="text-sm text-muted-foreground">Total Prize Pool</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>1st Place</span>
                  <span className="text-primary">5,000 pts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Top 10</span>
                  <span className="text-primary">20,500 pts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Top 100</span>
                  <span className="text-primary">65,200 pts</span>
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
});