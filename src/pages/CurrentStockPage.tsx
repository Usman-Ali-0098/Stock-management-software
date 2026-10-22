import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Warehouse, Search, Filter, RotateCcw, ChevronLeft, ChevronRight,
  Layers, CheckCircle, Clock, ArrowUpDown, ChevronDown, ChevronUp,
  Tag, DollarSign, Edit3, Check, X, Package, ShieldCheck, Box
} from 'lucide-react';
import { api, Product, Roll } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import RollHistoryModal from '../components/RollHistoryModal';

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

export interface RollGroup {
  key: string;
  productId: number;
  productCode: string;
  productName: string;
  lengthMeters: number;
  quantity: number;
  totalMeters: number;
  status: string;
  rate: number;
  totalPrice: number;
  rolls: Roll[];
}

export default function CurrentStockPage() {
  const toast = useToast();
  const { currentGodown } = useGodown();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(false);

  // Expanded groups in grouped view
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Editing rate state
  const [editingGroup, setEditingGroup] = useState<RollGroup | null>(null);
  const [newRateInput, setNewRateInput] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  // Filters
  const [rollSearch, setRollSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'available' | 'all' | 'fully_issued'>('available');
  const [exactLength, setExactLength] = useState('');

  // Roll History Modal
  const [activeRollModal, setActiveRollModal] = useState<string | null>(null);

  // Load products for dropdown filter
  const loadProducts = useCallback(async () => {
    if (!currentGodown) return;
    const res = await api.products.list({ includeInactive: false, godownId: currentGodown.id });
    if (res.success && res.data) {
      setProducts(res.data);
    }
  }, [currentGodown]);

  // Load rolls for active godown
  const loadRolls = useCallback(async () => {
    if (!currentGodown) return;
    setLoadingRolls(true);
    const params: {
      godownId: number;
      productId?: number;
      status?: 'all' | 'available' | 'fully_issued';
      rollCode?: string;
      exactLengthMeters?: number;
    } = {
      godownId: currentGodown.id,
      productId: selectedProductId ?? undefined,
      status: statusFilter,
      rollCode: rollSearch.trim() || undefined,
      exactLengthMeters: exactLength ? parseFloat(exactLength) : undefined,
    };

    const res = await api.stock.rollInventory(params);
    if (res.success && res.data) {
      setRolls(res.data);
    } else {
      setRolls([]);
    }
    setLoadingRolls(false);
  }, [currentGodown, selectedProductId, statusFilter, rollSearch, exactLength]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadRolls();
  }, [loadRolls]);

  // Grouped Rolls by Product + Roll Size (Length) + Status
  // e.g. "35 meter roll has 10 quantity left - black 192 - price is 700"
  const rollGroups: RollGroup[] = useMemo(() => {
    const map = new Map<string, RollGroup>();

    for (const r of rolls) {
      const key = `${r.product_id}_${r.original_length_meters.toFixed(2)}_${r.status}`;
      const existing = map.get(key);
      const rollRate = r.purchase_rate && r.purchase_rate > 0 ? r.purchase_rate : 700;

      if (existing) {
        existing.quantity += 1;
        existing.totalMeters += r.remaining_length_meters;
        existing.rolls.push(r);
        if ((!existing.rate || existing.rate === 700) && r.purchase_rate && r.purchase_rate > 0) {
          existing.rate = r.purchase_rate;
        }
        existing.totalPrice = Math.round(existing.totalMeters * existing.rate);
      } else {
        map.set(key, {
          key,
          productId: r.product_id,
          productCode: r.product_code || String(r.product_id),
          productName: r.product_name || 'Leather Product',
          lengthMeters: r.original_length_meters,
          quantity: 1,
          totalMeters: r.remaining_length_meters,
          status: r.status,
          rate: rollRate,
          totalPrice: Math.round(r.remaining_length_meters * rollRate),
          rolls: [r],
        });
      }
    }

    // Sort groups by product code then roll size
    return Array.from(map.values()).sort((a, b) => {
      const pCmp = a.productCode.localeCompare(b.productCode);
      if (pCmp !== 0) return pCmp;
      return a.lengthMeters - b.lengthMeters;
    });
  }, [rolls]);

  // Toggle group expansion with Enter or Click
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

  // Handle Rate Update for a Batch
  const handleSaveBatchRate = async () => {
    if (!editingGroup) return;
    const rateVal = parseFloat(newRateInput);
    if (isNaN(rateVal) || rateVal < 0) {
      toast.showToast('Durust rate darj karein.', 'error');
      return;
    }

    setSavingRate(true);
    try {
      const rollIds = editingGroup.rolls.map(r => r.id);
      const res = await api.stock.updateBatchRate({ rollIds, ratePerMeter: rateVal });
      if (res.success) {
        toast.showToast(`Rate Rs. ${rateVal}/m kamiyabi se mehfooz ho gaya!`, 'success');
        setEditingGroup(null);
        loadRolls();
      } else {
        toast.showToast(res.error || 'Rate update nahi ho saka.', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setSavingRate(false);
    }
  };

  // Grand totals
  const totalAvailableRolls = rolls.filter(r => r.status === 'available').length;
  const totalAvailableMeters = rolls.filter(r => r.status === 'available').reduce((acc, r) => acc + r.remaining_length_meters, 0);

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 60 }}>
      {/* Title & Godown Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#1e3a8a' }}>
            <Warehouse size={28} color="#2563eb" />
            Mojooda Stock (Current Warehouse Inventory)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Har roll size ke mutabiq available stock aur live qeemat ka khulasa.
          </p>
        </div>

        {/* Selected Godown Card */}
        <div style={{
          background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 10,
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <Warehouse size={22} color="#2563eb" />
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
              Muntakhib Godown (Active Location)
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
              {currentGodown ? currentGodown.name : 'Loading Godown...'}
            </div>
          </div>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', borderLeft: '4px solid #2563eb', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>
            Total Available Rolls
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1e3a8a', marginTop: 4 }}>
            {totalAvailableRolls.toLocaleString()} rolls
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Is godown ke kul physical rolls
          </div>
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', borderLeft: '4px solid #0f766e', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>
            Total Available Meters
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#0f766e', marginTop: 4 }}>
            {fmt(totalAvailableMeters)} m
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Kul lambai tamam rolls ki
          </div>
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', borderLeft: '4px solid #d97706', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>
            Total Roll Sizes / Batches
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#b45309', marginTop: 4 }}>
            {rollGroups.length} Sizes
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Available stock bars
          </div>
        </div>
      </div>

      {/* Main Stock Bars Section */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', padding: 20 }}>
        {/* Compact Filters Bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(200px, 1.2fr) minmax(180px, 1fr) minmax(140px, 0.8fr) minmax(120px, 0.7fr) auto',
          gap: 12, alignItems: 'flex-end', marginBottom: 18, paddingBottom: 16,
          borderBottom: '1px solid #f1f5f9'
        }}>
          {/* Product Filter */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
              Product Filter
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedProductId ?? 'all'}
              onChange={e => setSelectedProductId(e.target.value === 'all' ? null : Number(e.target.value))}
              style={{ fontSize: 13, height: 38 }}
            >
              <option value="all">Tamam Products (All)</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.product_name} ({p.product_code})</option>
              ))}
            </select>
          </div>

          {/* Roll ID Search */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
              Roll ID Search
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text"><Search size={14} /></span>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 192-0001"
                value={rollSearch}
                onChange={e => setRollSearch(e.target.value)}
                style={{ fontSize: 13, height: 38 }}
              />
            </div>
          </div>

          {/* Filter by Length */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
              Roll Size (Meters)
            </label>
            <div className="input-group input-group-sm">
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 35"
                value={exactLength}
                onChange={e => setExactLength(e.target.value)}
                style={{ fontSize: 13, height: 38 }}
              />
              <span className="input-group-text">m</span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
              Status
            </label>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{ fontSize: 13, height: 38 }}
            >
              <option value="available">Sirf Mojood</option>
              <option value="fully_issued">Jari Karda</option>
              <option value="all">Tamam Records</option>
            </select>
          </div>

          {/* Reset */}
          <div>
            <button
              onClick={() => { setRollSearch(''); setStatusFilter('available'); setExactLength(''); setSelectedProductId(null); }}
              className="btn btn-outline-secondary btn-sm"
              style={{ height: 38, fontWeight: 700, padding: '0 14px' }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Section Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12, marginBottom: 16
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
              Roll Sizes &amp; Available Quantity Bars ({rollGroups.length} Sizes)
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Har bar me roll size, mojooda quantity aur qeemat darj hai. Bar par <strong>Enter dabayein</strong> individual roll IDs dekhne ke liye.
            </div>
          </div>

          {rollGroups.length > 0 && (
            <button
              onClick={toggleAllGroups}
              className="btn btn-sm btn-link text-decoration-none"
              style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}
            >
              {expandedGroups.size === rollGroups.length ? 'Tamam Band Karein (Collapse All)' : 'Tamam Kholein (Expand All)'}
            </button>
          )}
        </div>

        {/* =========================================================================
           GROUPED STOCK BARS
           As requested: "35 meter roll has 10 quantity left - black 192 - price is 700"
           ========================================================================= */}
        {loadingRolls ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
            <span className="spinner-border spinner-border-sm me-2" /> Stock load ho raha hai...
          </div>
        ) : rollGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
            Is filter me koi stock mojood nahi hai.
          </div>
        ) : (
          <div>
            {rollGroups.map(group => {
              const isExpanded = expandedGroups.has(group.key);
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
                        padding: '8px 16px', textAlign: 'center', minWidth: 110,
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

                    {/* Right Part: Quantity Left, Price/Rate, Status, and Expand Prompt */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      {/* 10 QUANTITY LEFT BADGE (Matching user exact request) */}
                      <div style={{
                        background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 10,
                        padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 2px 6px rgba(34,197,94,0.15)'
                      }}>
                        <Box size={18} color="#16a34a" />
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Stock Available
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>
                            {group.quantity} Quantity Left
                          </div>
                        </div>
                      </div>

                      {/* Price / Rate Section (e.g. Price is 700) */}
                      <div style={{
                        background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10,
                        padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10
                      }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                            Price / Rate
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#b45309' }}>
                            Rs. {fmtMoney(group.rate)} <span style={{ fontSize: 11, fontWeight: 600 }}>/m</span>
                          </div>
                        </div>

                        {group.totalPrice > 0 && (
                          <div style={{ borderLeft: '1px solid #fcd34d', paddingLeft: 10 }}>
                            <div style={{ fontSize: 9, color: '#92400e', fontWeight: 800, textTransform: 'uppercase' }}>Kul Maaliyat</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: '#78350f' }}>
                              Rs. {fmtMoney(group.totalPrice)}
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            setEditingGroup(group);
                            setNewRateInput(String(group.rate));
                          }}
                          className="btn btn-ghost btn-sm p-0 text-muted"
                          title="Qeemat / Rate update karein"
                          style={{ marginLeft: 4 }}
                        >
                          <Edit3 size={15} color="#b45309" />
                        </button>
                      </div>

                      {/* Status */}
                      <span className={`badge ${group.status === 'available' ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: 12, padding: '7px 12px', fontWeight: 800 }}>
                        {group.status === 'available' ? 'Available' : 'Issued'}
                      </span>

                      {/* Expand Button / Enter Badge */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: '#2563eb', fontWeight: 800, fontSize: 13,
                        background: '#eff6ff', padding: '8px 12px', borderRadius: 8, border: '1px solid #bfdbfe'
                      }}>
                        <span>{isExpanded ? 'Chupayein' : `Roll IDs Dekhein (${group.quantity})`}</span>
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
                          Kisi bhi roll par <kbd>Enter</kbd> dabayein mukammal roll history dekhne ke liye
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
                              <th className="text-center">Status</th>
                              <th className="text-center">History</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rolls.map((r, idx) => (
                              <tr
                                key={r.id}
                                tabIndex={0}
                                role="button"
                                title="Enter dabayein roll history dekhne ke liye"
                                onClick={() => setActiveRollModal(r.roll_code)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setActiveRollModal(r.roll_code);
                                  }
                                }}
                              >
                                <td style={{ color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                                    {r.roll_code}
                                  </span>
                                </td>
                                <td>
                                  <strong>{r.product_name}</strong> <span style={{ color: '#64748b' }}>({r.product_code})</span>
                                </td>
                                <td className="text-end" style={{ fontWeight: 800, color: '#0f766e' }}>
                                  {r.original_length_meters.toFixed(2)} m
                                </td>
                                <td style={{ color: '#64748b', fontSize: 12 }}>
                                  {fmtDate(r.received_at)}
                                </td>
                                <td className="text-center">
                                  {r.status === 'available' ? (
                                    <span className="badge bg-success" style={{ fontSize: 11, padding: '3px 8px' }}>
                                      Available
                                    </span>
                                  ) : (
                                    <span className="badge bg-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>
                                      Issued
                                    </span>
                                  )}
                                </td>
                                <td className="text-center">
                                  <button
                                    tabIndex={-1}
                                    onClick={e => { e.stopPropagation(); setActiveRollModal(r.roll_code); }}
                                    className="btn btn-sm btn-outline-primary"
                                    style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700 }}
                                  >
                                    History <kbd style={{ fontSize: 9 }}>Enter</kbd>
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
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Rate Modal */}
      {editingGroup && (
        <div className="modal-backdrop" onClick={() => setEditingGroup(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1070, padding: 16
        }}>
          <div className="modal-card" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={18} color="#d97706" />
                Rate / Price Update Karein
              </h3>
              <button onClick={() => setEditingGroup(null)} className="btn btn-ghost btn-sm p-0">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                <div>Product: <strong>{editingGroup.productName} ({editingGroup.productCode})</strong></div>
                <div>Roll Size: <strong>{fmt(editingGroup.lengthMeters)} m</strong> · Quantity: <strong>{editingGroup.quantity} Quantity Left</strong></div>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 700, fontSize: 13 }}>
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
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveBatchRate();
                    }}
                    style={{ fontSize: 14, fontWeight: 700 }}
                  />
                  <span className="input-group-text">/m</span>
                </div>
              </div>

              {parseFloat(newRateInput) > 0 && (
                <div style={{ background: '#fffbeb', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
                  Kul Maaliyat ({editingGroup.totalMeters}m × Rs. {newRateInput}):
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#b45309', marginTop: 2 }}>
                    Rs. {fmtMoney(editingGroup.totalMeters * parseFloat(newRateInput))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
              <button className="btn btn-secondary" onClick={() => setEditingGroup(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveBatchRate}
                disabled={savingRate}
                style={{ fontWeight: 800 }}
              >
                {savingRate ? 'Saving...' : '✓ Rate Mehfooz Karein'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Roll History Modal */}
      {activeRollModal && (
        <RollHistoryModal
          rollIdOrCode={activeRollModal}
          onClose={() => setActiveRollModal(null)}
        />
      )}
    </div>
  );
}
