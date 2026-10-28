import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle,
  Warehouse, History, Settings, ChevronRight, Building2, X
} from 'lucide-react';
import { ToastProvider } from './contexts/ToastContext';
import { GodownProvider } from './contexts/GodownContext';
import DashboardPage from './pages/DashboardPage';
import GodownsPage from './pages/GodownsPage';
import ProductsPage from './pages/ProductsPage';
import InwardPage from './pages/InwardPage';
import OutwardPage from './pages/OutwardPage';
import StockHistoryPage from './pages/StockHistoryPage';
import SettingsPage from './pages/SettingsPage';
import { useEscapeClose } from './hooks/useEscapeClose';

export type Page =
  | 'dashboard'
  | 'godowns'
  | 'products'
  | 'inward'
  | 'outward'
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
  { id: 'dashboard', label: 'Dashboard', subLabel: 'Overview & stock', icon: <LayoutDashboard size={18} />, shortcut: 'F1 / Alt+1' },
  { id: 'godowns', label: 'Godowns', subLabel: 'Warehouse locations', icon: <Building2 size={18} />, shortcut: 'F2 / Alt+2' },
  { id: 'inward', label: 'Incoming Stock', subLabel: 'Receive stock', icon: <ArrowDownCircle size={18} />, shortcut: 'F3 / Alt+3' },
  { id: 'outward', label: 'Outgoing Stock', subLabel: 'Dispatch stock', icon: <ArrowUpCircle size={18} />, shortcut: 'F4 / Alt+4' },
  { id: 'products', label: 'Products & Rolls', subLabel: 'Catalogue', icon: <Package size={18} />, shortcut: 'F5 / Alt+5' },
  { id: 'history', label: 'Stock History', subLabel: 'Movement log', icon: <History size={18} />, shortcut: 'F6 / Alt+6' },
  { id: 'settings', label: 'Settings', subLabel: 'Backup & reset', icon: <Settings size={18} />, shortcut: 'F7 / Alt+7' },
];

function MainLayout() {
  const [page, setPage] = useState<Page>('dashboard');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  useEscapeClose(() => setShowKeyboardHelp(false), showKeyboardHelp);
  const [inwardPreselect, setInwardPreselect] = useState<{ productId: number; godownId: number; mode: 'single' | 'bulk'; lengthMeters?: number; ratePerMeter?: number } | null>(null);
  const [outwardPreselect, setOutwardPreselect] = useState<{ productId: number; godownId: number; mode: 'single' | 'bulk'; lengthMeters?: number } | null>(null);

  const navigate = (p: Page) => setPage(p);

  const restockVariant = (productId: number, godownId: number, lengthMeters?: number, ratePerMeter?: number) => {
    setInwardPreselect({ productId, godownId, mode: 'single', lengthMeters, ratePerMeter });
    setPage('inward');
  };

  const restockBulk = (productId: number, godownId: number, ratePerMeter?: number) => {
    setInwardPreselect({ productId, godownId, mode: 'bulk', ratePerMeter });
    setPage('inward');
  };

  const dispatchVariant = (productId: number, godownId: number, lengthMeters: number) => {
    setOutwardPreselect({ productId, godownId, mode: 'single', lengthMeters });
    setPage('outward');
  };

  const dispatchBulk = (productId: number, godownId: number) => {
    setOutwardPreselect({ productId, godownId, mode: 'bulk' });
    setPage('outward');
  };

  // ── Global Keyboard Navigation ─────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if inside input when typing ordinary characters, but allow F-keys and Alt+Number
      const isFKey = /^F[1-7]$/.test(e.key);
      const isAltNum = e.altKey && !e.ctrlKey && !e.shiftKey && /^[1-7]$/.test(e.key);
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
      case 'dashboard':     return (
        <DashboardPage
          onNavigate={navigate}
          onRestockVariant={restockVariant}
          onDispatchVariant={dispatchVariant}
          onRestockBulk={restockBulk}
          onDispatchBulk={dispatchBulk}
        />
      );
      case 'godowns':       return <GodownsPage onNavigateToStock={() => setPage('dashboard')} />;
      case 'products':      return <ProductsPage />;
      case 'inward':        return (
        <InwardPage
          onNavigate={navigate}
          preselect={inwardPreselect}
          onPreselectConsumed={() => setInwardPreselect(null)}
        />
      );
      case 'outward':       return (
        <OutwardPage
          onNavigate={navigate}
          preselect={outwardPreselect}
          onPreselectConsumed={() => setOutwardPreselect(null)}
        />
      );
      case 'history':       return <StockHistoryPage />;
      case 'settings':      return <SettingsPage />;
      default:              return (
        <DashboardPage
          onNavigate={navigate}
          onRestockVariant={restockVariant}
          onDispatchVariant={dispatchVariant}
          onRestockBulk={restockBulk}
          onDispatchBulk={dispatchBulk}
        />
      );
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
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Keys: F1–F7</span>
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

        {/* Footer credit */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 500 }}>
            Presented by <span style={{ color: '#94a3b8', fontWeight: 600 }}>AlphaLogics</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main">
        <div className="app-content" style={{ paddingTop: 20 }}>
          {renderPage()}
        </div>
      </main>

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      {showKeyboardHelp && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16
          }}
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div
            style={{
              maxWidth: 560, width: '100%', background: '#fff', borderRadius: 12,
              overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="btn btn-ghost btn-sm p-0"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 18, overflowY: 'auto' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Navigation (anywhere in the app)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {navItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 9px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                      <span>{item.label}</span>
                      <kbd style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{item.shortcut.split(' / ')[0]}</kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Incoming Stock Form
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    ['Focus godown', 'Alt+G'],
                    ['Focus product search', 'Alt+P'],
                    ['Focus buying price', 'Alt+R'],
                    ['Focus roll length', 'Alt+L'],
                    ['Focus quantity', 'Alt+Q'],
                    ['Add another roll batch', 'Alt+A'],
                    ['Save transaction', 'Ctrl+S'],
                  ].map(([label, key]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 9px', background: '#f0fdf4', borderRadius: 6, fontSize: 12 }}>
                      <span>{label}</span>
                      <kbd style={{ background: '#16a34a', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{key}</kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  General
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 9px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                    <span>Close modal</span>
                    <kbd style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>Esc</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 9px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                    <span>This help</span>
                    <kbd style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>F12 / ?</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '10px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setShowKeyboardHelp(false)}
                style={{ fontWeight: 700 }}
              >
                Close
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
