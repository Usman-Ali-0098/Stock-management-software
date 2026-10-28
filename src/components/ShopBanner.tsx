import React from 'react';
import { Warehouse } from 'lucide-react';
import { useGodown } from '../contexts/GodownContext';

export default function ShopBanner() {
  const { currentGodown } = useGodown();

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '16px 18px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 14
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 11,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 3px 8px rgba(30,58,138,0.25)'
      }}>
        <Warehouse size={24} color="#fff" />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', fontFamily: 'serif', lineHeight: 1.3 }}>
          حاجی رفیق پھوگا لیدر شاپ
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
          Haji Rafiq Phoga Leather Shop
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
          Shah Alam Market, Lahore &middot; Active Godown: <strong style={{ color: '#1e3a8a' }}>{currentGodown ? currentGodown.name : '—'}</strong>
        </div>
      </div>
    </div>
  );
}
