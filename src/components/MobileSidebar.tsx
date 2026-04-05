import { useTranslation } from 'react-i18next';
import { Users, ArrowLeftRight, Radio, Trophy, Package, Coins, Share2, Github, LayoutDashboard } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from './ui/sheet';

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  { id: 'Dashboard', icon: LayoutDashboard, i18nKey: 'nav.dashboard' },
] as const;

export function MobileSidebar({ open, onOpenChange, activeTab, onTabChange }: MobileSidebarProps) {
  const { t } = useTranslation();

  const handleTabSelect = (tab: string) => {
    onTabChange(tab);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[264px] p-0">
        <SheetHeader className="px-4 pt-5 pb-2">
          <SheetTitle className="text-lg bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            ESP.fun
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {tabs.map(({ id, icon: Icon, i18nKey }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => handleTabSelect(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'text-primary bg-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {t(i18nKey)}
                </span>
              </button>
            );
          })}
        </nav>

        <SheetFooter className="border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/0xj0siah/espfun_frontend"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://x.com/espfun_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            &copy; {new Date().getFullYear()} ESP.FUN
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
