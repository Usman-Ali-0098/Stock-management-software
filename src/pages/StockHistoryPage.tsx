import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  History, Search, Filter, RotateCcw, Printer,
  ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight,
  FileText, Calendar, Tag, Package, ExternalLink, X, Warehouse
} from 'lucide-react';
import { api, HistoryRow, Product, InwardTransaction, OutwardTransaction } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import RollHistoryModal from '../components/RollHistoryModal';

function fmt(m: number) {
  return m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

export default function StockHistoryPage() {
  const toast = useToast();
  const { currentGodown } = useGodown();

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'inward' | 'outward'>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [rollSearch, setRollSearch] = useState('');
  const [slipSearch, setSlipSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Individual Roll History Modal
  const [selectedRollCode, setSelectedRollCode] = useState<string | null>(null);

  // Slip modal state
  const [selectedSlip, setSelectedSlip] = useState<{
    type: 'inward' | 'outward';
    slipNumber: string;
    transactionId: number;
  } | null>(null);
  const [slipDetails, setSlipDetails] = useState<InwardTransaction | OutwardTransaction | null>(null);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Load products for dropdown
  useEffect(() => {
    api.products.list({ includeInactive: true, godownId: currentGodown?.id }).then((res) => {
      if (res.success && res.data) {
        setProducts(res.data);
      }
    });
  }, [currentGodown]);

  // Fetch history rows strictly for current godown
  const loadHistory = useCallback(async () => {
    if (!currentGodown) return;
    setLoading(true);
    const res = await api.history.list({
      godownId: currentGodown.id,
      type: typeFilter,
      productId: selectedProductId ? parseInt(selectedProductId, 10) : undefined,
      rollCode: rollSearch.trim() || undefined,
      slipNumber: slipSearch.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    if (res.success && res.data) {
      setRows(res.data);
      setCurrentPage(1);
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [currentGodown, typeFilter, selectedProductId, rollSearch, slipSearch, dateFrom, dateTo]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const resetFilters = () => {
    setTypeFilter('all');
    setSelectedProductId('');
    setRollSearch('');
    setSlipSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const openSlipModal = async (type: 'inward' | 'outward', slipNumber: string, transactionId: number) => {
    setSelectedSlip({ type, slipNumber, transactionId });
    setLoadingSlip(true);
    setSlipDetails(null);

    const res = await api.history.getBySlip({ type, slipNumber });
    if (res.success && res.data) {
      setSlipDetails(res.data);
    } else {
      toast.showToast('Slip details load nahi ho saki', 'error');
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

      if (res.success) {
        toast.showToast('Print command bheji gayi', 'success');
      } else {
        toast.showToast(res.error || 'Print nahi ho saka', 'error');
      }
    } catch (err) {
      toast.showToast(String(err), 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Title & Godown Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={28} color="var(--color-primary)" />
            Stock Movement History (Aamad o Khurch Fehrist)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Is godown me har roll ke aane aur jane ka mukammal record aur parchi reprint.
          </p>
        </div>

        {/* Selected Godown Indicator */}
        <div style={{
          background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 8,
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10
        }}>
          <Warehouse size={20} color="#2563eb" />
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              Muntakhib Godown
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              {currentGodown ? currentGodown.name : 'Loading Godown...'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1',
        padding: 18, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, alignItems: 'flex-end'
      }}>
        {/* Transaction Type */}
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>
            Event Type
          </label>
          <select
            className="form-select form-select-sm"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            style={{ fontSize: 13, height: 38 }}
          >
            <option value="all">Tamam (Inward + Outward)</option>
            <option value="inward">↓ Sirf Andar (Inward)</option>
            <option value="outward">↑ Sirf Bahar (Outward)</option>
          </select>
        </div>

        {/* Product Filter */}
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>
            Product
          </label>
          <select
            className="form-select form-select-sm"
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            style={{ fontSize: 13, height: 38 }}
          >
            <option value="">Tamam Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.product_name} ({p.product_code})</option>
            ))}
          </select>
        </div>

        {/* Roll ID Search */}
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>
            Roll ID
          </label>
          <div className="input-group input-group-sm">
            <span className="input-group-text"><Search size={14} /></span>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. A-0001"
              value={rollSearch}
              onChange={e => setRollSearch(e.target.value)}
              style={{ fontSize: 13, height: 38 }}
            />
          </div>
        </div>

        {/* Slip Number */}
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>
            Slip Number
          </label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="e.g. IN-2026..."
            value={slipSearch}
            onChange={e => setSlipSearch(e.target.value)}
            style={{ fontSize: 13, height: 38 }}
          />
        </div>

        {/* Date From */}
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>
            Date From
          </label>
          <input
            type="date"
            className="form-control form-control-sm"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 13, height: 38 }}
          />
        </div>

        {/* Date To */}
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>
            Date To
          </label>
          <input
            type="date"
            className="form-control form-control-sm"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 13, height: 38 }}
          />
        </div>

        {/* Reset Button */}
        <div>
          <button
            onClick={resetFilters}
            className="btn btn-outline-secondary btn-sm"
            style={{ width: '100%', height: 38, fontWeight: 600 }}
          >
            Filters Reset
          </button>
        </div>
      </div>

      {/* History Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
            History Records ({rows.length} total events)
            <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>
              (Roll ID par click karke mukammal roll history dekhein)
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            History load ho rahi hai...
          </div>
        ) : pagedRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
            Is filter me koi history record nahi mila.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
              <thead style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                <tr>
                  <th>Event</th>
                  <th>Date &amp; Time</th>
                  <th>Slip No</th>
                  <th>Roll ID</th>
                  <th>Product</th>
                  <th className="text-end">Length</th>
                  <th>Reference / Note</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r, idx) => {
                  const isInward = r.type === 'inward';
                  return (
                    <tr key={`${r.type}-${r.transaction_id}-${r.roll_id}-${idx}`}>
                      <td>
                        <span className={`badge ${isInward ? 'bg-success' : 'bg-warning text-white'}`} style={{ fontSize: 11, padding: '4px 8px' }}>
                          {isInward ? '↓ INWARD' : '↑ OUTWARD'}
                        </span>
                      </td>
                      <td style={{ color: '#475569', fontSize: 12 }}>{fmtDate(r.transaction_date)}</td>
                      <td>
                        <button
                          onClick={() => openSlipModal(r.type, r.slip_number, r.transaction_id)}
                          className="btn btn-link p-0 text-decoration-none"
                          style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: 13 }}
                          title="Click to view slip details and print"
                        >
                          {r.slip_number}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedRollCode(r.roll_code)}
                          className="btn btn-link p-0 text-decoration-none"
                          style={{ fontFamily: 'monospace', fontWeight: 800, color: isInward ? '#166534' : '#c2410c', fontSize: 13 }}
                          title="Click to view individual roll history"
                        >
                          {r.roll_code}
                        </button>
                      </td>
                      <td>{r.product_name} ({r.product_code})</td>
                      <td className="text-end" style={{ fontWeight: 700, color: '#0f766e', fontSize: 14 }}>
                        {r.length_meters.toFixed(2)} m
                      </td>
                      <td style={{ color: '#64748b', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.reference || '-'}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => openSlipModal(r.type, r.slip_number, r.transaction_id)}
                          className="btn btn-sm btn-outline-secondary"
                          style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Printer size={12} /> Parchi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Page {currentPage} of {totalPages} ({rows.length} total events)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={14} /> Pichla
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Agla <ChevronRight size={14} />
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
          <div className="modal-card" style={{ maxWidth: 640, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              background: selectedSlip.type === 'inward' ? 'linear-gradient(135deg, #15803d, #16a34a)' : 'linear-gradient(135deg, #c2410c, #ea580c)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  {selectedSlip.type === 'inward' ? 'Inward Stock Slip' : 'Outward Stock Slip'}
                </h3>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  Slip Number: {selectedSlip.slipNumber}
                </div>
              </div>
              <button onClick={() => setSelectedSlip(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
              {loadingSlip ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>Slip load ho rahi hai...</div>
              ) : slipDetails ? (
                <div>
                  <div style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Godown</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>&#127970; {slipDetails.godown_name || currentGodown?.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Date &amp; Time</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(slipDetails.transaction_date)}</div>
                    </div>
                  </div>

                  <table className="table table-sm table-bordered align-middle" style={{ fontSize: 13 }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th>Roll ID</th>
                        <th>Product</th>
                        <th className="text-end">Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(slipDetails.items || []).map(item => (
                        <tr key={item.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.roll_code}</td>
                          <td>{item.product_name} ({item.product_code})</td>
                          <td className="text-end" style={{ fontWeight: 700, color: '#0f766e' }}>
                            {fmt(('received_length_meters' in item ? item.received_length_meters : item.issued_length_meters) || 0)} m
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedSlip(null)}>
                Band Karein
              </button>
              <button
                className={`btn ${selectedSlip.type === 'inward' ? 'btn-primary' : 'btn-warning text-white'}`}
                onClick={handlePrintSlip}
                disabled={isPrinting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <Printer size={15} />
                {isPrinting ? 'Printing...' : 'Parchi Print Karein (Reprint)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Roll History Modal */}
      {selectedRollCode && (
        <RollHistoryModal
          rollIdOrCode={selectedRollCode}
          onClose={() => setSelectedRollCode(null)}
        />
      )}
    </div>
  );
}
