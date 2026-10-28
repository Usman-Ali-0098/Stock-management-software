import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Search, Package, Edit2,
  ToggleLeft, ToggleRight, X
} from 'lucide-react';
import { api, Product, Variant, BulkLot } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import VariantHistoryModal from '../components/RollHistoryModal';
import BulkLotHistoryModal from '../components/BulkLotHistoryModal';
import ShopBanner from '../components/ShopBanner';
import SelectDropdown from '../components/SelectDropdown';
import { useEscapeClose } from '../hooks/useEscapeClose';

function fmt(m: number) {
  return m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB');
}

// ─── Add/Edit Product Modal (also used by Incoming Stock) ───────────────────

interface ProductModalProps {
  product?: Product | null;
  onClose: () => void;
  onSaved: (product?: Product) => void;
}

export function ProductModal({ product, onClose, onSaved }: ProductModalProps) {
  const toast = useToast();
  const [code, setCode] = useState(product?.product_code ?? '');
  const [name, setName] = useState(product?.product_name ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  useEscapeClose(onClose, !saving);

  // Enter-to-advance: code -> name (pre-filled with the code, since they're usually the
  // same) -> Create button, so a new product can be entered without touching the mouse.
  const nameInputRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const validate = () => {
    const e: typeof errors = {};
    if (!code.trim()) e.code = 'Product code is required.';
    if (!name.trim()) e.name = 'Product name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    let res;
    if (product) {
      // Description no longer has a field here — preserve whatever the product already had.
      res = await api.products.update(product.id, { product_name: name, description: product.description });
    } else {
      res = await api.products.create({ product_code: code, product_name: name, description: '' });
    }
    setSaving(false);
    if (res.success) {
      toast.success(product ? 'Product updated' : 'Product created');
      onSaved(res.data);
      onClose();
    } else {
      toast.error('Save failed', res.error);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1070, padding: 16
    }}>
      <div className="modal-card" style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>
            {product ? 'Edit Product' : 'Add New Product'}
          </h3>
          <button className="btn btn-ghost btn-sm p-0" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
              Product Code *
            </label>
            <input
              className="form-control"
              placeholder="e.g. A, BlackLeather, BL-01"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!product) setName(code);
                  nameInputRef.current?.focus();
                }
              }}
              disabled={!!product}
              autoFocus
              style={{ height: 34, fontSize: 12.5 }}
            />
            {errors.code && <div style={{ color: '#dc2626', fontSize: 10.5, marginTop: 3 }}>{errors.code}</div>}
            {product && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>Product code cannot be changed after creation.</div>}
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
              Product Name *
            </label>
            <input
              ref={nameInputRef}
              className="form-control"
              placeholder="e.g. Black Leather, Brown Leather"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createButtonRef.current?.focus(); } }}
              style={{ height: 34, fontSize: 12.5 }}
            />
            {errors.name && <div style={{ color: '#dc2626', fontSize: 10.5, marginTop: 3 }}>{errors.name}</div>}
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
          <button className="btn btn-sm btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button ref={createButtonRef} className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving} style={{ fontWeight: 700 }}>
            {saving ? 'Saving...' : (product ? 'Save Changes' : 'Create Product')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Variant List Modal (one row per roll size / rate / godown batch) ───────

interface VariantListModalProps {
  product: Product;
  godownId?: number;
  godownName?: string;
  onClose: () => void;
}

function VariantListModal({ product, godownId, godownName, onClose }: VariantListModalProps) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [bulkLots, setBulkLots] = useState<BulkLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showZero, setShowZero] = useState(false);
  const [historyVariantId, setHistoryVariantId] = useState<number | null>(null);
  const [historyBulkLotId, setHistoryBulkLotId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [variantsRes, bulkRes] = await Promise.all([
      api.variants.listByProduct({ productId: product.id, godownId, includeZero: showZero }),
      api.bulk.listByProduct({ productId: product.id, godownId, includeZero: showZero }),
    ]);
    if (variantsRes.success && variantsRes.data) setVariants(variantsRes.data);
    if (bulkRes.success && bulkRes.data) setBulkLots(bulkRes.data);
    setLoading(false);
  }, [product.id, godownId, showZero]);

  useEffect(() => { load(); }, [load]);

  // Disabled while a nested history modal is open, so Escape closes that one first.
  useEscapeClose(onClose, !historyVariantId && !historyBulkLotId);

  const showGodownColumn = !godownId;

  const sortedVariants = useMemo(
    () => [...variants].sort((a, b) => b.length_meters - a.length_meters),
    [variants]
  );

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1060, padding: 16
      }}>
        <div className="modal-card" style={{ maxWidth: 660, width: '100%', maxHeight: '80vh', background: '#fff', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                Stock — {product.product_name}
              </h3>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>{godownName || 'All Godowns'}</span>
                <span>{product.available_rolls} available &middot; {fmt(product.total_available_meters)} m</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm p-0" onClick={onClose}><X size={16} /></button>
          </div>

          <div style={{ padding: '10px 18px 0', flexShrink: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11.5, color: '#475569' }}>
              <input
                type="checkbox"
                checked={showZero}
                onChange={e => setShowZero(e.target.checked)}
                style={{ width: 13, height: 13 }}
              />
              Show exhausted sizes (0 in stock)
            </label>
          </div>

          <div style={{ padding: 18, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12.5 }}>Loading...</div>
            ) : (
              <>
                {bulkLots.length > 0 && (
                  <div style={{ marginBottom: sortedVariants.length > 0 ? 18 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 7, fontWeight: 800, color: '#fff', background: '#111827',
                        borderRadius: 3, padding: '1px 4px', letterSpacing: 0.2, lineHeight: 1.4
                      }}>
                        BULK
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Lot Details
                      </span>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto' }}>
                      <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12, borderCollapse: 'separate', borderSpacing: '0 1px', minWidth: 480 }}>
                        <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
                          <tr>
                            <th className="text-end" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Meters Left</th>
                            <th className="text-end" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Rolls Left</th>
                            <th className="text-end" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Rate (Rs./m)</th>
                            {showGodownColumn && <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Godown</th>}
                            <th style={{ padding: '6px 8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkLots.map(lot => (
                            <tr key={lot.id}>
                              <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: lot.quantity === 0 ? '#94a3b8' : '#0f766e', whiteSpace: 'nowrap' }}>
                                {fmt(lot.total_length_meters)} m
                              </td>
                              <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: lot.quantity === 0 ? '#94a3b8' : undefined, whiteSpace: 'nowrap' }}>
                                {lot.quantity}
                              </td>
                              <td className="text-end" style={{ padding: '6px 8px', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {lot.rate_per_meter > 0 ? `Rs. ${lot.rate_per_meter}` : '—'}
                              </td>
                              {showGodownColumn && (
                                <td style={{ padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{lot.godown_name}</td>
                              )}
                              <td className="text-end" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                                <button
                                  onClick={() => setHistoryBulkLotId(lot.id)}
                                  className="btn btn-sm btn-outline-primary"
                                  style={{ fontSize: 10, padding: '1px 7px', fontWeight: 700 }}
                                >
                                  History
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {sortedVariants.length > 0 && (
                  <div>
                    {bulkLots.length > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                        Single Roll Sizes
                      </div>
                    )}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto' }}>
                      <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12, borderCollapse: 'separate', borderSpacing: '0 1px', minWidth: 480 }}>
                        <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
                          <tr>
                            <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Roll Size</th>
                            <th className="text-end" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Qty</th>
                            <th className="text-end" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Rate (Rs./m)</th>
                            {showGodownColumn && <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Godown</th>}
                            <th style={{ padding: '6px 8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedVariants.map(variant => (
                            <tr key={variant.id}>
                              <td style={{ padding: '6px 8px', fontWeight: 700, color: '#1e40af', whiteSpace: 'nowrap' }}>
                                {fmt(variant.length_meters)} m
                              </td>
                              <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: variant.quantity === 0 ? '#94a3b8' : undefined, whiteSpace: 'nowrap' }}>
                                {variant.quantity}
                              </td>
                              <td className="text-end" style={{ padding: '6px 8px', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {variant.rate_per_meter > 0 ? `Rs. ${variant.rate_per_meter}` : '—'}
                              </td>
                              {showGodownColumn && (
                                <td style={{ padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{variant.godown_name}</td>
                              )}
                              <td className="text-end" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                                <button
                                  onClick={() => setHistoryVariantId(variant.id)}
                                  className="btn btn-sm btn-outline-primary"
                                  style={{ fontSize: 10, padding: '1px 7px', fontWeight: 700 }}
                                >
                                  History
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {bulkLots.length === 0 && sortedVariants.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12.5 }}>No stock matches this filter.</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {historyBulkLotId && (
        <BulkLotHistoryModal
          bulkLotId={historyBulkLotId}
          onClose={() => setHistoryBulkLotId(null)}
        />
      )}
      {historyVariantId && (
        <VariantHistoryModal
          variantId={historyVariantId}
          onClose={() => setHistoryVariantId(null)}
        />
      )}
    </>
  );
}

// ─── Main Products Page ───────────────────────────────────────────────────────

export default function ProductsPage() {
  const toast = useToast();
  const { godowns } = useGodown();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedGodownId, setSelectedGodownId] = useState<number | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [rollsProduct, setRollsProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.products.list({
      includeInactive,
      godownId: selectedGodownId === 'all' ? undefined : selectedGodownId,
    });
    if (res.success && res.data) setProducts(res.data);
    else toast.error('Failed to load products', res.error);
    setLoading(false);
  }, [includeInactive, selectedGodownId]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (p: Product) => {
    const res = await api.products.update(p.id, { is_active: !p.is_active });
    if (res.success) {
      toast.success(p.is_active ? 'Product deactivated' : 'Product activated');
      load();
    } else {
      toast.error('Update failed', res.error);
    }
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (
      p.product_code.toLowerCase().includes(q) ||
      p.product_name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingBottom: 40 }}>
      <ShopBanner />

      {/* Header card */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
        border: '1px solid #ddd6fe', borderRadius: 12,
        padding: '14px 18px', marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: '#7c3aed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 3px 8px rgba(124,58,237,0.25)'
          }}>
            <Package size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#5b21b6' }}>Products &amp; Rolls</h1>
            <div style={{ fontSize: 11.5, color: '#6d28d9' }}>Manage your leather products and view their rolls</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setEditProduct(null); setShowModal(true); }}
          className="btn btn-sm"
          style={{
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            background: '#fff', border: '1px solid #ddd6fe', color: '#5b21b6'
          }}
        >
          <Plus size={14} /> New Product
        </button>
      </div>

      {/* Godown, search, show-inactive toggle — independent of the app's active godown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <SelectDropdown
            value={selectedGodownId}
            onChange={v => setSelectedGodownId(v === 'all' ? 'all' : Number(v))}
            options={[
              { value: 'all', label: 'All Godowns' },
              ...godowns.filter(g => g.is_active).map(g => ({ value: g.id, label: g.name })),
            ]}
          />
        </div>
        <div style={{ maxWidth: 320, flex: 1, minWidth: 220 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 11 }} />
            <input
              className="form-control"
              placeholder="Search by code, name, or description"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ height: 34, fontSize: 12.5, paddingLeft: 28 }}
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#475569' }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={e => setIncludeInactive(e.target.checked)}
            style={{ width: 13, height: 13 }}
          />
          Show inactive products
        </label>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
            Loading products...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
            {search ? 'No products match this search.' : 'No products yet.'}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12, borderCollapse: 'separate', borderSpacing: '0 1px' }}>
              <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '6px 8px' }}>Code</th>
                  <th style={{ padding: '6px 8px' }}>Name</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Rolls</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Meters</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                  <th style={{ padding: '6px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setRollsProduct(p)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setRollsProduct(p); } }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#1e3a8a' }}>
                      {p.product_code}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong>{p.product_name}</strong>
                        {p.has_bulk && (
                          <span style={{
                            fontSize: 7, fontWeight: 800, color: '#fff', background: '#111827',
                            borderRadius: 3, padding: '1px 4px', letterSpacing: 0.2, lineHeight: 1.4, flexShrink: 0
                          }}>
                            BULK
                          </span>
                        )}
                      </div>
                      {p.description && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{p.description}</div>}
                    </td>
                    <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700 }}>{p.available_rolls}</td>
                    <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: '#0f766e' }}>
                      {fmt(p.total_available_meters)} m
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {p.is_active
                        ? <span className="badge bg-success" style={{ fontSize: 10, fontWeight: 700 }}>Active</span>
                        : <span className="badge bg-secondary" style={{ fontSize: 10, fontWeight: 700 }}>Inactive</span>}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          tabIndex={-1}
                          onClick={e => { e.stopPropagation(); setEditProduct(p); setShowModal(true); }}
                          className="btn btn-sm btn-ghost"
                          title="Edit"
                          style={{ padding: '2px 7px' }}
                        >
                          <Edit2 size={12} color="#475569" />
                        </button>
                        <button
                          tabIndex={-1}
                          onClick={e => { e.stopPropagation(); handleToggleActive(p); }}
                          className="btn btn-sm btn-ghost"
                          title={p.is_active ? 'Deactivate' : 'Activate'}
                          style={{ padding: '2px 7px' }}
                        >
                          {p.is_active ? <ToggleRight size={14} color="#16a34a" /> : <ToggleLeft size={14} color="#94a3b8" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
      {rollsProduct && (
        <VariantListModal
          product={rollsProduct}
          godownId={selectedGodownId === 'all' ? undefined : selectedGodownId}
          godownName={selectedGodownId === 'all' ? undefined : godowns.find(g => g.id === selectedGodownId)?.name}
          onClose={() => setRollsProduct(null)}
        />
      )}
    </div>
  );
}
