import React from 'react';

const pulse = `
  @keyframes tps-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

const base = {
  backgroundColor: '#E5E7EB',
  animation: 'tps-pulse 1.4s ease-in-out infinite',
  display: 'block',
};

// Single skeleton bar
export const SkeletonBar = ({ width = '100%', height = '12px', style = {} }) => (
  <>
    <style>{pulse}</style>
    <span style={{ ...base, width, height, borderRadius: '0px', ...style }} />
  </>
);

// A full table skeleton — rows x cols grey bars
export const SkeletonTable = ({ rows = 6, cols = 5 }) => (
  <>
    <style>{pulse}</style>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} style={{ padding: '10px 8px' }}>
              <span style={{ ...base, width: '60%', height: '10px', display: 'block' }} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r} style={{ borderBottom: '1px solid #F3F4F6' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c} style={{ padding: '10px 8px' }}>
                <span style={{ ...base, width: c === 0 ? '30%' : `${55 + (c * 7) % 30}%`, height: '11px', display: 'block' }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </>
);

// A stat card skeleton
export const SkeletonCard = ({ style = {} }) => (
  <>
    <style>{pulse}</style>
    <div style={{ border: '1px solid #E5E7EB', padding: '20px', ...style }}>
      <span style={{ ...base, width: '40%', height: '10px', display: 'block', marginBottom: '12px' }} />
      <span style={{ ...base, width: '60%', height: '28px', display: 'block', marginBottom: '8px' }} />
      <span style={{ ...base, width: '80%', height: '9px', display: 'block' }} />
    </div>
  </>
);

// A page-level stat grid skeleton (4 cards)
export const SkeletonStatGrid = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
    {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
  </div>
);
