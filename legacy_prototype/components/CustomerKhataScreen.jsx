import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Coins, 
  Receipt, 
  MapPin, 
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/audio';

export default function CustomerKhataScreen({ customers, setCustomers }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [activeCustomerLedger, setActiveCustomerLedger] = useState(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // New Customer Form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustInitialBalance, setNewCustInitialBalance] = useState('');

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      c.name.toLowerCase().includes(q) || 
      c.city.toLowerCase().includes(q) || 
      c.phone.toLowerCase().includes(q);
  });

  const totalMarketUdhar = customers.reduce((acc, c) => acc + c.balanceDue, 0);

  const handleOpenReceiveCash = (cust) => {
    sound.click();
    setSelectedCustomerForPayment(cust);
    setPaymentAmount(cust.balanceDue > 0 ? cust.balanceDue : '');
  };

  const handleConfirmPayment = (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!selectedCustomerForPayment || amount <= 0) return;

    sound.cashSuccess();
    try {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
    } catch {}

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === selectedCustomerForPayment.id) {
          const newBal = Math.max(0, c.balanceDue - amount);
          const newTx = {
            id: `TX-${Date.now()}`,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            type: 'Cash Payment',
            ref: 'Counter Cash Wasooli',
            amount: -amount,
            status: 'Received'
          };
          return {
            ...c,
            balanceDue: newBal,
            history: [newTx, ...(c.history || [])]
          };
        }
        return c;
      })
    );

    setSelectedCustomerForPayment(null);
  };

  const handleAddNewCustomer = (e) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    sound.cashSuccess();
    const initBal = Number(newCustInitialBalance) || 0;
    const newCustomer = {
      id: `CUST-${Date.now().toString().slice(-4)}`,
      name: newCustName.trim(),
      contactPerson: 'Proprietor',
      phone: newCustPhone.trim() || '0300-XXXXXXX',
      city: newCustCity.trim() || 'Lahore',
      address: 'Shah Alam Market, Lahore',
      marketReputation: 'Registered Buyer',
      balanceDue: initBal,
      creditLimit: 200000,
      history: initBal > 0 ? [
        {
          id: `TX-${Date.now()}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'Opening Balance',
          ref: 'Initial Udhar',
          amount: initBal,
          status: 'Credit'
        }
      ] : []
    };

    setCustomers((prev) => [newCustomer, ...prev]);
    setIsAddCustomerOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustCity('');
    setNewCustInitialBalance('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-[calc(100vh-125px)] bg-slate-100 text-slate-900">
      {/* Top Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Customer Khata by name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-11 pr-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
            {customers.length} Registered Buyers
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-rose-700 uppercase font-bold">Total Market Udhar (مارکیٹ ادھار)</div>
            <div className="text-xl font-black font-num text-rose-700">
              Rs. {totalMarketUdhar.toLocaleString()}
            </div>
          </div>

          <button
            onClick={() => { sound.click(); setIsAddCustomerOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-heading font-black text-sm shadow-md active:scale-95 transition"
          >
            <UserPlus className="w-5 h-5" />
            <span>+ Add New Customer (نیا گاہک)</span>
          </button>
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((c) => {
          const hasBalance = c.balanceDue > 0;

          return (
            <div
              key={c.id}
              className="bg-white border-2 border-slate-200 hover:border-slate-300 hover:shadow-md rounded-2xl p-4 shadow-sm flex flex-col justify-between transition"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-heading font-black text-lg text-slate-900 leading-tight">
                      {c.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                      <span className="flex items-center gap-1 font-bold text-emerald-700">
                        <MapPin className="w-3.5 h-3.5" /> {c.city}
                      </span>
                      <span>•</span>
                      <span className="font-num text-slate-700 font-semibold">{c.phone}</span>
                    </div>
                  </div>
                </div>

                {/* GIANT RED BALANCE DUE BOX IN LIGHT MODE */}
                <div className={`p-4 rounded-2xl border-2 my-3 text-center ${
                  hasBalance
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}>
                  <div className="text-xs uppercase font-extrabold tracking-wider">
                    {hasBalance ? 'Udhar Balance Due (بقایا ادھار)' : 'Khata Clear (صاف کھاتہ)'}
                  </div>
                  <div className={`text-3xl font-black font-num mt-1 ${
                    hasBalance ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    Rs. {c.balanceDue.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 2 BIG ACTION BUTTONS */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => handleOpenReceiveCash(c)}
                  className={`py-3 rounded-xl font-heading font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-sm ${
                    hasBalance
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/20'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Coins className="w-5 h-5 text-emerald-200" />
                  <span>Receive Cash (وصولی)</span>
                </button>

                <button
                  onClick={() => { sound.click(); setActiveCustomerLedger(c); }}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-200 font-heading font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Receipt className="w-4 h-4 text-sky-700" />
                  <span>View Ledger (کھاتہ)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 1-Click Receive Cash Dialog */}
      {selectedCustomerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border-2 border-emerald-500 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white font-black shadow-sm">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-lg text-slate-900">Receive Cash (وصولی)</h3>
                  <p className="text-xs text-emerald-800 font-bold">{selectedCustomerForPayment.name}</p>
                </div>
              </div>
              <button
                onClick={() => { sound.click(); setSelectedCustomerForPayment(null); }}
                className="p-2 text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4">
              <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 flex items-center justify-between">
                <span className="text-xs text-rose-700 font-bold">Total Udhar Due:</span>
                <span className="text-2xl font-black font-num text-rose-700">
                  Rs. {selectedCustomerForPayment.balanceDue.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-2">
                  Enter Rupees Received (کتنے روپے ملے؟)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-600">Rs.</span>
                  <input
                    type="number"
                    required
                    min="1"
                    autoFocus
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-white border-2 border-emerald-500 rounded-2xl pl-14 pr-4 py-3 text-3xl font-black font-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { sound.click(); setSelectedCustomerForPayment(null); }}
                  className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-md"
                >
                  <Coins className="w-5 h-5" /> Confirm Payment (جمع کریں)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Modal */}
      {activeCustomerLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-lg text-slate-900">
                  {activeCustomerLedger.name} — Khata Statement
                </h3>
                <div className="text-xs text-slate-500 font-medium">{activeCustomerLedger.city} • {activeCustomerLedger.phone}</div>
              </div>
              <button
                onClick={() => { sound.click(); setActiveCustomerLedger(null); }}
                className="p-2 text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Type / Ref</th>
                    <th className="p-2.5 text-right">Debit / Credit</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(activeCustomerLedger.history || []).map((tx) => (
                    <tr key={tx.id}>
                      <td className="p-2.5 font-num text-slate-600 font-medium">{tx.date}</td>
                      <td className="p-2.5 font-bold text-slate-900">{tx.ref || tx.type}</td>
                      <td className={`p-2.5 text-right font-num font-bold text-sm ${
                        tx.amount > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        {tx.amount > 0 ? `+ Rs. ${tx.amount.toLocaleString()}` : `- Rs. ${Math.abs(tx.amount).toLocaleString()}`}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.amount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">Outstanding Balance:</span>
              <span className="text-2xl font-black font-num text-rose-700">
                Rs. {activeCustomerLedger.balanceDue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border-2 border-emerald-500 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white font-black shadow-sm">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-lg text-slate-900">Add Customer</h3>
                  <p className="text-xs text-emerald-800 font-bold">نیا گاہک کھاتہ</p>
                </div>
              </div>
              <button
                onClick={() => { sound.click(); setIsAddCustomerOpen(false); }}
                className="p-2 text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewCustomer} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Customer / Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Kasur Sofa Makers"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="0300-XXXXXXX"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    placeholder="e.g. Gujranwala"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-rose-700 mb-1">
                  Previous Udhar (سابقہ ادھار رقم)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCustInitialBalance}
                  onChange={(e) => setNewCustInitialBalance(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border-2 border-rose-400 rounded-xl px-3 py-2 text-base font-bold font-num text-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { sound.click(); setIsAddCustomerOpen(false); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
