import React, { useState } from 'react';
import { PackagePlus, X, Check, Layers } from 'lucide-react';
import { sound } from '../utils/audio';

export default function AddLotModal({ isOpen, onClose, onAddLot, existingProducts = [] }) {
  const [materialName, setMaterialName] = useState('Sofa Rexine Texture 0.9mm');
  const [colorCode, setColorCode] = useState('Royal Navy Blue #509');
  const [rollLengthMeters, setRollLengthMeters] = useState(50);
  const [purchaseRate, setPurchaseRate] = useState(14500);
  const [rollsReceived, setRollsReceived] = useState(10);
  const [wholesaleRate, setWholesaleRate] = useState(18200);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!materialName.trim() || Number(rollsReceived) <= 0) {
      alert('Please fill all required fields properly');
      return;
    }

    sound.cashSuccess();
    onAddLot({
      materialName: materialName.trim(),
      colorCode: colorCode.trim(),
      rollLengthMeters: Number(rollLengthMeters) || 50,
      purchaseRate: Number(purchaseRate) || 0,
      rollsReceived: Number(rollsReceived) || 1,
      wholesaleRate: Number(wholesaleRate) || Math.round(Number(purchaseRate) * 1.25),
    });
    onClose();
  };

  const totalLotCost = (Number(purchaseRate) || 0) * (Number(rollsReceived) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border-2 border-emerald-500 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white font-black shadow-sm">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-slate-900">+ Add New Roll / Godown Lot</h3>
              <p className="text-xs text-emerald-800 font-bold">گودام میں نیا تھان / لاٹ انٹری</p>
            </div>
          </div>
          <button
            onClick={() => { sound.click(); onClose(); }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Simple Fields Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              1. Material Name (مال کا نام)
            </label>
            <input
              type="text"
              required
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              list="existing-names"
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
            <datalist id="existing-names">
              {Array.from(new Set(existingProducts.map(p => p.name))).map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              2. Color / Code (رنگ / کوڈ)
            </label>
            <input
              type="text"
              required
              value={colorCode}
              onChange={(e) => setColorCode(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                3. Roll Length (Meters / گز)
              </label>
              <input
                type="number"
                min="1"
                required
                value={rollLengthMeters}
                onChange={(e) => setRollLengthMeters(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2 text-base font-black font-num text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                4. Rolls Received (تھان)
              </label>
              <input
                type="number"
                min="1"
                required
                value={rollsReceived}
                onChange={(e) => setRollsReceived(e.target.value)}
                className="w-full bg-emerald-50 border-2 border-emerald-400 rounded-xl px-3.5 py-2 text-lg font-black font-num text-emerald-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                5. Purchase Rate (خرید ریٹ)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rs.</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={purchaseRate}
                  onChange={(e) => {
                    const pr = Number(e.target.value);
                    setPurchaseRate(e.target.value);
                    setWholesaleRate(Math.round(pr * 1.25));
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-9 pr-3 py-2 text-base font-black font-num text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                Wholesale Selling Rate
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">Rs.</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={wholesaleRate}
                  onChange={(e) => setWholesaleRate(e.target.value)}
                  className="w-full bg-emerald-50 border-2 border-emerald-400 rounded-xl pl-9 pr-3 py-2 text-base font-black font-num text-emerald-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-bold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" /> Total Lot Value ({rollsReceived} Rolls):
            </span>
            <span className="text-lg font-black font-num text-slate-900">
              Rs. {totalLotCost.toLocaleString()}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { sound.click(); onClose(); }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-md transition"
            >
              <Check className="w-4 h-4" /> Save Lot to Godown
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
