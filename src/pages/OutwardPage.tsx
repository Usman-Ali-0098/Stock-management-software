import React, {
  useEffect, useState, useCallback, useRef, useMemo,
  KeyboardEvent as ReactKeyboardEvent
} from 'react';
import {
  ArrowUpCircle, Printer, CheckCircle, X, Warehouse, FileText,
  AlertCircle, Search, Package, Trash2, ChevronRight, BarChart2,
  RefreshCw, DollarSign, Calculator, Building2, Plus, CheckSquare,
  Box, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { api, Product, Roll, OutwardTransaction, Godown } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';

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
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Karachi'
  });
}

// ─── Slip View Modal ─────────────────────────────────────────────────────────

interface SlipViewProps {
  tx: OutwardTransaction;
  onClose: () => void;
  onPrint: () => void;
  printing: boolean;
}

function OutwardSlipView({ tx, onClose, onPrint, printing }: SlipViewProps) {
  const totalMeters = (tx.items || []).reduce((s, i) => s + (i.issued_length_meters || 0), 0);
  const totalRolls = (tx.items || []).length;
  const printBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    printBtnRef.current?.focus();
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onPrint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
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
      <div className="modal-card" style={{ maxWidth: 680, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #c2410c, #ea580c)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={20} />
              Maal Kamiyabi Se Jari Ho Gaya (Stock Dispatched)!
            </h2>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              Outward Slip: <strong>{tx.slip_number}</strong> · {fmtDate(tx.transaction_date)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Top Summary Box */}
          <div style={{
            background: '#fff7ed', border: '1.5px solid #fdba74', borderRadius: 8,
            padding: '14px 18px', marginBottom: 16, display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Godown</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#7c2d12' }}>
                🏢 {tx.godown_name || 'Main Warehouse'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Total Rolls</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#7c2d12' }}>
                {totalRolls} rolls
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Total Meters Issued</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#c2410c' }}>
                {fmt(totalMeters)} m
              </div>
            </div>
            {tx.total_price !== undefined && tx.total_price > 0 && (
              <div>
                <div style={{ fontSize: 10, color: '#9a3412', textTransform: 'uppercase', fontWeight: 700 }}>Total Bill Amount</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>
                  Rs. {fmtMoney(tx.total_price)}
                </div>
              </div>
            )}
          </div>

          {tx.recipient_reference && (
            <div style={{ marginBottom: 14, fontSize: 13, background: '#f8fafc', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Customer / Receiver: </span>
              <strong style={{ color: '#0f172a' }}>{tx.recipient_reference}</strong>
              {tx.rate_per_meter !== undefined && tx.rate_per_meter > 0 && (
                <span style={{ marginLeft: 16, color: '#047857', fontWeight: 700 }}>
                  (@ Rs. {tx.rate_per_meter}/m)
                </span>
              )}
            </div>
          )}

          {tx.notes && (
            <div style={{ marginBottom: 14, fontSize: 12, background: '#f8fafc', padding: '8px 12px', borderRadius: 6, color: '#475569' }}>
              <span style={{ fontWeight: 600 }}>Note: </span>{tx.notes}
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: '#334155' }}>
            Jari Karda Rolls (Dispatched Rolls Details):
          </h3>

          <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th>#</th>
                <th>Roll ID</th>
                <th>Product</th>
                <th className="text-end">Length Issued</th>
              </tr>
            </thead>
            <tbody>
              {(tx.items || []).map((item, idx) => (
                <tr key={item.id || idx}>
                  <td style={{ color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#c2410c' }}>{item.roll_code}</td>
                  <td>{item.product_name} ({item.product_code})</td>
                  <td className="text-end" style={{ fontWeight: 800, color: '#0f766e' }}>
                    {fmt(item.issued_length_meters)} m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Print karne ke liye <kbd>Ctrl+P</kbd> dabayein
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: 100 }}>
              Band Karein (Esc)
            </button>
            <button
              ref={printBtnRef}
              className="btn btn-warning"
              onClick={onPrint}
              disabled={printing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#fff' }}
            >
              <Printer size={16} />
              {printing ? 'Printing...' : 'Parchi Print Karein (Ctrl+P)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Outward Page ───────────────────────────────────────────────────────

export default function OutwardPage() {
  const toast = useToast();
  const { godowns, currentGodown, setCurrentGodown } = useGodown();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | 'all'>('all');
  const [availableRolls, setAvailableRolls] = useState<Roll[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(false);

  // Filters
  const [filterLength, setFilterLength] = useState('');
  const [rollScanInput, setRollScanInput] = useState('');

  // Selected Rolls Dispatch Cart
  const [selectedRolls, setSelectedRolls] = useState<Roll[]>([]);

  // Expanded groups for grouped roll size bars
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Customer Reference & Pricing
  const [recipient, setRecipient] = useState('');
  const [ratePerMeter, setRatePerMeter] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Slip Modal
  const [lastTx, setLastTx] = useState<OutwardTransaction | null>(null);
  const [printing, setPrinting] = useState(false);

  // Input Refs for full keyboard navigation
  const godownSelectRef = useRef<HTMLSelectElement>(null);
  const productSelectRef = useRef<HTMLSelectElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const totalInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Load products for current godown
  useEffect(() => {
    api.products.list({ includeInactive: false, godownId: currentGodown?.id })
      .then(res => {
        if (res.success && res.data) setProducts(res.data);
      });
  }, [currentGodown]);

  // Load available rolls strictly for current godown
  const loadAvailableRolls = useCallback(async () => {
    if (!currentGodown) return;
    setLoadingRolls(true);
    const params: {
      godownId: number;
      productId?: number;
      exactLengthMeters?: number;
    } = { godownId: currentGodown.id };

    if (selectedProductId !== 'all') {
      params.productId = selectedProductId;
    }
    if (filterLength.trim() && !isNaN(parseFloat(filterLength))) {
      params.exactLengthMeters = parseFloat(filterLength);
    }

    const res = await api.rolls.listAvailable(params);
    if (res.success && res.data) {
      setAvailableRolls(res.data);
    } else {
      setAvailableRolls([]);
    }
    setLoadingRolls(false);
  }, [currentGodown, selectedProductId, filterLength]);

  useEffect(() => {
    loadAvailableRolls();
  }, [loadAvailableRolls]);

  // Clear cart when godown changes to preserve godown isolation
  useEffect(() => {
    setSelectedRolls([]);
  }, [currentGodown?.id]);

  // Compute total selected meters & rolls
  const totalSelectedMeters = selectedRolls.reduce((sum, r) => sum + r.original_length_meters, 0);
  const totalSelectedRolls = selectedRolls.length;

  // Bidirectional pricing calculations
  const handleRateChange = (rateVal: string) => {
    setRatePerMeter(rateVal);
    const r = parseFloat(rateVal);
    if (!isNaN(r) && r > 0 && totalSelectedMeters > 0) {
      setTotalPrice(String(Math.round(totalSelectedMeters * r * 100) / 100));
    } else if (!rateVal) {
      setTotalPrice('');
    }
  };

  const handleTotalPriceChange = (totalVal: string) => {
    setTotalPrice(totalVal);
    const t = parseFloat(totalVal);
    if (!isNaN(t) && t > 0 && totalSelectedMeters > 0) {
      setRatePerMeter(String(Math.round((t / totalSelectedMeters) * 100) / 100));
    } else if (!totalVal) {
      setRatePerMeter('');
    }
  };

  // Recalculate price when rolls selection changes (if rate is set)
  useEffect(() => {
    const r = parseFloat(ratePerMeter);
    if (!isNaN(r) && r > 0 && totalSelectedMeters > 0) {
      setTotalPrice(String(Math.round(totalSelectedMeters * r * 100) / 100));
    }
  }, [totalSelectedMeters]);

  // Toggle roll in cart
  const toggleRollInCart = (roll: Roll) => {
    const isAlreadyIn = selectedRolls.some(r => r.id === roll.id);
    if (isAlreadyIn) {
      setSelectedRolls(prev => prev.filter(r => r.id !== roll.id));
      toast.showToast(`Roll ${roll.roll_code} cart se nikaal diya gaya`, 'info');
    } else {
      setSelectedRolls(prev => [...prev, roll]);
      toast.showToast(`Roll ${roll.roll_code} cart me shamil ho gaya!`, 'success');
    }
  };

  // Group rolls by product + roll size (e.g. 35 meter roll has 10 quantity left - black 192 - price is 700)
  const rollGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      productId: number;
      productCode: string;
      productName: string;
      lengthMeters: number;
      quantity: number;
      totalMeters: number;
      rate: number;
      rolls: Roll[];
    }>();

    for (const r of availableRolls) {
      const key = `${r.product_id}_${r.original_length_meters.toFixed(2)}`;
      const existing = map.get(key);
      const rollRate = r.purchase_rate && r.purchase_rate > 0 ? r.purchase_rate : 700;

      if (existing) {
        existing.quantity += 1;
        existing.totalMeters += r.remaining_length_meters;
        existing.rolls.push(r);
        if ((!existing.rate || existing.rate === 700) && r.purchase_rate && r.purchase_rate > 0) {
          existing.rate = r.purchase_rate;
        }
      } else {
        map.set(key, {
          key,
          productId: r.product_id,
          productCode: r.product_code || String(r.product_id),
          productName: r.product_name || 'Leather Product',
          lengthMeters: r.original_length_meters,
          quantity: 1,
          totalMeters: r.remaining_length_meters,
          rate: rollRate,
          rolls: [r],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const pCmp = a.productCode.localeCompare(b.productCode);
      if (pCmp !== 0) return pCmp;
      return a.lengthMeters - b.lengthMeters;
    });
  }, [availableRolls]);

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const toggleAllGroups = () => {
    if (expandedGroups.size === rollGroups.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(rollGroups.map(g => g.key)));
    }
  };

  // Add 1 roll from this group to cart
  const handleAddOneFromGroup = (groupRolls: Roll[]) => {
    const nextAvailable = groupRolls.find(r => !selectedRolls.some(item => item.id === r.id));
    if (nextAvailable) {
      setSelectedRolls(prev => [...prev, nextAvailable]);
      toast.showToast(`Roll ${nextAvailable.roll_code} cart me shamil ho gaya!`, 'success');
    } else {
      toast.showToast('Is group ke tamam rolls pehle se cart me hain!', 'info');
    }
  };

  // Add all rolls from this group to cart, or remove if already all in cart
  const handleToggleAllFromGroup = (groupRolls: Roll[]) => {
    const unselected = groupRolls.filter(r => !selectedRolls.some(item => item.id === r.id));
    if (unselected.length === 0) {
      // Remove all rolls of this group
      const groupRollIds = new Set(groupRolls.map(r => r.id));
      setSelectedRolls(prev => prev.filter(r => !groupRollIds.has(r.id)));
      toast.showToast(`Group ke ${groupRolls.length} rolls cart se nikaal diye gaye`, 'info');
    } else {
      setSelectedRolls(prev => [...prev, ...unselected]);
      toast.showToast(`Group ke ${unselected.length} rolls cart me shamil ho gaye!`, 'success');
    }
  };

  // Fast Roll Scan handler (pressing Enter on scan input)
  const handleScanRollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = rollScanInput.trim().toUpperCase();
    if (!query) return;

    // Check if already in cart
    const inCart = selectedRolls.find(r => r.roll_code.toUpperCase() === query);
    if (inCart) {
      toast.showToast(`Roll ${inCart.roll_code} pehle se dispatch list me shamil hai!`, 'info');
      setRollScanInput('');
      return;
    }

    // Find in available rolls of this godown
    const matched = availableRolls.find(r => r.roll_code.toUpperCase() === query);
    if (matched) {
      setSelectedRolls(prev => [...prev, matched]);
      setRollScanInput('');
      toast.showToast(`✓ Roll ${matched.roll_code} (${matched.original_length_meters.toFixed(2)}m) shamil ho gaya!`, 'success');
    } else {
      toast.showToast(`Roll "${query}" is godown (${currentGodown?.name}) me available nahi mila!`, 'error');
    }
  };

  // Dispatch Action
  const handleConfirmIssue = async () => {
    if (selectedRolls.length === 0) {
      toast.showToast('Pehle kam az kam aik roll muntakhib karein.', 'error');
      scanInputRef.current?.focus();
      return;
    }
    if (!currentGodown) {
      toast.showToast('Pehle godown select karein.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const rollIds = selectedRolls.map(r => r.id);
      const res = await api.outward.create({
        rollIds,
        godownId: currentGodown.id,
        recipientReference: recipient.trim(),
        notes: notes.trim(),
        ratePerMeter: parseFloat(ratePerMeter) || 0,
        totalPrice: parseFloat(totalPrice) || 0,
      });

      if (res.success && res.data) {
        toast.showToast(`${selectedRolls.length} rolls kamiyabi se jari ho gaye!`, 'success');
        setLastTx(res.data);
        setSelectedRolls([]);
        setRecipient('');
        setRatePerMeter('');
        setTotalPrice('');
        setNotes('');
        loadAvailableRolls();
      } else {
        toast.showToast(res.error || 'Maal jari karne me masla hua.', 'error');
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
      if (res.success) {
        toast.showToast('Print command bheji gayi.', 'success');
      } else {
        toast.showToast(res.error || 'Print nahi ho saka.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setPrinting(false);
    }
  };

  // Global hotkeys
  useEffect(() => {
    const handleGlobalKey = (e: globalThis.KeyboardEvent) => {
      // Don't trigger if modal is open
      if (lastTx) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleConfirmIssue();
      } else if (e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        godownSelectRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        productSelectRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        rateInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        totalInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        customerInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        notesInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [lastTx, selectedRolls, currentGodown, recipient, notes, ratePerMeter, totalPrice]);

  // Total available stats in godown
  const totalGodownRolls = availableRolls.length;
  const totalGodownMeters = availableRolls.reduce((s, r) => s + r.original_length_meters, 0);

  // Projected remaining stock
  const remainingRolls = Math.max(0, totalGodownRolls - totalSelectedRolls);
  const remainingMeters = Math.max(0, totalGodownMeters - totalSelectedMeters);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, marginBottom: 16, paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#c2410c' }}>
            <ArrowUpCircle size={28} />
            Maal Bahar Jaye (Outgoing Stock / Maal Kharch)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Customer ko physical rolls jari karein, sale rate darj karein aur Outward Slip print karein.
          </p>
        </div>

        {/* Target Godown Selector (Alt+G) */}
        <div style={{
          background: '#fff7ed', border: '1.5px solid #fdba74', borderRadius: 10,
          padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 2px 6px rgba(234, 88, 12, 0.08)'
        }}>
          <Warehouse size={22} color="#ea580c" />
          <div>
            <div style={{ fontSize: 10, color: '#9a3412', textTransform: 'uppercase', fontWeight: 800 }}>
              Khariji Godown [Alt+G]
            </div>
            <select
              ref={godownSelectRef}
              className="form-select form-select-sm"
              value={currentGodown?.id || ''}
              onChange={e => {
                const g = godowns.find(item => item.id === Number(e.target.value));
                if (g) setCurrentGodown(g);
              }}
              style={{ fontWeight: 800, fontSize: 14, color: '#7c2d12', padding: '2px 24px 2px 6px', height: 32, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {godowns.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Helper Bar */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '8px 14px', marginBottom: 18, display: 'flex', alignItems: 'center',
        gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#475569'
      }}>
        <span style={{ fontWeight: 800, color: '#1e293b' }}>⚡ Shortcuts:</span>
        <span><kbd>Alt+G</kbd> Godown</span>
        <span><kbd>Alt+S</kbd> Scan Roll</span>
        <span><kbd>Alt+P</kbd> Product</span>
        <span><kbd>Alt+R</kbd> Rate/m</span>
        <span><kbd>Alt+T</kbd> Total Bill</span>
        <span><kbd>Alt+C</kbd> Customer</span>
        <span><kbd>Enter</kbd> Add/Toggle Roll</span>
        <span style={{ fontWeight: 700, color: '#c2410c' }}><kbd>Ctrl+S</kbd> Issue Stock</span>
        <span><kbd>Ctrl+P</kbd> Print Slip</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20 }}>
        {/* Left Column: Form, Scan, Cart, and Available Rolls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Customer & Price Section */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #fed7aa', padding: 18, boxShadow: '0 2px 6px rgba(234, 88, 12, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <DollarSign size={18} color="#ea580c" />
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#9a3412' }}>
                Customer &amp; Price Section (Baqi aur Qeemat Ka Khana)
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {/* Customer Reference */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                  Customer / Recipient Reference <kbd style={{ fontSize: 9 }}>Alt+C</kbd>
                </label>
                <input
                  ref={customerInputRef}
                  type="text"
                  className="form-control"
                  placeholder="e.g. Aslam Shoes / Tariq Bhai"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  style={{ fontSize: 13, height: 38 }}
                />
              </div>

              {/* Rate per Meter */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                  Sale Rate Per Meter (Rs./m) <kbd style={{ fontSize: 9 }}>Alt+R</kbd>
                </label>
                <div className="input-group">
                  <span className="input-group-text" style={{ fontSize: 12, fontWeight: 700 }}>Rs.</span>
                  <input
                    ref={rateInputRef}
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 250"
                    value={ratePerMeter}
                    onChange={e => handleRateChange(e.target.value)}
                    style={{ fontSize: 13, height: 38 }}
                  />
                  <span className="input-group-text" style={{ fontSize: 12 }}>/m</span>
                </div>
              </div>

              {/* Total Sale Bill */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                  Kul Sale Bill (Total Price) <kbd style={{ fontSize: 9 }}>Alt+T</kbd>
                </label>
                <div className="input-group">
                  <span className="input-group-text" style={{ fontSize: 12, fontWeight: 700 }}>Rs.</span>
                  <input
                    ref={totalInputRef}
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="Kul Raqam"
                    value={totalPrice}
                    onChange={e => handleTotalPriceChange(e.target.value)}
                    style={{ fontSize: 13, height: 38, fontWeight: 700, color: '#15803d' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                  Khariji Note / Gate Pass <kbd style={{ fontSize: 9 }}>Alt+N</kbd>
                </label>
                <input
                  ref={notesInputRef}
                  type="text"
                  className="form-control"
                  placeholder="e.g. Gate pass #, gaari number"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ fontSize: 13, height: 38 }}
                />
              </div>
            </div>
          </div>

          {/* Quick Roll Scanner & Filter Bar */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.4fr) minmax(180px, 1fr) minmax(130px, 0.8fr) auto', gap: 12, alignItems: 'flex-end' }}>
              {/* Scan Barcode / Search Roll */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                  🔍 Fast Roll Barcode Scan / ID <kbd style={{ fontSize: 9 }}>Alt+S</kbd>
                </label>
                <form onSubmit={handleScanRollSubmit}>
                  <div className="input-group">
                    <span className="input-group-text" style={{ background: '#eff6ff' }}><Search size={14} color="#2563eb" /></span>
                    <input
                      ref={scanInputRef}
                      type="text"
                      className="form-control"
                      placeholder="Roll code likhein + Enter (e.g. A-0001)"
                      value={rollScanInput}
                      onChange={e => setRollScanInput(e.target.value)}
                      style={{ fontSize: 13, height: 38, fontWeight: 700, fontFamily: 'monospace' }}
                      autoFocus
                    />
                    <button type="submit" className="btn btn-primary" style={{ fontWeight: 700, fontSize: 12 }}>
                      Add <kbd style={{ fontSize: 9 }}>Enter</kbd>
                    </button>
                  </div>
                </form>
              </div>

              {/* Product Filter */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                  Product Filter <kbd style={{ fontSize: 9 }}>Alt+P</kbd>
                </label>
                <select
                  ref={productSelectRef}
                  className="form-select form-select-sm"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  style={{ fontSize: 13, height: 38 }}
                >
                  <option value="all">Tamam Products (All)</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name} ({p.product_code})</option>
                  ))}
                </select>
              </div>

              {/* Length Filter */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                  Exact Lambai
                </label>
                <div className="input-group input-group-sm">
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 50"
                    value={filterLength}
                    onChange={e => setFilterLength(e.target.value)}
                    style={{ fontSize: 13, height: 38 }}
                  />
                  <span className="input-group-text">m</span>
                </div>
              </div>

              {/* Clear */}
              <div>
                <button
                  type="button"
                  onClick={() => { setSelectedProductId('all'); setFilterLength(''); setRollScanInput(''); }}
                  className="btn btn-outline-secondary btn-sm"
                  style={{ height: 38, fontWeight: 600, padding: '0 12px' }}
                  title="Reset filters"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Selected Rolls Dispatch Cart */}
          {selectedRolls.length > 0 && (
            <div style={{
              background: '#fff', borderRadius: 12, border: '2px solid #ea580c',
              padding: 16, boxShadow: '0 4px 14px rgba(234, 88, 12, 0.12)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckSquare size={18} />
                    Muntakhib Khariji Rolls (Dispatch Cart): {selectedRolls.length} Rolls · {fmt(totalSelectedMeters)} Meters
                  </h3>
                  <div style={{ fontSize: 12, color: '#7c2d12', marginTop: 2 }}>
                    Yeh rolls is outward transaction me jari kiye jayenge.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRolls([])}
                  className="btn btn-outline-danger btn-sm"
                  style={{ fontWeight: 700, fontSize: 11, padding: '4px 10px' }}
                >
                  <Trash2 size={13} style={{ marginRight: 4 }} /> Saari Cart Khali Karein
                </button>
              </div>

              <div className="table-responsive" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ background: '#fff7ed', color: '#9a3412', fontSize: 11, textTransform: 'uppercase' }}>
                    <tr>
                      <th>#</th>
                      <th>Roll ID</th>
                      <th>Product</th>
                      <th className="text-end">Length</th>
                      {parseFloat(ratePerMeter) > 0 && <th className="text-end">Price</th>}
                      <th className="text-center">Hataiyein</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRolls.map((r, idx) => {
                      const itemPrice = parseFloat(ratePerMeter) > 0 ? r.original_length_meters * parseFloat(ratePerMeter) : 0;
                      return (
                        <tr key={r.id}>
                          <td style={{ color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#c2410c' }}>
                              {r.roll_code}
                            </span>
                          </td>
                          <td><strong>{r.product_name}</strong> <span style={{ color: '#64748b' }}>({r.product_code})</span></td>
                          <td className="text-end" style={{ fontWeight: 800, color: '#0f766e' }}>
                            {r.original_length_meters.toFixed(2)} m
                          </td>
                          {parseFloat(ratePerMeter) > 0 && (
                            <td className="text-end" style={{ fontWeight: 700, color: '#15803d' }}>
                              Rs. {fmtMoney(itemPrice)}
                            </td>
                          )}
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => toggleRollInCart(r)}
                              className="btn btn-ghost btn-sm text-danger p-0"
                              title="Hataiyein (Remove)"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Available Rolls in Current Godown - Grouped by Roll Size */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                  Is Godown Me Mojood Available Stock ({rollGroups.length} Sizes · {availableRolls.length} Rolls)
                </h2>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Har roll size ke mutabiq mojooda stock aur live qeemat. Bar par <strong>Enter dabayein</strong> individual roll IDs dekhne ke liye!
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {rollGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllGroups}
                    className="btn btn-sm btn-link text-decoration-none"
                    style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', padding: 0 }}
                  >
                    {expandedGroups.size === rollGroups.length ? 'Tamam Band Karein' : 'Tamam Kholein'}
                  </button>
                )}
                <span className="badge bg-light text-dark" style={{ border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700 }}>
                  {fmt(totalGodownMeters)} m Kul Available
                </span>
              </div>
            </div>

            {loadingRolls ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                <RefreshCw size={20} className="spinner-border" /> Rolls load ho rahe hain...
              </div>
            ) : rollGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
                Is filter me koi available roll nahi mila.
              </div>
            ) : (
              <div>
                {rollGroups.map(group => {
                  const isExpanded = expandedGroups.has(group.key);
                  const selectedInGroup = group.rolls.filter(r => selectedRolls.some(item => item.id === r.id));
                  const selectedCount = selectedInGroup.length;
                  const isAllSelected = selectedCount === group.quantity && group.quantity > 0;

                  return (
                    <div key={group.key} style={{ marginBottom: 14 }}>
                      {/* The Complete Stock Bar */}
                      <div
                        tabIndex={0}
                        role="button"
                        aria-expanded={isExpanded}
                        aria-label={`${group.lengthMeters} meter roll, ${group.quantity} quantity left, ${group.productName} ${group.productCode}, price ${group.rate}. Press Enter to view rolls`}
                        className={`stock-group-bar ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => toggleGroupExpand(group.key)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleGroupExpand(group.key);
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          flexWrap: 'wrap', gap: 14,
                        }}
                      >
                        {/* Left Part: Roll Size & Product */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {/* Roll Size Badge */}
                          <div style={{
                            background: '#eff6ff', border: '2px solid #2563eb', borderRadius: 10,
                            padding: '8px 16px', textAlign: 'center', minWidth: 100,
                            boxShadow: '0 2px 6px rgba(37,99,235,0.1)'
                          }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#1e40af', lineHeight: 1.1 }}>
                              {fmt(group.lengthMeters)} m
                            </div>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                              Roll Size
                            </div>
                          </div>

                          {/* Product Name & Code */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                                {group.productName}
                              </span>
                              <span style={{
                                fontFamily: 'monospace', fontSize: 13, fontWeight: 800,
                                background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 6
                              }}>
                                {group.productCode}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                              Kul Lambai: <strong style={{ color: '#0f766e', fontSize: 14 }}>{fmt(group.totalMeters)} m</strong> ({group.quantity} rolls × {fmt(group.lengthMeters)}m)
                            </div>
                          </div>
                        </div>

                        {/* Right Part: Quantity Left Badge, Price/Rate, Dispatch Actions, and Expand Prompt */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {/* QUANTITY LEFT BADGE (Matching user exact request) */}
                          <div style={{
                            background: selectedCount > 0 ? '#fff7ed' : '#f0fdf4',
                            border: `2px solid ${selectedCount > 0 ? '#ea580c' : '#22c55e'}`,
                            borderRadius: 10, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
                            boxShadow: selectedCount > 0 ? '0 2px 6px rgba(234,88,12,0.15)' : '0 2px 6px rgba(34,197,94,0.15)'
                          }}>
                            <Box size={18} color={selectedCount > 0 ? '#ea580c' : '#16a34a'} />
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 800, color: selectedCount > 0 ? '#9a3412' : '#15803d', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {selectedCount > 0 ? `${selectedCount} in Cart` : 'Stock Available'}
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: selectedCount > 0 ? '#c2410c' : '#15803d', lineHeight: 1.1 }}>
                                {group.quantity} Quantity Left
                              </div>
                            </div>
                          </div>

                          {/* Price / Rate Section (e.g. Price is 700) */}
                          <div style={{
                            background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10,
                            padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8
                          }}>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                                Price / Rate
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 900, color: '#b45309' }}>
                                Rs. {fmtMoney(group.rate)} <span style={{ fontSize: 10, fontWeight: 600 }}>/m</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Dispatch Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => handleAddOneFromGroup(group.rolls)}
                              disabled={selectedCount >= group.quantity}
                              className="btn btn-sm btn-outline-success"
                              style={{ fontWeight: 800, fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                              title="Is size ka 1 roll cart me shamil karein"
                            >
                              <Plus size={13} /> 1 Roll
                            </button>

                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => handleToggleAllFromGroup(group.rolls)}
                              className={`btn btn-sm ${isAllSelected ? 'btn-warning text-white' : 'btn-outline-primary'}`}
                              style={{ fontWeight: 800, fontSize: 12, padding: '5px 10px' }}
                              title={isAllSelected ? 'Is size ke tamam rolls cart se nikaalein' : 'Is size ke tamam rolls cart me dalein'}
                            >
                              {isAllSelected ? '✓ All in Cart' : `+ All (${group.quantity})`}
                            </button>
                          </div>

                          {/* Expand Button / Enter Badge */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            color: '#2563eb', fontWeight: 800, fontSize: 13,
                            background: '#eff6ff', padding: '8px 12px', borderRadius: 8, border: '1px solid #bfdbfe'
                          }}>
                            <span>{isExpanded ? 'Chupayein' : `Roll IDs (${group.quantity})`}</span>
                            <kbd style={{ fontSize: 10 }}>Enter</kbd>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Rolls Drawer: Shows only when Enter is pressed on the bar */}
                      {isExpanded && (
                        <div className="stock-group-details">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                              📦 {group.productName} ({group.productCode}) — {fmt(group.lengthMeters)}m Roll ke {group.rolls.length} Roll IDs:
                            </div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Kisi bhi roll par <kbd>Enter</kbd> dabayein cart me add/remove karne ke liye
                            </span>
                          </div>

                          <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                              <thead style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                                <tr>
                                  <th>#</th>
                                  <th>Roll ID</th>
                                  <th>Product</th>
                                  <th className="text-end">Length</th>
                                  <th>Received Date</th>
                                  <th className="text-center">Selection Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.rolls.map((r, idx) => {
                                  const isPicked = selectedRolls.some(item => item.id === r.id);
                                  return (
                                    <tr
                                      key={r.id}
                                      tabIndex={0}
                                      role="button"
                                      aria-label={`Roll ${r.roll_code}, ${r.original_length_meters}m, press Enter to toggle selection`}
                                      title="Enter dabayein ya click karein roll add/remove karne ke liye"
                                      onClick={() => toggleRollInCart(r)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          toggleRollInCart(r);
                                        }
                                      }}
                                      style={{
                                        background: isPicked ? '#fff7ed' : undefined,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <td style={{ color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                                      <td>
                                        <span style={{
                                          fontFamily: 'monospace', fontWeight: 800, fontSize: 14,
                                          color: isPicked ? '#c2410c' : '#1e3a8a'
                                        }}>
                                          {r.roll_code}
                                        </span>
                                      </td>
                                      <td>
                                        <strong>{r.product_name}</strong> <span style={{ color: '#64748b' }}>({r.product_code})</span>
                                      </td>
                                      <td className="text-end" style={{ fontWeight: 800, color: '#0f766e', fontSize: 14 }}>
                                        {r.original_length_meters.toFixed(2)} m
                                      </td>
                                      <td style={{ color: '#64748b', fontSize: 12 }}>
                                        {fmtDate(r.received_at)}
                                      </td>
                                      <td className="text-center">
                                        <button
                                          tabIndex={-1}
                                          type="button"
                                          onClick={e => { e.stopPropagation(); toggleRollInCart(r); }}
                                          className={`btn btn-sm ${isPicked ? 'btn-warning text-white' : 'btn-outline-primary'}`}
                                          style={{ fontWeight: 700, fontSize: 12, padding: '3px 12px' }}
                                        >
                                          {isPicked ? '✓ In Cart' : '+ Cart Me Dalein'} <kbd style={{ fontSize: 9 }}>Enter</kbd>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Live Stock Summary Side Panel */}
        <div>
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'sticky', top: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={18} color="#c2410c" />
                <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>Live Stock Summary</span>
              </div>
              <span style={{ fontSize: 11, background: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                {currentGodown?.name}
              </span>
            </div>

            {/* Current Godown Stock */}
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 8, background: '#f0fdf4', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#166534', marginBottom: 4 }}>
                🏢 Is Godown Ka Mojooda Stock
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>
                {totalGodownRolls} rolls · {fmt(totalGodownMeters)} m
              </div>
              <div style={{ fontSize: 11, color: '#166534', opacity: 0.85, marginTop: 2 }}>
                Current available rolls in {currentGodown?.name}
              </div>
            </div>

            {/* Outgoing Dispatch Preview */}
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 8, background: '#fff7ed', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#9a3412', marginBottom: 4 }}>
                📤 Naya Khariji Maal (Outgoing Dispatch)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#c2410c' }}>
                -{totalSelectedRolls} rolls · -{fmt(totalSelectedMeters)} m
              </div>
              {parseFloat(totalPrice) > 0 && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: '#7c2d12', background: '#ffedd5', padding: '4px 8px', borderRadius: 6 }}>
                  Kul Sale Bill: Rs. {fmtMoney(parseFloat(totalPrice))}
                  {parseFloat(ratePerMeter) > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginLeft: 6 }}>
                      (@ Rs. {ratePerMeter}/m)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Stock Remaining After Dispatch */}
            <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 8, background: '#eff6ff', borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#1e40af', marginBottom: 4 }}>
                📊 Kharch Ke Baad Bacha Stock (Remaining)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a' }}>
                {remainingRolls} rolls · {fmt(remainingMeters)} m
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Issuance ke baad ka mutawaqqa stock
              </div>
            </div>

            {/* Big Action Button (Ctrl+S) */}
            <button
              ref={submitBtnRef}
              onClick={handleConfirmIssue}
              disabled={submitting || selectedRolls.length === 0}
              className="btn btn-warning"
              style={{
                width: '100%', color: '#fff', fontWeight: 800, fontSize: 15,
                padding: '13px 0', borderRadius: 10,
                boxShadow: selectedRolls.length > 0 ? '0 4px 14px rgba(234, 88, 12, 0.35)' : 'none',
                cursor: selectedRolls.length === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Issue Stock (Ctrl+S)"
            >
              {submitting
                ? 'Maal Jari Ho Raha Hai...'
                : selectedRolls.length > 0
                  ? `✓ ${selectedRolls.length} Rolls Jari Karein [Ctrl+S]`
                  : 'Pehle Roll Muntakhib Karein'}
            </button>

            {selectedRolls.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedRolls([])}
                className="btn btn-link"
                style={{ width: '100%', marginTop: 8, fontSize: 12, color: '#64748b' }}
              >
                Selection Khatam Karein
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Outward Slip Modal */}
      {lastTx && (
        <OutwardSlipView
          tx={lastTx}
          onClose={() => setLastTx(null)}
          onPrint={() => handlePrint(lastTx.id)}
          printing={printing}
        />
      )}
    </div>
  );
}
