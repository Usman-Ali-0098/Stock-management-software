import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  /** Small pill shown on the right of an option, e.g. a quantity badge. */
  badge?: React.ReactNode;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value: string | number | null;
  onChange: (value: string | number) => void;
  placeholder?: string;
  /** Checkmark + selected-row tint color. */
  accentColor?: string;
  maxWidth?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: number;
  id?: string;
  /** Called right after a selection is committed by pressing Enter (not by a mouse click) — use it to advance focus to the next field. */
  onEnterSelect?: () => void;
}

/**
 * A small white, keyboard-navigable dropdown — replaces native <select>, whose popup
 * renders as an unstyled dark OS menu in this Electron app.
 */
const SelectDropdown = forwardRef<HTMLButtonElement, SelectDropdownProps>(function SelectDropdown(
  { options, value, onChange, placeholder = 'Select...', accentColor = '#2563eb', maxWidth, height = 34, fontSize = 12.5, fontWeight = 700, id, onEnterSelect },
  ref
) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const selectedIdx = options.findIndex(o => o.value === value);
  const selectedOption = selectedIdx >= 0 ? options[selectedIdx] : null;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (open) setHighlightIdx(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[highlightIdx]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightIdx]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (opt) { onChange(opt.value); setOpen(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlightIdx]) {
        commit(highlightIdx);
        onEnterSelect?.();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', maxWidth }}>
      <button
        ref={ref}
        id={id}
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 7, padding: '0 10px',
          fontSize, fontWeight, color: selectedOption ? '#1e293b' : '#94a3b8', cursor: 'pointer'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={13} color="#94a3b8" style={{ flexShrink: 0, marginLeft: 6 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 1050,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto'
        }}>
          {options.map((opt, idx) => {
            const isSel = opt.value === value;
            const isHighlighted = idx === highlightIdx;
            return (
              <div
                key={opt.value}
                ref={el => { itemRefs.current[idx] = el; }}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseDown={e => { e.preventDefault(); commit(idx); }}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9',
                  background: isHighlighted ? '#f1f5f9' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: isSel ? 700 : 500, color: '#1e293b' }}>
                  {opt.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {opt.badge}
                  {isSel && <Check size={13} color={accentColor} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default SelectDropdown;
