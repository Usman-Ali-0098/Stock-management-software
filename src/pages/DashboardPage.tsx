import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Layers, ArrowDownCircle, ArrowUpCircle, RefreshCw, Warehouse,
  Search, Building2, ChevronDown, ChevronUp, ChevronsDownUp, Plus, Check, X, AlertTriangle,
  Edit3, DollarSign, Repeat
} from 'lucide-react';
import { api, DashboardData, GodownBreakdown, Variant, BulkLot, LowStockItem } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import VariantHistoryModal from '../components/RollHistoryModal';
import BulkLotHistoryModal from '../components/BulkLotHistoryModal';
import ShopBanner from '../components/ShopBanner';
import { useEscapeClose } from '../hooks/useEscapeClose';

type Page = 'dashboard' | 'godowns' | 'products' | 'inward' | 'outward' | 'history' | 'settings';

interface Props {
  onNavigate: (page: Page) => void;
  onRestockVariant?: (productId: number, godownId: number, lengthMeters?: number, ratePerMeter?: number) => void;
  onDispatchVariant?: (productId: number, godownId: number, lengthMeters: number) => void;
  onRestockBulk?: (productId: number, godownId: number, ratePerMeter?: number) => void;
  onDispatchBulk?: (productId: number, godownId: number) => void;
}

const LOW_STOCK_THRESHOLD = 5;
const BULK_LOW_STOCK_METERS = 100;

function fmt(meters: number) {
  return meters.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtMoney(amount: number) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

const SEGMENT_COLORS = ['#2563eb', '#f59e0b', '#059669', '#db2777', '#7c3aed', '#0891b2'];

// Bootstrap paints an explicit white background on every <td>/<th>, so expanded-row cells
// need this set directly on each cell (inline styles are the only thing guaranteed to win).
const EXPAND_ROW_BG = '#eef1f5';

interface ProductGroup {
  productId: number;
  productCode: string;
  productName: string;
  totalQuantity: number;
  totalMeters: number;
  totalValue: number;
  latestUpdatedAt: string;
  variants: Variant[];
}

interface BulkProductGroup {
  productId: number;
  productCode: string;
  productName: string;
  totalQuantity: number;
  totalMeters: number;
  totalValue: number;
  latestUpdatedAt: string;
  lots: BulkLot[];
}

// ─── Low Stock Warning (search-bar sibling) ──────────────────────────────────

function LowStockWidget({ onRestock, onRestockBulk, stockView }: {
  onRestock?: (productId: number, godownId: number, lengthMeters?: number, ratePerMeter?: number) => void;
  onRestockBulk?: (productId: number, godownId: number, ratePerMeter?: number) => void;
  stockView: 'bulk' | 'single';
}) {
  const [allItems, setAllItems] = useState<LowStockItem[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.stock.lowStock(LOW_STOCK_THRESHOLD, BULK_LOW_STOCK_METERS).then(res => {
      if (res.success && res.data) setAllItems(res.data);
    });
  }, []);

  // Match whichever stock view (Bulk Lot / Single Roll Size) is currently selected on the dashboard.
  const items = useMemo(
    () => allItems.filter(v => (stockView === 'bulk' ? v.is_bulk : !v.is_bulk)),
    [allItems, stockView]
  );
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const count = items.length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn btn-sm"
        title="Low stock warning"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
          background: count > 0 ? '#fef2f2' : '#f8fafc',
          border: `1px solid ${count > 0 ? '#fecaca' : '#cbd5e1'}`,
          borderRadius: 7, padding: '0 10px', color: count > 0 ? '#b91c1c' : '#64748b',
          height: 34,
        }}
      >
        <AlertTriangle size={14} color={count > 0 ? '#dc2626' : '#94a3b8'} />
        <span>Low Stock</span>
        {count > 0 && (
          <span style={{
            minWidth: 18, height: 18, borderRadius: 9, background: '#dc2626', color: '#fff',
            fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px',
          }}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, minWidth: 300, maxWidth: 360,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 20px rgba(15,23,42,0.12)', zIndex: 60, overflow: 'hidden'
        }}>
          <div style={{
            padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700,
            color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>Low Stock &middot; &le; {stockView === 'bulk' ? `${BULK_LOW_STOCK_METERS} m` : `${LOW_STOCK_THRESHOLD} rolls`}</span>
            <button onClick={load} className="btn btn-ghost btn-sm p-0" title="Refresh">
              <RefreshCw size={12} color="#94a3b8" />
            </button>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {count === 0 ? (
              <div style={{ padding: '18px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                Nothing running low.
              </div>
            ) : items.map(v => {
              const isZero = v.is_bulk ? v.total_length_meters === 0 : v.quantity === 0;
              return (
                <button
                  key={v.is_bulk ? `b-${v.id}` : `v-${v.id}`}
                  type="button"
                  onClick={() => {
                    if (v.is_bulk) onRestockBulk?.(v.product_id, v.godown_id, v.rate_per_meter);
                    else onRestock?.(v.product_id, v.godown_id, v.length_meters, v.rate_per_meter);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
                    borderBottom: '1px solid #f8fafc', background: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: '#1e293b',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {v.product_name} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({v.product_code})</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>
                      {v.is_bulk ? 'Bulk' : `${v.length_meters} m`} &middot; {v.godown_name}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: isZero ? '#991b1b' : '#b45309',
                    background: isZero ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${isZero ? '#fecaca' : '#fde68a'}`,
                    borderRadius: 6, padding: '2px 7px', flexShrink: 0
                  }}>
                    {v.is_bulk ? `${fmt(v.total_length_meters)} m left` : `${v.quantity} left`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small View Selector (Overall / Godown switch + Create New) ─────────────

interface ViewSelectorProps {
  selectedView: number | 'all';
  onSelect: (v: number | 'all') => void;
  breakdown: GodownBreakdown[];
}

function ViewSelector({ selectedView, onSelect, breakdown }: ViewSelectorProps) {
  const { godowns, createGodown } = useGodown();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const currentLabel = selectedView === 'all'
    ? 'Overall (All Godowns)'
    : godowns.find(g => g.id === selectedView)?.name || 'Select Godown';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.showToast('Godown name is required.', 'error');
      return;
    }
    setSaving(true);
    const res = await createGodown(name.trim(), address.trim());
    setSaving(false);
    if (res.success && res.data) {
      toast.showToast(`Godown "${res.data.name}" created.`, 'success');
      setName('');
      setAddress('');
      setCreating(false);
      setOpen(false);
      onSelect(res.data.id);
    } else {
      toast.showToast(res.error || 'Could not create godown.', 'error');
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn btn-sm"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
          background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 7,
          padding: '5px 10px', color: '#334155'
        }}
      >
        <Building2 size={13} color="#2563eb" />
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentLabel}
        </span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, minWidth: 230,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 20px rgba(15,23,42,0.12)', zIndex: 50, overflow: 'hidden'
        }}>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => { onSelect('all'); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                background: selectedView === 'all' ? '#eff6ff' : '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5
              }}
            >
              <span style={{ fontWeight: selectedView === 'all' ? 700 : 500, color: '#1e293b' }}>
                Overall (All Godowns)
              </span>
              {selectedView === 'all' && <Check size={13} color="#2563eb" />}
            </button>
            {(breakdown.length ? breakdown : godowns).map(g => {
              const isSel = selectedView === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { onSelect(g.id); setOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                    background: isSel ? '#eff6ff' : '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5,
                    borderTop: '1px solid #f1f5f9'
                  }}
                >
                  <span style={{ fontWeight: isSel ? 700 : 500, color: '#1e293b' }}>{g.name}</span>
                  {isSel && <Check size={13} color="#2563eb" />}
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                style={{
                  width: '100%', padding: '8px 12px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#2563eb',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <Plus size={13} /> Add New Godown
              </button>
            ) : (
              <form onSubmit={handleCreate} style={{ padding: 10 }}>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Godown name"
                  className="form-control"
                  style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6, height: 30 }}
                />
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="form-control"
                  style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6, height: 30 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="btn btn-sm btn-outline-secondary"
                    style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
                  >
                    <X size={11} /> Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-sm btn-primary"
                    style={{ flex: 1, fontSize: 11, padding: '4px 0', fontWeight: 700 }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage({ onNavigate, onRestockVariant, onDispatchVariant, onRestockBulk, onDispatchBulk }: Props) {
  const toast = useToast();
  const [selectedView, setSelectedView] = useState<number | 'all'>('all');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Focusable product rows of whichever stock table (bulk/single) is currently visible —
  // lets Enter in the search box jump into the list, then Arrow Up/Down walk through it.
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const handleRowNavKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, index: number, total: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      rowRefs.current[Math.min(index + 1, total - 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index === 0) searchInputRef.current?.focus();
      else rowRefs.current[index - 1]?.focus();
    }
  };

  // Bulk is the primary stock view; "single" (roll-size) is one small button away.
  const [stockView, setStockView] = useState<'bulk' | 'single'>('bulk');

  // Stock table (merged in from the former Current Stock page) — scoped by the same godown view above.
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [editingProductLabel, setEditingProductLabel] = useState('');
  const [newRateInput, setNewRateInput] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [historyVariantId, setHistoryVariantId] = useState<number | null>(null);

  // Bulk lots table — parallel to the variant table above.
  const [bulkLots, setBulkLots] = useState<BulkLot[]>([]);
  const [loadingBulkLots, setLoadingBulkLots] = useState(false);
  const [expandedBulkProducts, setExpandedBulkProducts] = useState<Set<number>>(new Set());
  const [editingBulkLot, setEditingBulkLot] = useState<BulkLot | null>(null);
  const [editingBulkProductLabel, setEditingBulkProductLabel] = useState('');
  const [newBulkRateInput, setNewBulkRateInput] = useState('');
  const [savingBulkRate, setSavingBulkRate] = useState(false);
  const [historyBulkLotId, setHistoryBulkLotId] = useState<number | null>(null);

  useEscapeClose(() => setEditingVariant(null), !!editingVariant && !savingRate);
  useEscapeClose(() => setEditingBulkLot(null), !!editingBulkLot && !savingBulkRate);

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

  const loadVariants = useCallback(async () => {
    setLoadingVariants(true);
    const res = await api.variants.listAll({
      godownId: selectedView === 'all' ? undefined : selectedView,
    });
    setVariants(res.success && res.data ? res.data : []);
    setLoadingVariants(false);
  }, [selectedView]);

  const loadBulkLots = useCallback(async () => {
    setLoadingBulkLots(true);
    const res = await api.bulk.listAll({
      godownId: selectedView === 'all' ? undefined : selectedView,
    });
    setBulkLots(res.success && res.data ? res.data : []);
    setLoadingBulkLots(false);
  }, [selectedView]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadVariants(); }, [loadVariants]);
  useEffect(() => { loadBulkLots(); }, [loadBulkLots]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setSelectedView('all');
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        load();
        loadVariants();
        loadBulkLots();
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
  }, [load, loadVariants, loadBulkLots, onNavigate]);

  // Group: Product -> variants (each variant is already a distinct roll size / rate / godown batch)
  const productGroups: ProductGroup[] = useMemo(() => {
    const productMap = new Map<number, ProductGroup>();

    for (const v of variants) {
      let product = productMap.get(v.product_id);
      if (!product) {
        product = {
          productId: v.product_id,
          productCode: v.product_code || String(v.product_id),
          productName: v.product_name || 'Leather Product',
          totalQuantity: 0,
          totalMeters: 0,
          totalValue: 0,
          latestUpdatedAt: v.updated_at,
          variants: [],
        };
        productMap.set(v.product_id, product);
      }

      product.totalQuantity += v.quantity;
      product.totalMeters += v.quantity * v.length_meters;
      product.totalValue += Math.round(v.quantity * v.length_meters * v.rate_per_meter);
      if (v.updated_at > product.latestUpdatedAt) product.latestUpdatedAt = v.updated_at;
      product.variants.push(v);
    }

    for (const product of productMap.values()) {
      product.variants.sort((a, b) => b.length_meters - a.length_meters);
    }

    return Array.from(productMap.values()).sort((a, b) => b.latestUpdatedAt.localeCompare(a.latestUpdatedAt));
  }, [variants]);

  const filteredProductGroups = useMemo(() => {
    if (!search.trim()) return productGroups;
    const q = search.trim().toLowerCase();
    return productGroups.filter(p =>
      p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)
    );
  }, [productGroups, search]);

  const toggleProductExpand = (productId: number) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSaveRate = async () => {
    if (!editingVariant) return;
    const rateVal = parseFloat(newRateInput);
    if (isNaN(rateVal) || rateVal < 0) {
      toast.showToast('Enter a valid rate.', 'error');
      return;
    }

    setSavingRate(true);
    try {
      const res = await api.variants.updateRate({ variantId: editingVariant.id, ratePerMeter: rateVal });
      if (res.success) {
        toast.showToast(`Rate updated to Rs. ${rateVal}/m.`, 'success');
        setEditingVariant(null);
        loadVariants();
      } else {
        toast.showToast(res.error || 'Could not update rate.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setSavingRate(false);
    }
  };

  // Group: Product -> bulk lots (each lot is a distinct rate / godown batch, no fixed roll size)
  const bulkProductGroups: BulkProductGroup[] = useMemo(() => {
    const productMap = new Map<number, BulkProductGroup>();

    for (const b of bulkLots) {
      let product = productMap.get(b.product_id);
      if (!product) {
        product = {
          productId: b.product_id,
          productCode: b.product_code || String(b.product_id),
          productName: b.product_name || 'Leather Product',
          totalQuantity: 0,
          totalMeters: 0,
          totalValue: 0,
          latestUpdatedAt: b.updated_at,
          lots: [],
        };
        productMap.set(b.product_id, product);
      }

      product.totalQuantity += b.quantity;
      product.totalMeters += b.total_length_meters;
      product.totalValue += Math.round(b.total_length_meters * b.rate_per_meter);
      if (b.updated_at > product.latestUpdatedAt) product.latestUpdatedAt = b.updated_at;
      product.lots.push(b);
    }

    for (const product of productMap.values()) {
      product.lots.sort((a, b) => b.rate_per_meter - a.rate_per_meter);
    }

    return Array.from(productMap.values()).sort((a, b) => b.latestUpdatedAt.localeCompare(a.latestUpdatedAt));
  }, [bulkLots]);

  const filteredBulkProductGroups = useMemo(() => {
    if (!search.trim()) return bulkProductGroups;
    const q = search.trim().toLowerCase();
    return bulkProductGroups.filter(p =>
      p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)
    );
  }, [bulkProductGroups, search]);

  const toggleBulkProductExpand = (productId: number) => {
    setExpandedBulkProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSaveBulkRate = async () => {
    if (!editingBulkLot) return;
    const rateVal = parseFloat(newBulkRateInput);
    if (isNaN(rateVal) || rateVal < 0) {
      toast.showToast('Enter a valid rate.', 'error');
      return;
    }

    setSavingBulkRate(true);
    try {
      const res = await api.bulk.updateRate({ bulkLotId: editingBulkLot.id, ratePerMeter: rateVal });
      if (res.success) {
        toast.showToast(`Rate updated to Rs. ${rateVal}/m.`, 'success');
        setEditingBulkLot(null);
        loadBulkLots();
      } else {
        toast.showToast(res.error || 'Could not update rate.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setSavingBulkRate(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: 32, height: 32 }}></div>
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>Loading dashboard...</div>
      </div>
    );
  }

  const d = data;
  if (!d) return null;

  const breakdown = d.godownsBreakdown || [];
  const showGodownColumn = selectedView === 'all';

  const kpis = [
    { label: 'Available Rolls', value: `${d.totalAvailableRolls.toLocaleString()}`, suffix: 'rolls', icon: <Layers size={14} />, color: '#1e40af', bg: '#eff6ff' },
    { label: 'Available Meters', value: fmt(d.totalAvailableMeters), suffix: 'm', icon: <Warehouse size={14} />, color: '#059669', bg: '#f0fdf4' },
    { label: 'Inward Today', value: `${d.todayInwardCount}`, suffix: 'slips', icon: <ArrowDownCircle size={14} />, color: '#0284c7', bg: '#f0f9ff' },
    { label: 'Outward Today', value: `${d.todayOutwardCount}`, suffix: 'slips', icon: <ArrowUpCircle size={14} />, color: '#ea580c', bg: '#fff7ed' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingBottom: 40 }}>

      {/* ─── Header: shop name banner ─── */}
      <ShopBanner />

      {/* ─── View controls: refresh + godown view selector ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => { load(); loadVariants(); }}
          title="Refresh (Alt+R)"
          className="btn btn-sm btn-outline-secondary"
          style={{ padding: '5px 8px', display: 'flex', alignItems: 'center' }}
        >
          <RefreshCw size={13} />
        </button>
        <ViewSelector selectedView={selectedView} onSelect={setSelectedView} breakdown={breakdown} />
      </div>

      {/* ─── Incoming / Outgoing (small) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
        <button
          onClick={() => onNavigate('inward')}
          className="btn"
          style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46',
            borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center',
            gap: 10, cursor: 'pointer', textAlign: 'left'
          }}
        >
          <ArrowDownCircle size={20} color="#059669" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Incoming Stock</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Maal Andar &middot; F3</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate('outward')}
          className="btn"
          style={{
            background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412',
            borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center',
            gap: 10, cursor: 'pointer', textAlign: 'left'
          }}
        >
          <ArrowUpCircle size={20} color="#ea580c" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Outgoing Stock</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Maal Bahar &middot; F4</div>
          </div>
        </button>
      </div>

      {/* ─── KPI cards (small) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '10px 12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</span>
              <span style={{
                width: 22, height: 22, borderRadius: 6, background: k.bg, color: k.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {k.icon}
              </span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
              {k.value} <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{k.suffix}</span>
            </div>
          </div>
        ))}

        {breakdown.length > 0 && (
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '10px 12px',
            gridColumn: 'span 2'
          }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Stock Distribution
            </span>
            <div style={{ display: 'flex', width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', background: '#e2e8f0', margin: '7px 0 6px' }}>
              {breakdown.map((g, i) => {
                const pct = d.totalAvailableRolls > 0 ? (g.available_rolls / d.totalAvailableRolls) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={g.id}
                    style={{ width: `${pct}%`, height: '100%', background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {breakdown.map((g, i) => {
                const pct = d.totalAvailableRolls > 0 ? Math.round((g.available_rolls / d.totalAvailableRolls) * 100) : 0;
                return (
                  <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], display: 'inline-block' }} />
                    <strong style={{ color: '#1e293b' }}>{g.name}</strong>&nbsp;{pct}%
                    {i < breakdown.length - 1 && <span style={{ color: '#cbd5e1', marginLeft: 4 }}>&middot;</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Search bar + low stock warning ─── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', maxWidth: 360, flex: 1 }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            ref={searchInputRef}
            type="text"
            className="form-control"
            placeholder="Search product by name or code (Alt+S)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rowRefs.current[0]?.focus(); } }}
            autoFocus
            style={{ paddingLeft: 32, height: 34, fontSize: 12.5 }}
          />
        </div>
        <LowStockWidget onRestock={onRestockVariant} onRestockBulk={onRestockBulk} stockView={stockView} />
      </div>

      {/* ─── Stock table (Product -> Roll Size / Bulk Lot, expandable) ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {stockView === 'bulk' ? 'Bulk Lot Stock' : 'Single Roll Size Stock'}
        </span>
        <button
          type="button"
          onClick={() => setStockView(stockView === 'bulk' ? 'single' : 'bulk')}
          className="btn btn-sm btn-outline-secondary"
          style={{ fontSize: 10.5, padding: '3px 10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Repeat size={11} /> {stockView === 'bulk' ? 'Show Single Roll Size Products' : 'Show Bulk Lot Products'}
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 12 }}>
        {stockView === 'single' ? (
        loadingVariants ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
            Loading stock...
          </div>
        ) : filteredProductGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
            {search ? 'No products match this search.' : 'No stock available.'}
          </div>
        ) : (
          <>
            {expandedProducts.size > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => setExpandedProducts(new Set())}
                  className="btn btn-sm btn-outline-secondary"
                  style={{ fontSize: 10.5, padding: '2px 8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Collapse all expanded rows"
                >
                  <ChevronsDownUp size={11} /> Collapse All
                </button>
              </div>
            )}
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12, borderCollapse: 'separate', borderSpacing: '0 1px' }}>
              <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '6px 8px' }}></th>
                  <th style={{ padding: '6px 8px' }}>Product</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Roll Sizes</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Total Rolls</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Total Meters</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Value</th>
                  <th style={{ padding: '6px 8px' }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredProductGroups.map((product, rowIndex) => {
                  const isExpanded = expandedProducts.has(product.productId);
                  return (
                    <React.Fragment key={product.productId}>
                      <tr
                        ref={el => { rowRefs.current[rowIndex] = el; }}
                        tabIndex={0}
                        role="button"
                        onClick={() => toggleProductExpand(product.productId)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); toggleProductExpand(product.productId); }
                          else handleRowNavKeyDown(e, rowIndex, filteredProductGroups.length);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ padding: '6px 8px', color: '#94a3b8' }}>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <strong>{product.productName}</strong>{' '}
                          <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#64748b' }}>({product.productCode})</span>
                        </td>
                        <td className="text-end" style={{ padding: '6px 8px', color: '#64748b' }}>
                          {product.variants.length}
                        </td>
                        <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700 }}>{product.totalQuantity}</td>
                        <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: '#0f766e' }}>
                          {fmt(product.totalMeters)} m
                        </td>
                        <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: '#334155' }}>
                          {product.totalValue > 0 ? `Rs. ${fmtMoney(product.totalValue)}` : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#64748b', fontSize: 11 }}>
                          {fmtDate(product.latestUpdatedAt)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{
                            padding: '6px 0', background: '#eef1f5',
                            borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0'
                          }}>
                            <table className="table table-sm table-hover mb-0" style={{ fontSize: 11.5, background: 'transparent' }}>
                              <thead style={{ color: '#94a3b8', fontSize: 10 }}>
                                <tr>
                                  <th style={{ padding: '4px 20px' }}>Roll Size</th>
                                  <th className="text-end" style={{ padding: '4px 8px' }}>Qty</th>
                                  <th className="text-end" style={{ padding: '4px 8px' }}>Meters</th>
                                  <th className="text-end" style={{ padding: '4px 8px' }}>Rate (Rs./m)</th>
                                  <th className="text-end" style={{ padding: '4px 8px' }}>Value</th>
                                  {showGodownColumn && <th style={{ padding: '4px 8px' }}>Godown</th>}
                                  <th style={{ padding: '4px 8px' }}>Updated</th>
                                  <th style={{ padding: '4px 8px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.variants.map(variant => {
                                  const totalMeters = variant.quantity * variant.length_meters;
                                  const totalPrice = Math.round(totalMeters * variant.rate_per_meter);
                                  return (
                                    <tr
                                      key={variant.id}
                                      tabIndex={0}
                                      role="button"
                                      onClick={() => setHistoryVariantId(variant.id)}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setHistoryVariantId(variant.id); } }}
                                      title="View stock movement history"
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <td style={{ padding: '4px 20px', fontWeight: 700, color: '#1e40af', background: EXPAND_ROW_BG }}>
                                        {fmt(variant.length_meters)} m
                                      </td>
                                      <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, background: EXPAND_ROW_BG }}>{variant.quantity}</td>
                                      <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, color: '#0f766e', background: EXPAND_ROW_BG }}>
                                        {fmt(totalMeters)} m
                                      </td>
                                      <td className="text-end" style={{ padding: '4px 8px', background: EXPAND_ROW_BG }}>
                                        <span style={{ fontWeight: 700, color: '#92400e' }}>
                                          {variant.rate_per_meter > 0 ? `Rs. ${fmtMoney(variant.rate_per_meter)}` : '—'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={e => {
                                            e.stopPropagation();
                                            setEditingVariant(variant);
                                            setEditingProductLabel(`${product.productName} (${product.productCode})`);
                                            setNewRateInput(String(variant.rate_per_meter || ''));
                                          }}
                                          onKeyDown={e => e.stopPropagation()}
                                          className="btn btn-ghost btn-sm p-0 row-action-btn"
                                          style={{ marginLeft: 6, color: '#b45309' }}
                                          title="Edit rate"
                                        >
                                          <Edit3 size={12} color="#b45309" />
                                        </button>
                                      </td>
                                      <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, color: '#334155', background: EXPAND_ROW_BG }}>
                                        {totalPrice > 0 ? `Rs. ${fmtMoney(totalPrice)}` : '—'}
                                      </td>
                                      {showGodownColumn && (
                                        <td style={{ padding: '4px 8px', background: EXPAND_ROW_BG }}>
                                          <span style={{
                                            fontSize: 10.5, fontWeight: 700, color: '#3730a3',
                                            background: '#e0e7ff', borderRadius: 5, padding: '2px 7px',
                                          }}>
                                            {variant.godown_name}
                                          </span>
                                        </td>
                                      )}
                                      <td style={{ padding: '4px 8px', color: '#64748b', background: EXPAND_ROW_BG }}>{fmtDate(variant.updated_at)}</td>
                                      <td style={{ padding: '4px 8px', background: EXPAND_ROW_BG }}>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                          <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); onRestockVariant?.(variant.product_id, variant.godown_id, variant.length_meters, variant.rate_per_meter); }}
                                            onKeyDown={e => e.stopPropagation()}
                                            className="btn btn-sm row-action-btn"
                                            style={{
                                              padding: '2px 6px', display: 'flex', alignItems: 'center',
                                              background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#15803d', borderRadius: 5,
                                            }}
                                            title="Add stock (Incoming)"
                                          >
                                            <ArrowDownCircle size={13} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); onDispatchVariant?.(variant.product_id, variant.godown_id, variant.length_meters); }}
                                            onKeyDown={e => e.stopPropagation()}
                                            className="btn btn-sm row-action-btn"
                                            style={{
                                              padding: '2px 6px', display: 'flex', alignItems: 'center',
                                              background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 5,
                                            }}
                                            title="Dispatch stock (Outgoing)"
                                          >
                                            <ArrowUpCircle size={13} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )
        ) : (
          loadingBulkLots ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
              Loading stock...
            </div>
          ) : filteredBulkProductGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
              {search ? 'No products match this search.' : 'No bulk stock available.'}
            </div>
          ) : (
            <>
              {expandedBulkProducts.size > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <button
                    type="button"
                    onClick={() => setExpandedBulkProducts(new Set())}
                    className="btn btn-sm btn-outline-secondary"
                    style={{ fontSize: 10.5, padding: '2px 8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Collapse all expanded rows"
                  >
                    <ChevronsDownUp size={11} /> Collapse All
                  </button>
                </div>
              )}
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12, borderCollapse: 'separate', borderSpacing: '0 1px' }}>
                  <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
                    <tr>
                      <th style={{ padding: '6px 8px' }}></th>
                      <th style={{ padding: '6px 8px' }}>Product</th>
                      <th className="text-end" style={{ padding: '6px 8px' }}>Bulk Lots</th>
                      <th className="text-end" style={{ padding: '6px 8px' }}>Total Rolls</th>
                      <th className="text-end" style={{ padding: '6px 8px' }}>Total Meters</th>
                      <th className="text-end" style={{ padding: '6px 8px' }}>Value</th>
                      <th style={{ padding: '6px 8px' }}>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBulkProductGroups.map((product, rowIndex) => {
                      const isExpanded = expandedBulkProducts.has(product.productId);
                      return (
                        <React.Fragment key={product.productId}>
                          <tr
                            ref={el => { rowRefs.current[rowIndex] = el; }}
                            tabIndex={0}
                            role="button"
                            onClick={() => toggleBulkProductExpand(product.productId)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); toggleBulkProductExpand(product.productId); }
                              else handleRowNavKeyDown(e, rowIndex, filteredBulkProductGroups.length);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ padding: '6px 8px', color: '#94a3b8' }}>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <strong>{product.productName}</strong>{' '}
                              <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#64748b' }}>({product.productCode})</span>
                            </td>
                            <td className="text-end" style={{ padding: '6px 8px', color: '#64748b' }}>
                              {product.lots.length}
                            </td>
                            <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700 }}>{product.totalQuantity}</td>
                            <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: '#0f766e' }}>
                              {fmt(product.totalMeters)} m
                            </td>
                            <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: '#334155' }}>
                              {product.totalValue > 0 ? `Rs. ${fmtMoney(product.totalValue)}` : '—'}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#64748b', fontSize: 11 }}>
                              {fmtDate(product.latestUpdatedAt)}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={7} style={{
                                padding: '6px 0', background: '#eef1f5',
                                borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0'
                              }}>
                                <table className="table table-sm table-hover mb-0" style={{ fontSize: 11.5, background: 'transparent' }}>
                                  <thead style={{ color: '#94a3b8', fontSize: 10 }}>
                                    <tr>
                                      <th className="text-end" style={{ padding: '4px 20px' }}>Meters</th>
                                      <th className="text-end" style={{ padding: '4px 8px' }}>Rolls</th>
                                      <th className="text-end" style={{ padding: '4px 8px' }}>Rate (Rs./m)</th>
                                      <th className="text-end" style={{ padding: '4px 8px' }}>Value</th>
                                      {showGodownColumn && <th style={{ padding: '4px 8px' }}>Godown</th>}
                                      <th style={{ padding: '4px 8px' }}>Updated</th>
                                      <th style={{ padding: '4px 8px' }}></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {product.lots.map(lot => {
                                      const totalPrice = Math.round(lot.total_length_meters * lot.rate_per_meter);
                                      // Same godown, different rate = this product's price changed there over time.
                                      const priceChanged = product.lots.some(l => l.id !== lot.id && l.godown_id === lot.godown_id && l.rate_per_meter !== lot.rate_per_meter);
                                      return (
                                        <tr
                                          key={lot.id}
                                          tabIndex={0}
                                          role="button"
                                          onClick={() => setHistoryBulkLotId(lot.id)}
                                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setHistoryBulkLotId(lot.id); } }}
                                          title="View stock movement history"
                                          style={{ cursor: 'pointer' }}
                                        >
                                          <td className="text-end" style={{ padding: '4px 20px', fontWeight: 700, color: '#1e40af', background: EXPAND_ROW_BG }}>
                                            {fmt(lot.total_length_meters)} m
                                          </td>
                                          <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, background: EXPAND_ROW_BG }}>{lot.quantity}</td>
                                          <td className="text-end" style={{ padding: '4px 8px', background: EXPAND_ROW_BG }}>
                                            <span style={{ fontWeight: 700, color: '#92400e' }}>
                                              {lot.rate_per_meter > 0 ? `Rs. ${fmtMoney(lot.rate_per_meter)}` : '—'}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={e => {
                                                e.stopPropagation();
                                                setEditingBulkLot(lot);
                                                setEditingBulkProductLabel(`${product.productName} (${product.productCode})`);
                                                setNewBulkRateInput(String(lot.rate_per_meter || ''));
                                              }}
                                              onKeyDown={e => e.stopPropagation()}
                                              className="btn btn-ghost btn-sm p-0 row-action-btn"
                                              style={{ marginLeft: 6, color: '#b45309' }}
                                              title="Edit rate"
                                            >
                                              <Edit3 size={12} color="#b45309" />
                                            </button>
                                            {priceChanged && (
                                              <div
                                                title="Another lot for this product in the same godown has a different rate"
                                                style={{
                                                  fontSize: 8.5, fontWeight: 600, color: '#94a3b8', background: '#f1f5f9',
                                                  borderRadius: 3, padding: '1px 5px', marginTop: 3, display: 'block',
                                                  width: 'fit-content', marginLeft: 'auto',
                                                }}
                                              >
                                                price changed
                                              </div>
                                            )}
                                          </td>
                                          <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, color: '#334155', background: EXPAND_ROW_BG }}>
                                            {totalPrice > 0 ? `Rs. ${fmtMoney(totalPrice)}` : '—'}
                                          </td>
                                          {showGodownColumn && (
                                            <td style={{ padding: '4px 8px', background: EXPAND_ROW_BG }}>
                                              <span style={{
                                                fontSize: 10.5, fontWeight: 700, color: '#3730a3',
                                                background: '#e0e7ff', borderRadius: 5, padding: '2px 7px',
                                              }}>
                                                {lot.godown_name}
                                              </span>
                                            </td>
                                          )}
                                          <td style={{ padding: '4px 8px', color: '#64748b', background: EXPAND_ROW_BG }}>{fmtDate(lot.updated_at)}</td>
                                          <td style={{ padding: '4px 8px', background: EXPAND_ROW_BG }}>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                              <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); onRestockBulk?.(lot.product_id, lot.godown_id, lot.rate_per_meter); }}
                                                onKeyDown={e => e.stopPropagation()}
                                                className="btn btn-sm row-action-btn"
                                                style={{
                                                  padding: '2px 6px', display: 'flex', alignItems: 'center',
                                                  background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#15803d', borderRadius: 5,
                                                }}
                                                title="Add stock (Incoming)"
                                              >
                                                <ArrowDownCircle size={13} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); onDispatchBulk?.(lot.product_id, lot.godown_id); }}
                                                onKeyDown={e => e.stopPropagation()}
                                                className="btn btn-sm row-action-btn"
                                                style={{
                                                  padding: '2px 6px', display: 'flex', alignItems: 'center',
                                                  background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 5,
                                                }}
                                                title="Dispatch stock (Outgoing)"
                                              >
                                                <ArrowUpCircle size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>

      {/* Edit Rate Modal */}
      {editingVariant && (
        <div className="modal-backdrop" onClick={() => setEditingVariant(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1070, padding: 16
        }}>
          <div className="modal-card" style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={16} color="#d97706" />
                Update Rate
              </h3>
              <button onClick={() => setEditingVariant(null)} className="btn btn-ghost btn-sm p-0">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}>
                <div><strong>{editingProductLabel}</strong></div>
                <div>{fmt(editingVariant.length_meters)} m &middot; {editingVariant.quantity} rolls &middot; {editingVariant.godown_name}</div>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Rate Per Meter (Rs./m)
                </label>
                <div className="input-group">
                  <span className="input-group-text" style={{ fontWeight: 700 }}>Rs.</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 700"
                    value={newRateInput}
                    onChange={e => setNewRateInput(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveRate(); }}
                    style={{ fontSize: 13, fontWeight: 700 }}
                  />
                  <span className="input-group-text">/m</span>
                </div>
              </div>

              {parseFloat(newRateInput) > 0 && (
                <div style={{ background: '#fffbeb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e' }}>
                  Total ({editingVariant.quantity * editingVariant.length_meters}m &times; Rs. {newRateInput}):
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#b45309', marginTop: 2 }}>
                    Rs. {fmtMoney(editingVariant.quantity * editingVariant.length_meters * parseFloat(newRateInput))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditingVariant(null)}>
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSaveRate}
                disabled={savingRate}
                style={{ fontWeight: 700 }}
              >
                {savingRate ? 'Saving...' : 'Save Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyVariantId && (
        <VariantHistoryModal
          variantId={historyVariantId}
          onClose={() => setHistoryVariantId(null)}
        />
      )}

      {/* Edit Bulk Lot Rate Modal */}
      {editingBulkLot && (
        <div className="modal-backdrop" onClick={() => setEditingBulkLot(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1070, padding: 16
        }}>
          <div className="modal-card" style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={16} color="#d97706" />
                Update Bulk Lot Rate
              </h3>
              <button onClick={() => setEditingBulkLot(null)} className="btn btn-ghost btn-sm p-0">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}>
                <div><strong>{editingBulkProductLabel}</strong></div>
                <div>{fmt(editingBulkLot.total_length_meters)} m &middot; {editingBulkLot.quantity} rolls &middot; {editingBulkLot.godown_name}</div>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Rate Per Meter (Rs./m)
                </label>
                <div className="input-group">
                  <span className="input-group-text" style={{ fontWeight: 700 }}>Rs.</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 700"
                    value={newBulkRateInput}
                    onChange={e => setNewBulkRateInput(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveBulkRate(); }}
                    style={{ fontSize: 13, fontWeight: 700 }}
                  />
                  <span className="input-group-text">/m</span>
                </div>
              </div>

              {parseFloat(newBulkRateInput) > 0 && (
                <div style={{ background: '#fffbeb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e' }}>
                  Total ({editingBulkLot.total_length_meters}m &times; Rs. {newBulkRateInput}):
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#b45309', marginTop: 2 }}>
                    Rs. {fmtMoney(editingBulkLot.total_length_meters * parseFloat(newBulkRateInput))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditingBulkLot(null)}>
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSaveBulkRate}
                disabled={savingBulkRate}
                style={{ fontWeight: 700 }}
              >
                {savingBulkRate ? 'Saving...' : 'Save Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyBulkLotId && (
        <BulkLotHistoryModal
          bulkLotId={historyBulkLotId}
          onClose={() => setHistoryBulkLotId(null)}
        />
      )}
    </div>
  );
}
