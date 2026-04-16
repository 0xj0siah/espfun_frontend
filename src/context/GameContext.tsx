import { createContext, useContext, useState } from 'react';

interface GameContextType {
  selectedGame: string;
  setSelectedGame: (game: string) => void;
}

const GameContext = createContext<GameContextType>({
  selectedGame: 'LoL',
  setSelectedGame: () => {},
});

export const useGameContext = () => useContext(GameContext);

export const GameProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedGame, setSelectedGame] = useState(() => {
    return localStorage.getItem('selectedGame') || 'LoL';
  });

  const handleSetSelectedGame = (game: string) => {
    setSelectedGame(game);
    localStorage.setItem('selectedGame', game);
  };

  return (
    <GameContext.Provider value={{ selectedGame, setSelectedGame: handleSetSelectedGame }}>
      {children}
    </GameContext.Provider>
  );
};
