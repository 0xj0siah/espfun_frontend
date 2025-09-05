import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Star, Zap, Trophy, Package } from 'lucide-react';

interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  rating: number;
  price: string;
  image: string;
}

interface FlippableCard {
  id: number;
  player: Player;
  isFlipped: boolean;
}

export default function PackOpeningSection() {
  const [isOpening, setIsOpening] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [openedCards, setOpenedCards] = useState<FlippableCard[]>([]);
  const [showCards, setShowCards] = useState(false);
  const [packOpened, setPackOpened] = useState(false);

  const packs = [
    {
      id: 1,
      name: 'Bronze Pack',
      price: '0.1 ETH',
      description: '5 random players',
      cardCount: 5,
      rarity: 'common',
      gradient: 'from-amber-600 to-amber-800',
      glowColor: 'shadow-amber-500/50'
    },
    {
      id: 2,
      name: 'Silver Pack',
      price: '0.25 ETH',
      description: '5 players, 1 guaranteed rare+',
      cardCount: 5,
      rarity: 'rare',
      gradient: 'from-slate-400 to-slate-600',
      glowColor: 'shadow-slate-400/50'
    },
    {
      id: 3,
      name: 'Gold Pack',
      price: '0.5 ETH',
      description: '7 players, 1 guaranteed epic+',
      cardCount: 7,
      rarity: 'epic',
      gradient: 'from-yellow-400 to-yellow-600',
      glowColor: 'shadow-yellow-400/50'
    }
  ];

  const mockPlayers = [
    { 
      id: 1, 
      name: 'ShadowStrike', 
      game: 'Valorant', 
      position: 'Duelist', 
      rarity: 'legendary', 
      rating: 98, 
      price: '2.5 ETH',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=280&fit=crop&crop=face&random=1'
    },
    { 
      id: 2, 
      name: 'CyberNinja', 
      game: 'CS2', 
      position: 'AWPer', 
      rarity: 'epic', 
      rating: 92, 
      price: '1.2 ETH',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=280&fit=crop&crop=face&random=2'
    },
    { 
      id: 3, 
      name: 'FlashBang', 
      game: 'Valorant', 
      position: 'Initiator', 
      rarity: 'rare', 
      rating: 85, 
      price: '0.8 ETH',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=280&fit=crop&crop=face&random=3'
    },
    { 
      id: 4, 
      name: 'StormBreaker', 
      game: 'League of Legends', 
      position: 'Mid', 
      rarity: 'epic', 
      rating: 90, 
      price: '1.0 ETH',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=280&fit=crop&crop=face&random=4'
    },
    { 
      id: 5, 
      name: 'IceKing', 
      game: 'Dota 2', 
      position: 'Support', 
      rarity: 'common', 
      rating: 78, 
      price: '0.3 ETH',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=280&fit=crop&crop=face&random=5'
    },
    { 
      id: 6, 
      name: 'ThunderBolt', 
      game: 'CS2', 
      position: 'Rifler', 
      rarity: 'rare', 
      rating: 87, 
      price: '0.9 ETH',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=280&fit=crop&crop=face&random=6'
    },
    { 
      id: 7, 
      name: 'PhoenixRise', 
      game: 'Valorant', 
      position: 'Controller', 
      rarity: 'legendary', 
      rating: 95, 
      price: '2.0 ETH',
      image: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=280&fit=crop&crop=face&random=7'
    }
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
      case 'legendary': return 'from-yellow-400 via-orange-500 to-red-500';
      case 'epic': return 'from-purple-500 via-pink-500 to-red-500';
      case 'rare': return 'from-blue-500 via-cyan-500 to-teal-500';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const generateRandomPlayer = (): Player => {
    const player = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
    const rarityRoll = Math.random();
    let rarity: Player['rarity'];
    
    if (rarityRoll > 0.95) rarity = 'legendary';
    else if (rarityRoll > 0.8) rarity = 'epic';
    else if (rarityRoll > 0.5) rarity = 'rare';
    else rarity = 'common';
    
    return {
      ...player,
      id: Math.random(),
      rarity
    };
  };

  const openPack = async (packId: number) => {
    const pack = packs.find(p => p.id === packId);
    if (!pack) return;

    setSelectedPack(packId);
    setIsOpening(true);
    setShowCards(false);
    setPackOpened(false);

    // Simulate pack opening delay
    setTimeout(() => {
      const newCards: FlippableCard[] = Array.from({ length: pack.cardCount }, (_, index) => ({
        id: index,
        player: generateRandomPlayer(),
        isFlipped: false
      }));
      
      setOpenedCards(newCards);
      setIsOpening(false);
      setShowCards(true);
      setPackOpened(true);
    }, 2500);
  };

  const flipCard = (cardId: number) => {
    setOpenedCards(prev => 
      prev.map(card => 
        card.id === cardId ? { ...card, isFlipped: true } : card
      )
    );
  };

  const resetPack = () => {
    setSelectedPack(null);
    setOpenedCards([]);
    setShowCards(false);
    setPackOpened(false);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full"
        >
          <Package className="w-5 h-5" />
          <span className="text-lg font-semibold">Card Pack Opening</span>
        </motion.div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Discover Legendary Players
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Choose your pack and reveal your cards! Click on each card to flip it over and discover the players inside.
        </p>
      </div>

      {!packOpened && (
        <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
          {packs.map((pack) => (
            <motion.div
              key={pack.id}
              whileHover={{ scale: 1.05, y: -10 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <Card className={`relative overflow-hidden border-2 border-transparent bg-gradient-to-br ${pack.gradient} p-[2px] shadow-2xl ${pack.glowColor}`}>
                <div className="relative bg-background rounded-lg p-6 text-center space-y-4 h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-lg pointer-events-none"></div>
                  
                  <div className={`mx-auto w-20 h-20 rounded-full bg-gradient-to-br ${pack.gradient} flex items-center justify-center shadow-lg relative z-10`}>
                    <Package className="w-10 h-10 text-white" />
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold">{pack.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{pack.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">{pack.cardCount} cards total</p>
                  </div>
                  
                  <div className="space-y-3 relative z-10">
                    <Badge variant="outline" className="text-lg px-6 py-2 font-semibold">
                      {pack.price}
                    </Badge>
                    <Button 
                      onClick={() => openPack(pack.id)}
                      disabled={isOpening}
                      className={`w-full bg-gradient-to-r ${pack.gradient} hover:opacity-90 text-white border-0 shadow-lg font-semibold py-3`}
                    >
                      {isOpening && selectedPack === pack.id ? 'Opening...' : 'Open Pack'}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pack Opening Animation */}
      <AnimatePresence>
        {isOpening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="text-center space-y-8">
              <motion.div
                animate={{ 
                  rotateY: [0, 180, 360],
                  scale: [1, 1.3, 1],
                  rotateZ: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className={`w-40 h-40 mx-auto bg-gradient-to-br ${packs.find(p => p.id === selectedPack)?.gradient} rounded-2xl flex items-center justify-center shadow-2xl`}
              >
                <Package className="w-20 h-20 text-white" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h3 className="text-3xl font-bold text-white mb-2">Opening Pack...</h3>
                <p className="text-white/80">Revealing your cards</p>
              </motion.div>
              
              <div className="flex justify-center space-x-3">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [0, -30, 0],
                      opacity: [0.4, 1, 0.4]
                    }}
                    transition={{ 
                      duration: 1.2, 
                      repeat: Infinity, 
                      delay: i * 0.3,
                      ease: "easeInOut"
                    }}
                    className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Reveal Section */}
      <AnimatePresence>
        {showCards && openedCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center">
              <motion.h3 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold mb-3"
              >
                🎉 Pack Opened Successfully! 🎉
              </motion.h3>
              <p className="text-muted-foreground text-lg">Click on each card to reveal your player!</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto">
              {openedCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.8, y: 100 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
                  className="relative"
                >
                  <div 
                    className="relative w-48 h-64 cursor-pointer perspective-1000"
                    onClick={() => !card.isFlipped && flipCard(card.id)}
                  >
                    <motion.div
                      animate={{ rotateY: card.isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
                      className="relative w-full h-full preserve-3d"
                    >
                      {/* Card Back */}
                      <div className="absolute inset-0 w-full h-full backface-hidden">
                        <Card className="w-full h-full border-2 border-blue-500/50 bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900 shadow-2xl shadow-blue-500/25">
                          <div className="relative w-full h-full p-4 flex flex-col items-center justify-center">
                            <div className="absolute inset-2 border-2 border-blue-400/30 rounded-lg"></div>
                            <div className="absolute inset-4 border border-blue-400/20 rounded-lg"></div>
                            
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                              className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center mb-4"
                            >
                              <Sparkles className="w-8 h-8 text-white" />
                            </motion.div>
                            
                            <div className="text-center">
                              <h4 className="text-blue-200 font-bold text-sm">ESPORTS</h4>
                              <h3 className="text-white font-bold text-lg">PLAYER CARD</h3>
                              <p className="text-blue-300 text-xs mt-2">Click to reveal</p>
                            </div>
                            
                            <div className="absolute bottom-4 left-4 right-4">
                              <div className="h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 rounded-full opacity-60"></div>
                            </div>
                          </div>
                        </Card>
                      </div>

                      {/* Card Front */}
                      <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
                        <Card className={`w-full h-full border-2 bg-gradient-to-br ${getRarityColor(card.player.rarity)} p-[2px] shadow-2xl`}>
                          <div className="relative bg-background rounded-lg w-full h-full p-4 flex flex-col">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-lg"></div>
                            
                            {/* Header */}
                            <div className="relative z-10 flex items-center justify-between mb-3">
                              <Badge className={`capitalize bg-gradient-to-r ${getRarityColor(card.player.rarity)} text-white border-0`}>
                                {card.player.rarity}
                              </Badge>
                              <div className="flex items-center space-x-1">
                                {getRarityIcon(card.player.rarity)}
                                <span className="text-sm font-bold">{card.player.rating}</span>
                              </div>
                            </div>
                            
                            {/* Player Image */}
                            <div className="relative z-10 flex-1 mb-3">
                              <ImageWithFallback
                                src={card.player.image}
                                alt={card.player.name}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                            </div>
                            
                            {/* Player Info */}
                            <div className="relative z-10 text-center space-y-1">
                              <h4 className="font-bold text-sm">{card.player.name}</h4>
                              <p className="text-xs text-muted-foreground">{card.player.game}</p>
                              <p className="text-xs text-muted-foreground">{card.player.position}</p>
                              <p className="text-sm font-semibold text-primary">{card.player.price}</p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <div className="text-center space-x-4">
              <Button 
                onClick={resetPack}
                variant="outline"
                className="px-8 py-3"
              >
                Open Another Pack
              </Button>
              <Button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3">
                Add to Collection
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
