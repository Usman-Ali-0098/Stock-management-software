import React, { useEffect, useState } from 'react';
import { X, Clock, ArrowDownCircle, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { api, VariantMovements } from '../api';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface VariantHistoryModalProps {
  variantId: number | null;
  onClose: () => void;
}

function fmt(m: number) {
  return m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function VariantHistoryModal({ variantId, onClose }: VariantHistoryModalProps) {
  const [data, setData] = useState<VariantMovements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!variantId) return;
    setLoading(true);
    setError(null);

    api.variants.getMovements(variantId)
      .then(res => {
        if (res.success && res.data) setData(res.data);
        else setError(res.error || 'Stock variant not found.');
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [variantId]);

  useEscapeClose(onClose, !!variantId);

  if (!variantId) return null;

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Karachi'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1080, padding: 16
    }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>Stock Movement History</h3>
            {data && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {data.variant.product_name} &middot; {fmt(data.variant.length_meters)} m
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-0"><X size={16} /></button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12.5 }}>
              Loading...
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#991b1b', fontSize: 12.5 }}>
              <AlertCircle size={15} />
              <div>{error}</div>
            </div>
          )}

          {data && (
            <div>
              {/* Variant info */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Product</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {data.variant.product_name} <span style={{ color: '#64748b', fontWeight: 500 }}>({data.variant.product_code})</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Roll Size</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e' }}>
                      {fmt(data.variant.length_meters)} m
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>In Stock Now</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>
                      {data.variant.quantity}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Godown</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                      {data.variant.godown_name || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Movement Timeline
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.movements.map((evt, idx) => {
                  const isInward = evt.movement_type === 'inward';
                  return (
                    <div
                      key={evt.id || idx}
                      style={{
                        display: 'flex', gap: 10, padding: 10, borderRadius: 8,
                        background: isInward ? '#f0fdf4' : '#fffbeb',
                        border: `1px solid ${isInward ? '#86efac' : '#fde68a'}`,
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: isInward ? '#22c55e' : '#f59e0b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0
                      }}>
                        {isInward ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: isInward ? '#166534' : '#92400e' }}>
                            {isInward ? 'Received' : 'Dispatched'}
                          </div>
                          <span style={{ fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatDateTime(evt.event_timestamp)}
                          </span>
                        </div>

                        <div style={{ fontSize: 11.5, color: '#334155', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          <span><span style={{ color: '#64748b' }}>Qty: </span><strong>{evt.quantity}</strong></span>
                          <span><span style={{ color: '#64748b' }}>Length: </span><strong>{fmt(evt.length_meters)} m each</strong></span>
                          <span><span style={{ color: '#64748b' }}>Slip: </span><strong style={{ fontFamily: 'monospace' }}>{evt.slip_number}</strong></span>
                        </div>

                        {evt.reference && (
                          <div style={{ fontSize: 11, marginTop: 4, color: '#475569' }}>
                            <strong>Reference:</strong> {evt.reference}
                          </div>
                        )}
                        {evt.notes && (
                          <div style={{ fontSize: 11, marginTop: 2, color: '#64748b', fontStyle: 'italic' }}>
                            {evt.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {data.movements.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 12 }}>
                  <Clock size={16} style={{ marginBottom: 4 }} />
                  <div>No movement recorded yet.</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-sm btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
