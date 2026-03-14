interface CardBackProps {
  width: number;
  height: number;
}

export function CardBack({ width, height }: CardBackProps) {
  return (
    <div
      className="absolute inset-0 rounded-xl overflow-hidden"
      style={{
        width,
        height,
        backfaceVisibility: 'hidden',
      }}
    >
      {/* Outer frame — dark with metallic border */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: '#070a12',
          border: '3px solid #1a2d4a',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.6), inset 0 0 30px rgba(10,20,40,0.8)',
        }}
      />

      {/* Inner border accent */}
      <div className="absolute inset-[3px] rounded-[9px] pointer-events-none" style={{
        border: '1px solid rgba(30,58,95,0.15)',
      }} />

      {/* Interior panel */}
      <div className="absolute inset-[4px] rounded-[8px] overflow-hidden">
        {/* Deep blue-black background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(160deg, #080d1a 0%, #0c1428 35%, #0a1020 65%, #070b18 100%)',
        }} />

        {/* Diamond tessellation pattern (like premium card backs) */}
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: `
            linear-gradient(45deg, rgba(100,160,255,0.5) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(100,160,255,0.5) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(100,160,255,0.5) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(100,160,255,0.5) 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
        }} />

        {/* Decorative border band — double frame */}
        <div className="absolute inset-[8px] rounded-[4px]" style={{
          border: '1.5px solid rgba(59,130,246,0.12)',
        }} />
        <div className="absolute inset-[12px] rounded-[3px]" style={{
          border: '1px solid rgba(59,130,246,0.07)',
        }} />

        {/* Corner flourishes (4 corners) */}
        {[
          { top: 14, left: 14, rotate: 0 },
          { top: 14, right: 14, rotate: 90 },
          { bottom: 14, right: 14, rotate: 180 },
          { bottom: 14, left: 14, rotate: 270 },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute w-[16px] h-[16px]"
            style={{
              ...pos,
              transform: `rotate(${pos.rotate}deg)`,
              borderTop: '1.5px solid rgba(59,130,246,0.2)',
              borderLeft: '1.5px solid rgba(59,130,246,0.2)',
              borderRadius: '2px 0 0 0',
            }}
          />
        ))}

        {/* Center focal area */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Outer ring */}
          <div
            className="absolute w-[100px] h-[100px] rounded-full"
            style={{
              border: '1px solid rgba(59,130,246,0.1)',
              boxShadow: '0 0 20px rgba(59,130,246,0.05)',
            }}
          />

          {/* Middle ring with dashed effect */}
          <div
            className="absolute w-[76px] h-[76px] rounded-full"
            style={{
              border: '1px dashed rgba(59,130,246,0.12)',
            }}
          />

          {/* Inner ring */}
          <div
            className="absolute w-[56px] h-[56px] rounded-full"
            style={{
              border: '1px solid rgba(59,130,246,0.15)',
            }}
          />

          {/* Center emblem */}
          <div
            className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, #0e1a30, #0a1225)',
              border: '2px solid rgba(59,130,246,0.25)',
              boxShadow: '0 0 24px rgba(59,130,246,0.15), inset 0 0 12px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            <img
              src="/oglogonobg.png"
              alt="ESP.FUN"
              className="w-7 h-7 object-contain"
              style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.3)) brightness(0.9)' }}
            />
          </div>
        </div>

        {/* Radial glow behind emblem */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 40%)',
        }} />

        {/* Brand name — top */}
        <div className="absolute top-[20px] left-0 right-0 flex justify-center">
          <span className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: 'rgba(59,130,246,0.2)' }}>
            ESP.FUN
          </span>
        </div>

        {/* Series label — bottom */}
        <div className="absolute bottom-[20px] left-0 right-0 flex justify-center">
          <span className="text-[7px] font-bold tracking-[0.25em] uppercase" style={{ color: 'rgba(59,130,246,0.12)' }}>
            PLAYER SERIES
          </span>
        </div>

        {/* Top vignette */}
        <div className="absolute top-0 left-0 right-0 h-10" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)',
        }} />

        {/* Bottom vignette */}
        <div className="absolute bottom-0 left-0 right-0 h-10" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)',
        }} />
      </div>

      {/* Holographic shimmer sweep */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="shimmer-sweep absolute inset-0 opacity-[0.08]" />
      </div>

      {/* Subtle holographic rainbow tint */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" style={{
        mixBlendMode: 'color-dodge',
        opacity: 0.12,
      }}>
        <div className="holo-effect absolute inset-0" />
      </div>
    </div>
  );
}
