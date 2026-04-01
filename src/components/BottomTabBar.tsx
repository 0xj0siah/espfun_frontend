import { useTranslation } from 'react-i18next';
import { Users, ArrowLeftRight, Radio, Trophy, Package, Coins, Share2 } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'Team', icon: Users, i18nKey: 'nav.team' },
  { id: 'Transfers', icon: ArrowLeftRight, i18nKey: 'nav.transfers' },
  { id: 'Live Scores', icon: Radio, i18nKey: 'nav.liveScores' },
  { id: 'Leaderboard', icon: Trophy, i18nKey: 'nav.leaderboard' },
  { id: 'Pack Opening', icon: Package, i18nKey: 'nav.packOpening' },
  { id: 'Staking', icon: Coins, i18nKey: 'nav.staking' },
  { id: 'Referrals', icon: Share2, i18nKey: 'nav.referrals' },
] as const;

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const { t } = useTranslation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map(({ id, icon: Icon, i18nKey }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] flex-1 gap-0.5 transition-colors duration-150 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:text-foreground'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  isActive ? 'scale-110' : ''
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] leading-tight truncate max-w-full px-0.5 ${
                isActive ? 'font-semibold' : 'font-medium'
              }`}>
                {t(i18nKey)}
              </span>
              {isActive && (
                <div className="absolute bottom-[env(safe-area-inset-bottom,0px)] h-0.5 w-6 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
