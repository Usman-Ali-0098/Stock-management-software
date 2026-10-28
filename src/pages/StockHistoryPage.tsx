import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, Printer, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsDownUp, X, History
} from 'lucide-react';
import { api, HistoryRow, Product, InwardTransaction, OutwardTransaction } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import VariantHistoryModal from '../components/RollHistoryModal';
import ShopBanner from '../components/ShopBanner';
import SelectDropdown from '../components/SelectDropdown';
import { useEscapeClose } from '../hooks/useEscapeClose';

// Bootstrap paints an explicit white background on every <td>/<th>, so expanded-row cells
// need this set directly on each cell (inline styles are the only thing guaranteed to win).
const EXPAND_ROW_BG = '#eef1f5';

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

interface SlipGroup {
  key: string;
  type: 'inward' | 'outward';
  transactionId: number;
  slipNumber: string;
  transactionDate: string;
  reference: string;
  godownName: string;
  productsLabel: string;
  totalRolls: number;
  totalMeters: number;
  items: HistoryRow[];
}

export default function StockHistoryPage() {
  const toast = useToast();
  const { godowns } = useGodown();

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedGodownId, setSelectedGodownId] = useState<number | 'all'>('all');

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [historyVariantId, setHistoryVariantId] = useState<number | null>(null);

  const [selectedSlip, setSelectedSlip] = useState<{
    type: 'inward' | 'outward';
    slipNumber: string;
    transactionId: number;
  } | null>(null);
  const [slipDetails, setSlipDetails] = useState<InwardTransaction | OutwardTransaction | null>(null);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Disabled while the nested roll-history modal is open, so Escape closes that one first.
  useEscapeClose(() => setSelectedSlip(null), !!selectedSlip && !historyVariantId);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    api.products.list({ includeInactive: true }).then((res) => {
      if (res.success && res.data) setProducts(res.data);
    });
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const res = await api.history.list({
      godownId: selectedGodownId === 'all' ? undefined : selectedGodownId,
      productId: selectedProductId ? parseInt(selectedProductId, 10) : undefined,
    });
    setRows(res.success && res.data ? res.data : []);
    setCurrentPage(1);
    setLoading(false);
  }, [selectedGodownId, selectedProductId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Group movement rows (each already one product+size+rate batch) into one row per slip/transaction.
  const groups: SlipGroup[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q ? rows : rows.filter(r =>
      r.slip_number.toLowerCase().includes(q) ||
      r.product_name.toLowerCase().includes(q) ||
      r.product_code.toLowerCase().includes(q) ||
      (r.reference || '').toLowerCase().includes(q)
    );

    const map = new Map<string, SlipGroup>();
    for (const r of filtered) {
      const key = `${r.type}_${r.transaction_id}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          type: r.type,
          transactionId: r.transaction_id,
          slipNumber: r.slip_number,
          transactionDate: r.transaction_date,
          reference: r.reference || '',
          godownName: r.godown_name || '—',
          productsLabel: `${r.product_name} (${r.product_code})`,
          totalRolls: 0,
          totalMeters: 0,
          items: [],
        };
        map.set(key, group);
      } else if (!group.productsLabel.startsWith('Multiple') && !group.productsLabel.includes(r.product_code)) {
        group.productsLabel = 'Multiple Products';
      }
      group.totalRolls += r.quantity;
      group.totalMeters += r.is_bulk ? r.length_meters : r.length_meters * r.quantity;
      group.items.push(r);
    }

    for (const group of map.values()) {
      group.items.sort((a, b) => b.length_meters - a.length_meters);
    }

    return Array.from(map.values()).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [rows, search]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openSlipModal = async (type: 'inward' | 'outward', slipNumber: string, transactionId: number) => {
    setSelectedSlip({ type, slipNumber, transactionId });
    setLoadingSlip(true);
    setSlipDetails(null);

    const res = await api.history.getBySlip({ type, slipNumber });
    if (res.success && res.data) {
      setSlipDetails(res.data);
    } else {
      toast.showToast('Could not load slip details.', 'error');
    }
    setLoadingSlip(false);
  };

  const handlePrintSlip = async () => {
    if (!selectedSlip) return;
    setIsPrinting(true);
    try {
      const res = selectedSlip.type === 'inward'
        ? await api.print.inwardSlip(selectedSlip.transactionId)
        : await api.print.outwardSlip(selectedSlip.transactionId);

      if (res.success) toast.showToast('Sent to printer.', 'success');
      else toast.showToast(res.error || 'Print failed.', 'error');
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const pagedGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingBottom: 40 }}>
      {/* Shop name banner */}
      <ShopBanner />

      {/* Page title card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
        border: '1px solid #c7d2fe', borderRadius: 12,
        padding: '14px 18px', marginBottom: 16
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, background: '#4f46e5',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 3px 8px rgba(79,70,229,0.25)'
        }}>
          <History size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#3730a3' }}>Stock History</h1>
          <div style={{ fontSize: 11.5, color: '#4338ca' }}>Every roll received and dispatched, with reprintable slips</div>
        </div>
      </div>

      {/* Filters: Godown, Product, Search — independent of the app's active godown */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 3, display: 'block' }}>
            Godown
          </label>
          <SelectDropdown
            value={selectedGodownId}
            onChange={v => setSelectedGodownId(v === 'all' ? 'all' : Number(v))}
            options={[
              { value: 'all', label: 'All Godowns' },
              ...godowns.filter(g => g.is_active).map(g => ({ value: g.id, label: g.name })),
            ]}
          />
        </div>

        <div style={{ minWidth: 220 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 3, display: 'block' }}>
            Product
          </label>
          <SelectDropdown
            value={selectedProductId || ''}
            onChange={v => setSelectedProductId(String(v))}
            options={[
              { value: '', label: 'All Products' },
              ...products.map(p => ({ value: String(p.id), label: `${p.product_name} (${p.product_code})` })),
            ]}
          />
        </div>

        <div style={{ minWidth: 220, flex: 1, maxWidth: 320 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 3, display: 'block' }}>
            Search
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 11 }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search roll ID, slip no. or product"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ height: 34, fontSize: 12.5, paddingLeft: 28 }}
            />
          </div>
        </div>
      </div>

      {/* History table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
            Loading history...
          </div>
        ) : pagedGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
            No history matches this filter.
          </div>
        ) : (
          <>
            {expandedGroups.size > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => setExpandedGroups(new Set())}
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
                  <th style={{ padding: '6px 8px' }}>Event</th>
                  <th style={{ padding: '6px 8px' }}>Date</th>
                  <th style={{ padding: '6px 8px' }}>Slip No.</th>
                  <th style={{ padding: '6px 8px' }}>Product</th>
                  {selectedGodownId === 'all' && <th style={{ padding: '6px 8px' }}>Godown</th>}
                  <th className="text-end" style={{ padding: '6px 8px' }}>Rolls</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Meters</th>
                  <th style={{ padding: '6px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {pagedGroups.map(group => {
                  const isExpanded = expandedGroups.has(group.key);
                  const isInward = group.type === 'inward';
                  return (
                    <React.Fragment key={group.key}>
                      <tr
                        tabIndex={0}
                        role="button"
                        onClick={() => toggleGroup(group.key)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); toggleGroup(group.key); } }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ padding: '6px 8px', color: '#94a3b8' }}>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <span className={`badge ${isInward ? 'bg-success' : 'bg-warning text-white'}`} style={{ fontSize: 10, fontWeight: 700 }}>
                            {isInward ? 'Inward' : 'Outward'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', color: '#64748b', fontSize: 11 }}>{fmtDate(group.transactionDate)}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); openSlipModal(group.type, group.slipNumber, group.transactionId); }}
                            className="btn btn-link p-0 text-decoration-none"
                            style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: 12 }}
                          >
                            {group.slipNumber}
                          </button>
                        </td>
                        <td style={{ padding: '6px 8px' }}>{group.productsLabel}</td>
                        {selectedGodownId === 'all' && (
                          <td style={{ padding: '6px 8px', color: '#475569' }}>{group.godownName}</td>
                        )}
                        <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700 }}>{group.totalRolls}</td>
                        <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: '#0f766e' }}>
                          {fmt(group.totalMeters)} m
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); openSlipModal(group.type, group.slipNumber, group.transactionId); }}
                            className="btn btn-sm btn-outline-secondary"
                            style={{ fontSize: 10, padding: '1px 7px', fontWeight: 700 }}
                          >
                            <Printer size={11} />
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={selectedGodownId === 'all' ? 9 : 8} style={{
                            padding: '6px 0', background: '#eef1f5',
                            borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0'
                          }}>
                            <table className="table table-sm table-hover mb-0" style={{ fontSize: 11.5, background: 'transparent' }}>
                              <thead style={{ color: '#94a3b8', fontSize: 10 }}>
                                <tr>
                                  <th style={{ padding: '4px 20px' }}>Roll Size</th>
                                  <th style={{ padding: '4px 8px' }}>Product</th>
                                  <th className="text-end" style={{ padding: '4px 8px' }}>Qty</th>
                                  <th className="text-end" style={{ padding: '4px 8px' }}>Total Meters</th>
                                  <th className="text-end" style={{ padding: '4px 8px' }}>Rate (Rs./m)</th>
                                  <th style={{ padding: '4px 8px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map(item => (
                                  <tr key={(item.is_bulk ? 'b' : 'v') + (item.variant_id ?? item.bulk_lot_id) + '_' + item.transaction_id}>
                                    <td style={{ padding: '4px 20px', fontWeight: 700, color: '#1e40af', background: EXPAND_ROW_BG }}>
                                      {item.is_bulk ? `Bulk — ${fmt(item.length_meters)} m total` : `${fmt(item.length_meters)} m`}
                                    </td>
                                    <td style={{ padding: '4px 8px', color: '#475569', background: EXPAND_ROW_BG }}>{item.product_name} ({item.product_code})</td>
                                    <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, background: EXPAND_ROW_BG }}>{item.quantity}</td>
                                    <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, color: '#0f766e', background: EXPAND_ROW_BG }}>
                                      {fmt(item.is_bulk ? item.length_meters : item.length_meters * item.quantity)} m
                                    </td>
                                    <td className="text-end" style={{ padding: '4px 8px', fontWeight: 700, color: '#92400e', background: EXPAND_ROW_BG }}>
                                      {(item.rate_per_meter || 0) > 0 ? `Rs. ${fmtMoney(item.rate_per_meter || 0)}` : '—'}
                                    </td>
                                    <td style={{ padding: '4px 8px', background: EXPAND_ROW_BG }}>
                                      {!item.is_bulk && item.variant_id != null && (
                                        <button
                                          onClick={() => setHistoryVariantId(item.variant_id!)}
                                          className="btn btn-sm btn-outline-primary"
                                          style={{ fontSize: 10, padding: '1px 7px', fontWeight: 700 }}
                                          title="View stock movement history"
                                        >
                                          <History size={10} style={{ marginRight: 3 }} />History
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
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
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Page {currentPage} of {totalPages} &middot; {groups.length} slips
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={13} />
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slip Modal View */}
      {selectedSlip && (
        <div className="modal-backdrop" onClick={() => setSelectedSlip(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1060, padding: 16
        }}>
          <div className="modal-card" style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
              background: selectedSlip.type === 'inward' ? 'linear-gradient(135deg, #15803d, #16a34a)' : 'linear-gradient(135deg, #c2410c, #ea580c)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  {selectedSlip.type === 'inward' ? 'Inward Stock Slip' : 'Outward Stock Slip'}
                </h3>
                <div style={{ fontSize: 11.5, opacity: 0.9 }}>{selectedSlip.slipNumber}</div>
              </div>
              <button onClick={() => setSelectedSlip(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 18, maxHeight: '65vh', overflowY: 'auto' }}>
              {loadingSlip ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: 12.5 }}>Loading slip...</div>
              ) : slipDetails ? (
                <div>
                  <div style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: 10, marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Godown</div>
                      <div style={{ fontWeight: 700 }}>{slipDetails.godown_name || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Date &amp; Time</div>
                      <div style={{ fontWeight: 600 }}>{fmtDate(slipDetails.transaction_date)}</div>
                    </div>
                  </div>

                  <table className="table table-sm table-bordered align-middle" style={{ fontSize: 12.5 }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th>Product</th>
                        <th className="text-end">Roll Size</th>
                        <th className="text-end">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(slipDetails.lines || []).map(line => (
                        <tr key={line.id}>
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
              ) : null}
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedSlip(null)}>
                Close
              </button>
              <button
                className={`btn btn-sm ${selectedSlip.type === 'inward' ? 'btn-primary' : 'btn-warning text-white'}`}
                onClick={handlePrintSlip}
                disabled={isPrinting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <Printer size={13} />
                {isPrinting ? 'Printing...' : 'Reprint Slip'}
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
    </div>
  );
}
