import { motion } from 'motion/react';
import { Trophy, AlertCircle, Loader2, FlaskConical } from 'lucide-react';
import { Button } from '../../ui/button';
import { PACK_DESIGNS } from '../constants';
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
              {userPoints.tournamentPoints.toLocaleString()} Points
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
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm">
              {isAuthenticating ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span className="font-medium">
                {isAuthenticating ? 'Authenticating...' : 'Authentication Required'}
              </span>
            </div>
            {authError && <p className="text-xs text-red-600 mt-1">{authError}</p>}
          </div>
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Loading packs...</p>
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
          <div className="flex flex-wrap justify-center gap-10">
            {/* Test Pack */}
            {testMode && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  whileHover={{ scale: 1.04, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="cursor-pointer"
                  onClick={onTestOpen}
                >
                  <div
                    className="relative rounded-md overflow-hidden"
                    style={{
                      width: 160,
                      height: 228,
                      background: 'linear-gradient(165deg, #065f46 0%, #047857 40%, #065f46 100%)',
                      boxShadow: '0 4px 20px rgba(16,185,129,0.2), 0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* Foil texture */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%)',
                      backgroundSize: '4px 4px',
                    }} />

                    {/* Content */}
                    <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
                      <FlaskConical className="w-8 h-8 text-emerald-200/70 mb-2" />
                      <p className="text-emerald-100 font-bold text-xs mb-1">TEST PACK</p>
                      <p className="text-emerald-200/50 text-[10px]">4 Random Cards</p>
                    </div>

                    {/* Tear strip */}
                    <div className="absolute top-[52px] left-0 right-0">
                      <div className="h-[3px] bg-emerald-300/40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 6px)' }} />
                    </div>

                    {/* Shine sweep */}
                    <div className="absolute inset-0 overflow-hidden rounded-md">
                      <div className="shimmer-sweep absolute inset-0 opacity-20" />
                    </div>
                  </div>
                </motion.div>
                <span className="text-muted-foreground text-xs">Free</span>
              </motion.div>
            )}

            {/* Real Packs */}
            {availablePacks.map((pack, index) => {
              const design = PACK_DESIGNS[pack.id] || PACK_DESIGNS.PRO;
              const disabled = !testMode && (!isAuthenticated || isAuthenticating);

              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <motion.div
                    whileHover={disabled ? {} : { scale: 1.04, y: -6 }}
                    whileTap={disabled ? {} : { scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    onClick={() => !disabled && onSelectPack(pack)}
                  >
                    {/* === The Foil Pack Wrapper === */}
                    <div
                      className="relative rounded-md overflow-hidden"
                      style={{
                        width: 160,
                        height: 228,
                        background: design.foilGradient,
                        boxShadow: `0 4px 24px ${design.glowColor}, 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
                      }}
                    >
                      {/* Foil micro-texture (the tiny grain you see on real foil packs) */}
                      <div className="absolute inset-0 opacity-[0.12]" style={{
                        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%)',
                        backgroundSize: '4px 4px',
                      }} />

                      {/* Wrapper crinkle/wrinkle highlight lines */}
                      <div className="absolute inset-0 opacity-[0.07]" style={{
                        backgroundImage: `
                          linear-gradient(172deg, transparent 20%, rgba(255,255,255,0.8) 20.5%, transparent 21%),
                          linear-gradient(168deg, transparent 55%, rgba(255,255,255,0.6) 55.5%, transparent 56%),
                          linear-gradient(175deg, transparent 78%, rgba(255,255,255,0.5) 78.5%, transparent 79%)
                        `,
                      }} />

                      {/* Top edge fold/seal - the sealed top of the pack */}
                      <div className="absolute top-0 left-0 right-0 h-[10px]" style={{
                        background: `linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, transparent 100%)`,
                      }} />
                      {/* Crimp lines at top */}
                      <div className="absolute top-[3px] left-[8px] right-[8px] h-[4px] rounded-sm" style={{
                        backgroundImage: `repeating-linear-gradient(90deg, ${design.foilAccent}30 0px, ${design.foilAccent}30 4px, transparent 4px, transparent 8px)`,
                      }} />

                      {/* === Tear strip (the perforated pull strip) === */}
                      <div className="absolute top-[52px] left-0 right-0">
                        {/* Top edge of strip */}
                        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${design.tearColor}50, transparent)` }} />
                        {/* Dotted perforation */}
                        <div className="h-[2px]" style={{
                          backgroundImage: `repeating-linear-gradient(90deg, ${design.tearColor}40 0px, ${design.tearColor}40 3px, transparent 3px, transparent 7px)`,
                        }} />
                        {/* Pull tab nub on the right */}
                        <div className="absolute -top-[3px] right-[6px] w-[14px] h-[8px] rounded-b-sm" style={{
                          background: design.tearColor,
                          opacity: 0.35,
                        }} />
                        {/* Bottom edge of strip */}
                        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${design.tearColor}30, transparent)` }} />
                      </div>

                      {/* === Pack artwork / center content === */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
                        {/* ESP.FUN Logo */}
                        <div className="relative mb-2 mt-2">
                          <img
                            src="/oglogonobg.png"
                            alt="ESP.FUN"
                            className="w-14 h-14 object-contain relative z-10"
                            style={{ filter: `drop-shadow(0 2px 8px ${design.glowColor})` }}
                          />
                        </div>

                        {/* Pack name */}
                        <h3
                          className="font-black text-[13px] tracking-wider uppercase mb-0.5"
                          style={{
                            color: design.tierColor,
                            textShadow: `0 0 12px ${design.glowColor}, 0 1px 2px rgba(0,0,0,0.5)`,
                          }}
                        >
                          {pack.name}
                        </h3>

                        {/* Tier badge */}
                        <div
                          className="rounded-sm px-3 py-0.5 mb-1.5"
                          style={{
                            background: design.tierBg,
                            border: `1px solid ${design.foilAccent}40`,
                          }}
                        >
                          <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: design.tierColor }}>
                            {design.tierLabel} SERIES
                          </span>
                        </div>

                        {/* "4 Player Cards" text */}
                        <p className="text-white/40 text-[9px] font-medium tracking-wider uppercase">
                          4 Player Cards
                        </p>
                      </div>

                      {/* Bottom seal / barcode area */}
                      <div className="absolute bottom-0 left-0 right-0 h-[28px] bg-black/20">
                        {/* Fake barcode lines */}
                        <div className="absolute bottom-[6px] left-[12px] flex gap-[1px]">
                          {[3,1,2,1,3,2,1,1,2,3,1,2,1,1,3,2,1,2,1,3].map((w, i) => (
                            <div key={i} className="bg-white/15 rounded-[0.5px]" style={{ width: w, height: 10 }} />
                          ))}
                        </div>
                        {/* Tiny legal text */}
                        <div className="absolute bottom-[6px] right-[12px]">
                          <span className="text-white/20 text-[6px] font-mono">ESP-{pack.id}-2026</span>
                        </div>
                      </div>

                      {/* Shine sweep on hover */}
                      <div className="absolute inset-0 overflow-hidden rounded-md group">
                        <div className="shimmer-sweep absolute inset-0 opacity-15" />
                      </div>

                      {/* Edge shadow to simulate 3D foil wrapper depth */}
                      <div className="absolute inset-0 rounded-md pointer-events-none" style={{
                        boxShadow: 'inset 2px 0 4px rgba(255,255,255,0.08), inset -2px 0 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.06), inset 0 -2px 6px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                  </motion.div>

                  {/* Price label below the pack */}
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
