import React, { useState, useEffect, useMemo } from 'react';
import { Warehouse, Plus, Edit2, MapPin, Search, X, CheckCircle } from 'lucide-react';
import { useGodown } from '../contexts/GodownContext';
import { useToast } from '../contexts/ToastContext';
import { api, Godown } from '../api';
import ShopBanner from '../components/ShopBanner';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface GodownsPageProps {
  onNavigateToStock?: () => void;
}

function fmt(m: number) {
  return m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function GodownsPage({ onNavigateToStock }: GodownsPageProps) {
  const { currentGodown, setCurrentGodown, refreshGodowns, createGodown } = useGodown();
  const { showToast } = useToast();

  // This page keeps its own list (including inactive godowns) — the shared
  // GodownContext only ever loads active ones, since it drives every
  // godown-picker in the app.
  const [allGodowns, setAllGodowns] = useState<Godown[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEscapeClose(() => { setShowAddModal(false); setEditingGodown(null); }, (showAddModal || !!editingGodown) && !submitting);

  const loadAllGodowns = async () => {
    const res = await api.godowns.list(true);
    if (res.success && res.data) setAllGodowns(res.data);
  };

  useEffect(() => { loadAllGodowns(); }, []);

  const reload = async () => {
    await Promise.all([loadAllGodowns(), refreshGodowns()]);
  };

  const handleReactivate = async (g: Godown) => {
    const res = await api.godowns.update(g.id, { is_active: true });
    if (res.success) {
      showToast(`Godown reactivated: ${g.name}`, 'success');
      await reload();
    } else {
      showToast(res.error || 'Could not reactivate godown.', 'error');
    }
  };

  const filteredGodowns = useMemo(() => {
    let list = showInactive ? allGodowns : allGodowns.filter(g => g.is_active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q) || (g.address || '').toLowerCase().includes(q));
    }
    return list;
  }, [allGodowns, showInactive, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Enter a godown name.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createGodown(name.trim(), address.trim());
      if (res.success) {
        showToast(`Godown created: ${name}`, 'success');
        setName(''); setAddress(''); setShowAddModal(false);
        await loadAllGodowns();
      } else {
        showToast(res.error || 'Could not create godown.', 'error');
      }
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGodown) return;
    if (!name.trim()) {
      showToast('Enter a godown name.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.godowns.update(editingGodown.id, {
        name: name.trim(),
        address: address.trim(),
        is_active: isActive,
      });
      if (res.success && res.data) {
        showToast(`Godown updated: ${name}`, 'success');
        await reload();
        if (currentGodown?.id === editingGodown.id && res.data.is_active) setCurrentGodown(res.data);
        setEditingGodown(null);
      } else {
        showToast(res.error || 'Could not update godown.', 'error');
      }
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (g: Godown) => {
    setEditingGodown(g);
    setName(g.name);
    setAddress(g.address || '');
    setIsActive(g.is_active);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingBottom: 40 }}>
      <ShopBanner />

      {/* Header card */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
        border: '1px solid #a5f3fc', borderRadius: 12,
        padding: '14px 18px', marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: '#0891b2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 3px 8px rgba(8,145,178,0.25)'
          }}>
            <Warehouse size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#155e75' }}>Godowns</h1>
            <div style={{ fontSize: 11.5, color: '#0e7490' }}>Manage your warehouse locations — each keeps its own isolated stock</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setName(''); setAddress(''); setShowAddModal(true); }}
          className="btn btn-sm"
          style={{
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            background: '#fff', border: '1px solid #a5f3fc', color: '#155e75'
          }}
        >
          <Plus size={14} /> New Godown
        </button>
      </div>

      {/* Search + show-inactive toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 320, flex: 1, minWidth: 220 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 11 }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or address"
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
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            style={{ width: 13, height: 13 }}
          />
          Show inactive godowns
        </label>
      </div>

      {/* Godowns table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 12 }}>
        {filteredGodowns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 12.5 }}>
            {search ? 'No godowns match this search.' : 'No godowns yet.'}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12, borderCollapse: 'separate', borderSpacing: '0 1px' }}>
              <thead style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '6px 8px' }}>Name</th>
                  <th style={{ padding: '6px 8px' }}>Address</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Rolls</th>
                  <th className="text-end" style={{ padding: '6px 8px' }}>Meters</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                  <th style={{ padding: '6px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredGodowns.map(g => {
                  const isSelected = currentGodown?.id === g.id;
                  return (
                    <tr key={g.id}>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong>{g.name}</strong>
                          {isSelected && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 9.5, fontWeight: 700, color: '#0e7490',
                              background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: '1px 7px'
                            }}>
                              <CheckCircle size={9} /> Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>
                        {g.address ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={11} /> {g.address}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700 }}>{g.available_rolls ?? 0}</td>
                      <td className="text-end" style={{ padding: '6px 8px', fontWeight: 700, color: '#0f766e' }}>
                        {fmt(g.total_available_meters ?? 0)} m
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        {g.is_active
                          ? <span className="badge bg-success" style={{ fontSize: 10, fontWeight: 700 }}>Active</span>
                          : <span className="badge bg-secondary" style={{ fontSize: 10, fontWeight: 700 }}>Inactive</span>}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {!g.is_active ? (
                            <button
                              onClick={() => handleReactivate(g)}
                              className="btn btn-sm btn-outline-success"
                              style={{ fontSize: 10.5, padding: '2px 9px', fontWeight: 700 }}
                            >
                              Reactivate
                            </button>
                          ) : isSelected ? (
                            <button
                              onClick={() => onNavigateToStock?.()}
                              className="btn btn-sm btn-outline-primary"
                              style={{ fontSize: 10.5, padding: '2px 9px', fontWeight: 700 }}
                            >
                              View Stock
                            </button>
                          ) : (
                            <button
                              onClick={() => { setCurrentGodown(g); showToast(`Switched to ${g.name}`, 'info'); }}
                              className="btn btn-sm btn-outline-secondary"
                              style={{ fontSize: 10.5, padding: '2px 9px', fontWeight: 700 }}
                            >
                              Select
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(g)}
                            className="btn btn-sm btn-ghost"
                            title="Edit"
                            style={{ padding: '2px 7px' }}
                          >
                            <Edit2 size={12} color="#475569" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Godown */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1060, padding: 16
          }}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, overflow: 'hidden' }}
          >
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>New Godown</h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-sm p-0">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: 18 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                  Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Godown 3 — Additional Warehouse"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  style={{ height: 34, fontSize: 12.5 }}
                />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                  Starts empty — no stock is shared between godowns.
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                  Address (optional)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Shah Alam Market, Circular Road"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ height: 34, fontSize: 12.5 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={submitting} style={{ fontWeight: 700 }}>
                  {submitting ? 'Saving...' : 'Save Godown'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Godown */}
      {editingGodown && (
        <div
          className="modal-backdrop"
          onClick={() => setEditingGodown(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1060, padding: 16
          }}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, overflow: 'hidden' }}
          >
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#1e293b' }}>Edit Godown</h3>
              <button onClick={() => setEditingGodown(null)} className="btn btn-ghost btn-sm p-0">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ padding: 18 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                  Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{ height: 34, fontSize: 12.5 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>
                  Address
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ height: 34, fontSize: 12.5 }}
                />
              </div>

              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="godownActiveCheck"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  style={{ width: 14, height: 14 }}
                />
                <label htmlFor="godownActiveCheck" style={{ fontSize: 12, color: '#475569' }}>
                  Active (open for use)
                </label>
              </div>
              {!isActive && (
                <div style={{ fontSize: 10.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 16 }}>
                  Turning this off hides the godown from every stock screen in the app. Nothing is deleted — tick "Show inactive godowns" on this page anytime to find and reactivate it.
                </div>
              )}
              {isActive && <div style={{ marginBottom: 16 }} />}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditingGodown(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={submitting} style={{ fontWeight: 700 }}>
                  {submitting ? 'Saving...' : 'Update Godown'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
