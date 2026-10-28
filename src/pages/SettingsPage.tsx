import React, { useEffect, useState } from 'react';
import {
  Settings, Save, Download, Upload, Store, Database,
  AlertTriangle, RotateCcw, Trash2, X
} from 'lucide-react';
import { api, AppSettings } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import ShopBanner from '../components/ShopBanner';
import SelectDropdown from '../components/SelectDropdown';
import { useEscapeClose } from '../hooks/useEscapeClose';

export default function SettingsPage() {
  const { addToast } = useToast();
  const { refreshGodowns } = useGodown();

  const [settings, setSettings] = useState<AppSettings>({
    shop_name: 'Haji Rafiq Phoga Leather Shop',
    shop_address: 'Shah Alam Market, Lahore, Pakistan',
    shop_contact: '',
    print_mode: 'a4',
    date_format: 'YYYY-MM-DD',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearProducts, setClearProducts] = useState(true);

  useEscapeClose(() => setShowRestoreConfirm(false), showRestoreConfirm && !restoring);
  useEscapeClose(() => setShowResetModal(false), showResetModal && !resetting);
  const [resetSettings, setResetSettings] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.settings.get().then((res) => {
      if (res.success && res.data) {
        setSettings({
          shop_name: res.data.shop_name || 'Haji Rafiq Phoga Leather Shop',
          shop_address: res.data.shop_address || 'Shah Alam Market, Lahore, Pakistan',
          shop_contact: res.data.shop_contact || '',
          print_mode: res.data.print_mode || 'a4',
          date_format: res.data.date_format || 'YYYY-MM-DD',
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.settings.set(settings);
    if (res.success) addToast('Shop settings updated.', 'success');
    else addToast(res.error || 'Failed to update settings.', 'error');
    setSaving(false);
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    const res = await api.backup.create();
    if (res.success && res.data) {
      const sizeKb = (res.data.sizeBytes / 1024).toFixed(1);
      addToast(`Backup created (${sizeKb} KB) at: ${res.data.filePath}`, 'success');
    } else if (res.error && !res.error.includes('cancelled')) {
      addToast(res.error || 'Failed to create backup.', 'error');
    }
    setBackingUp(false);
  };

  const handleConfirmRestore = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    const res = await api.backup.restore();
    if (res.success && res.data) {
      addToast(res.data.message || 'Database restored.', 'success');
      await refreshGodowns();
      const setRes = await api.settings.get();
      if (setRes.success && setRes.data) setSettings(setRes.data);
    } else if (res.error && !res.error.includes('cancelled')) {
      addToast(res.error || 'Failed to restore database.', 'error');
    }
    setRestoring(false);
  };

  const handleConfirmReset = async () => {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      addToast('Type RESET to confirm.', 'error');
      return;
    }
    setResetting(true);
    try {
      const res = await api.settings.factoryReset({
        clearProducts,
        resetGodowns: false,
        resetSettings,
      });

      if (res.success && res.data) {
        addToast(res.data.message || 'Factory reset complete.', 'success');
        setShowResetModal(false);
        setConfirmText('');
        await refreshGodowns();
        if (resetSettings) {
          const sRes = await api.settings.get();
          if (sRes.success && sRes.data) setSettings(sRes.data);
        }
      } else {
        addToast(res.error || 'Factory reset failed.', 'error');
      }
    } catch (err) {
      addToast(String(err), 'error');
    } finally {
      setResetting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16,
  };
  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f1f5f9',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 3, display: 'block',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingBottom: 40 }}>
      <ShopBanner />

      {/* Header card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #e2e8f0', borderRadius: 12,
        padding: '14px 18px', marginBottom: 16
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, background: '#475569',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 3px 8px rgba(71,85,105,0.25)'
        }}>
          <Settings size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>Settings</h1>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>Shop details, database backup, and reset</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {/* Shop Details */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'
            }}>
              <Store size={14} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Shop Details</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Shown on every printed slip</div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Shop Name *</label>
              <input
                type="text" required
                className="form-control"
                placeholder="e.g. Raxine Leather Warehouse"
                value={settings.shop_name}
                onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                style={{ height: 34, fontSize: 12.5 }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Shop Address *</label>
              <textarea
                rows={2} required
                className="form-control"
                placeholder="e.g. Shah Alam Market, Lahore, Pakistan"
                value={settings.shop_address}
                onChange={(e) => setSettings({ ...settings, shop_address: e.target.value })}
                style={{ fontSize: 12.5 }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Contact Phone</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. +92 300 1234567"
                value={settings.shop_contact}
                onChange={(e) => setSettings({ ...settings, shop_contact: e.target.value })}
                style={{ height: 34, fontSize: 12.5 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Unit</label>
                <div style={{
                  height: 34, display: 'flex', alignItems: 'center', padding: '0 10px',
                  fontSize: 12.5, fontWeight: 700, color: '#64748b',
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7
                }}>
                  Meters (m)
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date Format</label>
                <SelectDropdown
                  value={settings.date_format}
                  onChange={v => setSettings({ ...settings, date_format: String(v) })}
                  options={[
                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                  ]}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={saving || loading}
              style={{ width: '100%', padding: '8px 0', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Save size={13} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Backup / Restore / Reset / Specs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a'
              }}>
                <Database size={14} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Database Backup &amp; Restore</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Offline data protection</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
                Save a complete backup of all godowns, rolls, and transactions to your computer or a USB drive.
              </div>
              <button
                type="button"
                className="btn btn-sm btn-success"
                onClick={handleCreateBackup}
                disabled={backingUp || restoring}
                style={{ width: '100%', padding: '8px 0', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Download size={13} /> {backingUp ? 'Creating Backup...' : 'Create Backup File'}
              </button>
            </div>

            <div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
                Restore data from a previously exported <code style={{ color: '#0284c7', background: '#f0f9ff', padding: '1px 5px', borderRadius: 4 }}>.db</code> file.
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={() => setShowRestoreConfirm(true)}
                disabled={backingUp || restoring}
                style={{ width: '100%', padding: '8px 0', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Upload size={13} /> {restoring ? 'Restoring...' : 'Restore From Backup'}
              </button>
            </div>
          </div>

          {/* Factory Reset */}
          <div style={{ ...cardStyle, border: '1px solid #fecaca' }}>
            <div style={{ ...cardHeaderStyle, borderBottom: '1px solid #fee2e2' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626'
              }}>
                <Trash2 size={14} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#991b1b' }}>Factory Reset</div>
                <div style={{ fontSize: 10.5, color: '#dc2626' }}>Wipe test data and start fresh</div>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
              If you entered sample rolls or slips while testing, this deletes them all so you can start recording real stock from zero.
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => { setConfirmText(''); setShowResetModal(true); }}
              style={{ width: '100%', padding: '8px 0', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <RotateCcw size={13} /> Factory Reset
            </button>
          </div>

          {/* System specs */}
          <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 6 }}>
              System
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: '#64748b' }}>
              <li>Offline-first Electron + SQLite (WAL mode)</li>
              <li>Multi-godown strict stock isolation</li>
              <li>Integer-millimeter precision (no float drift)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="modal-backdrop" onClick={() => setShowRestoreConfirm(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1070, padding: 16
        }}>
          <div className="modal-card" style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #fed7aa', background: '#fff7ed',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#ea580c" /> Confirm Restore
              </h3>
              <button type="button" className="btn btn-ghost btn-sm p-0" onClick={() => setShowRestoreConfirm(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: 18 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#334155' }}>
                This replaces all your current records with the records from the backup file.
              </p>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#92400e' }}>
                A safety backup of your current data is saved automatically first.
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowRestoreConfirm(false)}>Cancel</button>
              <button type="button" className="btn btn-sm btn-warning" onClick={handleConfirmRestore} style={{ fontWeight: 700 }}>
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Confirmation Modal */}
      {showResetModal && (
        <div className="modal-backdrop" onClick={() => !resetting && setShowResetModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1070, padding: 16
        }}>
          <div className="modal-card" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #fecaca', background: '#fef2f2',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#dc2626" /> Confirm Factory Reset
              </h3>
              <button type="button" className="btn btn-ghost btn-sm p-0" onClick={() => setShowResetModal(false)} disabled={resetting}><X size={16} /></button>
            </div>

            <div style={{ padding: 18 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 700, color: '#991b1b' }}>
                Delete all test data and start fresh?
              </p>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11.5, color: '#475569' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>This will delete:</div>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
                  <li>All physical rolls (available and issued)</li>
                  <li>All Inward slips and items</li>
                  <li>All Outward slips and items</li>
                  <li>The full roll movement history</li>
                </ul>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: '#166534' }}>
                A safety backup is saved automatically before the reset runs.
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={clearProducts}
                  onChange={(e) => setClearProducts(e.target.checked)}
                  style={{ width: 13, height: 13 }}
                />
                <span style={{ fontSize: 12, color: '#334155' }}>Also delete all sample/test products</span>
              </label>

              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>
                  Type <strong>RESET</strong> to confirm
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="RESET"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoFocus
                  style={{
                    height: 34, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                    borderColor: confirmText.toUpperCase() === 'RESET' ? '#16a34a' : undefined
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowResetModal(false)} disabled={resetting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleConfirmReset}
                disabled={resetting || confirmText.trim().toUpperCase() !== 'RESET'}
                style={{ fontWeight: 700 }}
              >
                {resetting ? 'Resetting...' : 'Delete Test Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
