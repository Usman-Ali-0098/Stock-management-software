import React, {
  useEffect, useState, useCallback, useRef,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ArrowDownCircle, Printer, CheckCircle, X,
  Plus, Trash2, ChevronDown, Search, Package, PackagePlus, History,
  Clock, BarChart2, RefreshCw,
} from 'lucide-react';
import {
  api, Product, InwardTransaction, ProductStockSummary, Godown, BulkLot, Variant,
} from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import { ProductModal } from './ProductsPage';
import ShopBanner from '../components/ShopBanner';
import SelectDropdown from '../components/SelectDropdown';

type Page = 'dashboard' | 'godowns' | 'products' | 'inward' | 'outward' | 'history' | 'settings';

interface Props {
  onNavigate?: (page: Page) => void;
  preselect?: { productId: number; godownId: number; mode?: 'single' | 'bulk'; lengthMeters?: number; ratePerMeter?: number } | null;
  onPreselectConsumed?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2, 9); }

function fmt(m: number) {
  return m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
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
    timeZone: 'Asia/Karachi',
  });
}

interface RollBatchRow {
  id: string;
  length: string;
  qty: string;
  price: string;
  lengthError?: string;
  qtyError?: string;
}

// ─── Searchable Product Combobox (compact) ───────────────────────────────────

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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlightIdx]) select(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {value && !open ? (
        <div
          id={id}
          tabIndex={0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid #93c5fd', borderRadius: 7, padding: '7px 10px',
            background: '#eff6ff', cursor: 'pointer', outline: 'none'
          }}
          onClick={() => { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
        >
          <Package size={14} color="#2563eb" />
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
                background: idx === highlightIdx ? '#eff6ff' : '#fff',
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

// ─── Small Summary Card ───────────────────────────────────────────────────────

interface StockPanelProps {
  product: Product | null;
  godown: Godown | null;
  refreshTrigger: number;
  batchRows: RollBatchRow[];
  bulkEntry?: { meters: number; qty: number; price: number } | null;
  previewRolls: number;
  previewMeters: number;
}

function StockSummaryPanel({
  product, godown, refreshTrigger, batchRows, bulkEntry, previewRolls, previewMeters
}: StockPanelProps) {
  const [stock, setStock] = useState<ProductStockSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!product || !godown) { setStock(null); return; }
    setLoading(true);
    setLoadError(false);
    api.inward.productStock(product.id, godown.id).then(res => {
      if (res.success && res.data) {
        setStock(res.data);
      } else {
        setStock(null);
        setLoadError(true);
      }
      setLoading(false);
    }).catch(() => {
      setStock(null);
      setLoadError(true);
      setLoading(false);
    });
  }, [product, godown, refreshTrigger]);

  const panelStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14,
    overflowWrap: 'break-word', wordBreak: 'break-word',
  };
  const rowStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 7, marginBottom: 8,
  };

  if (!product || !godown) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
          <BarChart2 size={14} /> Summary
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
          {!godown ? 'Select a godown' : 'Select a product to see stock summary'}
        </div>
      </div>
    );
  }

  const currentRolls = stock ? stock.verifiedRolls : 0;
  const currentMeters = stock ? stock.verifiedMeters : 0;

  // Only show batch rows with a real length & quantity entered.
  const enteredBatches = batchRows.filter(r => (parseFloat(r.length) || 0) > 0 && (parseInt(r.qty) || 0) > 0);

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b' }}>Summary</span>
        {loading && <RefreshCw size={12} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />}
      </div>

      <div style={{ fontSize: 11.5, color: '#1e3a8a', marginBottom: 10 }}>
        <strong>{godown.name}</strong> &middot; {product.product_name} ({product.product_code})
      </div>

      <div style={{ ...rowStyle, borderLeft: '3px solid #16a34a', background: '#f0fdf4' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Current Stock</div>
        {loading && !stock && !loadError ? (
          <div style={{ color: '#94a3b8', fontSize: 11 }}>Loading...</div>
        ) : loadError ? (
          <div style={{ color: '#dc2626', fontSize: 11 }}>Could not load stock</div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>
            {currentRolls} rolls &middot; {fmt(currentMeters)} m
          </div>
        )}
      </div>

      {enteredBatches.length > 0 && (
        <div style={{ ...rowStyle, borderLeft: '3px solid #8b5cf6', background: '#faf5ff' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 4 }}>
            This Entry (by batch)
          </div>
          {enteredBatches.map((row, i) => {
            const l = parseFloat(row.length) || 0;
            const q = parseInt(row.qty) || 0;
            const p = parseFloat(row.price) || 0;
            return (
              <div key={row.id} style={{ fontSize: 11.5, fontWeight: 700, color: '#6d28d9', marginTop: i > 0 ? 3 : 0 }}>
                {fmt(l)} m &middot; {q} rolls{p > 0 ? ` @ Rs. ${fmtMoney(p)}/m` : ''}
              </div>
            );
          })}
        </div>
      )}

      {bulkEntry && (bulkEntry.meters > 0 || bulkEntry.qty > 0) && (
        <div style={{ ...rowStyle, borderLeft: '3px solid #8b5cf6', background: '#faf5ff' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 4 }}>
            This Entry (bulk lot)
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6d28d9' }}>
            {fmt(bulkEntry.meters)} m total &middot; {bulkEntry.qty} rolls
            {bulkEntry.price > 0 ? ` @ Rs. ${fmtMoney(bulkEntry.price)}/m` : ''}
          </div>
        </div>
      )}

      {!loading && !loadError && (previewRolls > 0 || previewMeters > 0) && (
        <div style={{ ...rowStyle, marginBottom: 0, borderLeft: '3px solid #0284c7', background: '#f0f9ff' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>After Save</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0369a1' }}>
            {currentRolls + previewRolls} rolls &middot; {fmt(currentMeters + previewMeters)} m
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Slip View Modal ──────────────────────────────────────────────────────────

function SlipView({ tx, onClose, onPrint, printing }: {
  tx: InwardTransaction; onClose: () => void; onPrint: () => void; printing: boolean;
}) {
  const totalRolls = (tx.lines || []).reduce((s, l) => s + l.quantity, 0);
  // Bulk lines store the TOTAL meters directly (not per-roll), so they must not be multiplied by quantity.
  const totalMeters = (tx.lines || []).reduce((s, l) => s + (l.is_bulk ? l.length_meters : l.length_meters * l.quantity), 0);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); onPrint(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrint]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1060, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: 620, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #15803d, #16a34a)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={17} /> Stock Received
            </h2>
            <div style={{ fontSize: 11.5, opacity: 0.88, marginTop: 2 }}>
              Slip: {tx.slip_number} &middot; {fmtDate(tx.transaction_date)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 18, maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9.5, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Godown</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#14532d' }}>{tx.godown_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Rolls</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#14532d' }}>{totalRolls}</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Meters</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f766e' }}>{fmt(totalMeters)} m</div>
            </div>
            {(tx.total_price || 0) > 0 && (
              <div>
                <div style={{ fontSize: 9.5, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Amount</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e40af' }}>Rs. {fmtMoney(tx.total_price || 0)}</div>
              </div>
            )}
          </div>

          <table className="table table-sm table-bordered align-middle" style={{ fontSize: 12.5 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr><th>Product</th><th className="text-end">Roll Size</th><th className="text-end">Qty</th><th className="text-end">Buying Rate</th></tr>
            </thead>
            <tbody>
              {(tx.lines || []).map(line => (
                <tr key={line.id}>
                  <td>{line.product_name} ({line.product_code})</td>
                  <td className="text-end" style={{ fontWeight: 700, color: '#0f766e' }}>
                    {line.is_bulk ? `Bulk — ${fmt(line.length_meters)} m total` : `${fmt(line.length_meters)} m`}
                  </td>
                  <td className="text-end" style={{ fontWeight: 700 }}>{line.quantity}</td>
                  <td className="text-end" style={{ fontWeight: 700, color: '#92400e' }}>
                    {(line.rate_per_meter || 0) > 0 ? `Rs. ${fmtMoney(line.rate_per_meter || 0)}/m` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-sm btn-primary" onClick={onPrint} disabled={printing} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <Printer size={13} />{printing ? 'Printing...' : 'Print Slip (Ctrl+P)'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN InwardPage ──────────────────────────────────────────────────────────

export default function InwardPage({ onNavigate, preselect, onPreselectConsumed }: Props) {
  const toast = useToast();
  const { godowns, currentGodown, setCurrentGodown } = useGodown();

  const [receivingGodown, setReceivingGodown] = useState<Godown | null>(null);
  useEffect(() => {
    if (currentGodown && !receivingGodown) setReceivingGodown(currentGodown);
  }, [currentGodown]);

  const [products, setProducts] = useState<Product[]>([]);
  const loadProducts = useCallback(() => {
    api.products.list({ includeInactive: false }).then(res => {
      if (res.success && res.data) setProducts(res.data);
    });
  }, []);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const [showNewProduct, setShowNewProduct] = useState(false);

  const [mode, setMode] = useState<'single' | 'bulk'>('bulk');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [batchRows, setBatchRows] = useState<RollBatchRow[]>([{ id: makeId(), length: '', qty: '', price: '' }]);

  // Bulk lot entry — known total meters + roll count, no fixed per-roll size.
  const [bulkMeters, setBulkMeters] = useState('');
  const [bulkQty, setBulkQty] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkMetersError, setBulkMetersError] = useState<string | undefined>();
  const [bulkQtyError, setBulkQtyError] = useState<string | undefined>();

  // Existing bulk lots for the selected product (any godown/rate) — lets the form tell the
  // user whether this entry will merge into a lot that already exists or create a new one.
  const [productBulkLots, setProductBulkLots] = useState<BulkLot[]>([]);
  // Existing roll-size variants for the selected product — used the same way, to auto-fill
  // a batch row's price once its roll length matches a size this product is already stocked at.
  const [productVariants, setProductVariants] = useState<Variant[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const godownSelectRef = useRef<HTMLButtonElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const firstLengthInputRef = useRef<HTMLInputElement>(null);
  const firstQtyInputRef = useRef<HTMLInputElement>(null);
  const bulkMetersInputRef = useRef<HTMLInputElement>(null);
  const bulkQtyInputRef = useRef<HTMLInputElement>(null);
  const bulkPriceInputRef = useRef<HTMLInputElement>(null);

  const [lastTx, setLastTx] = useState<InwardTransaction | null>(null);
  const [printing, setPrinting] = useState(false);
  const [stockRefresh, setStockRefresh] = useState(0);

  useEffect(() => {
    if (!selectedProduct) { setProductBulkLots([]); return; }
    api.bulk.listByProduct({ productId: selectedProduct.id, includeZero: true }).then(res => {
      if (res.success && res.data) setProductBulkLots(res.data);
    });
  }, [selectedProduct, stockRefresh]);

  useEffect(() => {
    if (!selectedProduct) { setProductVariants([]); return; }
    api.variants.listByProduct({ productId: selectedProduct.id, includeZero: true }).then(res => {
      if (res.success && res.data) setProductVariants(res.data);
    });
  }, [selectedProduct, stockRefresh]);

  const [recentTxs, setRecentTxs] = useState<InwardTransaction[]>([]);
  const loadRecentTxs = useCallback(async () => {
    if (!receivingGodown) return;
    const res = await api.inward.list({ godownId: receivingGodown.id });
    if (res.success && res.data) setRecentTxs(res.data.slice(0, 6));
  }, [receivingGodown]);
  useEffect(() => { loadRecentTxs(); }, [loadRecentTxs]);

  // Coming from the low-stock warning or a "restock this" button — pre-select the exact
  // product + godown, and (when restocking one specific variant) its roll size and rate too,
  // so adding more of it merges into the same variant instead of creating a new one.
  useEffect(() => {
    if (!preselect || products.length === 0 || godowns.length === 0) return;
    const product = products.find(p => p.id === preselect.productId);
    const godown = godowns.find(g => g.id === preselect.godownId);
    if (product) setSelectedProduct(product);
    if (godown) { setReceivingGodown(godown); setCurrentGodown(godown); }
    if (preselect.mode === 'bulk') {
      setMode('bulk');
      if (preselect.ratePerMeter) setBulkPrice(String(preselect.ratePerMeter));
    } else if (preselect.lengthMeters) {
      setMode('single');
      setBatchRows([{
        id: makeId(),
        length: String(preselect.lengthMeters),
        qty: '',
        price: preselect.ratePerMeter ? String(preselect.ratePerMeter) : '',
      }]);
    }
    setStockRefresh(x => x + 1);
    onPreselectConsumed?.();
  }, [preselect, products, godowns]);

  const singlePreviewRolls = batchRows.reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
  const singlePreviewMeters = batchRows.reduce((s, r) => {
    const l = parseFloat(r.length), q = parseInt(r.qty);
    return s + (isFinite(l) && isFinite(q) && l > 0 && q > 0 ? l * q : 0);
  }, 0);
  const singleTotalPrice = Math.round(batchRows.reduce((s, r) => {
    const l = parseFloat(r.length), q = parseInt(r.qty), p = parseFloat(r.price);
    return s + (isFinite(l) && isFinite(q) && isFinite(p) && l > 0 && q > 0 && p > 0 ? l * q * p : 0);
  }, 0) * 100) / 100;

  const bulkMetersNum = parseFloat(bulkMeters) || 0;
  const bulkQtyNum = parseInt(bulkQty) || 0;
  const bulkPriceNum = parseFloat(bulkPrice) || 0;
  const bulkTotalPrice = Math.round(bulkMetersNum * bulkPriceNum * 100) / 100;

  const previewRolls = mode === 'bulk' ? bulkQtyNum : singlePreviewRolls;
  const previewMeters = mode === 'bulk' ? bulkMetersNum : singlePreviewMeters;
  const totalPrice = mode === 'bulk' ? bulkTotalPrice : singleTotalPrice;

  // Same product + godown + rate merges into one bulk lot (FK-safe merge rule) — surface
  // whichever existing lot this entry would land on, so it's clear this is "add more" not "new".
  const matchingBulkLot = receivingGodown && bulkPriceNum > 0
    ? productBulkLots.find(l => l.godown_id === receivingGodown.id && Math.abs(l.rate_per_meter - bulkPriceNum) < 0.005) || null
    : null;
  const otherBulkLots = productBulkLots.filter(l => l.quantity > 0 && l.id !== matchingBulkLot?.id);
  // A lot already sitting in this exact godown, but at a different rate — flag this as a
  // price change rather than just "new lot", since that's what's actually happening.
  const priceChangedFromLot = !matchingBulkLot && receivingGodown
    ? otherBulkLots.find(l => l.godown_id === receivingGodown.id) || null
    : null;

  // Don't make the user retype a rate this product already has — fill the price in
  // automatically (unless they've typed their own). Prefer a lot already sitting in the
  // selected godown; otherwise fall back to this product's most recent rate from any
  // godown (repo already orders bulk lots by updated_at DESC), since a product is usually
  // bought at one standard price regardless of which godown it ends up in.
  const autoFilledBulkPriceRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== 'bulk') return;
    const activeLots = productBulkLots.filter(l => l.quantity > 0);
    const source = (receivingGodown && activeLots.find(l => l.godown_id === receivingGodown.id)) || activeLots[0];
    if (source) {
      const rate = String(source.rate_per_meter);
      setBulkPrice(prev => {
        if (prev === '' || prev === autoFilledBulkPriceRef.current) {
          autoFilledBulkPriceRef.current = rate;
          return rate;
        }
        return prev;
      });
    } else if (autoFilledBulkPriceRef.current !== null) {
      setBulkPrice(prev => (prev === autoFilledBulkPriceRef.current ? '' : prev));
      autoFilledBulkPriceRef.current = null;
    }
  }, [mode, receivingGodown, productBulkLots]);

  // Same idea, per batch row: once a row's roll length matches a size this product is already
  // stocked at, auto-fill that row's price from it (current godown preferred, else any godown).
  const autoFilledRowPriceRef = useRef<Map<string, string>>(new Map());
  const batchLengthsKey = batchRows.map(r => `${r.id}:${r.length}`).join('|');
  useEffect(() => {
    if (mode !== 'single') return;
    setBatchRows(prev => prev.map(row => {
      const lengthNum = parseFloat(row.length);
      const lastAuto = autoFilledRowPriceRef.current.get(row.id);
      if (!isFinite(lengthNum) || lengthNum <= 0) return row;

      const matches = productVariants.filter(v => Math.abs(v.length_meters - lengthNum) < 0.005);
      const source = (receivingGodown && matches.find(v => v.godown_id === receivingGodown.id && v.quantity > 0))
        || matches.find(v => v.quantity > 0)
        || matches[0];

      if (source) {
        const rate = String(source.rate_per_meter);
        if (row.price === '' || row.price === lastAuto) {
          autoFilledRowPriceRef.current.set(row.id, rate);
          return row.price === rate ? row : { ...row, price: rate };
        }
        return row;
      }
      if (lastAuto !== undefined) {
        autoFilledRowPriceRef.current.delete(row.id);
        if (row.price === lastAuto) return { ...row, price: '' };
      }
      return row;
    }));
  }, [batchLengthsKey, receivingGodown, productVariants, mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        document.getElementById('btn-save-incoming')?.click();
        return;
      }
      if (e.altKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); godownSelectRef.current?.focus(); return; }
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        const prodInput = document.getElementById('inward-product') as HTMLElement;
        prodInput?.focus(); prodInput?.click();
        return;
      }
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        (mode === 'bulk' ? bulkPriceInputRef : rateInputRef).current?.focus();
        return;
      }
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        (mode === 'bulk' ? bulkMetersInputRef : firstLengthInputRef).current?.focus();
        return;
      }
      if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        (mode === 'bulk' ? bulkQtyInputRef : firstQtyInputRef).current?.focus();
        return;
      }
      if (e.altKey && (e.key === 'a' || e.key === 'A') && mode === 'single') { e.preventDefault(); addRow(); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  const addRow = () => {
    setBatchRows(prev => [...prev, { id: makeId(), length: '', qty: '', price: '' }]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.roll-length-input');
      inputs[inputs.length - 1]?.focus();
    }, 50);
  };

  const removeRow = (id: string) => {
    setBatchRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const handleSubmitSingle = async () => {
    if (!receivingGodown) {
      toast.showToast('Please select a godown.', 'error');
      godownSelectRef.current?.focus();
      return;
    }
    if (!selectedProduct) {
      toast.showToast('Please select a product.', 'error');
      (document.getElementById('inward-product') as HTMLElement)?.focus();
      return;
    }

    let hasErr = false;
    const newRows = batchRows.map(row => {
      const l = parseFloat(row.length), q = parseInt(row.qty);
      const er1 = (!row.length.trim() || !isFinite(l) || l <= 0) ? 'Enter a valid length' : l > 10000 ? 'Max 10,000 m' : undefined;
      const er2 = (!row.qty.trim() || !isFinite(q) || q <= 0 || !Number.isInteger(q)) ? 'Enter a valid quantity' : q > 9999 ? 'Max 9,999' : undefined;
      if (er1 || er2) hasErr = true;
      return { ...row, lengthError: er1, qtyError: er2 };
    });
    setBatchRows(newRows);
    if (hasErr) {
      toast.showToast('Please fix the roll length / quantity fields.', 'error');
      return;
    }

    const batches = batchRows.map(row => ({
      lengthMeters: parseFloat(row.length),
      quantity: parseInt(row.qty),
      ratePerMeter: parseFloat(row.price) || 0,
    }));

    setIsSubmitting(true);
    try {
      const res = await api.inward.create({
        godownId: receivingGodown.id,
        productId: selectedProduct.id,
        batches,
        referenceNote: '',
        notes: '',
      });

      if (res.success && res.data) {
        toast.showToast(`${previewRolls} rolls (${fmt(previewMeters)} m) added to ${receivingGodown.name}.`, 'success');
        setLastTx(res.data);
        setBatchRows([{ id: makeId(), length: '', qty: '', price: '' }]);
        setStockRefresh(x => x + 1);
        loadRecentTxs();
      } else {
        toast.showToast(res.error || 'Could not save stock.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    }
    setIsSubmitting(false);
  };

  const handleSubmitBulk = async () => {
    if (!receivingGodown) {
      toast.showToast('Please select a godown.', 'error');
      godownSelectRef.current?.focus();
      return;
    }
    if (!selectedProduct) {
      toast.showToast('Please select a product.', 'error');
      (document.getElementById('inward-product') as HTMLElement)?.focus();
      return;
    }

    const meters = parseFloat(bulkMeters), qty = parseInt(bulkQty);
    const metersErr = (!bulkMeters.trim() || !isFinite(meters) || meters <= 0) ? 'Enter a valid total length' : undefined;
    const qtyErr = (!bulkQty.trim() || !isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) ? 'Enter a valid quantity' : undefined;
    setBulkMetersError(metersErr);
    setBulkQtyError(qtyErr);
    if (metersErr || qtyErr) {
      toast.showToast('Please fix the total meters / quantity fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.inward.createBulk({
        godownId: receivingGodown.id,
        productId: selectedProduct.id,
        totalMeters: meters,
        quantity: qty,
        ratePerMeter: parseFloat(bulkPrice) || 0,
        referenceNote: '',
        notes: '',
      });

      if (res.success && res.data) {
        toast.showToast(`Bulk lot added: ${qty} rolls (${fmt(meters)} m) to ${receivingGodown.name}.`, 'success');
        setLastTx(res.data);
        setBulkMeters(''); setBulkQty(''); setBulkPrice('');
        setStockRefresh(x => x + 1);
        loadRecentTxs();
      } else {
        toast.showToast(res.error || 'Could not save bulk stock.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    }
    setIsSubmitting(false);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;
    if (mode === 'bulk') handleSubmitBulk();
    else handleSubmitSingle();
  };

  const handlePrint = async (txId: number) => {
    setPrinting(true);
    const res = await api.print.inwardSlip(txId);
    if (!res.success) toast.showToast(res.error || 'Print error.', 'error');
    else toast.showToast('Sent to printer.', 'success');
    setPrinting(false);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingBottom: 40 }}>
      <ShopBanner />

      {/* Header card */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: '1px solid #a7f3d0', borderRadius: 12,
        padding: '14px 18px', marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 3px 8px rgba(22,163,74,0.25)'
          }}>
            <ArrowDownCircle size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#065f46' }}>Incoming Stock</h1>
            <div style={{ fontSize: 11.5, color: '#047857' }}>Add and manage incoming stock for your godowns</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowNewProduct(true)}
            className="btn btn-sm"
            style={{
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff', border: '1px solid #86efac', color: '#15803d'
            }}
          >
            <PackagePlus size={14} /> New Product
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('history')}
            className="btn btn-sm"
            style={{
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff', border: '1px solid #86efac', color: '#166534'
            }}
          >
            <History size={14} /> History
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 16, alignItems: 'start' }}>
        {/* ── LEFT: Form ── */}
        <div>
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
            {/* Product */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                Product
              </label>
              <ProductCombobox
                id="inward-product"
                products={products}
                value={selectedProduct}
                onChange={p => {
                  setSelectedProduct(p);
                  setStockRefresh(x => x + 1);
                  if (p) setTimeout(() => {
                    (mode === 'bulk' ? bulkMetersInputRef : firstLengthInputRef).current?.focus();
                  }, 50);
                }}
                autoFocus
              />
              {selectedProduct && (
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                  Existing product — new rolls will be added and totals will update automatically.
                </div>
              )}
            </div>

            {/* Entry mode: bulk lot is the default; single roll sizes is one small button away */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {mode === 'bulk' ? 'Bulk Lot Entry' : 'Single Roll Size Entry'}
              </span>
              <button
                type="button"
                onClick={() => setMode(mode === 'bulk' ? 'single' : 'bulk')}
                className="btn btn-sm btn-outline-secondary"
                style={{ fontSize: 10.5, padding: '3px 10px', fontWeight: 700 }}
              >
                {mode === 'bulk' ? 'Switch to Single Roll Entry' : '← Back to Bulk Lot'}
              </button>
            </div>

            {mode === 'bulk' && (
              <div style={{ border: '1px solid #e8edf3', borderRadius: 8, padding: '9px 10px', marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#b0b9c6', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Bulk Lot — total meters known, individual roll sizes not tracked
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1.4fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                      Total Meters
                    </label>
                    <input
                      ref={bulkMetersInputRef}
                      type="number" step="0.01" min="0.01"
                      className="form-control"
                      placeholder="e.g. 500"
                      value={bulkMeters}
                      onChange={e => { setBulkMeters(e.target.value); setBulkMetersError(undefined); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); bulkQtyInputRef.current?.focus(); } }}
                      style={{ height: 30, fontSize: 12, fontWeight: 700, padding: '0 8px', borderColor: bulkMetersError ? '#dc2626' : undefined }}
                    />
                    {bulkMetersError && <div style={{ color: '#dc2626', fontSize: 10, marginTop: 2 }}>{bulkMetersError}</div>}
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                      Quantity
                    </label>
                    <input
                      ref={bulkQtyInputRef}
                      type="number" step="1" min="0" max="9999"
                      className="form-control"
                      placeholder="0"
                      value={bulkQty}
                      onChange={e => { setBulkQty(e.target.value); setBulkQtyError(undefined); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); bulkPriceInputRef.current?.focus(); } }}
                      style={{ height: 30, fontSize: 12, fontWeight: 700, padding: '0 8px', textAlign: 'center', borderColor: bulkQtyError ? '#dc2626' : undefined }}
                    />
                    {bulkQtyError && <div style={{ color: '#dc2626', fontSize: 10, marginTop: 2 }}>{bulkQtyError}</div>}
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                      Buying Price (Rs./m)
                    </label>
                    <input
                      ref={bulkPriceInputRef}
                      type="number" step="0.01" min="0"
                      className="form-control"
                      placeholder="e.g. 450"
                      value={bulkPrice}
                      onChange={e => setBulkPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); godownSelectRef.current?.focus(); } }}
                      style={{ height: 30, fontSize: 12, fontWeight: 700, padding: '0 8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                      Godown
                    </label>
                    <SelectDropdown
                      ref={godownSelectRef}
                      placeholder="Select..."
                      value={receivingGodown?.id ?? null}
                      onChange={v => {
                        const g = godowns.find(x => x.id === Number(v)) || null;
                        setReceivingGodown(g);
                        if (g) setCurrentGodown(g);
                        setStockRefresh(x => x + 1);
                      }}
                      onEnterSelect={() => document.getElementById('btn-save-incoming')?.focus()}
                      height={30}
                      fontSize={11.5}
                      options={godowns.filter(g => g.is_active).map(g => ({ value: g.id, label: g.name }))}
                    />
                  </div>
                </div>

                {(parseFloat(bulkMeters) || 0) > 0 && (
                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 6 }}>
                    Total: <strong style={{ color: '#0f766e' }}>{fmt(parseFloat(bulkMeters) || 0)} m</strong>
                    {(parseFloat(bulkPrice) || 0) > 0 && (
                      <> &middot; <strong style={{ color: '#4338ca' }}>
                        Rs. {fmtMoney((parseFloat(bulkMeters) || 0) * (parseFloat(bulkPrice) || 0))}
                      </strong> total</>
                    )}
                  </div>
                )}

                {selectedProduct && receivingGodown && (
                  <div style={{
                    fontSize: 10.5, marginTop: 8, padding: '7px 9px', borderRadius: 6, lineHeight: 1.5,
                    background: matchingBulkLot ? '#eff6ff' : '#fffbeb',
                    border: `1px solid ${matchingBulkLot ? '#bfdbfe' : '#fde68a'}`,
                    color: matchingBulkLot ? '#1e40af' : '#92400e',
                  }}>
                    {matchingBulkLot ? (
                      <>
                        <strong>Adding to existing lot</strong> — already have{' '}
                        <strong>{fmt(matchingBulkLot.total_length_meters)} m</strong> / <strong>{matchingBulkLot.quantity} rolls</strong>{' '}
                        at Rs. {matchingBulkLot.rate_per_meter}/m in {receivingGodown.name}. This entry will be added on top of it.
                      </>
                    ) : bulkPriceNum > 0 && priceChangedFromLot ? (
                      <>
                        <strong>Price changed</strong> — this godown already has {fmt(priceChangedFromLot.total_length_meters)} m at Rs. {priceChangedFromLot.rate_per_meter}/m,
                        {' '}so Rs. {bulkPriceNum}/m will be saved as a separate new lot (not merged) in {receivingGodown.name}.
                      </>
                    ) : bulkPriceNum > 0 ? (
                      <>
                        <strong>New bulk lot will be created</strong> at Rs. {bulkPriceNum}/m in {receivingGodown.name}
                        {' '}(no existing lot at this rate here).
                      </>
                    ) : (
                      <>Enter a buying price to see if this adds to an existing lot.</>
                    )}
                    {(() => {
                      const remaining = otherBulkLots.filter(l => l.id !== priceChangedFromLot?.id);
                      return remaining.length > 0 && (
                        <div style={{ marginTop: 4, color: '#64748b' }}>
                          Other existing bulk stock for this product: {remaining.map((l, i) => (
                            <span key={l.id}>
                              {i > 0 && '; '}
                              {fmt(l.total_length_meters)} m @ Rs. {l.rate_per_meter}/m in {l.godown_name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Roll batches: each has its own Length / Qty / Price; Godown is set once (row 1) and inherited */}
            {mode === 'single' && batchRows.map((row, idx) => {
              const rowSubtotalMeters = (parseFloat(row.length) || 0) * (parseInt(row.qty) || 0);
              const rowSubtotalPrice = rowSubtotalMeters * (parseFloat(row.price) || 0);
              return (
                <div
                  key={row.id}
                  style={{
                    position: 'relative', border: '1px solid #e8edf3', borderRadius: 8,
                    padding: '9px 10px', marginBottom: 7,
                    background: idx === 0 ? '#fff' : '#f8fafc'
                  }}
                >
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="btn btn-sm btn-outline-danger"
                      style={{ position: 'absolute', top: 6, right: 6, padding: '1px 6px', lineHeight: 1 }}
                      title="Remove this batch"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}

                  <div style={{ fontSize: 9, fontWeight: 700, color: '#b0b9c6', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Batch {idx + 1}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1.4fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                        Roll Length (m)
                      </label>
                      <input
                        ref={idx === 0 ? firstLengthInputRef : undefined}
                        id={`length-${row.id}`}
                        type="number" step="0.01" min="0.01" max="10000"
                        className="form-control roll-length-input"
                        placeholder="e.g. 30"
                        value={row.length}
                        onChange={e => {
                          const val = e.target.value;
                          setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, length: val, lengthError: undefined } : r));
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            document.getElementById(`qty-${row.id}`)?.focus();
                          }
                        }}
                        style={{ height: 30, fontSize: 12, fontWeight: 700, padding: '0 8px', borderColor: row.lengthError ? '#dc2626' : undefined }}
                      />
                      {row.lengthError && <div style={{ color: '#dc2626', fontSize: 10, marginTop: 2 }}>{row.lengthError}</div>}
                    </div>

                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                        Quantity
                      </label>
                      <input
                        ref={idx === 0 ? firstQtyInputRef : undefined}
                        id={`qty-${row.id}`}
                        type="number" step="1" min="1" max="9999"
                        className="form-control roll-qty-input"
                        placeholder="1"
                        value={row.qty}
                        onChange={e => {
                          const val = e.target.value;
                          setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: val, qtyError: undefined } : r));
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            document.getElementById(`price-${row.id}`)?.focus();
                          }
                        }}
                        style={{ height: 30, fontSize: 12, fontWeight: 700, padding: '0 8px', textAlign: 'center', borderColor: row.qtyError ? '#dc2626' : undefined }}
                      />
                      {row.qtyError && <div style={{ color: '#dc2626', fontSize: 10, marginTop: 2 }}>{row.qtyError}</div>}
                    </div>

                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                        Buying Price (Rs./m)
                      </label>
                      <input
                        ref={idx === 0 ? rateInputRef : undefined}
                        id={`price-${row.id}`}
                        type="number" step="0.01" min="0"
                        className="form-control"
                        placeholder="e.g. 450"
                        value={row.price}
                        onChange={e => {
                          const val = e.target.value;
                          setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, price: val } : r));
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (idx === 0) {
                              godownSelectRef.current?.focus();
                            } else {
                              const l = parseFloat(row.length), q = parseInt(row.qty);
                              if (isFinite(l) && l > 0 && isFinite(q) && q > 0) addRow();
                            }
                          }
                        }}
                        style={{ height: 30, fontSize: 12, fontWeight: 700, padding: '0 8px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' }}>
                        Godown
                      </label>
                      {idx === 0 ? (
                        <SelectDropdown
                          ref={godownSelectRef}
                          placeholder="Select..."
                          value={receivingGodown?.id ?? null}
                          onChange={v => {
                            const g = godowns.find(x => x.id === Number(v)) || null;
                            setReceivingGodown(g);
                            if (g) setCurrentGodown(g);
                            setStockRefresh(x => x + 1);
                          }}
                          onEnterSelect={() => document.getElementById('btn-save-incoming')?.focus()}
                          height={30}
                          fontSize={11.5}
                          options={godowns.filter(g => g.is_active).map(g => ({ value: g.id, label: g.name }))}
                        />
                      ) : (
                        <div
                          title="Same godown as Batch 1 — edit it there"
                          style={{
                            height: 30, display: 'flex', alignItems: 'center', padding: '0 8px',
                            fontSize: 11.5, fontWeight: 700, color: '#94a3b8',
                            background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6,
                            cursor: 'not-allowed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}
                        >
                          {receivingGodown?.name || 'Select...'}
                        </div>
                      )}
                    </div>
                  </div>

                  {rowSubtotalMeters > 0 && (
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 6 }}>
                      Subtotal: <strong style={{ color: '#0f766e' }}>{fmt(rowSubtotalMeters)} m</strong>
                      {rowSubtotalPrice > 0 && (
                        <> &middot; <strong style={{ color: '#4338ca' }}>Rs. {fmtMoney(rowSubtotalPrice)}</strong> total</>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {mode === 'single' && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={addRow}
                style={{ fontWeight: 700, fontSize: 11.5, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}
              >
                <Plus size={12} /> Add Another Roll Batch
              </button>
            )}

            <button
              id="btn-save-incoming"
              type="submit"
              disabled={isSubmitting || !receivingGodown || !selectedProduct || (mode === 'bulk' ? (bulkMetersNum <= 0 || bulkQtyNum <= 0) : previewRolls === 0)}
              className="btn btn-success"
              style={{
                width: '100%', padding: '10px', fontSize: 13.5, fontWeight: 800,
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {isSubmitting ? (
                <><span className="spinner-border spinner-border-sm" role="status"></span><span>Saving...</span></>
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>
                    Save ({mode === 'bulk' ? 'Bulk · ' : ''}{previewRolls} rolls &middot; {fmt(previewMeters)} m{totalPrice > 0 ? ` · Rs. ${fmtMoney(totalPrice)}` : ''})
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Recent transactions */}
          {recentTxs.length > 0 && (
            <div style={{ marginTop: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Clock size={13} color="#16a34a" />
                <h3 style={{ fontSize: 11.5, fontWeight: 700, margin: 0, color: '#1e293b' }}>
                  Recent Slips &middot; {receivingGodown?.name}
                </h3>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0" style={{ fontSize: 11.5 }}>
                  <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10 }}>
                    <tr>
                      <th style={{ padding: '5px 8px' }}>Slip No.</th>
                      <th style={{ padding: '5px 8px' }}>Date</th>
                      <th className="text-end" style={{ padding: '5px 8px' }}>Rolls</th>
                      <th className="text-end" style={{ padding: '5px 8px' }}>Meters</th>
                      <th className="text-end" style={{ padding: '5px 8px' }} title="Buying price per meter — for your reference">Rate (Rs./m)</th>
                      <th style={{ padding: '5px 8px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxs.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#1e40af' }}>{tx.slip_number}</td>
                        <td style={{ padding: '5px 8px', color: '#475569' }}>{fmtDate(tx.transaction_date)}</td>
                        <td className="text-end" style={{ padding: '5px 8px', fontWeight: 700 }}>{tx.roll_count}</td>
                        <td className="text-end" style={{ padding: '5px 8px', fontWeight: 700, color: '#0f766e' }}>{fmt(tx.total_received_meters || 0)} m</td>
                        <td className="text-end" style={{ padding: '5px 8px', fontWeight: 700, color: '#92400e' }}>
                          {(tx.rate_per_meter || 0) <= 0 ? '—' : tx.rate_is_uniform === false
                            ? <span title="Batches in this slip were bought at different rates — click View for details">Mixed</span>
                            : `Rs. ${fmtMoney(tx.rate_per_meter || 0)}`}
                        </td>
                        <td className="text-center" style={{ padding: '5px 8px' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await api.inward.getById(tx.id);
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

        {/* ── RIGHT: Summary ── */}
        <div>
          <StockSummaryPanel
            product={selectedProduct}
            godown={receivingGodown}
            refreshTrigger={stockRefresh}
            batchRows={mode === 'single' ? batchRows : []}
            bulkEntry={mode === 'bulk' ? { meters: bulkMetersNum, qty: bulkQtyNum, price: bulkPriceNum } : null}
            previewRolls={previewRolls}
            previewMeters={previewMeters}
          />
        </div>
      </div>

      {showNewProduct && (
        <ProductModal
          onClose={() => setShowNewProduct(false)}
          onSaved={(p) => {
            loadProducts();
            if (p) setSelectedProduct(p);
          }}
        />
      )}

      {lastTx && (
        <SlipView
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
