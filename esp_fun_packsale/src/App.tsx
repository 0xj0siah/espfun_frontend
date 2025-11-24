import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Input } from './components/ui/input';
import { Wallet, Package, TrendingUp, Users, Moon, Sun, Plus, Minus } from 'lucide-react';

function App() {
  const { login, logout, authenticated, user } = usePrivy();
  const [packQuantity, setPackQuantity] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const PACK_PRICE = 10; // $10 per pack in USDC

  // Initialize dark mode on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      // Default to dark mode
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
  };

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value) || 0;
    setPackQuantity(Math.max(1, num));
  };

  const incrementQuantity = () => {
    setPackQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setPackQuantity(prev => Math.max(1, prev - 1));
  };

  const handlePurchase = () => {
    if (!authenticated) {
      login();
      return;
    }
    // TODO: Implement buyPacks contract call
    alert(`Purchase ${packQuantity} pack(s) for $${packQuantity * PACK_PRICE} USDC - Coming soon!`);
  };

  const totalCost = packQuantity * PACK_PRICE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20 text-foreground">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={isDarkMode ? "/darkmodenobg.png" : "/lightmodenobg.png"} 
                alt="ESP.FUN Logo" 
                className="h-10 w-10 object-contain shadow-lg" 
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">ESP.FUN Presale</h1>
              <p className="text-sm text-muted-foreground">Fantasy Esports Player Packs</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
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
            {authenticated ? (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}</p>
                  <p className="text-xs text-muted-foreground">{user?.email?.address || 'Connected'}</p>
                </div>
                <Button onClick={logout} variant="outline" className="bg-accent/50 border-0 shadow-sm">
                  Disconnect
                </Button>
              </>
            ) : (
              <Button 
                onClick={login}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Badge className="mb-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/50" variant="outline">
          Presale Live Now 🔥
        </Badge>
        <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
          Get Your Player Packs Early
        </h2>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Be among the first to build your fantasy esports team. Purchase player packs during presale and help us generate liquidity for launch!
        </p>
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-500" />
            <span><strong>1,247</strong> participants</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span><strong>8,432</strong> packs sold</span>
          </div>
        </div>
      </section>

      {/* Pack Purchase */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-2xl border-border/50">
            <CardHeader className="text-center">
              <div className="w-full h-48 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 mb-6 flex items-center justify-center">
                <Package className="w-24 h-24 text-white" />
              </div>
              <CardTitle className="text-3xl">Player Pack</CardTitle>
              <CardDescription className="text-lg mt-2">
                Each pack contains 5 random player NFTs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pack Details */}
              <div className="bg-accent/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Price per pack</span>
                  <span className="font-bold text-xl">${PACK_PRICE} USDC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Players per pack</span>
                  <span className="font-semibold">5 NFTs</span>
                </div>
              </div>

              <Separator />

              {/* Quantity Selector */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Select Quantity</label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrementQuantity}
                    className="h-12 w-12"
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Input
                    type="number"
                    value={packQuantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="text-center text-2xl font-bold h-12 no-spinner"
                    min="1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={incrementQuantity}
                    className="h-12 w-12"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Total Cost */}
              <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Cost</span>
                  <span className="text-3xl font-bold">${totalCost} USDC</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {packQuantity} pack{packQuantity !== 1 ? 's' : ''} × ${PACK_PRICE} = {packQuantity * 5} player NFTs
                </p>
              </div>

              {/* Purchase Button */}
              <Button
                onClick={handlePurchase}
                className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg"
                disabled={!authenticated}
              >
                {authenticated ? (
                  <>
                    <Wallet className="w-5 h-5 mr-2" />
                    Purchase {packQuantity} Pack{packQuantity !== 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5 mr-2" />
                    Connect Wallet to Purchase
                  </>
                )}
              </Button>

              {!authenticated && (
                <p className="text-sm text-muted-foreground text-center">
                  Connect your wallet to participate in the presale
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-8">Presale Benefits</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Early Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get your players before the official launch and start building your strategy.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  Bonus Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Presale packs include bonus players and higher chances for rare cards.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Support Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Help generate liquidity for the platform and earn exclusive founder rewards.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p className="font-medium">&copy; 2025 ESP.FUN - Crypto Fantasy Esports Platform</p>
          <p className="text-sm mt-2">Presale proceeds support platform development and player liquidity</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
