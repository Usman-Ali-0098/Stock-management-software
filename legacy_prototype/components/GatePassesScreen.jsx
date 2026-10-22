import React, { useState } from 'react';
import { 
  Receipt, 
  Search, 
  Printer, 
  Truck, 
  Layers
} from 'lucide-react';
import { sound } from '../utils/audio';

export default function GatePassesScreen({ bills, onOpenSlip }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'cash' | 'credit'

  const filteredBills = bills.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      b.gatePassNo.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      (b.truckDriver && b.truckDriver.toLowerCase().includes(q));

    if (!matchSearch) return false;
    if (filterMode === 'cash') return b.paymentMode === 'Cash';
    if (filterMode === 'credit') return b.paymentMode === 'Credit';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-[calc(100vh-125px)] bg-slate-100 text-slate-900">
      {/* Header bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Gate Passes by GP #, Customer, or City..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => { sound.click(); setFilterMode('all'); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Passes ({bills.length})
            </button>
            <button
              onClick={() => { sound.click(); setFilterMode('cash'); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterMode === 'cash' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cash Slips
            </button>
            <button
              onClick={() => { sound.click(); setFilterMode('credit'); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterMode === 'credit' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Khata Udhar
            </button>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-600">
          Total Passes: <strong className="text-slate-900 font-num text-sm">{bills.length}</strong>
        </div>
      </div>

      {/* Passes List Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-black text-[11px]">
              <tr>
                <th className="p-3.5">Gate Pass #</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Customer & City</th>
                <th className="p-3.5">Rolls / Thaan</th>
                <th className="p-3.5">Transport Dispatch</th>
                <th className="p-3.5 text-right">Bill Total</th>
                <th className="p-3.5 text-center">Payment Status</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBills.map((b) => {
                const isCredit = b.paymentMode === 'Credit';
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">
                      <span className="font-mono font-black text-sm text-emerald-700">
                        {b.gatePassNo}
                      </span>
                    </td>
                    <td className="p-3.5 font-num text-slate-600 font-medium">
                      {b.date}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-sm">{b.customerName}</div>
                      <div className="text-slate-500 text-[11px] font-medium">{b.city}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-num font-bold text-sm text-slate-900">
                        <Layers className="w-4 h-4 text-amber-600" />
                        <span>{b.totalRolls} Thaan</span>
                        {b.totalMeters > 0 && (
                          <span className="text-xs text-slate-500 font-normal">
                            ({b.totalMeters}m)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-700">
                      <div className="flex items-center gap-1.5 text-xs truncate max-w-xs">
                        <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{b.truckDriver}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-num font-black text-base text-slate-900">
                      Rs. {b.totalAmount.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-black ${
                        isCredit
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {isCredit ? '● Market Khata (ادھار)' : '✔ Cash Paid (نقد)'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => {
                          sound.click();
                          onOpenSlip(b);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Print Slip</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
