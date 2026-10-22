import React, { useState, useMemo } from 'react';
import { 
  PackagePlus, 
  Search, 
  Layers, 
  Scissors, 
  AlertTriangle, 
  Plus, 
  Minus 
} from 'lucide-react';
import { sound } from '../utils/audio';
import AddLotModal from './AddLotModal';

export default function GodownStockScreen({ products, setProducts }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'low'
  const [isAddLotOpen, setIsAddLotOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.color.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (filterType === 'low') return p.rollsInStock <= p.minAlertRolls;
      return true;
    });
  }, [products, searchQuery, filterType]);

  const handleAdjustRolls = (productId, delta) => {
    sound.click();
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const next = Math.max(0, p.rollsInStock + delta);
          return { ...p, rollsInStock: next };
        }
        return p;
      })
    );
  };

  const handleSaveNewLot = (lotData) => {
    const newProduct = {
      id: `REX-${Date.now().toString().slice(-4)}`,
      name: lotData.materialName,
      nameUrdu: 'نیا لاٹ مال',
      category: 'sofa',
      color: lotData.colorCode,
      colorHex: '#64748B',
      pattern: 'Fresh Mill Arrival',
      thickness: '1.0 mm',
      rollLengthMeters: lotData.rollLengthMeters,
      rollsInStock: lotData.rollsReceived,
      looseMetersInStock: 0,
      purchaseRateRoll: lotData.purchaseRate,
      wholesaleRateRoll: lotData.wholesaleRate,
      wholesaleRateMeter: Math.round(lotData.wholesaleRate / lotData.rollLengthMeters * 1.15),
      minAlertRolls: 5,
      sku: `LOT-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    setProducts((prev) => [newProduct, ...prev]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-[calc(100vh-125px)] bg-slate-100 text-slate-900">
      {/* Simple Top Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search stock by name or color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          <button
            onClick={() => {
              sound.click();
              setFilterType(filterType === 'low' ? 'all' : 'low');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border-2 transition ${
              filterType === 'low'
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Low Stock (&lt; 5 Rolls)</span>
          </button>
        </div>

        {/* Big Add Lot Button */}
        <button
          onClick={() => {
            sound.click();
            setIsAddLotOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-heading font-black text-sm shadow-md active:scale-95 transition"
        >
          <PackagePlus className="w-5 h-5" />
          <span>+ Add New Lot / Rolls (نیا مال گودام میں شامل کریں)</span>
        </button>
      </div>

      {/* Clean Stock Cards */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((p) => {
          const isLow = p.rollsInStock <= p.minAlertRolls;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border-2 p-4 shadow-sm flex flex-col justify-between transition ${
                isLow ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className="w-7 h-7 rounded-full border-2 border-slate-300 shrink-0 mt-0.5 shadow-sm"
                    style={{ backgroundColor: p.colorHex }}
                  />
                  <div>
                    <h3 className="font-heading font-black text-base text-slate-900 leading-tight">
                      {p.name}
                    </h3>
                    <div className="text-xs text-slate-600 font-semibold">{p.color} • {p.thickness}</div>
                    <div className="text-xs text-emerald-700 font-bold">{p.nameUrdu}</div>
                  </div>
                </div>

                {/* Stock Boxes */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* Rolls In Godown */}
                  <div className={`p-3 rounded-xl border text-center ${
                    isLow ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Rolls (تھان)</div>
                    <div className="text-3xl font-black font-num mt-1">
                      {p.rollsInStock}
                    </div>
                    <div className="text-[10px] text-slate-500">{p.rollLengthMeters}m / Thaan</div>
                  </div>

                  {/* Cut Meters */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-sky-800">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Cut Guz (کھلا)</div>
                    <div className="text-3xl font-black font-num mt-1">
                      {p.looseMetersInStock}
                    </div>
                    <div className="text-[10px] text-slate-500">Meters Ready</div>
                  </div>
                </div>

                {/* Rate Info */}
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-xs space-y-1 mb-3">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Purchase Cost:</span>
                    <span className="font-num font-bold">Rs. {p.purchaseRateRoll.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span>Wholesale Selling:</span>
                    <span className="font-num">Rs. {p.wholesaleRateRoll.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Adjust Stock Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-500">Adjust Thaan:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAdjustRolls(p.id, -1)}
                    className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold flex items-center justify-center border-2 border-slate-300 active:scale-95 shadow-xs"
                    title="Minus 1 Roll"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-num font-black text-base text-slate-900 min-w-[24px] text-center">
                    {p.rollsInStock}
                  </span>
                  <button
                    onClick={() => handleAdjustRolls(p.id, 1)}
                    className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center border border-emerald-600 active:scale-95 shadow-xs"
                    title="Plus 1 Roll"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Lot Modal */}
      <AddLotModal
        isOpen={isAddLotOpen}
        onClose={() => setIsAddLotOpen(false)}
        onAddLot={handleSaveNewLot}
        existingProducts={products}
      />
    </div>
  );
}
