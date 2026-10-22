import React, { useState, useEffect } from 'react';
import { Warehouse, Plus, Edit2, MapPin, CheckCircle, Package, ArrowRight, Layers } from 'lucide-react';
import { useGodown } from '../contexts/GodownContext';
import { useToast } from '../contexts/ToastContext';
import { api, Godown } from '../api';

interface GodownsPageProps {
  onNavigateToStock?: () => void;
}

export default function GodownsPage({ onNavigateToStock }: GodownsPageProps) {
  const { godowns, currentGodown, setCurrentGodown, refreshGodowns, createGodown } = useGodown();
  const { showToast } = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshGodowns();
  }, [refreshGodowns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Godown ka naam likhein.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createGodown(name.trim(), address.trim());
      if (res.success) {
        showToast(`Naya Godown ban gaya: ${name}`, 'success');
        setName('');
        setAddress('');
        setShowAddModal(false);
      } else {
        showToast(res.error || 'Godown banane me masla hua.', 'error');
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
      showToast('Godown ka naam likhein.', 'error');
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
        showToast(`Godown update ho gaya: ${name}`, 'success');
        await refreshGodowns();
        if (currentGodown?.id === editingGodown.id) {
          setCurrentGodown(res.data);
        }
        setEditingGodown(null);
      } else {
        showToast(res.error || 'Update me masla hua.', 'error');
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
    <div className="page-container" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Title & Action */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16, marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Warehouse size={28} color="var(--color-primary)" />
            Godown Management (Godown Sambhalein)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Tamam godowns ki fehrist. Har godown ka stock mukammal alag aur mehfooz rehta hai.
          </p>
        </div>

        <button
          onClick={() => {
            setName('');
            setAddress('');
            setShowAddModal(true);
          }}
          className="btn btn-primary"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', fontSize: 15, fontWeight: 700,
            borderRadius: 8, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}
        >
          <Plus size={18} />
          <span>+ Naya Godown Banayein</span>
        </button>
      </div>

      {/* Godowns Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {godowns.map(g => {
          const isSelected = currentGodown?.id === g.id;
          return (
            <div
              key={g.id}
              style={{
                background: '#fff', borderRadius: 12,
                border: isSelected ? '2.5px solid #2563eb' : '1px solid #cbd5e1',
                boxShadow: isSelected ? '0 10px 25px rgba(37,99,235,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                padding: 20, display: 'flex', flexDirection: 'column',
                transition: 'all 0.2s ease', position: 'relative'
              }}
            >
              {isSelected && (
                <div style={{
                  position: 'absolute', top: -11, right: 16,
                  background: '#2563eb', color: '#fff', fontSize: 11,
                  fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                  display: 'flex', alignItems: 'center', gap: 4, letterSpacing: 0.5
                }}>
                  <CheckCircle size={12} /> ACTIVE (MUNTAKHIB)
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: isSelected ? '#eff6ff' : '#f8fafc',
                  border: `1.5px solid ${isSelected ? '#93c5fd' : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isSelected ? '#2563eb' : '#64748b', flexShrink: 0
                }}>
                  <Warehouse size={24} />
                </div>

                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: '#1e293b' }}>
                    {g.name}
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} />
                    <span>{g.address || 'Address not specified'}</span>
                  </div>
                </div>
              </div>

              {/* Godown Stock Summary KPIs */}
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                margin: '8px 0 16px', border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Available Rolls</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>
                    {g.available_rolls ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Available Meters</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f766e' }}>
                    {(g.total_available_meters ?? 0).toFixed(2)} m
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                {isSelected ? (
                  <button
                    onClick={() => onNavigateToStock && onNavigateToStock()}
                    className="btn btn-outline-primary"
                    style={{ flex: 1, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <span>Stock Dekhein</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setCurrentGodown(g);
                      showToast(`Switched to ${g.name}`, 'info');
                    }}
                    className="btn btn-primary"
                    style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
                  >
                    Yeh Godown Chunein (Select)
                  </button>
                )}

                <button
                  onClick={() => startEdit(g)}
                  className="btn btn-light"
                  title="Edit Godown"
                  style={{ border: '1px solid #cbd5e1', padding: '6px 12px' }}
                >
                  <Edit2 size={15} color="#475569" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Godown */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1060, padding: 16
          }}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
              overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', color: '#fff'
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Warehouse size={20} color="#93c5fd" />
                + Naya Godown Banayein (Create Godown)
              </h3>
            </div>

            <form onSubmit={handleCreate} style={{ padding: 20 }}>
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                  Godown Ka Naam <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Godown 3 — Additional Warehouse"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Naya godown shuru me khali (zero stock) hoga. Kisi doosre godown ka stock isme nahi aayega.
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                  Pata / Location (Optional Address)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Shah Alam Market, Circular Road"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  style={{ minWidth: 100 }}
                >
                  Cancel Karein
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: 150, fontWeight: 700 }}
                >
                  {submitting ? 'Save ho raha hai...' : 'Save Godown'}
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
            background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1060, padding: 16
          }}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
              overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', color: '#fff'
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} color="#38bdf8" />
                Godown Tafseelat Edit Karein
              </h3>
            </div>

            <form onSubmit={handleUpdate} style={{ padding: 20 }}>
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                  Godown Ka Naam <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                  Pata / Location
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
              </div>

              <div className="mb-4 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="godownActiveCheck"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="godownActiveCheck" style={{ fontSize: 13, fontWeight: 500 }}>
                  Active (Yeh godown kaam ke liye khula hai)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingGodown(null)}
                  disabled={submitting}
                >
                  Cancel Karein
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ fontWeight: 700 }}
                >
                  {submitting ? 'Save ho raha hai...' : 'Update Godown'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
