import { ImageWithFallback } from './figma/ImageWithFallback';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from './ui/sidebar';
import { useIsMobile } from './ui/use-mobile';

interface MobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileNavigation({ activeTab, onTabChange }: MobileNavigationProps) {
  const isMobile = useIsMobile();
  const navItems = ['Team', 'Transfers', 'Live Scores', 'Leaderboard', 'Pack Opening'];

  if (!isMobile) return null;

  return (
    <Sidebar className="border-r">
      <SidebarHeader>
        <div className="flex items-center space-x-3 px-2">
          <ImageWithFallback
            src="/darkmodenobg.png"
            alt="Crypto Esports Fantasy Logo"
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              ESP.fun
            </h1>
            <p className="text-xs text-muted-foreground">Fantasy League</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item}>
              <SidebarMenuButton
                onClick={() => onTabChange(item)}
                isActive={activeTab === item}
              >
                <span>{item}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}