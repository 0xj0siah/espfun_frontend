export interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  winRate: number;
}

export interface PlayerMatch {
  opponent: string;
  result: 'win' | 'loss';
  score: string;
  performance: number;
}

export interface Player {
  id: number;
  name: string;
  game: string;
  position: string;
  price: string;
  trend: 'up' | 'down' | 'stable';
  points: number;
  rating: number;
  image: string;
  gridID?: string;
  teamGridId?: string;
  stats: PlayerStats;
  recentMatches: PlayerMatch[];
  level: number;
  xp: number;
  potential: number;
  lockedShares?: string;
  ownedShares?: bigint;
  totalValue?: string;
  gamesRemaining?: number;
}
