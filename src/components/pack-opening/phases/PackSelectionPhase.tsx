import { motion } from 'motion/react';
import { Trophy, AlertCircle, Loader2, FlaskConical } from 'lucide-react';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { RiveFoilIdle } from '../effects/RiveFoilIdle';
import { PACK_DESIGNS } from '../constants';
import { formatPoints } from '../../../utils/formatPoints';
import type { PackSelectionPhaseProps } from '../types';

export function PackSelectionPhase({
  availablePacks,
  userPoints,
  isAuthenticated,
  walletConnected,
  isAuthenticating,
  authError,
  loading,
  error,
  testMode,
  onToggleTestMode,
  onSelectPack,
  onTestOpen,
  onRetryAuth,
  riveFoilIdleBuffer,
}: PackSelectionPhaseProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent text-2xl font-bold">
          Open Player Packs
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Each pack contains 4 esports player cards. Higher tiers mean better odds for rare players.
        </p>

        {/* User Points */}
        {userPoints && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-yellow-500/90 to-amber-600/90 text-white px-5 py-2 rounded-full shadow-lg text-sm"
          >
            <Trophy className="w-4 h-4" />
            <span className="font-bold">
              {formatPoints(userPoints.tournamentPoints)} Points
            </span>
          </motion.div>
        )}

        {/* Auth warnings */}
        {!walletConnected && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">Connect wallet to purchase packs</span>
            </div>
          </div>
        )}

        {walletConnected && !isAuthenticated && (
          isAuthenticating ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span className="font-medium">Authenticating...</span>
              </div>
            </div>
          ) : authError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">Authentication Failed</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{authError}</p>
              {onRetryAuth && (
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40" onClick={onRetryAuth}>
                  Try Again
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">Authentication Required</span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Connect your wallet to purchase packs.</p>
            </div>
          )
        )}

        {/* Test mode toggle */}
        <div className="flex justify-center">
          <button
            onClick={onToggleTestMode}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
              testMode
                ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <FlaskConical className="w-3 h-3" />
            {testMode ? 'Test Mode ON' : 'Test Mode'}
          </button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="flex justify-center">
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <Skeleton className="rounded-lg" style={{ width: 180, height: 260 }} />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-12 space-y-3">
          <p className="text-red-500 font-medium">Failed to load packs</p>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      )}

      {/* Pack Grid */}
      {!loading && !error && availablePacks.length > 0 && (
        <div className="flex justify-center">
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {/* Test Pack */}
            {testMode && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  whileHover={{ scale: 1.05, y: -8, rotateY: 3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="cursor-pointer"
                  style={{ perspective: 800 }}
                  onClick={onTestOpen}
                >
                  <div
                    className="relative rounded-lg overflow-hidden"
                    style={{
                      width: 180,
                      height: 260,
                      background: 'linear-gradient(165deg, #065f46 0%, #047857 40%, #065f46 100%)',
                      boxShadow: '0 8px 30px rgba(16,185,129,0.25), 0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%)',
                      backgroundSize: '3px 3px',
                    }} />
                    <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
                      <FlaskConical className="w-10 h-10 text-emerald-200/60 mb-3" />
                      <p className="text-emerald-100 font-black text-sm tracking-wider mb-1">TEST PACK</p>
                      <p className="text-emerald-200/40 text-[9px] tracking-widest uppercase">4 Random Cards</p>
                    </div>
                    <div className="absolute inset-0 overflow-hidden rounded-lg">
                      <div className="shimmer-sweep absolute inset-0 opacity-15" />
                    </div>
                  </div>
                </motion.div>
                <span className="text-muted-foreground text-xs font-medium">Free</span>
              </motion.div>
            )}

            {/* Real Packs */}
            {availablePacks.map((pack, index) => {
              const design = PACK_DESIGNS[pack.id] || PACK_DESIGNS.PRO;
              const disabled = !testMode && (!isAuthenticated || isAuthenticating);
              const isLegendary = pack.id === 'LEGENDARY';

              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.12 }}
                  className="flex flex-col items-center gap-3"
                >
                  <motion.div
                    whileHover={disabled ? {} : { scale: 1.06, y: -10, rotateY: 4 }}
                    whileTap={disabled ? {} : { scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className={disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    style={{ perspective: 800 }}
                    onClick={() => !disabled && onSelectPack(pack)}
                  >
                    {/* Pack wrapper */}
                    <div
                      className="relative rounded-lg overflow-hidden"
                      style={{
                        width: 180,
                        height: 260,
                        background: design.foilGradient,
                        boxShadow: `
                          0 12px 40px ${design.glowColor},
                          0 4px 12px rgba(0,0,0,0.4),
                          0 0 0 1px rgba(255,255,255,0.06)
                          ${isLegendary ? `, 0 0 60px ${design.foilAccent}30` : ''}
                        `,
                      }}
                    >
                      {/* Metallic grain texture */}
                      <div className="absolute inset-0 opacity-[0.07]" style={{
                        backgroundImage: `
                          repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.15) 1px, rgba(255,255,255,0.15) 2px),
                          repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)
                        `,
                        backgroundSize: '3px 3px',
                      }} />

                      {/* Wrapper crinkle highlights */}
                      <div className="absolute inset-0 opacity-[0.05]" style={{
                        backgroundImage: `
                          linear-gradient(168deg, transparent 18%, rgba(255,255,255,0.9) 18.4%, transparent 18.8%),
                          linear-gradient(173deg, transparent 52%, rgba(255,255,255,0.7) 52.4%, transparent 52.8%),
                          linear-gradient(162deg, transparent 71%, rgba(255,255,255,0.6) 71.4%, transparent 71.8%),
                          linear-gradient(177deg, transparent 38%, rgba(255,255,255,0.5) 38.4%, transparent 38.8%)
                        `,
                      }} />

                      {/* Top heat seal */}
                      <div className="absolute top-0 left-0 right-0 h-[14px]" style={{
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 50%, transparent 100%)',
                      }} />
                      <div className="absolute top-[4px] left-[10px] right-[10px] h-[5px] rounded-sm" style={{
                        backgroundImage: `repeating-linear-gradient(90deg, ${design.foilAccent}25 0px, ${design.foilAccent}25 3px, transparent 3px, transparent 6px)`,
                      }} />

                      {/* Holographic rainbow strip */}
                      <div className="absolute left-0 right-0 h-[5px]" style={{
                        top: '38%',
                        background: 'linear-gradient(90deg, #ff000025, #ff800025, #ffff0025, #00ff0025, #0080ff25, #8000ff25, #ff000025)',
                        backgroundSize: '200% 100%',
                        animation: 'holo-shift 4s linear infinite',
                        mixBlendMode: 'screen',
                      }} />

                      {/* Tear notch */}
                      <div className="absolute right-0 w-[7px] h-[10px]" style={{
                        top: '37%',
                        background: `linear-gradient(to left, ${design.foilAccent}50, transparent)`,
                        clipPath: 'polygon(100% 0, 0 50%, 100% 100%)',
                      }} />

                      {/* Pack artwork */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
                        <div className="relative mb-3">
                          <img
                            src="/oglogonobg.png"
                            alt="ESP.FUN"
                            className="w-16 h-16 object-contain relative z-10"
                            style={{ filter: `drop-shadow(0 0 14px ${design.glowColor}) drop-shadow(0 2px 4px rgba(0,0,0,0.5))` }}
                          />
                        </div>
                        <h3 className="font-black text-[15px] tracking-[0.15em] uppercase mb-0.5" style={{
                          color: design.tierColor,
                          textShadow: `0 0 16px ${design.glowColor}, 0 0 32px ${design.glowColor}, 0 2px 4px rgba(0,0,0,0.6)`,
                        }}>
                          {pack.name}
                        </h3>
                        <div className="rounded-sm px-4 py-0.5 mb-2" style={{
                          background: design.tierBg,
                          border: `1px solid ${design.foilAccent}30`,
                        }}>
                          <span className="text-[8px] font-black tracking-[0.25em] uppercase" style={{ color: design.tierColor }}>
                            {design.tierLabel} SERIES
                          </span>
                        </div>
                        <p className="text-white/30 text-[8px] font-semibold tracking-[0.3em] uppercase">
                          4 PLAYER CARDS
                        </p>
                      </div>

                      {/* Bottom barcode area */}
                      <div className="absolute bottom-0 left-0 right-0 h-[32px]" style={{
                        background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.3))',
                      }}>
                        <div className="absolute bottom-[8px] left-[14px] flex gap-[1px]">
                          {[3,1,2,1,3,2,1,1,2,3,1,2,1,1,3,2,1,2,1,3,1,2,3,1].map((w, i) => (
                            <div key={i} className="bg-white/12 rounded-[0.5px]" style={{ width: w, height: 12 }} />
                          ))}
                        </div>
                        <div className="absolute bottom-[8px] right-[14px]">
                          <span className="text-white/15 text-[6px] font-mono tracking-wider">ESP-{pack.id}-S1</span>
                        </div>
                      </div>

                      {/* Shimmer sweep */}
                      <div className="absolute inset-0 overflow-hidden rounded-lg">
                        <div className="shimmer-sweep absolute inset-0 opacity-12" />
                      </div>

                      {/* Rive foil idle overlay */}
                      {riveFoilIdleBuffer && (
                        <RiveFoilIdle tier={pack.id} riveBuffer={riveFoilIdleBuffer} />
                      )}

                      {/* 3D edge insets */}
                      <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
                        boxShadow: `
                          inset 1px 0 3px rgba(255,255,255,0.1),
                          inset -1px 0 3px rgba(0,0,0,0.2),
                          inset 0 1px 3px rgba(255,255,255,0.08),
                          inset 0 -1px 4px rgba(0,0,0,0.25)
                        `,
                      }} />

                      {/* Legendary pulsing border glow */}
                      {isLegendary && (
                        <div className="absolute inset-0 rounded-lg pointer-events-none glow-pulse-border" />
                      )}
                    </div>
                  </motion.div>

                  {/* Price label */}
                  <div className="text-center">
                    <span className="text-foreground font-bold text-sm">{pack.price}</span>
                    <span className="text-muted-foreground text-xs ml-1">pts</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
