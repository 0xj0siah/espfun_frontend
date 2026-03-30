import { useState, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import Header from './components/Header';
import { useIsMobile } from './components/ui/use-mobile';
import TeamSection from './components/TeamSection';
import { PasswordGate } from './components/PasswordGate';
import { usePlayerPrices } from './hooks/usePlayerPricing';
import fakeData from './fakedata.json';
import { getActivePlayerIds } from './utils/contractInteractions';
import { useAuthentication } from './hooks/useAuthentication';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded sections (deferred until tab is selected)
const TransfersSection = lazy(() => import('./components/TransfersSection'));
const LiveScoresSection = lazy(() => import('./components/LiveScoresSection'));
const LeaderboardSection = lazy(() => import('./components/LeaderboardSection'));
const PackOpeningSection = lazy(() => import('./components/pack-opening/PackOpeningSection'));
const StakingSection = lazy(() => import('./components/StakingSection'));

// Import icons
import { Github } from 'lucide-react';
import { Toaster } from 'sonner';

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('Team');
  const [activePlayerIds, setActivePlayerIds] = useState<number[]>([]);
  const isMobile = useIsMobile();

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
      case 'Staking':
        return <StakingSection />;
      default:
        return <TeamSection preloadedPrices={preloadedPrices} pricesLoading={pricesLoading} />;
    }
  };

  return (
    <PasswordGate>
      <AuthProvider>
        <GameProvider>
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
          <Header activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 isolate">
          <ErrorBoundary>
            <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">{t('common.loading')}</div></div>}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Footer with Social Links (hidden on mobile) */}
        {!isMobile && (
          <footer className="border-t border-border/50 bg-background/95 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="flex items-center space-x-6">
                  <a
                    href="https://github.com/0xj0siah/espfun_frontend"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    <Github className="h-5 w-5" />
                    <span className="text-sm font-medium">GitHub</span>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  © {new Date().getFullYear()} ESP.FUN. {t('footer.allRightsReserved')}
                </p>
              </div>
            </div>
          </footer>
        )}

        {/* Background decorative elements */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/5 to-purple-600/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-green-500/5 to-emerald-600/5 rounded-full blur-3xl"></div>
        </div>
      </div>
      <Toaster richColors position="bottom-right" />
      </GameProvider>
      </AuthProvider>
    </PasswordGate>
  );
}