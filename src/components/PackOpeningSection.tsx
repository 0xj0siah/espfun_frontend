import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Star, Zap, Trophy, Gift } from 'lucide-react';

interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  rating: number;
  price: string;
}

export default function PackOpeningSection() {
  const [isOpening, setIsOpening] = useState(false);
  const [openedPacks, setOpenedPacks] = useState<Player[]>([]);
  const [showRewards, setShowRewards] = useState(false);

  const packs = [
    {
      id: 1,
      name: 'Standard Pack',
      price: '0.1 ETH',
      description: '5 random players',
      rarity: 'common',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 2,
      name: 'Premium Pack',
      price: '0.25 ETH',
      description: '5 players, 1 guaranteed rare+',
      rarity: 'rare',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 3,
      name: 'Elite Pack',
      price: '0.5 ETH',
      description: '7 players, 1 guaranteed epic+',
      rarity: 'epic',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      id: 4,
      name: 'Legendary Pack',
      price: '1.0 ETH',
      description: '10 players, 1 guaranteed legendary',
      rarity: 'legendary',
      gradient: 'from-yellow-400 to-orange-500'
    }
  ];

  const mockPlayers = [
    { id: 1, name: 'ShadowStrike', game: 'Valorant', position: 'Duelist', rarity: 'legendary', rating: 98, price: '2.5 ETH' },
    { id: 2, name: 'CyberNinja', game: 'CS2', position: 'AWPer', rarity: 'epic', rating: 92, price: '1.2 ETH' },
    { id: 3, name: 'FlashBang', game: 'Valorant', position: 'Initiator', rarity: 'rare', rating: 85, price: '0.8 ETH' },
    { id: 4, name: 'StormBreaker', game: 'League of Legends', position: 'Mid', rarity: 'epic', rating: 90, price: '1.0 ETH' },
    { id: 5, name: 'IceKing', game: 'Dota 2', position: 'Support', rarity: 'common', rating: 78, price: '0.3 ETH' }
  ];

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return <Trophy className="w-4 h-4" />;
      case 'epic': return <Zap className="w-4 h-4" />;
      case 'rare': return <Star className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-orange-500';
      case 'epic': return 'from-purple-500 to-pink-500';
      case 'rare': return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const openPack = async () => {
    setIsOpening(true);
    setShowRewards(false);

    // Simulate pack opening delay
    setTimeout(() => {
      const newPlayers = mockPlayers.slice(0, 5).map(player => ({
        ...player,
        rarity: Math.random() > 0.7 ? 'rare' : Math.random() > 0.9 ? 'epic' : Math.random() > 0.95 ? 'legendary' : 'common'
      })) as Player[];
      
      setOpenedPacks(newPlayers);
      setIsOpening(false);
      setShowRewards(true);
    }, 3000);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full"
        >
          <Gift className="w-5 h-5" />
          <span className="text-lg">Pack Opening</span>
        </motion.div>
        <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Open packs to discover legendary players
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Each pack contains a randomized selection of players from different rarities. The higher the pack tier, the better your chances of getting rare players!
        </p>
      </div>

      {/* Pack Selection */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {packs.map((pack) => (
          <motion.div
            key={pack.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className={`absolute inset-0 bg-gradient-to-br ${pack.gradient} opacity-10`}></div>
              <div className="relative p-6 text-center space-y-4">
                <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-br ${pack.gradient} flex items-center justify-center`}>
                  {getRarityIcon(pack.rarity)}
                </div>
                <div>
                  <h3 className="text-lg">{pack.name}</h3>
                  <p className="text-sm text-muted-foreground">{pack.description}</p>
                </div>
                <div className="space-y-3">
                  <Badge variant="outline" className="text-lg px-4 py-1">
                    {pack.price}
                  </Badge>
                  <Button 
                    onClick={openPack}
                    disabled={isOpening}
                    className={`w-full bg-gradient-to-r ${pack.gradient} hover:opacity-90 text-white border-0`}
                  >
                    {isOpening ? 'Opening...' : 'Open Pack'}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pack Opening Animation */}
      <AnimatePresence>
        {isOpening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="text-center space-y-8">
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1, repeat: Infinity }
                }}
                className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center"
              >
                <Gift className="w-16 h-16 text-white" />
              </motion.div>
              <motion.h3
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-2xl"
              >
                Opening your pack...
              </motion.h3>
              <div className="flex justify-center space-x-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -20, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                    className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Opened Pack Results */}
      <AnimatePresence>
        {showRewards && openedPacks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl mb-2">Pack Opened Successfully! 🎉</h3>
              <p className="text-muted-foreground">Here are your new players:</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {openedPacks.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ delay: index * 0.2 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-lg">
                    <div className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(player.rarity)} opacity-20`}></div>
                    <div className="relative p-4 text-center space-y-3">
                      <ImageWithFallback
                        src={`https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&h=100&fit=crop&crop=face&random=${player.id + index}`}
                        alt={player.name}
                        className="w-16 h-16 rounded-full mx-auto object-cover"
                      />
                      <div>
                        <h4 className="text-sm">{player.name}</h4>
                        <p className="text-xs text-muted-foreground">{player.game}</p>
                        <div className="flex items-center justify-center space-x-1 mt-2">
                          {getRarityIcon(player.rarity)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {player.rarity}
                          </Badge>
                        </div>
                        <p className="text-sm text-primary mt-2">{player.price}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
            
            <div className="text-center">
              <Button 
                onClick={() => setShowRewards(false)}
                variant="outline"
                className="mr-4"
              >
                Close
              </Button>
              <Button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                Add to Collection
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Pack Openings */}
      <Card className="p-6">
        <h3 className="mb-4">Recent Community Openings</h3>
        <div className="space-y-3">
          {[
            { user: 'CryptoGamer23', player: 'ShadowStrike', rarity: 'legendary', time: '2 minutes ago' },
            { user: 'ProPlayer99', player: 'CyberNinja', rarity: 'epic', time: '5 minutes ago' },
            { user: 'EliteStrat', player: 'FlashBang', rarity: 'rare', time: '8 minutes ago' }
          ].map((opening, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getRarityColor(opening.rarity)}`}></div>
                <div>
                  <p className="text-sm">
                    <span className="text-primary">{opening.user}</span> opened{' '}
                    <span className="text-primary">{opening.player}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{opening.time}</p>
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {opening.rarity}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}