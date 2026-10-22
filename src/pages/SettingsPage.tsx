import React, { useEffect, useState } from 'react';
import {
  Settings, Save, Download, Upload, ShieldAlert,
  Store, MapPin, Phone, Database, CheckCircle, AlertTriangle,
  RotateCcw, Trash2
} from 'lucide-react';
import { api, AppSettings } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';

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

  // Backup & Restore state
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Factory Reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearProducts, setClearProducts] = useState(true);
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
    if (res.success) {
      addToast('Shop settings updated successfully', 'success');
    } else {
      addToast(res.error || 'Failed to update settings', 'error');
    }
    setSaving(false);
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    const res = await api.backup.create();
    if (res.success && res.data) {
      const sizeKb = (res.data.sizeBytes / 1024).toFixed(1);
      addToast(`Backup created successfully (${sizeKb} KB) at: ${res.data.filePath}`, 'success');
    } else if (res.error && !res.error.includes('cancelled')) {
      addToast(res.error || 'Failed to create backup', 'error');
    }
    setBackingUp(false);
  };

  const handleConfirmRestore = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    const res = await api.backup.restore();
    if (res.success && res.data) {
      addToast(res.data.message || 'Database restored successfully!', 'success');
      await refreshGodowns();
      const setRes = await api.settings.get();
      if (setRes.success && setRes.data) {
        setSettings(setRes.data);
      }
    } else if (res.error && !res.error.includes('cancelled')) {
      addToast(res.error || 'Failed to restore database', 'error');
    }
    setRestoring(false);
  };

  const handleConfirmReset = async () => {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      addToast('Confirm karne ke liye baraye meherbani RESET type karein.', 'error');
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
        addToast(res.data.message || 'Factory Reset kamiyabi se mukammal ho gaya!', 'success');
        setShowResetModal(false);
        setConfirmText('');
        await refreshGodowns();
        if (resetSettings) {
          const sRes = await api.settings.get();
          if (sRes.success && sRes.data) {
            setSettings(sRes.data);
          }
        }
      } else {
        addToast(res.error || 'Factory Reset me masla pesh aaya.', 'error');
      }
    } catch (err) {
      addToast(String(err), 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, marginBottom: 22, paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}>
            <Settings size={28} color="var(--color-primary)" />
            Settings (Settings aur Backup)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Shop ki tafseelat, print slips ka pata aur mukammal database ka local backup banayein.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Shop Configuration Card */}
        <div style={{
          background: '#ffffff', borderRadius: 12, border: '1px solid #cbd5e1',
          padding: 24, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'
            }}>
              <Store size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Warehouse &amp; Shop Details
              </h2>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Yeh tafseelat tamam printed slips par nazar aati hain
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="mb-3">
              <label className="form-label">
                Shop / Warehouse Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. Raxine Leather Warehouse"
                value={settings.shop_name}
                onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                style={{ fontSize: 14, fontWeight: 600 }}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">
                Shop / Warehouse Address <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={2}
                required
                className="form-control"
                placeholder="e.g. Shah Alam Market, Lahore, Pakistan"
                value={settings.shop_address}
                onChange={(e) => setSettings({ ...settings, shop_address: e.target.value })}
                style={{ fontSize: 13 }}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">
                Contact Phone / Reference
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. +92 300 1234567"
                value={settings.shop_contact}
                onChange={(e) => setSettings({ ...settings, shop_contact: e.target.value })}
                style={{ fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="form-label">
                  Measurement Unit
                </label>
                <input
                  type="text"
                  disabled
                  className="form-control"
                  value="Meters (m)"
                  style={{ background: '#f8fafc', color: '#64748b', fontWeight: 600 }}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Tamam leather rolls ki standard ikai
                </div>
              </div>
              <div>
                <label className="form-label">
                  Date Format
                </label>
                <select
                  className="form-select"
                  value={settings.date_format}
                  onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
                  style={{ fontSize: 13 }}
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || loading}
                style={{ padding: '10px 24px', fontWeight: 700 }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Database Backup & Restore Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            background: '#ffffff', borderRadius: 12, border: '1px solid #cbd5e1',
            padding: 24, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a'
              }}>
                <Database size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Database Backup &amp; Restore
                </h2>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Offline data protection aur USB transfer
                </div>
              </div>
            </div>

            {/* Backup Section */}
            <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#15803d', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={16} /> Create Database Backup
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.5 }}>
                Tamam godowns, rolls aur inward/outward ka mukammal backup file apne computer ya USB drive me mehfooz karein.
              </p>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleCreateBackup}
                disabled={backingUp || restoring}
                style={{ width: '100%', padding: '10px 16px', fontWeight: 700 }}
              >
                <Download size={16} /> {backingUp ? 'Creating Backup...' : 'Create Backup File (Backup Banayein)'}
              </button>
            </div>

            {/* Restore Section */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#c2410c', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Upload size={16} /> Restore From Backup
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.5 }}>
                Pehle se export karda <code style={{ color: '#0284c7', background: '#f0f9ff', padding: '1px 5px', borderRadius: 4 }}>.db</code> file se data wapis restore karein.
              </p>
              <button
                type="button"
                className="btn btn-outline-warning"
                onClick={() => setShowRestoreConfirm(true)}
                disabled={backingUp || restoring}
                style={{ width: '100%', padding: '10px 16px', fontWeight: 700 }}
              >
                <Upload size={16} /> {restoring ? 'Restoring Database...' : 'Restore Database File (Data Wapis Layein)'}
              </button>
            </div>
          </div>

          {/* Factory Reset / Wipe Test Data Card */}
          <div style={{
            background: '#ffffff', borderRadius: 12, border: '1.5px solid #fca5a5',
            padding: 24, boxShadow: '0 2px 8px rgba(220, 38, 38, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #fee2e2' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626'
              }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#991b1b' }}>
                  Factory Reset (Test Data Saaf Karein)
                </h2>
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
                  Database ko bilkul fresh aur zero stock par reset karein
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', lineHeight: 1.5 }}>
              Agar aapne testing ke doran dummy/sample rolls ya inward/outward slips darj ki hain, to yeh option un tamam records ko delete kar ke database ko naye siray se fresh kar dega taake aap apna asli stock zero se darj kar sakein.
            </p>

            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => {
                setConfirmText('');
                setShowResetModal(true);
              }}
              style={{ width: '100%', padding: '10px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <RotateCcw size={16} /> Factory Reset Karein (Wipe All Test Data)
            </button>
          </div>

          {/* System Specs Card */}
          <div style={{
            background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0',
            padding: 16
          }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: 0.5, margin: '0 0 8px' }}>
              System Specifications
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#64748b' }}>
              <li>• <strong>Architecture:</strong> Offline-First Electron + SQLite WAL Mode</li>
              <li>• <strong>Location:</strong> Shah Alam Market, Lahore, Pakistan</li>
              <li>• <strong>Storage:</strong> Local database with multi-godown strict isolation</li>
              <li>• <strong>Precision:</strong> Integer-millimeter arithmetic (zero float drift)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #fed7aa',
              background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color="#ea580c" /> Confirm Database Restore
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowRestoreConfirm(false)}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#334155' }}>
                Restore karne se aapke mojooda tamam records backup file ke records se tabdeel ho jayenge.
              </p>
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                padding: '10px 14px', fontSize: 12, color: '#92400e'
              }}>
                Aapke mojooda data ka aik safety backup (.safety-bak) khud-ba-khud pehle mehfooz kar liya jayega.
              </div>
            </div>
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRestoreConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={handleConfirmRestore}
                style={{ fontWeight: 700 }}
              >
                Haan, Restore Karein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Confirmation Modal */}
      {showResetModal && (
        <div
          className="modal-backdrop"
          onClick={() => !resetting && setShowResetModal(false)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #fecaca',
              background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color="#dc2626" /> Factory Reset Confirmation (Khatra)
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 22 }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#991b1b' }}>
                Kya aap waqai tamam test data delete kar ke fresh start lena chahte hain?
              </p>

              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#475569'
              }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Yeh cheezein delete ho jayengi:</div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Tamam physical leather rolls (Available aur Issued)</li>
                  <li>Tamam Maal Andar (Inward) slips aur items</li>
                  <li>Tamam Maal Bahar (Outward) slips aur items</li>
                  <li>Mukammal roll movement history aur audit log</li>
                </ul>
              </div>

              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#166534'
              }}>
                <strong>Safety Feature:</strong> Reset hone se pehle aapke data ka aik safety backup (<code>.safety-factory-reset-*.bak</code>) khud-ba-khud save ho jayega.
              </div>

              <div className="mb-3 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="clearProdCheck"
                  checked={clearProducts}
                  onChange={(e) => setClearProducts(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="clearProdCheck" style={{ fontSize: 13, fontWeight: 600 }}>
                  Tamam sample / test products bhi delete karein (Zero Products)
                </label>
              </div>

              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a' }}>
                  Tasdeeq ke liye yahan baraye meherbani <strong>RESET</strong> likhein:
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="RESET"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoFocus
                  style={{
                    fontSize: 14, fontWeight: 700, letterSpacing: 1,
                    textTransform: 'uppercase', borderColor: confirmText.toUpperCase() === 'RESET' ? '#16a34a' : '#cbd5e1'
                  }}
                />
              </div>

              <div style={{
                paddingTop: 12, borderTop: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'flex-end', gap: 10
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmReset}
                  disabled={resetting || confirmText.trim().toUpperCase() !== 'RESET'}
                  style={{ fontWeight: 700, padding: '10px 20px' }}
                >
                  {resetting ? 'Reset ho raha hai...' : 'Haan, Tamam Test Data Delete Karein'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


