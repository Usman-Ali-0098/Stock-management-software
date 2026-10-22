import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Truck, 
  FileText, 
  Download, 
  Share2, 
  Copy,
  Receipt
} from 'lucide-react';
import { sound } from '../utils/audio';

export default function GatePassModal({ billData, isOpen, onClose }) {
  const [printFormat, setPrintFormat] = useState('a5'); // 'a5' | 'thermal'

  if (!isOpen || !billData) return null;

  const isCredit = billData.paymentMode === 'Credit';
  const gatePassNo = billData.gatePassNo || `GP-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateTime = billData.date || new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const handlePrint = () => {
    sound.click();
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border-2 border-slate-300 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Modal Top Actions Toolbar (Hidden during print) */}
        <div className="no-print bg-slate-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Format:</span>
            <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-300 text-xs">
              <button
                onClick={() => { sound.click(); setPrintFormat('a5'); }}
                className={`px-3 py-1 rounded-md font-bold transition ${
                  printFormat === 'a5' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A5 Gate Pass
              </button>
              <button
                onClick={() => { sound.click(); setPrintFormat('thermal'); }}
                className={`px-3 py-1 rounded-md font-bold transition ${
                  printFormat === 'thermal' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm Thermal Slip
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-heading font-black text-xs shadow-md active:scale-95 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Gate Pass Now</span>
            </button>
            <button
              onClick={() => { sound.click(); onClose(); }}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Slip Container */}
        <div className="p-6 bg-slate-100 max-h-[calc(85vh-80px)] overflow-y-auto">
          {/* Printable White Document Sheet */}
          <div 
            id="printable-slip"
            className={`mx-auto bg-white text-slate-900 shadow-2xl border border-slate-300 p-6 font-sans text-xs ${
              printFormat === 'thermal' ? 'max-w-[340px] text-[11px]' : 'max-w-[560px]'
            }`}
          >
            {/* Header: Shop Branding */}
            <div className="text-center border-b-2 border-slate-900 pb-3 mb-3">
              <div className="text-[11px] font-bold tracking-widest text-slate-600 uppercase">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight text-slate-950 mt-0.5">
                AL-MADINA REXINE TRADERS
              </h1>
              <div className="text-xs font-bold text-emerald-800 tracking-wide uppercase">
                المدینہ ریگزین ٹریڈرز (شاہ عالم مارکیٹ، لاہور)
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                Wholesale Artificial Leather, PVC Clear Sheets & Upholstery Roll Stockist
              </div>
              <div className="text-[10px] text-slate-500">
                42-B, Main Bazar Shah Alam Market (Shalmi), Lahore • Ph: 042-37652918 / 0300-8451920
              </div>
            </div>

            {/* Slip Meta Info & Gate Pass Banner */}
            <div className="flex items-center justify-between border border-slate-900 p-2 mb-3 bg-slate-50 rounded">
              <div>
                <div className="font-extrabold text-sm text-slate-900 font-num">
                  GATE PASS # {gatePassNo}
                </div>
                <div className="text-[10px] text-slate-600">Date: {dateTime}</div>
              </div>

              {/* Status Stamp */}
              <div className="text-right">
                <span className={`inline-block px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded border-2 ${
                  isCredit
                    ? 'border-rose-600 text-rose-700 bg-rose-50'
                    : 'border-emerald-600 text-emerald-700 bg-emerald-50'
                }`}>
                  {isCredit ? '● MARKET KHATA / ادھار' : '✔ CASH PAID / نقد وصول'}
                </span>
              </div>
            </div>

            {/* Buyer & Transport Details */}
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-3 border-b border-slate-200 pb-2">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Buyer / Customer Name:</span>
                <span className="font-bold text-slate-900 text-xs">
                  {billData.selectedCustomer ? billData.selectedCustomer.name : 'Counter Cash Buyer (نقدی گاہک)'}
                </span>
                <span className="text-slate-500 block text-[10px]">
                  {billData.selectedCustomer ? `${billData.selectedCustomer.city} • ${billData.selectedCustomer.phone}` : 'Walk-in Workshop Pickup'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Transport / Dispatch:</span>
                <span className="font-semibold text-slate-900 text-xs flex items-center justify-end gap-1">
                  <Truck className="w-3 h-3 text-slate-600" />
                  {billData.transportNote || 'Rehri / Direct Hand-Cart'}
                </span>
                <span className="text-slate-500 block text-[10px]">Gate Out Clearance Approved</span>
              </div>
            </div>

            {/* Itemized Table */}
            <table className="w-full text-left border-collapse mb-3">
              <thead>
                <tr className="border-y-2 border-slate-900 text-[10px] uppercase font-bold bg-slate-100">
                  <th className="py-1.5 px-1">Item & Quality</th>
                  <th className="py-1.5 px-1 text-center">Unit / Thaan</th>
                  <th className="py-1.5 px-1 text-right">Rate</th>
                  <th className="py-1.5 px-1 text-right">Total PKR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(billData.cart || []).map((item, idx) => {
                  const isRoll = item.unitType === 'roll';
                  const itemTotal = item.rate * item.quantity;
                  return (
                    <tr key={idx} className="text-xs">
                      <td className="py-2 px-1">
                        <div className="font-bold text-slate-950 leading-tight">{item.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.color} {isRoll ? `(${item.rollLength}m Roll)` : '(Loose Cut)'}
                        </div>
                      </td>
                      <td className="py-2 px-1 text-center font-num font-bold">
                        {isRoll ? `${item.quantity} Thaan` : `${item.quantity} Meters`}
                      </td>
                      <td className="py-2 px-1 text-right font-num text-slate-700">
                        {item.rate.toLocaleString()}
                      </td>
                      <td className="py-2 px-1 text-right font-num font-bold text-slate-950">
                        Rs. {itemTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals & Roll Counts */}
            <div className="border-t-2 border-slate-900 pt-2 mb-4 space-y-1">
              <div className="flex items-center justify-between font-bold text-xs bg-slate-100 p-1.5 rounded">
                <span className="uppercase text-[10px] text-slate-600">Total Rolls (تھان) Dispatched:</span>
                <span className="font-num text-sm text-slate-900">
                  {billData.totalRollsCount || 0} Thaan ({billData.totalMetersCount || 0} Meters)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-num font-bold">Rs. {billData.subtotal.toLocaleString()}</span>
              </div>

              {billData.discount > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-700 font-semibold">
                  <span>Wholesale Discount:</span>
                  <span className="font-num">- Rs. {billData.discount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-base font-black border-t-2 border-slate-900 pt-1.5">
                <span className="uppercase">Net Payable Amount:</span>
                <span className="font-num text-lg text-slate-950">
                  Rs. {billData.grandTotal.toLocaleString()}
                </span>
              </div>

              {/* Payment Details */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                <span className="text-slate-600">Amount Paid Now:</span>
                <span className="font-num font-bold text-emerald-700">
                  Rs. {billData.cashPaidAmount ? billData.cashPaidAmount.toLocaleString() : (isCredit ? '0' : billData.grandTotal.toLocaleString())}
                </span>
              </div>

              {isCredit && (
                <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                  <span>Balance Added to Khata (ادھار):</span>
                  <span className="font-num">Rs. {billData.grandTotal.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Gate Pass Terms & Signatures */}
            <div className="border-t border-dashed border-slate-400 pt-3 text-[10px] text-slate-600">
              <div className="italic mb-4 text-center">
                * Goods once sold and cut from roll will not be returned. Verify roll count before leaving Shalmi gate.
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="border-t border-slate-400 text-center pt-1 font-semibold text-[10px]">
                  Munshi / Shopkeeper Stamp
                </div>
                <div className="border-t border-slate-400 text-center pt-1 font-semibold text-[10px]">
                  Driver / Receiver Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
