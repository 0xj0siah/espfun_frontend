
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Github, Twitter } from 'lucide-react';

interface MobileSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
}

const navItems = ['Team', 'Transfers', 'Live Scores', 'Leaderboard', 'Pack Opening'];

export function MobileSidebar({ activeTab, onTabChange, onClose }: MobileSidebarProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Accessibility: DialogTitle and Description (visually hidden) */}
      <VisuallyHidden>
        <h2 id="mobile-sidebar-title">Navigation</h2>
        <p id="mobile-sidebar-desc">Sidebar navigation for mobile users</p>
      </VisuallyHidden>
      <div className="flex items-center space-x-3 px-4 py-4 border-b border-border/20">
        <ImageWithFallback
          src="/darkmodenobg.png"
          alt="Crypto Esports Fantasy Logo"
          className="h-10 w-10 object-contain"
        />
        {/* No text on mobile for logo */}
      </div>
      <nav className="flex-1 flex flex-col gap-2 p-4">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => {
              onTabChange(item);
              onClose();
            }}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors duration-150 ${
              activeTab === item
                ? 'bg-accent text-primary shadow'
                : 'bg-transparent text-foreground hover:bg-accent/50'
            }`}
            aria-current={activeTab === item ? 'page' : undefined}
          >
            {item}
          </button>
        ))}
      </nav>
      {/* Social links at the bottom on mobile */}
      <div className="mt-auto px-4 pb-6">
        <div className="flex items-center space-x-6 justify-center">
          <a
            href="https://github.com/0xj0siah/espfun_frontend"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <Github className="h-5 w-5" />
            <span className="text-sm font-medium">GitHub</span>
          </a>
          <a
            href="https://x.com/esp_fun"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <Twitter className="h-5 w-5" />
            <span className="text-sm font-medium">X / Twitter</span>
          </a>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          © 2025 ESP.FUN. All rights reserved.
        </p>
      </div>
    </div>
  );
}
