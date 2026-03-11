interface CardBackProps {
  width: number;
  height: number;
}

export function CardBack({ width, height }: CardBackProps) {
  return (
    <div
      className="absolute inset-0 rounded-lg overflow-hidden"
      style={{
        width,
        height,
        backfaceVisibility: 'hidden',
      }}
    >
      {/* === Printed card back - solid, clean, professional === */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'linear-gradient(150deg, #0c1220 0%, #111b2e 30%, #0a1628 60%, #0c1220 100%)',
          border: '3px solid #1e3a5f',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
        }}
      />

      {/* Interior pattern - clean repeating design like real card backs */}
      <div className="absolute inset-[3px] rounded-[5px] overflow-hidden">
        {/* Dark inner border band */}
        <div
          className="absolute inset-0"
          style={{
            border: '6px solid rgba(30,58,95,0.2)',
            borderRadius: 5,
          }}
        />

        {/* Repeating logo pattern background (like Pokémon card backs) */}
        <div className="absolute inset-[6px] overflow-hidden rounded-sm" style={{ background: '#0a1525' }}>
          {/* Grid of tiny logos */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `url(/oglogonobg.png)`,
              backgroundSize: '28px 28px',
              backgroundRepeat: 'repeat',
            }}
          />

          {/* Center focal area */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Decorative circles */}
            <div
              className="absolute w-[120px] h-[120px] rounded-full"
              style={{ border: '1px solid rgba(30,58,95,0.2)' }}
            />
            <div
              className="absolute w-[90px] h-[90px] rounded-full"
              style={{ border: '1px solid rgba(30,58,95,0.25)' }}
            />

            {/* Center emblem */}
            <div
              className="relative w-[64px] h-[64px] rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #162033, #0d1626)',
                border: '2px solid #1e3a5f',
                boxShadow: '0 0 20px rgba(30,58,95,0.3), inset 0 0 10px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src="/oglogonobg.png"
                alt="ESP.FUN"
                className="w-9 h-9 object-contain"
                style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.2))' }}
              />
            </div>
          </div>

          {/* Brand name - top */}
          <div className="absolute top-4 left-0 right-0 flex justify-center">
            <span className="text-[10px] font-black tracking-[0.35em] uppercase" style={{ color: '#1e3a5f' }}>
              ESP.FUN
            </span>
          </div>

          {/* Brand name - bottom */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span className="text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: 'rgba(30,58,95,0.5)' }}>
              PLAYER SERIES
            </span>
          </div>

          {/* Subtle radial glow in center */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(30,58,95,0.1) 0%, transparent 50%)',
            }}
          />
        </div>
      </div>

      {/* Subtle shimmer on the back */}
      <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
        <div className="shimmer-sweep absolute inset-0 opacity-10" />
      </div>
    </div>
  );
}
