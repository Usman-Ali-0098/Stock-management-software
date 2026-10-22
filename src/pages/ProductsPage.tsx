import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Package, Edit2, ChevronRight,
  CheckCircle, XCircle, X, ToggleLeft, ToggleRight, Warehouse
} from 'lucide-react';
import { api, Product, Roll } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useGodown } from '../contexts/GodownContext';
import RollHistoryModal from '../components/RollHistoryModal';

function fmt(m: number) {
  return m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB');
}

// ─── Add/Edit Product Modal ───────────────────────────────────────────────────

interface ProductModalProps {
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

function ProductModal({ product, onClose, onSaved }: ProductModalProps) {
  const toast = useToast();
  const [code, setCode] = useState(product?.product_code ?? '');
  const [name, setName] = useState(product?.product_name ?? '');
  const [desc, setDesc] = useState(product?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

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
      res = await api.products.update(product.id, { product_name: name, description: desc });
    } else {
      res = await api.products.create({ product_code: code, product_name: name, description: desc });
    }
    setSaving(false);
    if (res.success) {
      toast.success(product ? 'Product updated' : 'Product created');
      onSaved();
      onClose();
    } else {
      toast.error('Save failed', res.error);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Product Code *</label>
            <input
              className="form-control"
              placeholder="e.g. A, BlackLeather, BL-01"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={!!product}
              autoFocus
            />
            {errors.code && <div className="form-error">{errors.code}</div>}
            {product && <div className="form-text">Product code cannot be changed after creation.</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              className="form-control"
              placeholder="e.g. Black Leather, Brown Leather"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              placeholder="Optional description or notes"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> Saving...</> : (product ? 'Save Changes' : 'Create Product')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Roll List Modal ──────────────────────────────────────────────────────────

interface RollListModalProps {
  product: Product;
  godownId?: number;
  godownName?: string;
  onClose: () => void;
}

function RollListModal({ product, godownId, godownName, onClose }: RollListModalProps) {
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'fully_issued'>('all');
  const [historyRollCode, setHistoryRollCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.rolls.listByProduct({ productId: product.id, godownId, status: statusFilter });
    if (res.success && res.data) setRolls(res.data);
    setLoading(false);
  }, [product.id, godownId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2 className="modal-title">Rolls — {product.product_name}</h2>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center' }}>
                {godownName && <span style={{ fontWeight: 600, color: '#0f172a' }}>📍 {godownName}</span>}
                <span>{product.available_rolls} available</span>
                <span>{fmt(product.total_available_meters)} m total</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['all', 'available', 'fully_issued'] as const).map(s => (
                <button
                  key={s}
                  className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All Rolls' : s === 'available' ? 'Available' : 'Fully Issued'}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="loading-overlay"><div className="loading-spinner" /></div>
            ) : rolls.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <Package className="empty-state-icon" />
                <h3>No Rolls Found</h3>
                <p>No rolls match the current filter in this godown.</p>
              </div>
            ) : (
              <table className="wms-table">
                <thead>
                  <tr>
                    <th>Roll ID</th>
                    <th className="text-end">Original Length</th>
                    <th className="text-end">Remaining</th>
                    <th>Received</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rolls.map(r => (
                    <tr
                      key={r.id}
                      tabIndex={0}
                      role="button"
                      title="Enter dabayein roll history dekhne ke liye"
                      onClick={() => setHistoryRollCode(r.roll_code)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setHistoryRollCode(r.roll_code);
                        }
                      }}
                    >
                      <td className="font-mono" style={{ fontWeight: 600 }}>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                          {r.roll_code}
                        </span>
                      </td>
                      <td className="text-end">{fmt(r.original_length_meters)} m</td>
                      <td className="text-end">{fmt(r.remaining_length_meters)} m</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{fmtDate(r.received_at)}</td>
                      <td>
                        {r.status === 'available'
                          ? <span className="badge badge-success"><CheckCircle size={10} /> Available</span>
                          : <span className="badge badge-danger"><XCircle size={10} /> Fully Issued</span>}
                      </td>
                      <td>
                        <button
                          tabIndex={-1}
                          className="btn btn-sm btn-outline"
                          onClick={e => { e.stopPropagation(); setHistoryRollCode(r.roll_code); }}
                          style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
                        >
                          History <kbd style={{ fontSize: 9 }}>Enter</kbd>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
      {historyRollCode && (
        <RollHistoryModal
          rollIdOrCode={historyRollCode}
          onClose={() => setHistoryRollCode(null)}
        />
      )}
    </>
  );
}

// ─── Main Products Page ───────────────────────────────────────────────────────

export default function ProductsPage() {
  const toast = useToast();
  const { currentGodown } = useGodown();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [rollsProduct, setRollsProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.products.list({ includeInactive, godownId: currentGodown?.id });
    if (res.success && res.data) setProducts(res.data);
    else toast.error('Failed to load products', res.error);
    setLoading(false);
  }, [includeInactive, currentGodown?.id]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (p: Product) => {
    if (!p.is_active && p.available_rolls === 0) {
      // Can reactivate
    } else if (p.is_active) {
      // Deactivate
    }
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
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}>
            <Package size={28} color="var(--color-primary)" />
            Products &amp; Rolls (Products Fehrist)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Leather products sambhalein, naya item shamil karein aur individual rolls dekhein.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 8,
            padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10
          }}>
            <Warehouse size={18} color="#2563eb" />
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Godown</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {currentGodown ? currentGodown.name : 'Loading...'}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowModal(true); }}>
            <Plus size={16} /> + Naya Product Shamil Karein
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="search-wrap" style={{ flex: 1 }}>
            <Search className="search-icon" size={15} />
            <input
              className="form-control"
              placeholder="Search by code, name, or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)' }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={e => setIncludeInactive(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            Show inactive products
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-overlay"><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-state-icon" />
            <h3>{search ? 'No Products Found' : 'No Products Yet'}</h3>
            <p>{search ? 'Try a different search term.' : 'Add your first product to get started.'}</p>
            {!search && (
              <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowModal(true); }}>
                <Plus size={14} /> Add First Product
              </button>
            )}
          </div>
        ) : (
          <table className="wms-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th className="text-end">Available Rolls</th>
                <th className="text-end">Total Meters</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  role="button"
                  title="Enter dabayein rolls dekhne ke liye"
                  onClick={() => setRollsProduct(p)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setRollsProduct(p);
                    }
                  }}
                >
                  <td className="font-mono" style={{ fontWeight: 700 }}>{p.product_code}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.product_name}</div>
                    {p.description && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.description}</div>}
                  </td>
                  <td className="text-end">
                    <span className="badge badge-primary">{p.available_rolls}</span>
                  </td>
                  <td className="text-end" style={{ fontWeight: 600 }}>
                    {fmt(p.total_available_meters)} m
                  </td>
                  <td>
                    {p.is_active
                      ? <span className="badge badge-success">Active</span>
                      : <span className="badge badge-muted">Inactive</span>}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{fmtDate(p.created_at)}</td>
                  <td className="text-end">
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        tabIndex={-1}
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); setRollsProduct(p); }}
                        title="View rolls"
                        style={{ fontWeight: 700 }}
                      >
                        <ChevronRight size={14} /> Rolls <kbd style={{ fontSize: 9 }}>Enter</kbd>
                      </button>
                      <button
                        tabIndex={-1}
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); setEditProduct(p); setShowModal(true); }}
                        title="Edit product"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        tabIndex={-1}
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); handleToggleActive(p); }}
                        title={p.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {p.is_active ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <RollListModal
          product={rollsProduct}
          godownId={currentGodown?.id}
          godownName={currentGodown?.name}
          onClose={() => setRollsProduct(null)}
        />
      )}
    </div>
  );
}
