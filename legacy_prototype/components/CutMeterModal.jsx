import React, { useState } from 'react';
import { Scissors, X, Check, Calculator } from 'lucide-react';
import { sound } from '../utils/audio';

export default function CutMeterModal({ product, isOpen, onClose, onAddCutMeters }) {
  const [meters, setMeters] = useState(5);

  if (!isOpen || !product) return null;

  const quickPresets = [1, 2, 3, 5, 10, 15, 20, 25];

  const handleAdd = () => {
    const qty = Number(meters);
    if (qty <= 0) return;
    sound.cutMeter();
    onAddCutMeters(product, qty);
    onClose();
  };

  const totalCost = Number(meters || 0) * product.wholesaleRateMeter;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border-2 border-sky-400 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-sky-50 border-b border-sky-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-600 text-white font-black shadow-sm">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-slate-900">Cut Loose Guz / Meters</h3>
              <p className="text-xs text-sky-800 font-bold">کھلا گز یا میٹر کٹنگ</p>
            </div>
          </div>
          <button
            onClick={() => { sound.click(); onClose(); }}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Info */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-black text-slate-900 text-base">{product.name}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium">
              <span className="text-slate-900 font-bold">{product.color}</span> • {product.looseMetersInStock}m Loose in Shop
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-semibold">Rate per Meter:</div>
            <div className="text-lg font-black font-num text-emerald-700">
              Rs. {product.wholesaleRateMeter}
            </div>
          </div>
        </div>

        {/* Input & Quick Buttons */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-2">
              Enter Meters / Guz to Cut (کتنے گز کاٹیں؟)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={meters}
                onChange={(e) => setMeters(e.target.value)}
                autoFocus
                className="w-full bg-white border-2 border-sky-400 rounded-2xl px-4 py-3 text-3xl font-black font-num text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <span className="text-lg font-black text-slate-700">Guz / m</span>
            </div>
          </div>

          {/* Quick Buttons */}
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-2">Quick Presets (ایک کلک پر منتخب کریں):</span>
            <div className="grid grid-cols-4 gap-2">
              {quickPresets.map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => {
                    sound.click();
                    setMeters(qty);
                  }}
                  className={`py-2.5 rounded-xl font-num font-black text-sm border-2 transition ${
                    Number(meters) === qty
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  +{qty} m
                </button>
              ))}
            </div>
          </div>

          {/* Rate Calculation */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-sky-600" /> Total Cost:
            </span>
            <span className="text-2xl font-black font-num text-emerald-700">
              Rs. {totalCost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => { sound.click(); onClose(); }}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-md transition"
          >
            <Check className="w-5 h-5 stroke-[3]" /> Add {meters} Guz to Bill
          </button>
        </div>
      </div>
    </div>
  );
}
