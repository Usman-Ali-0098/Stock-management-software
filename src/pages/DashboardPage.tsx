import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Layers, BarChart2, ArrowDownCircle, ArrowUpCircle, RefreshCw, Warehouse,
  Search, History, ArrowRight, Building2, CheckCircle2, ChevronRight, Hash,
  Sparkles, ShieldCheck, Box, Clock, TrendingUp
} from 'lucide-react';
import { api, DashboardData, GodownBreakdown } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import RollHistoryModal from '../components/RollHistoryModal';

type Page = 'dashboard' | 'godowns' | 'products' | 'inward' | 'outward' | 'current-stock' | 'history' | 'settings';

interface Props {
  onNavigate: (page: Page) => void;
}

function fmt(meters: number) {
  return meters.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Karachi'
  });
}

export default function DashboardPage({ onNavigate }: Props) {
  const toast = useToast();
  const { godowns, currentGodown, setCurrentGodown } = useGodown();
  // Default view is 'all' (Overall Warehouse across all godowns)
  const [selectedView, setSelectedView] = useState<number | 'all'>('all');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRollCode, setSelectedRollCode] = useState<string | null>(null);
  const [quickSearchRoll, setQuickSearchRoll] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.stock.dashboard(selectedView);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      toast.showToast(res.error || 'Failed to load dashboard', 'error');
    }
    setLoading(false);
  }, [selectedView]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Keyboard shortcuts on Dashboard ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setSelectedView('all');
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        load();
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        onNavigate('inward');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [load, onNavigate]);

  const handleQuickRollSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearchRoll.trim()) return;
    setSelectedRollCode(quickSearchRoll.trim());
    setQuickSearchRoll('');
  };

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#64748b' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: 44, height: 44 }}></div>
        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: '#1e3a8a' }}>
          Haji Rafiq Phoga Leather Shop — Dashboard load ho raha hai...
        </div>
      </div>
    );
  }

  const d = data;
  if (!d) return null;

  const isOverall = selectedView === 'all';

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 60 }}>
      {/* ─── 1. PRESTIGIOUS BRAND HERO BANNER ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #091223 0%, #0f1e3f 40%, #1e3a8a 100%)',
        color: '#fff', borderRadius: 16, padding: '24px 28px',
        marginBottom: 20, position: 'relative', overflow: 'hidden',
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.12)'
      }}>
        {/* Subtle decorative glow element */}
        <div style={{
          position: 'absolute', right: -60, top: -60, width: 240, height: 240,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1
        }}>
          {/* Shop Name & Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 14,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(245, 158, 11, 0.35)', flexShrink: 0
            }}>
              <Warehouse size={32} color="#ffffff" />
            </div>

            <div>
              {/* Urdu Name Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 18, fontWeight: 900, color: '#fcd34d',
                  fontFamily: 'serif', letterSpacing: 0.5
                }}>
                  حاجی رفیق پھوگا لیدر شاپ
                </span>
                <span style={{
                  fontSize: 11, background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24', padding: '3px 10px', borderRadius: 20,
                  fontWeight: 800, border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'inline-flex', alignItems: 'center', gap: 5
                }}>
                  <Sparkles size={12} /> Wholesale Leather Warehouse
                </span>
              </div>

              {/* Main English Name */}
              <h1 style={{
                fontSize: 26, fontWeight: 900, margin: '4px 0 2px',
                letterSpacing: -0.4, color: '#ffffff'
              }}>
                Haji Rafiq Phoga Leather Shop
              </h1>

              {/* Badges / Address */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
                <span>📍 Shah Alam Market, Lahore</span>
                <span>•</span>
                <span style={{ color: '#93c5fd', fontWeight: 700 }}>
                  🏢 Active View: {d.godownName}
                </span>
                <span>•</span>
                <span style={{ color: '#86efac', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                  Multi-Godown Live Sync
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stat Pill Overview & Godowns Switcher Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 12,
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 16
            }}>
              <div>
                <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>Kul Rolls</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fcd34d' }}>{d.totalAvailableRolls.toLocaleString()}</div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.2)', paddingLeft: 14 }}>
                <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>Kul Lambai</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#86efac' }}>{fmt(d.totalAvailableMeters)} m</div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('godowns')}
              className="btn btn-light"
              style={{ fontWeight: 800, fontSize: 13, height: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderRadius: 10 }}
              title="Tamam Godowns Manage Karein (F2)"
            >
              <Building2 size={16} color="#1e40af" />
              <span>Godowns ({d.godownsBreakdown?.length || godowns.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. GODOWN VIEW SEGMENTED CONTROLLER ────────────────────────────── */}
      <div style={{
        background: '#ffffff', borderRadius: 12, padding: '10px 14px', marginBottom: 20,
        border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', marginRight: 4 }}>
            Stock View:
          </span>
          <button
            type="button"
            onClick={() => setSelectedView('all')}
            className="btn btn-sm"
            style={{
              fontWeight: 800, fontSize: 12, borderRadius: 8, padding: '6px 14px',
              background: isOverall ? '#1e3a8a' : '#f8fafc',
              color: isOverall ? '#ffffff' : '#334155',
              border: isOverall ? '1px solid #1e3a8a' : '1px solid #cbd5e1',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: isOverall ? '0 2px 6px rgba(30, 58, 138, 0.25)' : 'none'
            }}
            title="Overall Warehouse across all godowns (Alt+O)"
          >
            <Warehouse size={14} />
            <span>Tamam Godowns (Overall)</span>
            <span style={{
              fontSize: 10, padding: '1px 5px', borderRadius: 4,
              background: isOverall ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              fontFamily: 'monospace'
            }}>Alt+O</span>
          </button>

          {(d.godownsBreakdown || godowns).map((g) => {
            const isSelected = selectedView === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedView(g.id)}
                className="btn btn-sm"
                style={{
                  fontWeight: 800, fontSize: 12, borderRadius: 8, padding: '6px 14px',
                  background: isSelected ? '#2563eb' : '#f8fafc',
                  color: isSelected ? '#ffffff' : '#475569',
                  border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none'
                }}
              >
                <Building2 size={13} />
                <span>{g.name}</span>
                {'available_rolls' in g && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 10,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    fontWeight: 800
                  }}>
                    {(g as GodownBreakdown).available_rolls} rolls
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={load}
          className="btn btn-outline-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
          title="Refresh Dashboard (Alt+R)"
        >
          <RefreshCw size={13} /> Refresh <kbd style={{ fontSize: 9, padding: '1px 4px' }}>Alt+R</kbd>
        </button>
      </div>

      {/* ─── 3. TWO PRIMARY HERO ACTION BUTTONS (F4 / F5) ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, marginBottom: 24 }}>
        {/* INWARD STOCK: GREEN LUXURY GRADIENT */}
        <button
          onClick={() => onNavigate('inward')}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%)',
            color: '#fff', padding: '22px 26px', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: 'none', boxShadow: '0 8px 20px rgba(5, 150, 105, 0.3)',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
          }}
          title="Incoming Stock (F4 / Alt+4)"
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, opacity: 0.95, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 900, background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                AAMAD-E-MAAL
              </span>
              <kbd style={{ background: '#ffffff', color: '#064e3b', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 900 }}>F4</kbd>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, letterSpacing: -0.4 }}>
              MAAL ANDAR AAYE
            </div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4, fontWeight: 600 }}>
              Naya Maal Wasool Karein · Supplier Bill, Rate &amp; Rolls Darj Karein
            </div>
          </div>
          <div style={{
            width: 58, height: 58, borderRadius: 14,
            background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)', flexShrink: 0
          }}>
            <ArrowDownCircle size={34} color="#ffffff" />
          </div>
        </button>

        {/* OUTWARD STOCK: SUNSET ORANGE LUXURY GRADIENT */}
        <button
          onClick={() => onNavigate('outward')}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #ea580c 100%)',
            color: '#fff', padding: '22px 26px', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: 'none', boxShadow: '0 8px 20px rgba(234, 88, 12, 0.3)',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
          }}
          title="Outgoing Dispatch (F5 / Alt+5)"
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, opacity: 0.95, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 900, background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                IKHRAJ-E-MAAL
              </span>
              <kbd style={{ background: '#ffffff', color: '#7c2d12', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 900 }}>F5</kbd>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, letterSpacing: -0.4 }}>
              MAAL BAHAR JAYE
            </div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4, fontWeight: 600 }}>
              Customer Ko Maal Jari Karein · Rolls Select Karein &amp; Parchi Print Karein
            </div>
          </div>
          <div style={{
            width: 58, height: 58, borderRadius: 14,
            background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)', flexShrink: 0
          }}>
            <ArrowUpCircle size={34} color="#ffffff" />
          </div>
        </button>
      </div>

      {/* ─── 4. KPI METRIC CARDS ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Total Rolls */}
        <div style={{
          background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '20px 22px',
          borderTop: '5px solid #1e40af', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
              {isOverall ? 'Tamam Godowns Ka Stock' : 'Is Godown Ka Stock'}
            </span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e40af' }}>
              <Layers size={17} />
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#1e3a8a', lineHeight: 1.1 }}>
            {d.totalAvailableRolls.toLocaleString()} <span style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>rolls</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            {isOverall ? 'Tamam godowns me mojood rolls' : `${d.godownName} me mojood rolls`}
          </div>
        </div>

        {/* Total Meters */}
        <div style={{
          background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '20px 22px',
          borderTop: '5px solid #059669', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
              Kul Lambai (Available Meters)
            </span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <Warehouse size={17} />
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#065f46', lineHeight: 1.1 }}>
            {fmt(d.totalAvailableMeters)} <span style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>m</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            {isOverall ? 'Tamam godowns ki kul physical lambai' : 'Is godown ki kul physical lambai'}
          </div>
        </div>

        {/* Inward Today */}
        <div style={{
          background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '20px 22px',
          borderTop: '5px solid #0284c7', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
              Aaj Ki Aamad (Inward Today)
            </span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <ArrowDownCircle size={17} />
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#0369a1', lineHeight: 1.1 }}>
            {d.todayInwardCount} <span style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>slips</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            {isOverall ? 'Tamam godowns ki aamad slips' : 'Aaj ki aamad slips'}
          </div>
        </div>

        {/* Outward Today */}
        <div style={{
          background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '20px 22px',
          borderTop: '5px solid #ea580c', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
              Aaj Ka Jari Maal (Outward Today)
            </span>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <ArrowUpCircle size={17} />
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#c2410c', lineHeight: 1.1 }}>
            {d.todayOutwardCount} <span style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>slips</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            {isOverall ? 'Tamam godowns ki jari karda slips' : 'Aaj ki jari karda slips'}
          </div>
        </div>
      </div>

      {/* ─── 5. GODOWNS BREAKDOWN CARDS (When in Overall View) ────────────────── */}
      {isOverall && d.godownsBreakdown && d.godownsBreakdown.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #cbd5e1', padding: 22, marginBottom: 24, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={22} color="#2563eb" />
                Godown-Wise Stock Distribution (Har Godown Ka Stock)
              </h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                Haji Rafiq Phoga Leather Shop ke tamam godowns ka tafseeli stock. Kisi bhi godown par <strong>Enter dabayein</strong> uski tafseel dekhne ke liye.
              </div>
            </div>
            <button
              onClick={() => onNavigate('godowns')}
              className="btn btn-sm btn-outline-primary"
              style={{ fontWeight: 800, fontSize: 12, borderRadius: 8 }}
            >
              Godowns Manage Karein →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {d.godownsBreakdown.map(g => {
              const rollPct = d.totalAvailableRolls > 0 ? Math.round((g.available_rolls / d.totalAvailableRolls) * 100) : 0;
              return (
                <div
                  key={g.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Godown ${g.name}, press Enter to view inventory`}
                  onClick={() => setSelectedView(g.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedView(g.id);
                    }
                  }}
                  className="keyboard-bar"
                  style={{
                    border: '1.5px solid #cbd5e1', borderRadius: 14, padding: 18,
                    background: '#f8fafc', cursor: 'pointer', transition: 'all 0.18s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>{g.name}</div>
                      {g.address && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📍 {g.address}</div>}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 20,
                      background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe'
                    }}>
                      {rollPct}% Stock
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', margin: '12px 0' }}>
                    <div style={{ width: `${Math.min(rollPct, 100)}%`, height: '100%', background: '#2563eb', borderRadius: 4 }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Available Rolls</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#1e3a8a' }}>{g.available_rolls}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Total Meters</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f766e' }}>{fmt(g.total_available_meters)} m</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: '#2563eb', fontWeight: 800 }}>
                    <span>Is Godown Ki Tafseel Dekhein</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 6. FAST ROLL SEARCH & INSTANT HISTORY LOOKUP ───────────────────── */}
      <div style={{
        background: '#ffffff', padding: '16px 22px', borderRadius: 14,
        border: '1.5px solid #cbd5e1', marginBottom: 24, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
      }}>
        <form onSubmit={handleQuickRollSearch} style={{ display: 'flex', gap: 10, flex: 1, maxWidth: 580 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              ref={searchInputRef}
              type="text"
              className="form-control"
              placeholder="Roll ID likhein aur Enter dabayein (e.g. 192-0001 / RL-...) [Alt+S]"
              value={quickSearchRoll}
              onChange={e => setQuickSearchRoll(e.target.value)}
              style={{ paddingLeft: 36, height: 42, fontSize: 13, fontWeight: 700 }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ fontWeight: 800, fontSize: 13, padding: '0 18px' }}>
            History Dekhein <kbd style={{ fontSize: 9, marginLeft: 4 }}>Enter</kbd>
          </button>
        </form>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onNavigate('current-stock')}
            className="btn btn-outline-secondary"
            style={{ fontSize: 13, fontWeight: 800, height: 42, display: 'flex', alignItems: 'center', gap: 6 }}
            title="Current Stock (F3)"
          >
            <Layers size={15} /> Mojooda Stock <kbd style={{ fontSize: 9 }}>F3</kbd>
          </button>
          <button
            onClick={() => onNavigate('history')}
            className="btn btn-outline-secondary"
            style={{ fontSize: 13, fontWeight: 800, height: 42, display: 'flex', alignItems: 'center', gap: 6 }}
            title="History (F7)"
          >
            <History size={15} /> Roll History <kbd style={{ fontSize: 9 }}>F7</kbd>
          </button>
        </div>
      </div>

      {/* ─── 7. PRODUCTS STOCK SUMMARY TABLE ─────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 22, marginBottom: 24, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: '#1e293b' }}>
              {isOverall ? 'Products Stock Summary (Overall Warehouse)' : `Products Stock Summary (${d.godownName})`}
            </h2>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {isOverall ? 'Tamam godowns me har product ke kul available rolls aur meters' : 'Is godown ka product-wise stock'}
            </div>
          </div>
          <button
            onClick={() => onNavigate('current-stock')}
            className="btn btn-sm btn-link text-decoration-none"
            style={{ fontWeight: 800, fontSize: 13, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Mukammal Stock Bars Dekhein <ArrowRight size={14} />
          </button>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
            <thead style={{ background: '#f8fafc', textTransform: 'uppercase', fontSize: 11, color: '#64748b' }}>
              <tr>
                <th>Product Code</th>
                <th>Product Name</th>
                <th className="text-end">Available Rolls</th>
                <th className="text-end">Total Available Meters</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {d.byProduct.map(p => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  role="button"
                  title="Enter dabayein ya click karein rolls dekhne ke liye"
                  onClick={() => onNavigate('current-stock')}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate('current-stock');
                    }
                  }}
                >
                  <td><strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#1e3a8a', background: '#e0e7ff', padding: '2px 8px', borderRadius: 6 }}>{p.product_code}</strong></td>
                  <td><strong>{p.product_name}</strong></td>
                  <td className="text-end">
                    <span className="badge bg-light text-dark" style={{ fontSize: 13, fontWeight: 800, padding: '5px 12px', border: '1.5px solid #cbd5e1' }}>
                      {p.available_rolls} rolls
                    </span>
                  </td>
                  <td className="text-end" style={{ fontWeight: 900, color: '#0f766e', fontSize: 15 }}>
                    {fmt(p.total_available_meters)} m
                  </td>
                  <td className="text-center">
                    <button
                      tabIndex={-1}
                      onClick={e => { e.stopPropagation(); onNavigate('current-stock'); }}
                      className="btn btn-sm btn-outline-primary"
                      style={{ fontSize: 12, padding: '4px 12px', fontWeight: 800 }}
                    >
                      Rolls Dekhein <kbd style={{ fontSize: 9, marginLeft: 4 }}>Enter</kbd>
                    </button>
                  </td>
                </tr>
              ))}
              {d.byProduct.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    Koi stock mojood nahi hai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 8. RECENT ACTIVITY (INWARD & OUTWARD FEEDS) ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Recently Received */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 20, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowDownCircle size={20} color="#16a34a" />
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: '#166534' }}>
                Haliya Aamad (Recently Received Rolls)
              </h3>
            </div>
            {isOverall && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>All Godowns</span>}
          </div>

          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0" style={{ fontSize: 12 }}>
              <thead style={{ background: '#f8fafc', color: '#64748b' }}>
                <tr>
                  <th>Roll ID</th>
                  <th>Length</th>
                  <th>Product</th>
                  {isOverall && <th>Godown</th>}
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {d.recentInward.map((r, i) => (
                  <tr
                    key={i}
                    tabIndex={0}
                    role="button"
                    title="Enter dabayein roll history dekhne ke liye"
                    onClick={() => setSelectedRollCode(r.roll_code)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRollCode(r.roll_code);
                      }
                    }}
                  >
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#2563eb', fontSize: 13 }}>
                        {r.roll_code}
                      </span>
                    </td>
                    <td><strong>{r.original_length_meters.toFixed(2)} m</strong></td>
                    <td>{r.product_code}</td>
                    {isOverall && (
                      <td>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#eff6ff', color: '#1e40af', fontWeight: 700 }}>
                          {r.godown_name || '—'}
                        </span>
                      </td>
                    )}
                    <td style={{ color: '#64748b' }}>{fmtDate(r.received_at)}</td>
                  </tr>
                ))}
                {d.recentInward.length === 0 && (
                  <tr>
                    <td colSpan={isOverall ? 5 : 4} className="text-center py-4 text-muted">Haliya koi roll receive nahi hua.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recently Issued */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 20, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowUpCircle size={20} color="#ea580c" />
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: '#9a3412' }}>
                Haliya Khurch (Recently Dispatched Rolls)
              </h3>
            </div>
            {isOverall && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>All Godowns</span>}
          </div>

          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0" style={{ fontSize: 12 }}>
              <thead style={{ background: '#f8fafc', color: '#64748b' }}>
                <tr>
                  <th>Roll ID</th>
                  <th>Length</th>
                  <th>Recipient</th>
                  {isOverall && <th>Godown</th>}
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {d.recentOutward.map((r, i) => (
                  <tr
                    key={i}
                    tabIndex={0}
                    role="button"
                    title="Enter dabayein roll history dekhne ke liye"
                    onClick={() => setSelectedRollCode(r.roll_code)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRollCode(r.roll_code);
                      }
                    }}
                  >
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#ea580c', fontSize: 13 }}>
                        {r.roll_code}
                      </span>
                    </td>
                    <td><strong>{r.issued_length_meters.toFixed(2)} m</strong></td>
                    <td>{r.recipient_reference || '-'}</td>
                    {isOverall && (
                      <td>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fff7ed', color: '#c2410c', fontWeight: 700 }}>
                          {r.godown_name || '—'}
                        </span>
                      </td>
                    )}
                    <td style={{ color: '#64748b' }}>{fmtDate(r.transaction_date)}</td>
                  </tr>
                ))}
                {d.recentOutward.length === 0 && (
                  <tr>
                    <td colSpan={isOverall ? 5 : 4} className="text-center py-4 text-muted">Haliya koi roll khurch nahi hua.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Global Roll History Modal */}
      {selectedRollCode && (
        <RollHistoryModal
          rollIdOrCode={selectedRollCode}
          onClose={() => setSelectedRollCode(null)}
        />
      )}
    </div>
  );
}
