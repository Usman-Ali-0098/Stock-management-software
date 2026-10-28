import React from 'react';

/** Small dark pill used to show a quantity/count next to a dropdown option's main label. */
export function QtyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, color: '#fff', background: '#1e293b',
      borderRadius: 9, padding: '2px 7px', whiteSpace: 'nowrap', lineHeight: 1.4,
    }}>
      {children}
    </span>
  );
}
