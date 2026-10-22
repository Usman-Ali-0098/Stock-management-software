import React, { useState } from 'react';
import { Warehouse, Plus, ChevronDown, Check, MapPin, X } from 'lucide-react';
import { useGodown } from '../contexts/GodownContext';
import { useToast } from '../contexts/ToastContext';

interface GodownSelectorProps {
  onManageClick?: () => void;
}

export default function GodownSelector({ onManageClick }: GodownSelectorProps) {
  const { godowns, currentGodown, setCurrentGodown, createGodown } = useGodown();
  const { showToast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = (g: typeof godowns[0]) => {
    setCurrentGodown(g);
    setDropdownOpen(false);
    showToast(`Godown switched to: ${g.name}`, 'info');
  };

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
        setShowModal(false);
      } else {
        showToast(res.error || 'Godown banane me masla hua.', 'error');
      }
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        {/* Godown Indicator & Switcher Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f1f5f9', border: '1.5px solid #cbd5e1',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              color: '#0f172a', fontWeight: 600, fontSize: 13,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: '#2563eb', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Warehouse size={14} />
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Muntakhib Godown (Active)
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                {currentGodown ? currentGodown.name : 'Loading Godown...'}
              </div>
            </div>
            <ChevronDown size={14} color="#64748b" style={{ marginLeft: 4 }} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: 280,
                zIndex: 1000, overflow: 'hidden'
              }}
            >
              <div style={{
                padding: '10px 14px', background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0', fontSize: 12,
                fontWeight: 600, color: '#475569'
              }}>
                Godown Muntakhib Karein (Switch Godown):
              </div>

              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {godowns.map(g => {
                  const isSelected = currentGodown?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => handleSelect(g)}
                      style={{
                        width: '100%', padding: '10px 14px', border: 'none',
                        background: isSelected ? '#eff6ff' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      <div>
                        <div style={{
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: 13, color: isSelected ? '#1d4ed8' : '#1e293b'
                        }}>
                          {g.name}
                        </div>
                        {g.address && (
                          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <MapPin size={10} /> {g.address}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check size={16} color="#1d4ed8" />}
                    </button>
                  );
                })}
              </div>

              <div style={{ padding: '8px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 6 }}>
                <button
                  onClick={() => { setDropdownOpen(false); setShowModal(true); }}
                  className="btn btn-sm btn-primary"
                  style={{ flex: 1, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <Plus size={14} /> Naya Godown
                </button>
                {onManageClick && (
                  <button
                    onClick={() => { setDropdownOpen(false); onManageClick(); }}
                    className="btn btn-sm btn-outline-secondary"
                    style={{ fontSize: 12 }}
                  >
                    Sab Dekhein
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick New Godown Button */}
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-outline-primary"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontWeight: 600, fontSize: 13, padding: '7px 14px',
            borderRadius: 8
          }}
        >
          <Plus size={16} />
          <span>+ Naya Godown</span>
        </button>
      </div>

      {/* Modal: Naya Godown Banayein */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1060, padding: 16
          }}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460,
              overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', color: '#fff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Warehouse size={20} color="#93c5fd" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  + Naya Godown Banayein (Create Godown)
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: 20 }}>
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                  Godown Ka Naam (Name) <span style={{ color: '#dc2626' }}>*</span>
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
                  Naye godown ka stock bilkul alag (empty) shuru hoga.
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                  Pata / Location (Optional Address)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Circular Road, Shah Alam Market"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  style={{ minWidth: 100 }}
                >
                  Cancel Karein
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: 140, fontWeight: 700 }}
                >
                  {submitting ? 'Save ho raha hai...' : 'Save Godown'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
