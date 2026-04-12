import { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Header from './components/Header';
import { useIsMobile } from './components/ui/use-mobile';
import TeamSection from './components/TeamSection';
import { PasswordGate } from './components/PasswordGate';
import { useAuthentication } from './hooks/useAuthentication';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { PriceProvider } from './context/PriceContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded sections (deferred until tab is selected)
const TransfersSection = lazy(() => import('./components/TransfersSection'));
const LiveScoresSection = lazy(() => import('./components/LiveScoresSection'));
const LeaderboardSection = lazy(() => import('./components/LeaderboardSection'));
const PackOpeningSection = lazy(() => import('./components/pack-opening/PackOpeningSection'));
const StakingSection = lazy(() => import('./components/StakingSection'));
const DashboardSection = lazy(() => import('./components/DashboardSection'));
const AdvancedTradeView = lazy(() => import('./components/AdvancedTradeView'));

// Import icons
import { Github } from 'lucide-react';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('Team');
  const [advancedViewPlayer, setAdvancedViewPlayer] = useState<any>(null);
  const isMobile = useIsMobile();

  // Authentication hook for JWT token validation
  const { validateToken, isAuthenticated, hasAuthToken } = useAuthentication();

  // Detect ?ref= URL parameter and store for later use during login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && /^[a-zA-Z0-9_-]{1,32}$/.test(ref)) {
      localStorage.setItem('pendingReferralCode', ref);
      // Clean URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  // Validate JWT token on page load
  useEffect(() => {
    const validateExistingToken = async () => {
      if (hasAuthToken) {
        try {
          await validateToken();
        } catch (error) {
          // Token validation failed silently
        }
      }
    };

    // Small delay to ensure Privy is ready
    const timer = setTimeout(validateExistingToken, 1000);
    return () => clearTimeout(timer);
  }, [validateToken, hasAuthToken]);

  const renderContent = () => {
    switch (activeTab) {
      case 'Team':
        return <TeamSection onAdvancedView={setAdvancedViewPlayer} />;
      case 'Transfers':
        return <TransfersSection onAdvancedView={setAdvancedViewPlayer} />;
      case 'Live Scores':
        return <LiveScoresSection />;
      case 'Leaderboard':
        return <LeaderboardSection />;
      case 'Pack Opening':
        return <PackOpeningSection />;
      case 'Staking':
        return <StakingSection />;
      case 'Dashboard':
        return <DashboardSection />;
      default:
        return <TeamSection />;
    }
  };

  return (
    <PasswordGate>
      <AuthProvider>
        <GameProvider>
        <PriceProvider>
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
          <Header activeTab={activeTab} onTabChange={(tab) => { setAdvancedViewPlayer(null); setActiveTab(tab); }} />

        <main className={`flex-1 max-w-[1440px] 2xl:max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12 ${isMobile ? 'pt-4 pb-4' : 'py-8 lg:py-10'} isolate`}>
          <ErrorBoundary>
            {advancedViewPlayer ? (
              <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">{t('common.loading')}</div></div>}>
                <AdvancedTradeView
                  player={advancedViewPlayer}
                  onBack={() => setAdvancedViewPlayer(null)}
                />
              </Suspense>
            ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">{t('common.loading')}</div></div>}>
                  {renderContent()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
            )}
          </ErrorBoundary>
        </main>

        {/* Footer with Social Links (hidden on mobile) */}
        {!isMobile && (
          <footer className="border-t border-border/50 bg-background/95 backdrop-blur-sm">
            <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
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
      <Toaster richColors position={isMobile ? "top-center" : "bottom-right"} />
      </PriceProvider>
      </GameProvider>
      </AuthProvider>
    </PasswordGate>
  );
}