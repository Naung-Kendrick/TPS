import { useEffect, useState } from 'react';

export default function IntroAnimation({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2100),
      setTimeout(() => onDone(), 2700),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const letters = ['T', 'P', 'S'];

  return (
    <>
      <style>{`
        @keyframes tps-intro-fade-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .tps-intro-root {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          z-index: 9999;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          -webkit-overflow-scrolling: touch;
        }
        .tps-intro-root.exit {
          animation: tps-intro-fade-out 600ms cubic-bezier(0.23,1,0.32,1) forwards;
          pointer-events: none;
        }
      `}</style>

      <div className={`tps-intro-root${phase === 4 ? ' exit' : ''}`}>

        {/* Top horizontal rule */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginLeft: '-110px',
            marginTop: '-72px',
            height: '2px',
            background: '#1A1A1A',
            width: phase >= 1 ? '220px' : '0px',
            transition: 'width 400ms cubic-bezier(0.23,1,0.32,1)',
          }}
        />

        {/* TPS letters */}
        <div style={{ display: 'flex', marginBottom: '10px' }}>
          {letters.map((letter, i) => (
            <span
              key={letter}
              style={{
                display: 'inline-block',
                fontSize: 'clamp(52px, 18vw, 80px)',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                fontWeight: '700',
                color: '#1A1A1A',
                letterSpacing: '-2px',
                lineHeight: 1,
                opacity: phase >= 1 ? 1 : 0,
                WebkitTransform: phase >= 1 ? 'translateY(0)' : 'translateY(12px)',
                transform: phase >= 1 ? 'translateY(0)' : 'translateY(12px)',
                WebkitTransition: `opacity 300ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms, -webkit-transform 300ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms`,
                transition: `opacity 300ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms, transform 300ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: phase >= 2 ? 1 : 0,
            WebkitTransform: phase >= 2 ? 'translateY(0)' : 'translateY(6px)',
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(6px)',
            WebkitTransition: 'opacity 350ms cubic-bezier(0.23,1,0.32,1), -webkit-transform 350ms cubic-bezier(0.23,1,0.32,1)',
            transition: 'opacity 350ms cubic-bezier(0.23,1,0.32,1), transform 350ms cubic-bezier(0.23,1,0.32,1)',
          }}
        >
          <span
            style={{
              fontSize: 'clamp(8px, 2.5vw, 10px)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#1D4ED8',
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontWeight: '600',
            }}
          >
            Ta&apos;ang Population System
          </span>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginLeft: '-110px',
            marginTop: '56px',
            height: '2px',
            background: '#1D4ED8',
            width: phase >= 3 ? '220px' : '0px',
            WebkitTransition: 'width 350ms cubic-bezier(0.23,1,0.32,1)',
            transition: 'width 350ms cubic-bezier(0.23,1,0.32,1)',
          }}
        />

        {/* Corner marks */}
        {[
          { top: '32px', left: '32px', borderTop: '1px solid #E5E7EB', borderLeft: '1px solid #E5E7EB' },
          { bottom: '32px', right: '32px', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '18px',
              height: '18px',
              opacity: phase >= 1 ? 0.8 : 0,
              WebkitTransition: `opacity 400ms ease ${i * 100}ms`,
              transition: `opacity 400ms ease ${i * 100}ms`,
              ...s,
            }}
          />
        ))}
      </div>
    </>
  );
}
