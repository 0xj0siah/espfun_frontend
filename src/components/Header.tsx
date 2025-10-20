import { useState, useEffect } from 'react';
import { useIsMobile } from './ui/use-mobile';
import { Sheet, SheetContent } from './ui/sheet';
import { MobileSidebar } from './MobileSidebar';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button'; 
import { Wallet, User, Moon, Sun, Send, ArrowDownToLine, Copy, ArrowRight, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { QRCodeSVG } from 'qrcode.react';
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWalletTransactions } from "../hooks/useWalletTransactions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { useAuthentication } from '../hooks/useAuthentication';
import { useAuthContext } from '../context/AuthContext';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const navItems = ['Team', 'Transfers', 'Live Scores', 'Pack Opening'];
  const [selectedGame, setSelectedGame] = useState('CS2');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { login, logout, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { globalAuthState } = useAuthContext();
  
  // Transaction handling with new unified system
  const { sendTransactionWithWallet, isEmbeddedWallet } = useWalletTransactions();

  // Get the active wallet address (works for both embedded and external wallets)
  const getActiveWalletAddress = () => {
    if (!wallets || wallets.length === 0) return null;
    
    // Return the first connected wallet's address (embedded or external)
    return wallets[0]?.address || null;
  };

  const activeWalletAddress = getActiveWalletAddress();
  const { isAuthenticated, isAuthenticating, error: authError, authenticate } = useAuthentication();

  const games = [
    { value: 'CS2', label: 'Counter-Strike 2' },
    { value: 'League of Legends', label: 'League of Legends' }
  ];

  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  // Send ETH using Privy wallet
  const handleSend = async () => {
    if (!authenticated) {
      setError("Please connect your wallet first.");
      return;
    }
    
    if (!sendAmount || !recipientAddress) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      if (!user?.wallet) {
        setError("Wallet not available.");
        return;
      }

      // Send transaction using the unified wallet system
      // This will automatically handle embedded wallets seamlessly and show prompts for external wallets
      const result = await sendTransactionWithWallet({
        to: recipientAddress as `0x${string}`,
        value: BigInt(Math.floor(parseFloat(sendAmount) * 1e18)), // Convert ETH to Wei
      });

      console.log('Transaction sent:', result.hash);
      setIsSendModalOpen(false);
      setSendAmount('');
      setRecipientAddress('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send transaction");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle deposit modal actions
  const handleDeposit = () => {
    if (!authenticated) {
      setError("Please connect your wallet first.");
      return;
    }
    setIsDepositModalOpen(true);
  };

  const handleCopyAddress = async () => {
    if (activeWalletAddress) {
      await navigator.clipboard.writeText(activeWalletAddress);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };


  return (
    <header className="bg-background/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              {/* On mobile, logo is a button to open sidebar */}
              {isMobile ? (
                <button
                  className="relative focus:outline-none"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <ImageWithFallback
                    src={isDarkMode ? "/darkmodenobg.png" : "/lightmodenobg.png"}
                    alt="Crypto Esports Fantasy Logo"
                    className="h-10 w-10 object-contain shadow-lg"
                  />
                </button>
              ) : (
                <div className="relative">
                  <ImageWithFallback
                    src={isDarkMode ? "/darkmodenobg.png" : "/lightmodenobg.png"}
                    alt="Crypto Esports Fantasy Logo"
                    className="h-10 w-10 object-contain shadow-lg"
                  />
                </div>
              )}
              <div className="ml-3">
                <h1 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent hidden sm:block">ESP.fun</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Fantasy League</p>
              </div>
            </div>

            {/* Navigation: hidden on mobile, visible on desktop */}
            {!isMobile && (
              <nav className="flex space-x-1">
                {navItems.map((item) => (
                  <button
                    key={item}
                    onClick={() => onTabChange(item)}
                    className={`px-4 py-2 rounded-lg transition-all duration-200 relative overflow-hidden ${
                      activeTab === item
                        ? 'text-primary bg-accent shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                  >
                    {activeTab === item && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-lg"></div>
                    )}
                    <span className="relative z-10">{item}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>
        {/* Mobile Sidebar Drawer */}
        {isMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent
              side="left"
              className="p-0 w-64"
              aria-labelledby="mobile-sidebar-title"
              aria-describedby="mobile-sidebar-desc"
            >
              <MobileSidebar
                onClose={() => setSidebarOpen(false)}
                activeTab={activeTab}
                onTabChange={onTabChange}
              />
            </SheetContent>
          </Sheet>
        )}

          {/* Right Section - Controls */}
          <div className="flex items-center space-x-4">
            {/* Authentication Error Alert */}
            {authError && (
              <Alert variant="destructive" className="mr-4 max-w-xs">
                <AlertDescription className="text-sm">{authError}</AlertDescription>
              </Alert>
            )}

            {/* Game Selector */}
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger className="w-44 bg-accent/50 border-0 shadow-sm">
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((game) => (
                  <SelectItem key={game.value} value={game.value}>
                    {game.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Dark Mode Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleDarkMode}
              className="h-9 w-9 bg-accent/50 border-0 shadow-sm hidden md:inline-flex"
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Wallet Connection */}
            {!authenticated ? (
              <Button 
                onClick={() => login()} 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg"
                disabled={!ready}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            ) : !globalAuthState && !isAuthenticated ? (
              <Button 
                onClick={() => authenticate()} 
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 shadow-lg"
                disabled={isAuthenticating}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {isAuthenticating ? "Authenticating..." : "Authenticate"}
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-accent/50 border-0 shadow-sm">
                    <User className="w-4 h-4 mr-2" />
                    {activeWalletAddress
                      ? `${activeWalletAddress.slice(0, 6)}...${activeWalletAddress.slice(-4)}`
                      : "Wallet"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <div className="flex flex-col">
                      <span className="text-sm">Wallet Address</span>
                      <span className="text-xs text-muted-foreground">
                        {activeWalletAddress}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* Only show Send and Deposit for embedded wallets */}
                  {isEmbeddedWallet && (
                    <>
                      <DropdownMenuItem onClick={() => setIsSendModalOpen(true)}>
                        <Send className="w-4 h-4 mr-2" />
                        Send MON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsDepositModalOpen(true)}>
                        <ArrowDownToLine className="w-4 h-4 mr-2" />
                        Deposit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={logout}>
                    Disconnect Wallet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Send ETH Modal */}
      <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
        <DialogContent className="max-w-[300px] w-[90vw]">
          <DialogHeader className="space-y-2">
            <DialogTitle>Send MON</DialogTitle>
            <DialogDescription>
              Send MON to any Monad address
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Card className="p-4 bg-accent/30">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recipient Monad Address</label>
                  <Input
                    placeholder="0x..."
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount (MON)</label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    min="0"
                    step="0.001"
                  />
                </div>
              </div>
            </Card>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSendModalOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              disabled={isLoading || !sendAmount || !recipientAddress}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
            >
              {isLoading ? "Sending..." : "Send MON"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent className="max-w-[300px] w-[90vw]">
          <DialogHeader className="space-y-2">
            <DialogTitle>Deposit Funds</DialogTitle>
            <DialogDescription>
              Add funds to your wallet using your preferred method
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Card className="p-4 bg-accent/30">
              <div className="text-center space-y-4">
                {activeWalletAddress && (
                  <div className="bg-background/80 p-4 rounded-lg inline-block mx-auto">
                    <QRCodeSVG
                      value={activeWalletAddress}
                      size={180}
                      className="mx-auto"
                      level="H"
                      includeMargin={true}
                      style={{ borderRadius: '8px' }}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Your Wallet Address</p>
                  <div className="relative">
                    <Input
                      readOnly
                      value={activeWalletAddress || ''}
                      className="pr-20 font-mono text-xs bg-background/50"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyAddress}
                      className="absolute right-0 top-0 h-full px-3 hover:bg-accent flex gap-2 items-center"
                    >
                      {hasCopied ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Send any supported tokens to this address to deposit funds into your wallet
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDepositModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}