import React, { useEffect, useState } from 'react';
import { X, Clock, ArrowDownCircle, ArrowUpCircle, Warehouse, Package, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { api, RollHistoryData } from '../api';

interface RollHistoryModalProps {
  rollIdOrCode: number | string | null;
  onClose: () => void;
  onPrintSlip?: (type: 'inward' | 'outward', slipNumber: string) => void;
}

export default function RollHistoryModal({ rollIdOrCode, onClose, onPrintSlip }: RollHistoryModalProps) {
  const [data, setData] = useState<RollHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rollIdOrCode) return;
    setLoading(true);
    setError(null);

    api.rolls.getHistory(rollIdOrCode)
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || 'Roll not found.');
        }
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [rollIdOrCode]);

  if (!rollIdOrCode) return null;

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        timeZone: 'Asia/Karachi'
      }) + ' ' + d.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Karachi'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1050, padding: 16
    }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 650,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={22} color="#93c5fd" />
            <div>
              <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700, letterSpacing: 0.5 }}>
                Roll Ki Complete History (Audit Trail)
              </h2>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Roll ID: <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{String(rollIdOrCode)}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
              <div className="spinner-border text-primary" role="status" style={{ width: 32, height: 32 }}></div>
              <div style={{ marginTop: 12, fontSize: 14 }}>History load ho rahi hai...</div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={20} />
              <div>{error}</div>
            </div>
          )}

          {data && (
            <div>
              {/* Roll Info Card */}
              <div style={{
                background: 'var(--color-bg-subtle, #f8fafc)', border: '1.5px solid var(--color-border, #e2e8f0)',
                borderRadius: 10, padding: 14, marginBottom: 20
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Roll Code</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#1e3a8a' }}>
                      {data.roll.roll_code}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Product</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {data.roll.product_name} <span style={{ color: '#64748b' }}>({data.roll.product_code})</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Length</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f766e' }}>
                      {data.roll.original_length_meters.toFixed(2)} m
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Current Status</div>
                    <div>
                      {data.roll.status === 'available' ? (
                        <span className="badge bg-success" style={{ fontSize: 12, padding: '4px 8px' }}>
                          <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} /> Mojood (Available)
                        </span>
                      ) : (
                        <span className="badge bg-secondary" style={{ fontSize: 12, padding: '4px 8px' }}>
                          Jari Karda (Issued)
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Godown</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      &#127970; {data.roll.godown_name || 'Main Warehouse'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Movement Timeline */}
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#334155' }}>
                Movement Timeline (Aamad o Khurch Record):
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.events.map((evt, idx) => {
                  const isInward = evt.transaction_type === 'inward';
                  return (
                    <div
                      key={evt.id || idx}
                      style={{
                        display: 'flex', gap: 14, padding: 14, borderRadius: 8,
                        background: isInward ? '#f0fdf4' : '#fffbeb',
                        border: `1.5px solid ${isInward ? '#86efac' : '#fde68a'}`,
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isInward ? '#22c55e' : '#f59e0b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0
                      }}>
                        {isInward ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isInward ? '#166534' : '#92400e' }}>
                            {isInward ? 'Maal Andar Aaya (Received in Warehouse)' : 'Maal Bahar Jari Hua (Issued from Warehouse)'}
                          </div>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                            {formatDateTime(evt.event_timestamp)}
                          </span>
                        </div>

                        <div style={{ fontSize: 13, color: '#334155', display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
                          <div>
                            <span style={{ color: '#64748b' }}>Godown: </span>
                            <strong>{evt.godown_name}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Length: </span>
                            <strong>{evt.length_involved_meters.toFixed(2)} m</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Slip #: </span>
                            <strong style={{ fontFamily: 'monospace' }}>{evt.slip_number}</strong>
                          </div>
                        </div>

                        {evt.recipient_reference && (
                          <div style={{ fontSize: 12, marginTop: 6, color: '#475569' }}>
                            <strong>Recipient / Reference:</strong> {evt.recipient_reference}
                          </div>
                        )}

                        {evt.notes && (
                          <div style={{ fontSize: 12, marginTop: 4, color: '#64748b', fontStyle: 'italic' }}>
                            Note: {evt.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {data.events.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b' }}>
                  Koi movement record nahi mila.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'flex-end', background: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ minWidth: 120, fontWeight: 600, padding: '8px 18px', fontSize: 14 }}
          >
            Band Karein (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
