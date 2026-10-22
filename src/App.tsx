import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle,
  Warehouse, History, Settings, ChevronRight, Building2
} from 'lucide-react';
import { ToastProvider } from './contexts/ToastContext';
import { GodownProvider, useGodown } from './contexts/GodownContext';
import GodownSelector from './components/GodownSelector';
import DashboardPage from './pages/DashboardPage';
import GodownsPage from './pages/GodownsPage';
import ProductsPage from './pages/ProductsPage';
import InwardPage from './pages/InwardPage';
import OutwardPage from './pages/OutwardPage';
import CurrentStockPage from './pages/CurrentStockPage';
import StockHistoryPage from './pages/StockHistoryPage';
import SettingsPage from './pages/SettingsPage';

export type Page =
  | 'dashboard'
  | 'godowns'
  | 'products'
  | 'inward'
  | 'outward'
  | 'current-stock'
  | 'history'
  | 'settings';

interface NavItem {
  id: Page;
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  shortcut: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', subLabel: 'Kholasa (Overall)', icon: <LayoutDashboard size={18} />, shortcut: 'F1 / Alt+1' },
  { id: 'godowns', label: 'Godowns', subLabel: 'Godown List', icon: <Building2 size={18} />, shortcut: 'F2 / Alt+2' },
  { id: 'current-stock', label: 'Current Stock', subLabel: 'Mojooda Stock', icon: <Warehouse size={18} />, shortcut: 'F3 / Alt+3' },
  { id: 'inward', label: 'Incoming Stock', subLabel: 'Maal Andar', icon: <ArrowDownCircle size={18} />, shortcut: 'F4 / Alt+4' },
  { id: 'outward', label: 'Outgoing Stock', subLabel: 'Maal Bahar', icon: <ArrowUpCircle size={18} />, shortcut: 'F5 / Alt+5' },
  { id: 'products', label: 'Products & Rolls', subLabel: 'Products', icon: <Package size={18} />, shortcut: 'F6 / Alt+6' },
  { id: 'history', label: 'Stock History', subLabel: 'Tafseel', icon: <History size={18} />, shortcut: 'F7 / Alt+7' },
  { id: 'settings', label: 'Settings', subLabel: 'Backup & Print', icon: <Settings size={18} />, shortcut: 'F8 / Alt+8' },
];

function MainLayout() {
  const [page, setPage] = useState<Page>('dashboard');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const { currentGodown } = useGodown();

  const navigate = (p: Page) => setPage(p);

  // ── Global Keyboard Navigation ─────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if inside input when typing ordinary characters, but allow F-keys and Alt+Number
      const isFKey = /^F[1-8]$/.test(e.key);
      const isAltNum = e.altKey && !e.ctrlKey && !e.shiftKey && /^[1-8]$/.test(e.key);
      const isHelpKey = e.key === 'F12' || (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName));

      if (isHelpKey) {
        e.preventDefault();
        setShowKeyboardHelp(prev => !prev);
        return;
      }

      if (isFKey) {
        e.preventDefault();
        const num = parseInt(e.key.slice(1));
        const target = navItems[num - 1];
        if (target) setPage(target.id);
        return;
      }

      if (isAltNum) {
        e.preventDefault();
        const num = parseInt(e.key);
        const target = navItems[num - 1];
        if (target) setPage(target.id);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':     return <DashboardPage onNavigate={navigate} />;
      case 'godowns':       return <GodownsPage onNavigateToStock={() => setPage('current-stock')} />;
      case 'products':      return <ProductsPage />;
      case 'inward':        return <InwardPage />;
      case 'outward':       return <OutwardPage />;
      case 'current-stock': return <CurrentStockPage />;
      case 'history':       return <StockHistoryPage />;
      case 'settings':      return <SettingsPage />;
      default:              return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 38, height: 38,
              background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)', flexShrink: 0
            }}>
              <Warehouse size={20} color="#fff" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div className="sidebar-logo-title" style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                Haji Rafiq Phoga
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>
                Leather Shop
              </div>
              <div className="sidebar-logo-sub" style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
                Shah Alam Market, Lahore
              </div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 6px' }}>
            <span className="nav-section-label" style={{ padding: 0 }}>Warehouse Menu</span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Keys: F1–F8</span>
          </div>
          {navItems.map(item => {
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
                title={`${item.label} (${item.shortcut})`}
              >
                <span className="icon" style={{ color: isActive ? '#2563eb' : '#64748b' }}>
                  {item.icon}
                </span>
                <div style={{ flex: 1, textAlign: 'left', lineHeight: 1.25 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: isActive ? 700 : 600, color: isActive ? '#1d4ed8' : '#334155' }}>
                      {item.label}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '1px 5px', borderRadius: 4,
                      background: isActive ? '#dbeafe' : '#f1f5f9',
                      color: isActive ? '#1e40af' : '#64748b',
                      fontWeight: 700, fontFamily: 'monospace'
                    }}>
                      {item.shortcut.split(' / ')[0]}
                    </span>
                  </div>
                  {item.subLabel && (
                    <div style={{
                      fontSize: 10,
                      color: isActive ? '#2563eb' : '#94a3b8',
                      fontWeight: isActive ? 600 : 500,
                      marginTop: 1
                    }}>
                      {item.subLabel}
                    </div>
                  )}
                </div>
                {isActive && <ChevronRight size={14} color="#2563eb" />}
              </button>
            );
          })}
        </nav>

        {/* Selected godown quick pill in sidebar bottom */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--color-border)',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', fontWeight: 700 }}>
              Current Godown
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: '#16a34a', fontWeight: 700
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              Offline Active
            </span>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#0f172a',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {currentGodown ? currentGodown.name : 'None'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            v1.0.0 · Local SQLite
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main">
        {/* Top bar with Active Godown & Selector */}
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Active Godown:
            </span>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#0f172a',
              background: '#f8fafc', padding: '6px 14px', borderRadius: 8,
              border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}>
              <Warehouse size={16} color="#2563eb" />
              <span>{currentGodown ? currentGodown.name : 'No Godown Selected'}</span>
              {currentGodown?.address && (
                <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b', borderLeft: '1px solid #cbd5e1', paddingLeft: 8 }}>
                  {currentGodown.address}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="btn btn-outline-secondary"
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 12px',
                display: 'flex', alignItems: 'center', gap: 6,
                borderColor: '#cbd5e1', background: '#fff'
              }}
              title="Keyboard Shortcuts Cheat Sheet (F12 or ?)"
            >
              <span style={{
                background: '#1e293b', color: '#fff', padding: '1px 5px',
                borderRadius: 4, fontSize: 10, fontFamily: 'monospace'
              }}>F12 / ?</span>
              <span>Keyboard Keys</span>
            </button>
            <GodownSelector onManageClick={() => setPage('godowns')} />
          </div>
        </header>

        <div className="app-content">
          {renderPage()}
        </div>
      </main>

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      {showKeyboardHelp && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16
          }}
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div
            style={{
              maxWidth: 620, width: '100%', background: '#fff', borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              padding: '16px 20px', background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⌨️ Complete App Keyboard Shortcuts (Asaan Keyboard Workflow)
              </div>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  🌐 Main Navigation (Puri App me kahin bhi dabayein)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Dashboard (Overall)</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F1 / Alt+1</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Godowns List</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F2 / Alt+2</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Current Stock</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F3 / Alt+3</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                    <span>Incoming Stock (Inward)</span>
                    <kbd style={{ background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F4 / Alt+4</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Outgoing Stock (Outward)</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F5 / Alt+5</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Products & Rolls</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F6 / Alt+6</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Stock History</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F7 / Alt+7</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Settings & Backup</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>F8 / Alt+8</kbd>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  📥 Incoming Stock (Maal Andar Workflow)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>1. Focus Receiving Godown Selector</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Alt+G</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>2. Focus Product Search Combobox</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Alt+P</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>3. Focus Price / Rate Per Meter</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Alt+R</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>4. Focus Total Amount / Price</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Alt+T</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>5. Focus Roll Length input</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Alt+L</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>6. Focus Quantity input</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Alt+Q</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>7. Add another roll length row</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Alt+A / Enter on Qty</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
                    <span>8. SAVE INCOMING STOCK TRANSACTION</span>
                    <kbd style={{ background: '#15803d', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>Ctrl+S / Alt+S</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                    <span>Print Slip / Parchi</span>
                    <kbd style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Ctrl+P</kbd>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  General Keys
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Close Modal / Menu</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Escape</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <span>Select suggestion / Next field</span>
                    <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Enter / Tab</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowKeyboardHelp(false)}
                style={{ fontWeight: 700 }}
              >
                Samajh Gaya (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

export default function App() {
  return (
    <ToastProvider>
      <GodownProvider>
        <MainLayout />
      </GodownProvider>
    </ToastProvider>
  );
}
