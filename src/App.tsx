import { useState, useEffect } from 'react';
import Header from './components/Header';
import TeamSection from './components/TeamSection';
import TransfersSection from './components/TransfersSection';
import LiveScoresSection from './components/LiveScoresSection';
import LeaderboardSection from './components/LeaderboardSection';
import PackOpeningSection from './components/PackOpeningSection';
import { usePlayerPrices } from './hooks/usePlayerPricing';
import fakeData from './fakedata.json';
import { getActivePlayerIds } from './utils/contractInteractions';
import { useAuthentication } from './hooks/useAuthentication';

// Import debug utility
import './utils/contractDebug';

export default function App() {
  const [activeTab, setActiveTab] = useState('Team');
  const [activePlayerIds, setActivePlayerIds] = useState<number[]>([]);

  // Authentication hook for JWT token validation
  const { validateToken, isAuthenticated, hasAuthToken } = useAuthentication();

  // Validate JWT token on page load
  useEffect(() => {
    const validateExistingToken = async () => {
      // Only validate if we have a token in localStorage
      if (hasAuthToken) {
        console.log('🔐 Validating existing JWT token on page load...');
        try {
          const isValid = await validateToken();
          if (isValid) {
            console.log('✅ JWT token is still valid');
          } else {
            console.log('❌ JWT token has expired or is invalid');
          }
        } catch (error) {
          console.error('❌ Error validating JWT token:', error);
        }
      } else {
        console.log('ℹ️ No existing JWT token found');
      }
    };

    // Small delay to ensure Privy is ready
    const timer = setTimeout(validateExistingToken, 1000);
    return () => clearTimeout(timer);
  }, [validateToken, hasAuthToken]);

  // Fetch active player IDs on mount
  useEffect(() => {
    const fetchActivePlayers = async () => {
      try {
        const activeIds = await getActivePlayerIds();
        console.log('✅ App: Active player IDs from contract:', activeIds.map(id => Number(id)));
        setActivePlayerIds(activeIds.map(id => Number(id)));
      } catch (error) {
        console.error('❌ App: Error fetching active player IDs:', error);
        // Fallback to all players if contract fails
        setActivePlayerIds(fakeData.teamPlayers.map(player => player.id));
      }
    };
    fetchActivePlayers();
  }, []);

  // Only preload prices for active players
  const { prices: preloadedPrices, loading: pricesLoading } = usePlayerPrices(activePlayerIds);

  // Debug logging
  console.log('🚀 App: activePlayerIds:', activePlayerIds);
  console.log('🚀 App: preloadedPrices keys:', Object.keys(preloadedPrices));
  console.log('🚀 App: pricesLoading:', pricesLoading);

  const renderContent = () => {
    switch (activeTab) {
      case 'Team':
        return <TeamSection preloadedPrices={preloadedPrices} pricesLoading={pricesLoading} />;
      case 'Transfers':
        return <TransfersSection />;
      case 'Live Scores':
        return <LiveScoresSection />;
      case 'Leaderboard':
        return <LeaderboardSection />;
      case 'Pack Opening':
        return <PackOpeningSection />;
      default:
        return <TeamSection preloadedPrices={preloadedPrices} pricesLoading={pricesLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
      
      {/* Background decorative elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/5 to-purple-600/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-green-500/5 to-emerald-600/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}