import React, {
  useEffect, useState, useCallback, useRef,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ArrowDownCircle, Printer, CheckCircle, X, Warehouse, FileText,
  AlertCircle, Plus, Trash2, ChevronDown, Search, ClipboardList,
  Package, AlertTriangle, CheckSquare, Clock, BarChart2, RefreshCw,
  Coins, DollarSign, Calculator, Building2
} from 'lucide-react';
import {
  api, Product, InwardTransaction, SupplierBill, SupplierBillItem,
  ProductStockSummary, Godown,
} from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';

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
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Karachi',
  });
}

function statusBadge(s: string) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pending:     { bg: '#fef3c7', color: '#92400e', label: '⏳ Pending' },
    partial:     { bg: '#dbeafe', color: '#1e40af', label: '🔄 Partial' },
    verified:    { bg: '#d1fae5', color: '#065f46', label: '✅ Complete' },
    discrepancy: { bg: '#fee2e2', color: '#991b1b', label: '⚠️ Discrepancy' },
  };
  const c = cfg[s] || { bg: '#f1f5f9', color: '#475569', label: s };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      background: c.bg, color: c.color, fontSize: 11, fontWeight: 700,
    }}>{c.label}</span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryMode = 'B' | 'A';

interface BillProductLine {
  id: string;
  productId: number | null;
  product: Product | null;
  supplierMeters: string;
  supplierRolls: string;
  notes: string;
  metersError?: string;
  rollsError?: string;
  productError?: string;
}

interface RollBatchRow {
  id: string;
  length: string;
  qty: string;
  lengthError?: string;
  qtyError?: string;
}

// ─── Searchable Product Combobox ─────────────────────────────────────────────

interface ProductComboboxProps {
  products: Product[];
  value: Product | null;
  onChange: (p: Product | null) => void;
  placeholder?: string;
  id?: string;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  onSelectAndAdvance?: () => void;
}

function ProductCombobox({
  products, value, onChange, placeholder, id, onKeyDown, autoFocus, disabled, onSelectAndAdvance
}: ProductComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? products.filter(p =>
        p.product_name.toLowerCase().includes(query.toLowerCase()) ||
        p.product_code.toLowerCase().includes(query.toLowerCase())
      )
    : products;

  useEffect(() => { setHighlightIdx(0); }, [query]);

  const select = (p: Product) => {
    onChange(p);
    setQuery('');
    setOpen(false);
    onSelectAndAdvance?.();
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
      if (open && filtered[highlightIdx]) {
        select(filtered[highlightIdx]);
      } else if (!open && filtered.length > 0 && query.trim()) {
        setOpen(true);
      } else if (value) {
        onSelectAndAdvance?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
    onKeyDown?.(e);
  };

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      el?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [highlightIdx]);

  return (
    <div style={{ position: 'relative' }}>
      {value && !open ? (
        <div
          id={id}
          tabIndex={0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1.5px solid #3b82f6', borderRadius: 8, padding: '8px 12px',
            background: '#eff6ff', cursor: 'pointer', outline: 'none'
          }}
          onClick={() => { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              setOpen(true);
              setQuery('');
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
        >
          <Package size={16} color="#2563eb" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>{value.product_name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Code: {value.product_code}</div>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null); setQuery(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
            title="Clear selection"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 12, pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            id={id}
            type="text"
            className="form-control"
            placeholder={placeholder || 'Product code ya naam likhein (e.g. 192 Black) [Alt+P]'}
            value={query}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onKeyDown={handleKey}
            style={{ paddingLeft: 34, height: 40, fontSize: 13, fontWeight: 600 }}
          />
          <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: 10, top: 13, pointerEvents: 'none' }} />
        </div>
      )}

      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
            marginTop: 4,
          }}
        >
          {filtered.map((p, idx) => (
            <div
              key={p.id}
              onMouseDown={() => select(p)}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                background: idx === highlightIdx ? '#eff6ff' : '#fff',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>{p.product_name}</span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>({p.product_code})</span>
              </div>
              <span style={{ fontSize: 10, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#475569', fontWeight: 600 }}>
                Enter to select
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Current Stock Summary Side Panel (Cleaned up: No Verified/Physical Jargon) ─

interface StockPanelProps {
  product: Product | null;
  godown: Godown | null;
  refreshTrigger: number;
  previewRolls: number;
  previewMeters: number;
  ratePerMeter: number;
  totalPrice: number;
}

function StockSummaryPanel({
  product, godown, refreshTrigger, previewRolls, previewMeters, ratePerMeter, totalPrice
}: StockPanelProps) {
  const [stock, setStock] = useState<ProductStockSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!product || !godown) { setStock(null); return; }
    setLoading(true);
    api.inward.productStock(product.id, godown.id).then(res => {
      if (res.success && res.data) setStock(res.data);
      setLoading(false);
    });
  }, [product, godown, refreshTrigger]);

  const panelStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  };
  const sectionStyle: React.CSSProperties = {
    marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#f8fafc',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6,
    color: '#475569', marginBottom: 4,
  };

  if (!product || !godown) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <BarChart2 size={16} color="#64748b" />
          <span style={{ fontWeight: 800, fontSize: 14, color: '#475569' }}>Godown Stock Summary</span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          {!godown ? '⚠️ Pehle godown select karein' : '⬆️ Product select karein'}
        </div>
      </div>
    );
  }

  const currentRolls = stock ? stock.verifiedRolls : 0;
  const currentMeters = stock ? stock.verifiedMeters : 0;

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={16} color="#2563eb" />
          <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>Godown Stock</span>
        </div>
        {loading && <RefreshCw size={13} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />}
      </div>

      <div style={{ fontSize: 12, color: '#1e3a8a', marginBottom: 12, padding: '8px 10px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
        <div>🏭 <strong>{godown.name}</strong></div>
        <div style={{ fontWeight: 700, marginTop: 2 }}>{product.product_name} ({product.product_code})</div>
      </div>

      {/* Current Stock in this Godown */}
      <div style={{ ...sectionStyle, borderLeft: '3.5px solid #16a34a', background: '#f0fdf4' }}>
        <div style={labelStyle}>🏢 Is Godown Ka Mojooda Stock</div>
        {stock ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>
              {currentRolls} rolls · {fmt(currentMeters)} m
            </div>
            {stock.rollBreakdown.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#334155', borderTop: '1px dashed #bbf7d0', paddingTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 3 }}>ROLL LENGTHS:</div>
                {stock.rollBreakdown.map(rb => (
                  <div key={rb.length_meters} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                    <span>{fmt(rb.length_meters)} m</span>
                    <span style={{ fontWeight: 800 }}>{rb.count} rolls</span>
                  </div>
                ))}
              </div>
            )}
            {currentRolls === 0 && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Is godown me abhi koi roll nahi hai</div>}
          </>
        ) : <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading stock...</div>}
      </div>

      {/* Current entry preview with Price */}
      {(previewRolls > 0 || previewMeters > 0) && (
        <div style={{ ...sectionStyle, borderLeft: '3.5px solid #8b5cf6', background: '#faf5ff' }}>
          <div style={{ ...labelStyle, color: '#7c3aed' }}>📥 Naya Maal (Current Entry)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#6d28d9' }}>
            +{previewRolls} rolls · +{fmt(previewMeters)} m
          </div>
          {totalPrice > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#4338ca', background: '#ede9fe', padding: '4px 8px', borderRadius: 6 }}>
              Kul Qeemat: Rs. {fmtMoney(totalPrice)}
              {ratePerMeter > 0 && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginLeft: 6 }}>(@ Rs. {ratePerMeter}/m)</span>}
            </div>
          )}
        </div>
      )}

      {/* Total after inward */}
      {stock && (previewRolls > 0 || previewMeters > 0) && (
        <div style={{ ...sectionStyle, borderLeft: '3.5px solid #0284c7', background: '#f0f9ff' }}>
          <div style={{ ...labelStyle, color: '#0369a1' }}>📊 Save Ke Baad Kul Stock</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0369a1' }}>
            {currentRolls + previewRolls} rolls · {fmt(currentMeters + previewMeters)} m
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
  const totalMeters = (tx.items || []).reduce((s, i) => s + (i.received_length_meters || 0), 0);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        onPrint();
      }
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
        style={{ maxWidth: 660, width: '100%', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #15803d, #16a34a)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={19} /> Stock Kamiyabi Se Receive Ho Gaya!
            </h2>
            <div style={{ fontSize: 12, opacity: 0.88, marginTop: 2 }}>
              Slip: {tx.slip_number} · {fmtDate(tx.transaction_date)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20, maxHeight: '65vh', overflowY: 'auto' }}>
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Receiving Godown</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#14532d' }}>🏭 {tx.godown_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Total Rolls</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#14532d' }}>{(tx.items || []).length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Total Meters</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f766e' }}>{fmt(totalMeters)} m</div>
            </div>
            {(tx.total_price || 0) > 0 && (
              <div>
                <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Total Amount</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#1e40af' }}>Rs. {fmtMoney(tx.total_price || 0)}</div>
              </div>
            )}
          </div>

          <table className="table table-sm table-bordered align-middle" style={{ fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr><th>Roll ID</th><th>Product</th><th className="text-end">Length</th></tr>
            </thead>
            <tbody>
              {(tx.items || []).map(item => (
                <tr key={item.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a8a' }}>{item.roll_code}</td>
                  <td>{item.product_name} ({item.product_code})</td>
                  <td className="text-end" style={{ fontWeight: 700, color: '#0f766e' }}>{fmt(item.received_length_meters)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: 100 }}>Band Karein</button>
          <button className="btn btn-primary" onClick={onPrint} disabled={printing} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <Printer size={15} />{printing ? 'Printing...' : 'Parchi Print Karein (Ctrl+P)'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN InwardPage ──────────────────────────────────────────────────────────

export default function InwardPage() {
  const toast = useToast();
  const { godowns, currentGodown, setCurrentGodown } = useGodown();

  // ── Target receiving godown
  const [receivingGodown, setReceivingGodown] = useState<Godown | null>(null);
  useEffect(() => {
    if (currentGodown && !receivingGodown) setReceivingGodown(currentGodown);
  }, [currentGodown]);

  // ── Products list
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    api.products.list({ includeInactive: false }).then(res => {
      if (res.success && res.data) setProducts(res.data);
    });
  }, []);

  // ── Mode selector: Default is 'B' (Direct Roll Entry with Price)
  const [mode, setMode] = useState<EntryMode>('B');

  // ── Form State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [batchRows, setBatchRows] = useState<RollBatchRow[]>([{ id: makeId(), length: '', qty: '1' }]);
  const [bNote, setBNote] = useState('');
  const [bRef, setBRef] = useState('');
  const [ratePerMeter, setRatePerMeter] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Refs for keyboard focus navigation
  const godownSelectRef = useRef<HTMLSelectElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const firstLengthInputRef = useRef<HTMLInputElement>(null);
  const firstQtyInputRef = useRef<HTMLInputElement>(null);

  // ── Modals & Slip history
  const [lastTx, setLastTx] = useState<InwardTransaction | null>(null);
  const [printing, setPrinting] = useState(false);
  const [stockRefresh, setStockRefresh] = useState(0);

  // ── Recent inward slips for this godown
  const [recentTxs, setRecentTxs] = useState<InwardTransaction[]>([]);
  const loadRecentTxs = useCallback(async () => {
    if (!receivingGodown) return;
    const res = await api.inward.list({ godownId: receivingGodown.id });
    if (res.success && res.data) setRecentTxs(res.data.slice(0, 8));
  }, [receivingGodown]);
  useEffect(() => { loadRecentTxs(); }, [loadRecentTxs]);

  // ── Roll Totals Calculation
  const previewRolls = batchRows.reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
  const previewMeters = batchRows.reduce((s, r) => {
    const l = parseFloat(r.length), q = parseInt(r.qty);
    return s + (isFinite(l) && isFinite(q) && l > 0 && q > 0 ? l * q : 0);
  }, 0);

  // ── Bidirectional Price Calculation
  const handleRateChange = (val: string) => {
    setRatePerMeter(val);
    const r = parseFloat(val);
    if (isFinite(r) && r >= 0 && previewMeters > 0) {
      setTotalPrice((Math.round(previewMeters * r * 100) / 100).toString());
    } else if (!val.trim()) {
      setTotalPrice('');
    }
  };

  const handleTotalPriceChange = (val: string) => {
    setTotalPrice(val);
    const p = parseFloat(val);
    if (isFinite(p) && p >= 0 && previewMeters > 0) {
      setRatePerMeter((Math.round((p / previewMeters) * 100) / 100).toString());
    } else if (!val.trim()) {
      setRatePerMeter('');
    }
  };

  // Recalculate price when meter length changes if rate is present
  useEffect(() => {
    const r = parseFloat(ratePerMeter);
    if (isFinite(r) && r > 0 && previewMeters > 0) {
      setTotalPrice((Math.round(previewMeters * r * 100) / 100).toString());
    }
  }, [previewMeters]);

  // ── Global Hotkeys for InwardPage
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S -> Save
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        document.getElementById('btn-save-incoming')?.click();
        return;
      }

      // Alt+G -> Focus Godown
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        godownSelectRef.current?.focus();
        return;
      }

      // Alt+P -> Focus Product
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        const prodInput = document.getElementById('mode-b-product') as HTMLElement;
        prodInput?.focus();
        prodInput?.click();
        return;
      }

      // Alt+R -> Focus Rate
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        rateInputRef.current?.focus();
        return;
      }

      // Alt+T -> Focus Total Price
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        priceInputRef.current?.focus();
        return;
      }

      // Alt+L -> Focus Length
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        firstLengthInputRef.current?.focus();
        return;
      }

      // Alt+Q -> Focus Qty
      if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        firstQtyInputRef.current?.focus();
        return;
      }

      // Alt+A -> Add Row
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        addRow();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addRow = () => {
    setBatchRows(prev => [...prev, { id: makeId(), length: '', qty: '1' }]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.roll-length-input');
      inputs[inputs.length - 1]?.focus();
    }, 50);
  };

  const removeRow = (id: string) => {
    setBatchRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  // ── Save Incoming Stock Transaction
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;

    if (!receivingGodown) {
      toast.showToast('Pehle Receiving Godown muntakhib karein.', 'error');
      godownSelectRef.current?.focus();
      return;
    }
    if (!selectedProduct) {
      toast.showToast('Product select karein.', 'error');
      const prodInput = document.getElementById('mode-b-product') as HTMLElement;
      prodInput?.focus();
      return;
    }

    // Validate rows
    let hasErr = false;
    const newRows = batchRows.map(row => {
      const l = parseFloat(row.length), q = parseInt(row.qty);
      const er1 = (!row.length.trim() || !isFinite(l) || l <= 0) ? 'Sahi lambai likhein (> 0)' : l > 10000 ? 'Max 10,000 m' : undefined;
      const er2 = (!row.qty.trim() || !isFinite(q) || q <= 0 || !Number.isInteger(q)) ? 'Sahi quantity likhein' : q > 9999 ? 'Max 9,999' : undefined;
      if (er1 || er2) hasErr = true;
      return { ...row, lengthError: er1, qtyError: er2 };
    });
    setBatchRows(newRows);
    if (hasErr) {
      toast.showToast('Rolls ki lambai aur quantity theek karein.', 'error');
      return;
    }

    // Expand batch rows into individual roll lengths
    const allLengths: number[] = [];
    for (const row of batchRows) {
      const l = parseFloat(row.length), q = parseInt(row.qty);
      for (let i = 0; i < q; i++) allLengths.push(l);
    }

    const rNum = parseFloat(ratePerMeter) || 0;
    const pNum = parseFloat(totalPrice) || 0;

    setIsSubmitting(true);
    try {
      const res = await api.inward.create({
        godownId: receivingGodown.id,
        productId: selectedProduct.id,
        rollLengthsMeters: allLengths,
        referenceNote: bRef.trim(),
        notes: bNote.trim(),
        ratePerMeter: rNum,
        totalPrice: pNum,
      });

      if (res.success && res.data) {
        toast.showToast(`✓ ${allLengths.length} rolls (${fmt(previewMeters)} m) ${receivingGodown.name} me darj ho gaye!`, 'success');
        setLastTx(res.data);
        // Reset rows & pricing
        setBatchRows([{ id: makeId(), length: '', qty: '1' }]);
        setBNote(''); setBRef('');
        setRatePerMeter(''); setTotalPrice('');
        setStockRefresh(x => x + 1);
        loadRecentTxs();
      } else {
        toast.showToast(res.error || 'Stock save karne mein masla hua.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    }
    setIsSubmitting(false);
  };

  const handlePrint = async (txId: number) => {
    setPrinting(true);
    const res = await api.print.inwardSlip(txId);
    if (!res.success) toast.showToast(res.error || 'Print error.', 'error');
    else toast.showToast('Print command bhej di gayi.', 'success');
    setPrinting(false);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header with Quick Keyboard Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 16, paddingBottom: 14,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#15803d' }}>
            <ArrowDownCircle size={26} /> Maal Andar Aaye (Incoming Stock)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Pura form keyboard se chalta hai: <kbd style={{ padding: '2px 5px' }}>Alt+G</kbd> Godown → <kbd style={{ padding: '2px 5px' }}>Alt+P</kbd> Product → <kbd style={{ padding: '2px 5px' }}>Alt+R</kbd> Rate → <kbd style={{ padding: '2px 5px' }}>Alt+L</kbd> Rolls → <kbd style={{ padding: '2px 5px', fontWeight: 700 }}>Ctrl+S</kbd> Save!
          </p>
        </div>

        {receivingGodown && (
          <div style={{
            background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10,
            padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10
          }}>
            <Warehouse size={20} color="#16a34a" />
            <div>
              <div style={{ fontSize: 10, color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>Target Godown</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#14532d' }}>{receivingGodown.name}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* ── LEFT: Incoming Stock Form ── */}
        <div>
          {/* 1. RECEIVING GODOWN SELECTOR (WHICH GODOWN TO ADD ROLLS TO) */}
          <div style={{
            background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: 12,
            padding: '14px 18px', marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.6, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={16} color="#2563eb" />
                1. Kis Godown Me Maal Daalna Hai? (Receiving Godown) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <kbd style={{ background: '#e2e8f0', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Alt+G</kbd>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                ref={godownSelectRef}
                className="form-select"
                value={receivingGodown?.id ?? ''}
                onChange={e => {
                  const g = godowns.find(x => x.id === Number(e.target.value)) || null;
                  setReceivingGodown(g);
                  if (g) setCurrentGodown(g);
                  setStockRefresh(x => x + 1);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const prodInput = document.getElementById('mode-b-product') as HTMLElement;
                    prodInput?.focus();
                    prodInput?.click();
                  }
                }}
                style={{
                  fontSize: 15, fontWeight: 800, color: '#0f172a', height: 44,
                  borderColor: '#94a3b8', background: '#fff', flex: 1, minWidth: 260
                }}
              >
                <option value="">-- Godown Select Karein --</option>
                {godowns.filter(g => g.is_active).map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.address ? `(${g.address})` : ''}
                  </option>
                ))}
              </select>

              {/* Quick Godown Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {godowns.filter(g => g.is_active).map(g => {
                  const isSel = receivingGodown?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setReceivingGodown(g);
                        setCurrentGodown(g);
                        setStockRefresh(x => x + 1);
                      }}
                      className="btn btn-sm"
                      style={{
                        fontWeight: 700, fontSize: 12, padding: '6px 12px',
                        background: isSel ? '#1e40af' : '#fff',
                        color: isSel ? '#fff' : '#334155',
                        border: isSel ? '1px solid #1e40af' : '1px solid #cbd5e1',
                      }}
                    >
                      {g.name.split(' — ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {receivingGodown && (
              <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                ✓ Naya maal <strong>"{receivingGodown.name}"</strong> me darj hoga.
              </div>
            )}
          </div>

          {/* MAIN INWARD FORM */}
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', padding: 22, boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
            {/* 2. PRODUCT SELECTOR */}
            <div className="mb-4">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label mb-0" style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>
                  2. Product Muntakhib Karein <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <kbd style={{ background: '#e2e8f0', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Alt+P</kbd>
              </div>
              <ProductCombobox
                id="mode-b-product"
                products={products}
                value={selectedProduct}
                onChange={p => {
                  setSelectedProduct(p);
                  setStockRefresh(x => x + 1);
                }}
                onSelectAndAdvance={() => {
                  rateInputRef.current?.focus();
                }}
              />
            </div>

            {/* 3. PRICE SECTION (RATE PER METER & TOTAL PURCHASE PRICE) */}
            <div style={{
              background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 10,
              padding: '14px 16px', marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Coins size={16} color="#2563eb" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    3. Price &amp; Purchase Rate (Qeemat / Rate Section)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <kbd style={{ background: '#e2e8f0', color: '#1e40af', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Alt+R (Rate)</kbd>
                  <kbd style={{ background: '#e2e8f0', color: '#1e40af', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Alt+T (Total)</kbd>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Rate per Meter (Rs. / meter):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: 9, fontWeight: 700, color: '#64748b', fontSize: 13 }}>Rs.</span>
                    <input
                      ref={rateInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="e.g. 450"
                      value={ratePerMeter}
                      onChange={e => handleRateChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          firstLengthInputRef.current?.focus();
                        }
                      }}
                      style={{ paddingLeft: 36, height: 40, fontSize: 14, fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    Rate likhne se Total Price khud ba khud ban jayegi
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Total Bill / Price (Kul Raqam):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: 9, fontWeight: 700, color: '#64748b', fontSize: 13 }}>Rs.</span>
                    <input
                      ref={priceInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="e.g. 45000"
                      value={totalPrice}
                      onChange={e => handleTotalPriceChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          firstLengthInputRef.current?.focus();
                        }
                      }}
                      style={{ paddingLeft: 36, height: 40, fontSize: 14, fontWeight: 800, color: '#1e40af' }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    Ya kul bill likhein to Rate khud calculate ho jayega
                  </div>
                </div>
              </div>
            </div>

            {/* 4. ROLL LENGTHS & QUANTITIES (TABLE) */}
            <div className="mb-4">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <label className="form-label mb-0" style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>
                    4. Roll Lengths &amp; Counts (Lambai aur Rolls) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Ek jaisi lambai ke mutaddid rolls ke liye quantity darj karein
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <kbd style={{ background: '#e2e8f0', color: '#1e40af', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Alt+L (Length)</kbd>
                  <kbd style={{ background: '#e2e8f0', color: '#1e40af', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Alt+Q (Qty)</kbd>
                  <kbd style={{ background: '#e2e8f0', color: '#1e40af', padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Alt+A (Add)</kbd>
                </div>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', width: '38%' }}>
                        Roll Length (Meters)
                      </th>
                      <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', width: '28%' }}>
                        Number of Rolls
                      </th>
                      <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>
                        Total Meters
                      </th>
                      <th style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchRows.map((row, idx) => {
                      const l = parseFloat(row.length), q = parseInt(row.qty);
                      const sub = isFinite(l) && isFinite(q) && l > 0 && q > 0 ? l * q : 0;
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ position: 'relative' }}>
                              <input
                                ref={idx === 0 ? firstLengthInputRef : undefined}
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="10000"
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
                                    const qtyInput = (e.currentTarget.closest('tr')?.querySelector('.roll-qty-input') as HTMLInputElement);
                                    qtyInput?.focus();
                                    qtyInput?.select();
                                  }
                                }}
                                style={{
                                  fontWeight: 800, fontSize: 14,
                                  borderColor: row.lengthError ? '#dc2626' : undefined,
                                }}
                              />
                              <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 12, color: '#94a3b8', pointerEvents: 'none' }}>m</span>
                            </div>
                            {row.lengthError && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>{row.lengthError}</div>}
                          </td>

                          <td style={{ padding: '8px 12px' }}>
                            <input
                              ref={idx === 0 ? firstQtyInputRef : undefined}
                              type="number"
                              step="1"
                              min="1"
                              max="9999"
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
                                  if (idx === batchRows.length - 1) {
                                    addRow();
                                  } else {
                                    const nextLength = document.querySelectorAll<HTMLInputElement>('.roll-length-input')[idx + 1];
                                    nextLength?.focus();
                                  }
                                }
                              }}
                              style={{
                                textAlign: 'center', fontWeight: 800, fontSize: 14,
                                borderColor: row.qtyError ? '#dc2626' : undefined,
                              }}
                            />
                            {row.qtyError && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2, textAlign: 'center' }}>{row.qtyError}</div>}
                          </td>

                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#0f766e', fontSize: 14 }}>
                            {sub > 0 ? `${fmt(sub)} m` : '—'}
                          </td>

                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {batchRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(row.id)}
                                className="btn btn-sm btn-outline-danger"
                                style={{ padding: '3px 8px' }}
                                title="Remove row"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                    <tr>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e293b' }}>
                        Total Rolls: <strong style={{ color: '#2563eb', fontSize: 15 }}>{previewRolls} rolls</strong>
                      </td>
                      <td colSpan={2} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#0f766e', fontSize: 16 }}>
                        Total: {fmt(previewMeters)} m
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={addRow}
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
                title="Add Another Length Row (Alt+A or Enter on Qty)"
              >
                <Plus size={15} /> + Add Another Length Row <kbd style={{ fontSize: 9 }}>Alt+A / Enter on Qty</kbd>
              </button>
            </div>

            {/* 5. NOTES & BILL REFERENCE (OPTIONAL) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Supplier Bill No. / Parchi Reference:
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. Bill # 4821"
                  value={bRef}
                  onChange={e => setBRef(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Memo / Remarks:
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Optional memo"
                  value={bNote}
                  onChange={e => setBNote(e.target.value)}
                />
              </div>
            </div>

            {/* SAVE BUTTON (LARGE & ACCESSIBLE) */}
            <button
              id="btn-save-incoming"
              type="submit"
              disabled={isSubmitting || !receivingGodown || !selectedProduct || previewRolls === 0}
              className="btn btn-success"
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 900,
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 4px 12px rgba(21, 128, 61, 0.3)', letterSpacing: 0.3
              }}
              title="Save Incoming Stock (Ctrl+S / Alt+S)"
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>Saving Stock...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>
                    SAVE INCOMING STOCK ({previewRolls} Rolls · {fmt(previewMeters)} m
                    {parseFloat(totalPrice) > 0 ? ` · Rs. ${fmtMoney(parseFloat(totalPrice))}` : ''})
                  </span>
                  <kbd style={{ background: 'rgba(0,0,0,0.25)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontSize: 11 }}>Ctrl+S</kbd>
                </>
              )}
            </button>
          </form>

          {/* RECENT INWARD TRANSACTIONS TABLE */}
          {recentTxs.length > 0 && (
            <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color="#16a34a" />
                  Is Godown Ki Haliya Aamad (Recent Slips in {receivingGodown?.name})
                </h3>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ background: '#f8fafc', color: '#64748b' }}>
                    <tr>
                      <th>Slip No.</th>
                      <th>Date</th>
                      <th className="text-end">Rolls</th>
                      <th className="text-end">Meters</th>
                      <th className="text-end">Price / Rate</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxs.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1e40af' }}>{tx.slip_number}</td>
                        <td style={{ color: '#475569' }}>{fmtDate(tx.transaction_date)}</td>
                        <td className="text-end" style={{ fontWeight: 800 }}>{tx.roll_count}</td>
                        <td className="text-end" style={{ fontWeight: 800, color: '#0f766e' }}>{fmt(tx.total_received_meters || 0)} m</td>
                        <td className="text-end" style={{ fontWeight: 700, color: '#4338ca' }}>
                          {(tx.total_price || 0) > 0 ? `Rs. ${fmtMoney(tx.total_price || 0)}` : '—'}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await api.inward.getById(tx.id);
                              if (r.success && r.data) setLastTx(r.data);
                            }}
                            className="btn btn-sm btn-outline-primary"
                            style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700 }}
                          >
                            Parchi Dekhein
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

        {/* ── RIGHT: Current Stock Summary Side Panel ── */}
        <div>
          <StockSummaryPanel
            product={selectedProduct}
            godown={receivingGodown}
            refreshTrigger={stockRefresh}
            previewRolls={previewRolls}
            previewMeters={previewMeters}
            ratePerMeter={parseFloat(ratePerMeter) || 0}
            totalPrice={parseFloat(totalPrice) || 0}
          />
        </div>
      </div>

      {/* Slip Modal on successful save or view */}
      {lastTx && (
        <SlipView
          tx={lastTx}
          onClose={() => setLastTx(null)}
          onPrint={() => handlePrint(lastTx.id)}
          printing={printing}
        />
      )}

      {/* CSS spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
