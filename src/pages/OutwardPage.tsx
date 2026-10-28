import React, {
  useEffect, useState, useCallback, useRef, useMemo,
  KeyboardEvent as ReactKeyboardEvent
} from 'react';
import {
  ArrowUpCircle, Printer, CheckCircle, X, Search, Trash2,
  Package, ChevronDown, History, RefreshCw, Clock
} from 'lucide-react';
import { api, Product, Variant, BulkLot, OutwardTransaction } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import ShopBanner from '../components/ShopBanner';
import SelectDropdown from '../components/SelectDropdown';
import { QtyBadge } from '../components/QtyBadge';

type Page = 'dashboard' | 'godowns' | 'products' | 'inward' | 'outward' | 'history' | 'settings';

interface Props {
  onNavigate?: (page: Page) => void;
  preselect?: { productId: number; godownId: number; mode?: 'single' | 'bulk'; lengthMeters?: number } | null;
  onPreselectConsumed?: () => void;
}

function fmt(m: number) {
  return m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

interface CartItem {
  key: string; // 'v-<variantId>' or 'b-<bulkLotId>'
  isBulk: boolean;
  variantId?: number;
  bulkLotId?: number;
  // For a roll-size item this is the PER-ROLL length; for a bulk item this is the
  // TOTAL meters taken so far (bulk has no fixed per-roll size).
  lengthMeters: number;
  rate: number;
  quantity: number;
  productName: string;
  productCode: string;
}

// ─── Searchable Product Combobox (same pattern as Incoming Stock) ───────────

interface ProductComboboxProps {
  products: Product[];
  value: Product | null;
  onChange: (p: Product | null) => void;
  id?: string;
  autoFocus?: boolean;
}

function ProductCombobox({ products, value, onChange, id, autoFocus }: ProductComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filtered = query.trim()
    ? products.filter(p =>
      p.product_name.toLowerCase().includes(query.toLowerCase()) ||
      p.product_code.toLowerCase().includes(query.toLowerCase())
    )
    : products;

  useEffect(() => { setHighlightIdx(0); }, [query]);

  useEffect(() => {
    if (open) itemRefs.current[highlightIdx]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightIdx]);

  const select = (p: Product) => {
    onChange(p);
    setQuery('');
    setOpen(false);
  };

  const handleKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && filtered[highlightIdx]) select(filtered[highlightIdx]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div style={{ position: 'relative' }}>
      {value && !open ? (
        <div
          id={id}
          tabIndex={0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid #fdba74', borderRadius: 7, padding: '7px 10px',
            background: '#fff7ed', cursor: 'pointer', outline: 'none'
          }}
          onClick={() => { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); } }}
        >
          <Package size={14} color="#ea580c" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{value.product_name}</div>
            <div style={{ fontSize: 10.5, color: '#64748b' }}>Code: {value.product_code}</div>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null); setQuery(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
            title="Clear"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 10, pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            id={id}
            type="text"
            className="form-control"
            placeholder="Search product by name or code (Alt+P)"
            value={query}
            autoFocus={autoFocus}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onKeyDown={handleKey}
            style={{ paddingLeft: 30, height: 34, fontSize: 12.5 }}
          />
          <ChevronDown size={13} color="#94a3b8" style={{ position: 'absolute', right: 9, top: 11, pointerEvents: 'none' }} />
        </div>
      )}

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 4,
        }}>
          {filtered.map((p, idx) => (
            <div
              key={p.id}
              ref={el => { itemRefs.current[idx] = el; }}
              onMouseDown={() => select(p)}
              style={{
                padding: '7px 10px', cursor: 'pointer', fontSize: 12.5,
                background: idx === highlightIdx ? '#fff7ed' : '#fff',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 700, color: '#1e293b' }}>{p.product_name}</span>
              <span style={{ fontSize: 10.5, color: '#64748b' }}>{p.product_code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Small Summary Panel ──────────────────────────────────────────────────────

interface StockPanelProps {
  product: Product | null;
  godown: { name: string } | null;
  availableRolls: number;
  availableMeters: number;
  loading: boolean;
  previewRolls: number;
  previewMeters: number;
}

function DispatchSummaryPanel({ product, godown, availableRolls, availableMeters, loading, previewRolls, previewMeters }: StockPanelProps) {
  const panelStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14,
    overflowWrap: 'break-word', wordBreak: 'break-word',
  };
  const rowStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 7, marginBottom: 8 };

  if (!product || !godown) {
    return (
      <div style={panelStyle}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b', marginBottom: 6 }}>Summary</div>
        <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
          {!product ? 'Search a product to begin' : 'Pick a roll size / bulk lot and godown to see stock'}
        </div>
      </div>
    );
  }

  const currentRolls = availableRolls;
  const currentMeters = availableMeters;

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b' }}>Summary</span>
        {loading && <RefreshCw size={12} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />}
      </div>

      <div style={{ fontSize: 11.5, color: '#9a3412', marginBottom: 10 }}>
        <strong>{godown.name}</strong> &middot; {product.product_name} ({product.product_code})
      </div>

      <div style={{ ...rowStyle, borderLeft: '3px solid #16a34a', background: '#f0fdf4' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Available Stock</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>
          {currentRolls} rolls &middot; {fmt(currentMeters)} m
        </div>
      </div>

      {(previewRolls > 0 || previewMeters > 0) && (
        <div style={{ ...rowStyle, borderLeft: '3px solid #ea580c', background: '#fff7ed' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>Dispatching</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#c2410c' }}>
            -{previewRolls} rolls &middot; -{fmt(previewMeters)} m
          </div>
        </div>
      )}

      {(previewRolls > 0 || previewMeters > 0) && (
        <div style={{ ...rowStyle, marginBottom: 0, borderLeft: '3px solid #0284c7', background: '#f0f9ff' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Remaining After</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0369a1' }}>
            {Math.max(0, currentRolls - previewRolls)} rolls &middot; {fmt(Math.max(0, currentMeters - previewMeters))} m
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Slip View Modal ─────────────────────────────────────────────────────────

interface SlipViewProps {
  tx: OutwardTransaction;
  onClose: () => void;
  onPrint: () => void;
  printing: boolean;
}

function OutwardSlipView({ tx, onClose, onPrint, printing }: SlipViewProps) {
  // Bulk lines store the TOTAL meters directly (not per-roll), so they must not be multiplied by quantity.
  const totalMeters = (tx.lines || []).reduce((s, l) => s + (l.is_bulk ? l.length_meters : l.length_meters * l.quantity), 0);
  const totalRolls = (tx.lines || []).reduce((s, l) => s + l.quantity, 0);
  const printBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    printBtnRef.current?.focus();
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); onPrint(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onPrint, onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1060, padding: 16
    }}>
      <div className="modal-card" style={{ maxWidth: 620, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #c2410c, #ea580c)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={17} /> Stock Dispatched
            </h2>
            <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>
              {tx.slip_number} &middot; {fmtDate(tx.transaction_date)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 18, maxHeight: '65vh', overflowY: 'auto' }}>
          <div style={{
            background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8,
            padding: '10px 14px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 14
          }}>
            <div>
              <div style={{ fontSize: 9.5, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Godown</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#7c2d12' }}>{tx.godown_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Rolls</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#7c2d12' }}>{totalRolls}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Meters</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#c2410c' }}>{fmt(totalMeters)} m</div>
            </div>
            {(tx.total_price || 0) > 0 && (
              <div>
                <div style={{ fontSize: 9.5, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Amount</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>Rs. {fmtMoney(tx.total_price || 0)}</div>
              </div>
            )}
          </div>

          {tx.recipient_reference && (
            <div style={{ marginBottom: 12, fontSize: 12.5, background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Customer: </span>
              <strong style={{ color: '#0f172a' }}>{tx.recipient_reference}</strong>
              {(tx.rate_per_meter || 0) > 0 && (
                <span style={{ marginLeft: 12, color: '#047857', fontWeight: 700 }}>(@ Rs. {tx.rate_per_meter}/m)</span>
              )}
            </div>
          )}

          <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: 12.5 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr><th>Product</th><th className="text-end">Roll Size</th><th className="text-end">Qty</th></tr>
            </thead>
            <tbody>
              {(tx.lines || []).map((line, idx) => (
                <tr key={line.id || idx}>
                  <td>{line.product_name} ({line.product_code})</td>
                  <td className="text-end" style={{ fontWeight: 700, color: '#0f766e' }}>
                    {line.is_bulk ? `Bulk — ${fmt(line.length_meters)} m total` : `${fmt(line.length_meters)} m`}
                  </td>
                  <td className="text-end" style={{ fontWeight: 700 }}>{line.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
          <button
            ref={printBtnRef}
            className="btn btn-sm btn-warning"
            onClick={onPrint}
            disabled={printing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#fff' }}
          >
            <Printer size={13} />
            {printing ? 'Printing...' : 'Print Slip (Ctrl+P)'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Outward Page ───────────────────────────────────────────────────────

export default function OutwardPage({ onNavigate, preselect, onPreselectConsumed }: Props) {
  const toast = useToast();
  const { godowns, currentGodown, setCurrentGodown } = useGodown();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // All available stock variants of the selected product, across every godown.
  const [productVariants, setProductVariants] = useState<Variant[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(false);

  // All available bulk lots of the selected product, across every godown.
  const [productBulkLots, setProductBulkLots] = useState<BulkLot[]>([]);
  const [loadingBulkLots, setLoadingBulkLots] = useState(false);

  const [dispatchMode, setDispatchMode] = useState<'single' | 'bulk'>('bulk');
  const [selectedLength, setSelectedLength] = useState<number | null>(null);
  const [dispatchGodown, setDispatchGodown] = useState<{ id: number; name: string } | null>(null);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [qtyErrors, setQtyErrors] = useState<Record<string, string>>({});

  // Bulk dispatch — two inputs (meters + rolls) per bulk lot, since bulk has no fixed roll size.
  const [bulkMetersInputs, setBulkMetersInputs] = useState<Record<number, string>>({});
  const [bulkRollsInputs, setBulkRollsInputs] = useState<Record<number, string>>({});
  const [bulkQtyErrors, setBulkQtyErrors] = useState<Record<number, string>>({});

  const [cart, setCart] = useState<CartItem[]>([]);
  const applyingPreselectRef = useRef(false);

  // Arrow-key navigation between a row of "pick one" option buttons (godown pickers below).
  const handleOptionGroupKeyDown = (e: React.KeyboardEvent, groupRef: React.RefObject<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const buttons = Array.from(groupRef.current?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) { buttons[0]?.focus(); return; }
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    buttons[Math.min(Math.max(idx + delta, 0), buttons.length - 1)]?.focus();
  };

  const rollSizeRef = useRef<HTMLButtonElement>(null);
  const godownBtnGroupRef = useRef<HTMLDivElement>(null);
  const qtyGroupRef = useRef<HTMLDivElement>(null);
  const bulkGodownBtnGroupRef = useRef<HTMLDivElement>(null);
  const bulkQtyGroupRef = useRef<HTMLDivElement>(null);

  const [reference, setReference] = useState('Shop');
  const [submitting, setSubmitting] = useState(false);

  const [lastTx, setLastTx] = useState<OutwardTransaction | null>(null);
  const [printing, setPrinting] = useState(false);

  const [recentTxs, setRecentTxs] = useState<OutwardTransaction[]>([]);

  // Products are searched globally — we don't know the godown yet.
  useEffect(() => {
    api.products.list({ includeInactive: false }).then(res => {
      if (res.success && res.data) setProducts(res.data);
    });
  }, []);

  const loadProductRolls = useCallback(async () => {
    if (!selectedProduct) { setProductVariants([]); return; }
    setLoadingRolls(true);
    const res = await api.variants.listByProduct({ productId: selectedProduct.id });
    setProductVariants(res.success && res.data ? res.data : []);
    setLoadingRolls(false);
  }, [selectedProduct]);

  useEffect(() => { loadProductRolls(); }, [loadProductRolls]);

  const loadProductBulkLots = useCallback(async () => {
    if (!selectedProduct) { setProductBulkLots([]); return; }
    setLoadingBulkLots(true);
    const res = await api.bulk.listByProduct({ productId: selectedProduct.id });
    setProductBulkLots(res.success && res.data ? res.data : []);
    setLoadingBulkLots(false);
  }, [selectedProduct]);

  useEffect(() => { loadProductBulkLots(); }, [loadProductBulkLots]);

  // Reset the downstream selection whenever the product changes (skipped while a preselect is being applied below).
  useEffect(() => {
    if (applyingPreselectRef.current) return;
    setDispatchMode('bulk');
    setSelectedLength(null);
    setDispatchGodown(null);
    setCart([]);
    setQtyInputs({});
    setBulkMetersInputs({});
    setBulkRollsInputs({});
    setBulkQtyErrors({});
  }, [selectedProduct?.id]);

  // Reset godown choice whenever the roll size changes (skipped while a preselect is being applied below).
  useEffect(() => {
    if (applyingPreselectRef.current) return;
    setDispatchGodown(null);
    setCart([]);
    setQtyInputs({});
  }, [selectedLength]);

  // Coming from a "Dispatch" shortcut (e.g. the Dashboard stock table or low-stock warning) —
  // pre-select the exact product, roll size and godown. Guarded by a ref so the two reset
  // effects above don't wipe the selection out mid-flight.
  useEffect(() => {
    if (!preselect || products.length === 0) return;
    const product = products.find(p => p.id === preselect.productId);
    if (!product) return;
    applyingPreselectRef.current = true;
    setSelectedProduct(product);
  }, [preselect, products]);

  useEffect(() => {
    if (!preselect || !applyingPreselectRef.current) return;
    if (selectedProduct?.id !== preselect.productId) return;
    const godown = godowns.find(g => g.id === preselect.godownId);
    if (preselect.mode === 'bulk') {
      setDispatchMode('bulk');
    } else {
      setDispatchMode('single');
      setSelectedLength(preselect.lengthMeters ?? null);
    }
    if (godown) { setDispatchGodown({ id: godown.id, name: godown.name }); setCurrentGodown(godown); }
  }, [preselect, selectedProduct, godowns]);

  // Only clear the "applying" flag once the godown (and, for single mode, the length too) have
  // actually landed in state — by then the reset effects above have already run (and skipped).
  useEffect(() => {
    const ready = applyingPreselectRef.current && dispatchGodown
      && (preselect?.mode === 'bulk' || selectedLength != null);
    if (ready) {
      applyingPreselectRef.current = false;
      onPreselectConsumed?.();
    }
  }, [dispatchGodown, selectedLength, preselect]);

  const loadRecentTxs = useCallback(async () => {
    if (!currentGodown) return;
    const res = await api.outward.list({ godownId: currentGodown.id });
    if (res.success && res.data) setRecentTxs(res.data.slice(0, 6));
  }, [currentGodown]);
  useEffect(() => { loadRecentTxs(); }, [loadRecentTxs]);

  const totalSelectedMeters = cart.reduce((sum, c) => sum + (c.isBulk ? c.lengthMeters : c.quantity * c.lengthMeters), 0);
  const totalSelectedRolls = cart.reduce((sum, c) => sum + c.quantity, 0);

  // Step 1 result: distinct roll sizes available for this product, across all godowns.
  const lengthOptions = useMemo(() => {
    const map = new Map<number, number>();
    for (const v of productVariants) {
      map.set(v.length_meters, (map.get(v.length_meters) || 0) + v.quantity);
    }
    return Array.from(map.entries())
      .map(([length, qty]) => ({ length, qty }))
      .sort((a, b) => b.length - a.length);
  }, [productVariants]);

  // Step 2 result: which godowns have this product+size, and how much.
  const godownOptions = useMemo(() => {
    if (selectedLength == null) return [];
    const map = new Map<number, { godownId: number; godownName: string; qty: number }>();
    for (const v of productVariants) {
      if (v.length_meters !== selectedLength) continue;
      const gid = v.godown_id;
      let entry = map.get(gid);
      if (!entry) {
        entry = { godownId: gid, godownName: v.godown_name || '—', qty: 0 };
        map.set(gid, entry);
      }
      entry.qty += v.quantity;
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [productVariants, selectedLength]);

  // Step 3 result: the rate-distinct variants for the chosen product+size+godown — each IS a batch.
  const variantsInScope = useMemo(() => {
    if (!dispatchGodown || selectedLength == null) return [];
    return productVariants
      .filter(v => v.length_meters === selectedLength && v.godown_id === dispatchGodown.id)
      .sort((a, b) => b.rate_per_meter - a.rate_per_meter);
  }, [productVariants, selectedLength, dispatchGodown]);

  // Bulk: which godowns have a bulk lot of this product, and how much.
  const bulkGodownOptions = useMemo(() => {
    const map = new Map<number, { godownId: number; godownName: string; qty: number; meters: number }>();
    for (const b of productBulkLots) {
      if (b.quantity <= 0) continue;
      let entry = map.get(b.godown_id);
      if (!entry) {
        entry = { godownId: b.godown_id, godownName: b.godown_name || '—', qty: 0, meters: 0 };
        map.set(b.godown_id, entry);
      }
      entry.qty += b.quantity;
      entry.meters += b.total_length_meters;
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [productBulkLots]);

  // Bulk: the rate-distinct bulk lots for the chosen product+godown — each IS a lot.
  const bulkLotsInScope = useMemo(() => {
    if (!dispatchGodown) return [];
    return productBulkLots
      .filter(b => b.godown_id === dispatchGodown.id && b.quantity > 0)
      .sort((a, b) => b.rate_per_meter - a.rate_per_meter);
  }, [productBulkLots, dispatchGodown]);

  // No real choice to make when only one godown has this stock — select it automatically
  // instead of making the user click/confirm a single option.
  useEffect(() => {
    if (applyingPreselectRef.current || dispatchMode !== 'bulk' || dispatchGodown) return;
    if (bulkGodownOptions.length === 1) {
      const opt = bulkGodownOptions[0];
      setDispatchGodown({ id: opt.godownId, name: opt.godownName });
      const full = godowns.find(g => g.id === opt.godownId);
      if (full) setCurrentGodown(full);
    }
  }, [dispatchMode, dispatchGodown, bulkGodownOptions, godowns]);

  useEffect(() => {
    if (applyingPreselectRef.current || dispatchMode !== 'single' || dispatchGodown) return;
    if (godownOptions.length === 1) {
      const opt = godownOptions[0];
      setDispatchGodown({ id: opt.godownId, name: opt.godownName });
      const full = godowns.find(g => g.id === opt.godownId);
      if (full) setCurrentGodown(full);
    }
  }, [dispatchMode, dispatchGodown, godownOptions, godowns]);

  // Combined "what's available here" for the summary panel — spans both the
  // currently-selected roll size (if any) and any bulk lots at this godown.
  const availableRolls = variantsInScope.reduce((s, v) => s + v.quantity, 0)
    + bulkLotsInScope.reduce((s, b) => s + b.quantity, 0);
  const availableMeters = variantsInScope.reduce((s, v) => s + v.quantity * v.length_meters, 0)
    + bulkLotsInScope.reduce((s, b) => s + b.total_length_meters, 0);

  // Add N rolls from a variant (batch) to the cart.
  const handleAddQtyFromBatch = (variant: Variant) => {
    const key = `v-${variant.id}`;
    const qty = parseInt(qtyInputs[variant.id] || '0', 10);
    if (!qty || qty <= 0) {
      setQtyErrors(prev => ({ ...prev, [variant.id]: 'Enter a quantity.' }));
      return;
    }
    const inCart = cart.find(c => c.key === key);
    const remaining = variant.quantity - (inCart?.quantity || 0);
    if (qty > remaining) {
      setQtyErrors(prev => ({ ...prev, [variant.id]: `Only ${remaining} in stock.` }));
      return;
    }
    setQtyErrors(prev => ({ ...prev, [variant.id]: '' }));
    setCart(prev => {
      const existing = prev.find(c => c.key === key);
      if (existing) {
        return prev.map(c => c.key === key ? { ...c, quantity: c.quantity + qty } : c);
      }
      return [...prev, {
        key, isBulk: false, variantId: variant.id,
        lengthMeters: variant.length_meters,
        rate: variant.rate_per_meter,
        quantity: qty,
        productName: variant.product_name || '',
        productCode: variant.product_code || '',
      }];
    });
    setQtyInputs(prev => ({ ...prev, [variant.id]: '' }));
    toast.showToast(`${qty} rolls (${fmt(variant.length_meters)}m) added.`, 'success');
  };

  // Add N meters / rolls from a bulk lot to the cart.
  const handleAddBulkToCart = (lot: BulkLot) => {
    const key = `b-${lot.id}`;
    const meters = parseFloat(bulkMetersInputs[lot.id] || '');
    const rolls = parseInt(bulkRollsInputs[lot.id] || '', 10);
    if (!isFinite(meters) || meters <= 0 || !isFinite(rolls) || rolls <= 0) {
      setBulkQtyErrors(prev => ({ ...prev, [lot.id]: 'Enter meters and rolls.' }));
      return;
    }
    const inCart = cart.find(c => c.key === key);
    const remainingMeters = lot.total_length_meters - (inCart?.lengthMeters || 0);
    const remainingRolls = lot.quantity - (inCart?.quantity || 0);
    if (meters > remainingMeters) {
      setBulkQtyErrors(prev => ({ ...prev, [lot.id]: `Only ${fmt(remainingMeters)} m left.` }));
      return;
    }
    if (rolls > remainingRolls) {
      setBulkQtyErrors(prev => ({ ...prev, [lot.id]: `Only ${remainingRolls} rolls left.` }));
      return;
    }
    setBulkQtyErrors(prev => ({ ...prev, [lot.id]: '' }));
    setCart(prev => {
      const existing = prev.find(c => c.key === key);
      if (existing) {
        return prev.map(c => c.key === key ? { ...c, lengthMeters: c.lengthMeters + meters, quantity: c.quantity + rolls } : c);
      }
      return [...prev, {
        key, isBulk: true, bulkLotId: lot.id,
        lengthMeters: meters,
        rate: lot.rate_per_meter,
        quantity: rolls,
        productName: lot.product_name || '',
        productCode: lot.product_code || '',
      }];
    });
    setBulkMetersInputs(prev => ({ ...prev, [lot.id]: '' }));
    setBulkRollsInputs(prev => ({ ...prev, [lot.id]: '' }));
    toast.showToast(`${rolls} rolls (${fmt(meters)}m) added from bulk lot.`, 'success');
  };

  const removeFromCart = (key: string) => {
    setCart(prev => prev.filter(c => c.key !== key));
  };

  const handleConfirmIssue = async () => {
    if (cart.length === 0) {
      toast.showToast('Select at least one roll to dispatch.', 'error');
      return;
    }
    if (!dispatchGodown) {
      toast.showToast('Select a godown first.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const items = cart.map(c => c.isBulk
        ? { bulkLotId: c.bulkLotId!, quantity: c.quantity, lengthMeters: c.lengthMeters }
        : { variantId: c.variantId!, quantity: c.quantity }
      );
      const res = await api.outward.create({
        items,
        godownId: dispatchGodown.id,
        recipientReference: reference.trim(),
      });

      if (res.success && res.data) {
        toast.showToast(`${totalSelectedRolls} rolls dispatched.`, 'success');
        setLastTx(res.data);
        setCart([]);
        setReference('Shop');
        loadProductRolls();
        loadProductBulkLots();
        loadRecentTxs();
      } else {
        toast.showToast(res.error || 'Could not dispatch stock.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = async (txId: number) => {
    setPrinting(true);
    try {
      const res = await api.print.outwardSlip(txId);
      if (res.success) toast.showToast('Sent to printer.', 'success');
      else toast.showToast(res.error || 'Print failed.', 'error');
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    const handleGlobalKey = (e: globalThis.KeyboardEvent) => {
      if (lastTx) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleConfirmIssue(); }
      else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        (document.getElementById('outward-product') as HTMLElement)?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [lastTx, cart, dispatchGodown, reference]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingBottom: 40 }}>
      <ShopBanner />

      {/* Header card */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
        border: '1px solid #fed7aa', borderRadius: 12,
        padding: '14px 18px', marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: '#ea580c',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 3px 8px rgba(234,88,12,0.25)'
          }}>
            <ArrowUpCircle size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#9a3412' }}>Outgoing Stock</h1>
            <div style={{ fontSize: 11.5, color: '#c2410c' }}>Dispatch rolls to a customer and print the slip</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('history')}
          className="btn btn-sm"
          style={{
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            background: '#fff', border: '1px solid #fdba74', color: '#9a3412'
          }}
        >
          <History size={14} /> History
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 16, alignItems: 'start' }}>
        {/* ── LEFT: form ── */}
        <div>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
            {/* 1. Product */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                Product
              </label>
              <ProductCombobox
                id="outward-product"
                products={products}
                value={selectedProduct}
                onChange={p => {
                  setSelectedProduct(p);
                  if (p) setTimeout(() => {
                    if (dispatchMode === 'bulk') bulkGodownBtnGroupRef.current?.querySelector('button')?.focus();
                    else rollSizeRef.current?.focus();
                  }, 50);
                }}
                autoFocus
              />
            </div>

            {/* Dispatch mode: bulk lot is the default; single roll size is one small button away */}
            {selectedProduct && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {dispatchMode === 'bulk' ? 'Bulk Lot Dispatch' : 'Single Roll Size Dispatch'}
                </span>
                <button
                  type="button"
                  onClick={() => setDispatchMode(dispatchMode === 'bulk' ? 'single' : 'bulk')}
                  className="btn btn-sm btn-outline-secondary"
                  style={{ fontSize: 10.5, padding: '3px 10px', fontWeight: 700 }}
                >
                  {dispatchMode === 'bulk' ? 'Switch to Single Roll Dispatch' : '← Back to Bulk Lot'}
                </button>
              </div>
            )}

            {/* 2. Roll size (meters) */}
            {dispatchMode === 'single' && selectedProduct && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                  Roll Size (meters)
                </label>
                {loadingRolls ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 0' }}>Loading...</div>
                ) : lengthOptions.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 0' }}>
                    No available stock of this product anywhere.
                  </div>
                ) : (
                  <SelectDropdown
                    ref={rollSizeRef}
                    maxWidth={320}
                    accentColor="#ea580c"
                    placeholder="Select roll size..."
                    value={selectedLength}
                    onChange={v => {
                      setSelectedLength(Number(v));
                      setTimeout(() => godownBtnGroupRef.current?.querySelector('button')?.focus(), 50);
                    }}
                    options={lengthOptions.map(opt => ({
                      value: opt.length,
                      label: `${fmt(opt.length)} m`,
                      badge: <QtyBadge>{opt.qty} available</QtyBadge>,
                    }))}
                  />
                )}
              </div>
            )}

            {/* 3. Which godowns have this size */}
            {dispatchMode === 'single' && selectedProduct && selectedLength != null && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                  Available In
                </label>
                {godownOptions.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 0' }}>
                    No godown currently has this size in stock.
                  </div>
                ) : (
                  <div ref={godownBtnGroupRef} onKeyDown={e => handleOptionGroupKeyDown(e, godownBtnGroupRef)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {godownOptions.map(opt => {
                      const isSelected = dispatchGodown?.id === opt.godownId;
                      return (
                        <button
                          key={opt.godownId}
                          type="button"
                          onClick={() => {
                            setDispatchGodown({ id: opt.godownId, name: opt.godownName });
                            const full = godowns.find(g => g.id === opt.godownId);
                            if (full) setCurrentGodown(full);
                            setTimeout(() => qtyGroupRef.current?.querySelector('input')?.focus(), 50);
                          }}
                          className={`btn btn-sm pick-option-btn${isSelected ? ' selected' : ''}`}
                          style={{
                            fontSize: 12, fontWeight: 700, padding: '6px 12px',
                            background: isSelected ? '#ea580c' : '#fff',
                            color: isSelected ? '#fff' : '#334155',
                            border: isSelected ? '1px solid #ea580c' : '1px solid #cbd5e1',
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                          }}
                        >
                          <span>{opt.godownName}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#fff', background: '#1e293b',
                            borderRadius: 4, padding: '2px 6px',
                          }}>
                            {opt.qty} rolls
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. Qty to dispatch, once a godown is chosen */}
            {dispatchMode === 'single' && dispatchGodown && variantsInScope.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                  Quantity to Dispatch
                </label>
                <div ref={qtyGroupRef} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {variantsInScope.map((variant, idx) => {
                    const inCartQty = cart.find(c => c.variantId === variant.id)?.quantity || 0;
                    const remaining = variant.quantity - inCartQty;
                    return (
                      <div
                        key={variant.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                          borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9'
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                          Available: {remaining}
                          {inCartQty > 0 && <span style={{ color: '#c2410c', fontWeight: 600 }}> ({inCartQty} in cart)</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <input
                            type="number" min="0" max={remaining}
                            className="form-control"
                            placeholder="Qty"
                            value={qtyInputs[variant.id] || ''}
                            onChange={e => {
                              setQtyInputs(prev => ({ ...prev, [variant.id]: e.target.value }));
                              setQtyErrors(prev => ({ ...prev, [variant.id]: '' }));
                            }}
                            onKeyDown={e => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              // Nothing typed but something's already in the cart — Enter here means
                              // "I'm done adding, go issue it", not a failed add of an empty line.
                              if (!(qtyInputs[variant.id] || '').trim() && cart.length > 0) {
                                document.getElementById('btn-issue-outgoing')?.focus();
                                return;
                              }
                              handleAddQtyFromBatch(variant);
                            }}
                            style={{
                              height: 30, fontSize: 12, width: 70, padding: '0 8px',
                              borderColor: qtyErrors[variant.id] ? '#dc2626' : undefined,
                            }}
                          />
                          {qtyErrors[variant.id] && (
                            <div style={{ color: '#dc2626', fontSize: 10, marginTop: 2, width: 90 }}>
                              {qtyErrors[variant.id]}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {variant.rate_per_meter > 0 ? `buying price Rs. ${fmtMoney(variant.rate_per_meter)}/m` : 'no buying price on record'}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddQtyFromBatch(variant)}
                          disabled={remaining === 0}
                          className="btn btn-sm btn-outline-primary"
                          style={{ fontSize: 10.5, padding: '3px 10px', fontWeight: 700, marginLeft: 'auto' }}
                        >
                          Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4b. Bulk Lot dispatch — the default path */}
            {dispatchMode === 'bulk' && selectedProduct && (
              <div style={{ marginBottom: 14 }}>
                {loadingBulkLots ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 0' }}>Loading...</div>
                ) : !productBulkLots.some(b => b.quantity > 0) ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 0' }}>
                    No bulk stock of this product anywhere.
                  </div>
                ) : (
                <>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                    Godown
                  </label>
                  <div ref={bulkGodownBtnGroupRef} onKeyDown={e => handleOptionGroupKeyDown(e, bulkGodownBtnGroupRef)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {bulkGodownOptions.map(opt => {
                      const isSelected = dispatchGodown?.id === opt.godownId;
                      return (
                        <button
                          key={opt.godownId}
                          type="button"
                          onClick={() => {
                            setDispatchGodown({ id: opt.godownId, name: opt.godownName });
                            const full = godowns.find(g => g.id === opt.godownId);
                            if (full) setCurrentGodown(full);
                            setTimeout(() => bulkQtyGroupRef.current?.querySelector('input')?.focus(), 50);
                          }}
                          className={`btn btn-sm pick-option-btn${isSelected ? ' selected' : ''}`}
                          style={{
                            fontSize: 12, fontWeight: 700, padding: '6px 12px',
                            background: isSelected ? '#ea580c' : '#fff',
                            color: isSelected ? '#fff' : '#334155',
                            border: isSelected ? '1px solid #ea580c' : '1px solid #cbd5e1',
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                          }}
                        >
                          <span>{opt.godownName}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#fff', background: '#1e293b',
                            borderRadius: 4, padding: '2px 6px',
                          }}>
                            {fmt(opt.meters)} m / {opt.qty} rolls
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {dispatchGodown && bulkLotsInScope.length > 0 && (
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                      Meters &amp; Rolls to Dispatch
                    </label>
                    <div ref={bulkQtyGroupRef} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      {bulkLotsInScope.map((lot, idx) => {
                        const inCart = cart.find(c => c.key === `b-${lot.id}`);
                        const remainingMeters = lot.total_length_meters - (inCart?.lengthMeters || 0);
                        const remainingRolls = lot.quantity - (inCart?.quantity || 0);
                        return (
                          <div key={lot.id} style={{ padding: '8px 12px', borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                              Available: {fmt(remainingMeters)} m / {remainingRolls} rolls
                              {inCart && <span style={{ color: '#c2410c', fontWeight: 600 }}> ({fmt(inCart.lengthMeters)}m / {inCart.quantity} in cart)</span>}
                              {lot.rate_per_meter > 0 && (
                                <span style={{ color: '#94a3b8', fontWeight: 500 }}> &middot; buying price Rs. {fmtMoney(lot.rate_per_meter)}/m</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <input
                                type="number" min="0" step="0.01"
                                className="form-control"
                                placeholder="Meters"
                                value={bulkMetersInputs[lot.id] || ''}
                                onChange={e => {
                                  setBulkMetersInputs(prev => ({ ...prev, [lot.id]: e.target.value }));
                                  setBulkQtyErrors(prev => ({ ...prev, [lot.id]: '' }));
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    document.getElementById(`bulk-rolls-${lot.id}`)?.focus();
                                  }
                                }}
                                style={{
                                  height: 30, fontSize: 12, width: 80, padding: '0 8px',
                                  borderColor: bulkQtyErrors[lot.id] ? '#dc2626' : undefined,
                                }}
                              />
                              <input
                                id={`bulk-rolls-${lot.id}`}
                                type="number" min="0" step="1"
                                className="form-control"
                                placeholder="Rolls"
                                value={bulkRollsInputs[lot.id] || ''}
                                onChange={e => {
                                  setBulkRollsInputs(prev => ({ ...prev, [lot.id]: e.target.value }));
                                  setBulkQtyErrors(prev => ({ ...prev, [lot.id]: '' }));
                                }}
                                onKeyDown={e => {
                                  if (e.key !== 'Enter') return;
                                  e.preventDefault();
                                  const hasInput = (bulkMetersInputs[lot.id] || '').trim() || (bulkRollsInputs[lot.id] || '').trim();
                                  // Nothing typed but something's already in the cart — Enter here means
                                  // "I'm done adding, go issue it", not a failed add of an empty line.
                                  if (!hasInput && cart.length > 0) {
                                    document.getElementById('btn-issue-outgoing')?.focus();
                                    return;
                                  }
                                  handleAddBulkToCart(lot);
                                }}
                                style={{
                                  height: 30, fontSize: 12, width: 70, padding: '0 8px',
                                  borderColor: bulkQtyErrors[lot.id] ? '#dc2626' : undefined,
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleAddBulkToCart(lot)}
                                disabled={remainingMeters <= 0 || remainingRolls <= 0}
                                className="btn btn-sm btn-outline-primary"
                                style={{ fontSize: 10.5, padding: '3px 10px', fontWeight: 700 }}
                              >
                                Add
                              </button>
                            </div>
                            {bulkQtyErrors[lot.id] && (
                              <div style={{ color: '#dc2626', fontSize: 10, marginTop: 3 }}>{bulkQtyErrors[lot.id]}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            )}

            {/* 5. Dispatch cart */}
            {cart.length > 0 && (
              <div style={{ marginBottom: 14, border: '1.5px solid #ea580c', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#9a3412' }}>
                    Dispatch Cart: {totalSelectedRolls} rolls &middot; {fmt(totalSelectedMeters)} m
                  </div>
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="btn btn-sm btn-outline-danger"
                    style={{ fontSize: 10.5, padding: '2px 8px', fontWeight: 700 }}
                  >
                    <Trash2 size={11} style={{ marginRight: 4 }} /> Clear
                  </button>
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 11.5 }}>
                    <tbody>
                      {cart.map(c => (
                        <tr key={c.key}>
                          <td style={{ padding: '4px 8px', color: '#64748b' }}>
                            {c.productName} ({c.productCode}){c.isBulk && <span style={{ color: '#94a3b8' }}> &middot; Bulk</span>}
                          </td>
                          <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, color: '#0f766e' }}>
                            {c.isBulk ? `${c.lengthMeters.toFixed(2)} m total` : `${c.lengthMeters.toFixed(2)} m`}
                          </td>
                          <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, color: '#c2410c' }}>
                            &times;{c.quantity}
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'center', width: 28 }}>
                            <button type="button" onClick={() => removeFromCart(c.key)} className="btn btn-ghost btn-sm text-danger p-0">
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. Total meters (read-only) & reference */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 3, display: 'block' }}>
                  Total Meters
                </label>
                <div style={{
                  height: 34, display: 'flex', alignItems: 'center', padding: '0 10px',
                  fontSize: 12.5, fontWeight: 700, color: '#0f766e',
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7
                }}>
                  {fmt(totalSelectedMeters)} m
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 3, display: 'block' }}>
                  Reference
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Shop"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-issue-outgoing')?.click(); } }}
                  style={{ height: 34, fontSize: 12.5 }}
                />
              </div>
            </div>

            {/* 7. Save */}
            <button
              id="btn-issue-outgoing"
              onClick={handleConfirmIssue}
              disabled={submitting || cart.length === 0}
              className="btn btn-warning"
              style={{ width: '100%', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 0', borderRadius: 8 }}
              title="Issue Stock (Ctrl+S)"
            >
              {submitting
                ? 'Dispatching...'
                : cart.length > 0
                  ? `Issue ${totalSelectedRolls} Rolls (${fmt(totalSelectedMeters)} m) · Ctrl+S`
                  : 'Select rolls first'}
            </button>
          </div>

          {/* Recent dispatches */}
          {recentTxs.length > 0 && (
            <div style={{ marginTop: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Clock size={13} color="#ea580c" />
                <h3 style={{ fontSize: 11.5, fontWeight: 700, margin: 0, color: '#1e293b' }}>
                  Recent Dispatches &middot; {currentGodown?.name}
                </h3>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0" style={{ fontSize: 11.5 }}>
                  <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10 }}>
                    <tr>
                      <th style={{ padding: '5px 8px' }}>Slip No.</th>
                      <th style={{ padding: '5px 8px' }}>Date</th>
                      <th style={{ padding: '5px 8px' }}>Customer</th>
                      <th className="text-end" style={{ padding: '5px 8px' }}>Rolls</th>
                      <th className="text-end" style={{ padding: '5px 8px' }}>Meters</th>
                      <th className="text-end" style={{ padding: '5px 8px' }}>Amount</th>
                      <th style={{ padding: '5px 8px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxs.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#c2410c' }}>{tx.slip_number}</td>
                        <td style={{ padding: '5px 8px', color: '#475569' }}>{fmtDate(tx.transaction_date)}</td>
                        <td style={{ padding: '5px 8px', color: '#475569' }}>{tx.recipient_reference || '—'}</td>
                        <td className="text-end" style={{ padding: '5px 8px', fontWeight: 700 }}>{tx.roll_count}</td>
                        <td className="text-end" style={{ padding: '5px 8px', fontWeight: 700, color: '#0f766e' }}>{fmt(tx.total_issued_meters || 0)} m</td>
                        <td className="text-end" style={{ padding: '5px 8px', fontWeight: 700, color: '#15803d' }}>
                          {(tx.total_price || 0) > 0 ? `Rs. ${fmtMoney(tx.total_price || 0)}` : '—'}
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await api.outward.getById(tx.id);
                              if (r.success && r.data) setLastTx(r.data);
                            }}
                            className="btn btn-sm btn-outline-primary"
                            style={{ fontSize: 10, padding: '1px 7px', fontWeight: 700 }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: summary ── */}
        <div>
          <DispatchSummaryPanel
            product={selectedProduct}
            godown={dispatchGodown}
            availableRolls={availableRolls}
            availableMeters={availableMeters}
            loading={loadingRolls || loadingBulkLots}
            previewRolls={totalSelectedRolls}
            previewMeters={totalSelectedMeters}
          />
        </div>
      </div>

      {lastTx && (
        <OutwardSlipView
          tx={lastTx}
          onClose={() => setLastTx(null)}
          onPrint={() => handlePrint(lastTx.id)}
          printing={printing}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


