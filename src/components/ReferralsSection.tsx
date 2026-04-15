import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion } from 'motion/react';
import { Share2, Copy, Check, Users, TrendingUp, Trophy, Gift, ArrowRight } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAuthentication } from '../hooks/useAuthentication';
import { apiService } from '../services/apiService';
import { toast } from 'sonner';
import { getPreferredWallet } from '../utils/walletPreference';

interface ReferralStats {
  totalReferred: number;
  totalPointsEarned: number;
  rank: number | null;
  referrals: Array<{
    referredUserId: string;
    referredWallet: string;
    createdAt: string;
    pointsEarned: number;
  }>;
}

interface LeaderboardEntry {
  userId: string;
  walletAddress: string;
  referralCount: number;
  totalPointsEarned: number;
}

export default memo(function ReferralsSection() {
  const { t } = useTranslation();
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { isAuthenticated, authenticate, isAuthenticating } = useAuthentication();

  const walletAddress = getPreferredWallet(wallets)?.address;

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  const referralLink = referralCode
    ? `${window.location.origin}?ref=${referralCode}`
    : null;

  const loadReferralData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [codeRes, statsRes, leaderboardRes] = await Promise.all([
        apiService.generateReferralCode(),
        apiService.getReferralStats(),
        apiService.getReferralLeaderboard(),
      ]);

      setReferralCode(codeRes.code);
      setStats(statsRes);
      setLeaderboard(leaderboardRes);
    } catch (err: any) {
      console.error('Failed to load referral data:', err);
      toast.error(t('referrals.loadError'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    loadReferralData();
  }, [loadReferralData]);

  const handleSaveCustomCode = async () => {
    const code = customCode.trim().toUpperCase();
    if (!code || code.length < 3 || code.length > 16) {
      toast.error(t('referrals.codeLength'));
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      toast.error(t('referrals.codeFormat'));
      return;
    }
    try {
      setSavingCode(true);
      const res = await apiService.generateReferralCode(code);
      setReferralCode(res.code);
      setIsEditingCode(false);
      setCustomCode('');
      toast.success(t('referrals.codeSaved'));
    } catch (err: any) {
      toast.error(err.message || t('referrals.codeTaken'));
    } finally {
      setSavingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setHasCopiedCode(true);
    toast.success(t('referrals.copied'));
    setTimeout(() => setHasCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setHasCopiedLink(true);
    toast.success(t('referrals.copied'));
    setTimeout(() => setHasCopiedLink(false), 2000);
  };

  const truncateAddress = (addr: string | undefined | null) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown';

  // Not connected state
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="p-8 text-center border-0 shadow-lg max-w-md">
          <Share2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">{t('referrals.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('referrals.connectWallet')}</p>
        </Card>
      </div>
    );
  }

  // Connected but not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="p-8 text-center border-0 shadow-lg max-w-md">
          <Share2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">{t('referrals.title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('referrals.authenticateFirst')}</p>
          <Button
            onClick={() => authenticate()}
            disabled={isAuthenticating}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
          >
            {isAuthenticating ? t('header.authenticating') : t('header.authenticate')}
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t('referrals.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('referrals.subtitle')}</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-6 border-0 shadow-lg">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-3"
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t('referrals.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('referrals.subtitle')}</p>
          </div>
        </motion.div>
      </div>

      {/* Share Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10">
          <h3 className="text-lg font-semibold mb-4">{t('referrals.shareYourCode')}</h3>
          <div className="space-y-4">
            {/* Referral Code */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('referrals.yourReferralCode')}</label>
              {!referralCode ? (
                /* No code yet — let user choose a custom one or auto-generate */
                <div className="space-y-2 mt-1.5">
                  <div className="flex gap-2">
                    <Input
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                      placeholder={t('referrals.enterCustomCode')}
                      maxLength={16}
                      className="font-mono text-lg tracking-wider bg-background/80 uppercase"
                      onKeyDown={(e) => e.key === 'Enter' && customCode.trim() && handleSaveCustomCode()}
                    />
                    <Button
                      onClick={handleSaveCustomCode}
                      disabled={savingCode || !customCode.trim()}
                      className="shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0"
                    >
                      {savingCode ? <span className="animate-pulse">...</span> : t('referrals.setCode')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('referrals.codeHintSetup')}</p>
                </div>
              ) : (
                /* Code is set — display only, no editing */
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={referralCode}
                    readOnly
                    className="font-mono text-lg tracking-wider bg-background/80"
                  />
                  <Button onClick={handleCopyCode} variant="outline" size="icon" className="shrink-0 h-10 w-10">
                    {hasCopiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Referral Link */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('referrals.referralLink')}</label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={referralLink || ''}
                  readOnly
                  className="font-mono text-xs bg-background/80"
                />
                <Button onClick={handleCopyLink} variant="outline" size="icon" className="shrink-0 h-10 w-10">
                  {hasCopiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('referrals.totalReferred')}</p>
                <p className="text-3xl font-bold mt-2">{stats?.totalReferred ?? 0}</p>
              </div>
              <div className="bg-blue-500/10 p-3 rounded-xl">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('referrals.pointsEarned')}</p>
                <p className="text-3xl font-bold mt-2">{stats?.totalPointsEarned ?? 0}</p>
              </div>
              <div className="bg-green-500/10 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('referrals.yourRank')}</p>
                <p className="text-3xl font-bold mt-2">
                  {stats?.rank ? `#${stats.rank}` : '-'}
                </p>
              </div>
              <div className="bg-yellow-500/10 p-3 rounded-xl">
                <Trophy className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* How It Works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-6 border-0 shadow-lg">
          <h3 className="text-lg font-semibold mb-4">{t('referrals.howItWorks')}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Share2, title: t('referrals.step1Title'), desc: t('referrals.step1Desc') },
              { icon: Users, title: t('referrals.step2Title'), desc: t('referrals.step2Desc') },
              { icon: Gift, title: t('referrals.step3Title'), desc: t('referrals.step3Desc') },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center p-4 rounded-lg bg-accent/30">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2.5 rounded-xl mb-3">
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <p className="font-medium text-sm mb-1">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
                {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground mt-2 hidden sm:block" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">{t('referrals.boostNote')}</p>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Your Referrals */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">{t('referrals.yourReferrals')}</h3>
            {stats?.referrals && stats.referrals.length > 0 ? (
              <div className="space-y-3">
                {stats.referrals.map((referral, index) => (
                  <motion.div
                    key={referral.referredUserId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30"
                  >
                    <div>
                      <p className="font-medium font-mono text-sm">
                        {truncateAddress(referral.referredWallet)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      +{referral.pointsEarned} pts
                    </Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('referrals.noReferralsYet')}</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Leaderboard */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-6 border-0 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">{t('referrals.leaderboard')}</h3>
            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      entry.walletAddress?.toLowerCase() === walletAddress?.toLowerCase()
                        ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-primary/20'
                        : 'bg-accent/30'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold w-8 text-center">
                        {index === 0 ? '\u{1F947}' : index === 1 ? '\u{1F948}' : index === 2 ? '\u{1F949}' : `#${index + 1}`}
                      </span>
                      <div>
                        <p className="font-medium font-mono text-sm">
                          {truncateAddress(entry.walletAddress)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.referralCount} {t('referrals.referralsCount')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      +{entry.totalPointsEarned} pts
                    </Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('referrals.noLeaderboardYet')}</p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
});
