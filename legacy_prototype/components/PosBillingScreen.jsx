import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Layers, 
  Scissors, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  RotateCcw, 
  Coins, 
  CreditCard, 
  User, 
  AlertCircle
} from 'lucide-react';
import { sound } from '../utils/audio';
import CutMeterModal from './CutMeterModal';

export default function PosBillingScreen({ 
  products, 
  categories, 
  customers, 
  cart, 
  setCart, 
  selectedCustomer, 
  setSelectedCustomer, 
  paymentMode, 
  setPaymentMode, 
  discount, 
  setDiscount, 
  onPrintBill, 
  onClearBill 
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cuttingModalProduct, setCuttingModalProduct] = useState(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.color.toLowerCase().includes(q) ||
        (p.nameUrdu && p.nameUrdu.includes(q));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Totals
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.rate * item.quantity), 0);
  }, [cart]);

  const totalDiscount = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal - totalDiscount);

  const totalRollsCount = cart
    .filter((item) => item.unitType === 'roll')
    .reduce((acc, item) => acc + item.quantity, 0);

  const totalMetersCount = cart
    .reduce((acc, item) => {
      if (item.unitType === 'roll') {
        return acc + (item.quantity * item.rollLength);
      }
      return acc + item.quantity;
    }, 0);

  // Add 1 Full Roll (Thaan)
  const handleAddFullRoll = (product) => {
    sound.addRoll();
    setCart((prev) => {
      const existing = prev.findIndex(
        (i) => i.productId === product.id && i.unitType === 'roll'
      );
      if (existing > -1) {
        const next = [...prev];
        next[existing].quantity += 1;
        return next;
      }
      return [
        ...prev,
        {
          id: `CART-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId: product.id,
          name: product.name,
          color: product.color,
          colorHex: product.colorHex,
          unitType: 'roll',
          rollLength: product.rollLengthMeters,
          quantity: 1,
          rate: product.wholesaleRateRoll,
          ratePerMeter: product.wholesaleRateMeter,
          ratePerRoll: product.wholesaleRateRoll,
        }
      ];
    });
  };

  // Add Cut Meters from Modal
  const handleAddCutMeters = (product, meters) => {
    setCart((prev) => {
      const existing = prev.findIndex(
        (i) => i.productId === product.id && i.unitType === 'meter'
      );
      if (existing > -1) {
        const next = [...prev];
        next[existing].quantity += meters;
        return next;
      }
      return [
        ...prev,
        {
          id: `CART-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId: product.id,
          name: product.name,
          color: product.color,
          colorHex: product.colorHex,
          unitType: 'meter',
          rollLength: product.rollLengthMeters,
          quantity: meters,
          rate: product.wholesaleRateMeter,
          ratePerMeter: product.wholesaleRateMeter,
          ratePerRoll: product.wholesaleRateRoll,
        }
      ];
    });
  };

  // Adjust item quantity
  const handleUpdateQuantity = (cartItemId, delta) => {
    sound.click();
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Toggle unit on item
  const handleToggleUnit = (cartItemId) => {
    sound.click();
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === cartItemId) {
          if (item.unitType === 'roll') {
            return {
              ...item,
              unitType: 'meter',
              quantity: item.rollLength || 50,
              rate: item.ratePerMeter,
            };
          } else {
            return {
              ...item,
              unitType: 'roll',
              quantity: 1,
              rate: item.ratePerRoll,
            };
          }
        }
        return item;
      })
    );
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Bill is empty! Please add rolls or meters first.');
      return;
    }
    if (paymentMode === 'Credit') {
      sound.creditAlert();
    } else {
      sound.cashSuccess();
    }
    onPrintBill({
      cart,
      subtotal,
      discount: totalDiscount,
      grandTotal,
      paymentMode,
      selectedCustomer,
      transportNote: 'Direct Hand-Cart / Shalmi Bazar',
      totalRollsCount,
      totalMetersCount,
    });
  };

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-125px)] bg-slate-100 text-slate-900">
      {/* LEFT: Product Grid in Light Mode */}
      <div className="flex-1 flex flex-col min-w-0 border-r-2 border-slate-200 bg-slate-50/70">
        {/* Top Search & Filter Bar */}
        <div className="p-3 bg-white border-b border-slate-200 space-y-2 shadow-xs">
          {/* Big Search Box */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Rexine (e.g. Sofa, Black, PVC, Motorbike)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-11 pr-4 py-2.5 text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          {/* Quick Category Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  sound.click();
                  setSelectedCategory(cat.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {cat.name} ({cat.nameUrdu})
              </button>
            ))}
          </div>
        </div>

        {/* Clean, Bright Product Cards */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isLow = p.rollsInStock <= p.minAlertRolls;

            return (
              <div
                key={p.id}
                className="bg-white border-2 border-slate-200 hover:border-slate-300 hover:shadow-md rounded-2xl p-4 flex flex-col justify-between transition"
              >
                {/* Product Header */}
                <div>
                  <div className="flex items-start gap-3 mb-2">
                    <span
                      className="w-7 h-7 rounded-full border-2 border-slate-300 shrink-0 mt-0.5 shadow-sm"
                      style={{ backgroundColor: p.colorHex }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-black text-base text-slate-900 leading-tight">
                        {p.name}
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">
                        <span className="text-slate-800 font-bold">{p.color}</span> • {p.thickness}
                      </div>
                      <div className="text-xs font-bold text-emerald-700 mt-0.5">
                        {p.nameUrdu}
                      </div>
                    </div>
                  </div>

                  {/* Stock & Rate Box */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 mb-4">
                    {/* Stock available */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Available Stock:</span>
                      <span className={`text-base font-black font-num px-2 py-0.5 rounded ${
                        isLow ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'text-emerald-700'
                      }`}>
                        {p.rollsInStock} Rolls (تھان)
                      </span>
                    </div>

                    {/* Loose stock */}
                    <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200">
                      <span>Cut Stock:</span>
                      <span className="font-bold text-sky-700 font-num">{p.looseMetersInStock} Meters (گز)</span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                      <span className="text-xs font-bold text-slate-700">Roll Price:</span>
                      <span className="text-base font-black font-num text-slate-900">
                        Rs. {p.wholesaleRateRoll.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2 HUGE ACTION BUTTONS */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleAddFullRoll(p)}
                    className="py-3 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-heading font-black text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                  >
                    <Plus className="w-5 h-5 stroke-[3]" />
                    <span>+1 Roll (تھان)</span>
                  </button>

                  <button
                    onClick={() => {
                      sound.click();
                      setCuttingModalProduct(p);
                    }}
                    className="py-3 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-heading font-black text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>Cut Guz (گز)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Clear Running Bill Panel in Light Mode */}
      <div className="w-[450px] flex flex-col bg-white border-l-2 border-slate-300 shrink-0 shadow-lg">
        {/* Customer Selector */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-600" /> Select Customer (گاہک کا نام):
            </span>
            {selectedCustomer && selectedCustomer.balanceDue > 0 && (
              <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                Due: Rs. {selectedCustomer.balanceDue.toLocaleString()}
              </span>
            )}
          </div>

          <select
            value={selectedCustomer ? selectedCustomer.id : 'walk-in'}
            onChange={(e) => {
              sound.click();
              const id = e.target.value;
              if (id === 'walk-in') {
                setSelectedCustomer(null);
              } else {
                const found = customers.find((c) => c.id === id);
                setSelectedCustomer(found || null);
              }
            }}
            className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
          >
            <option value="walk-in">⚡ Cash Counter / Walk-in Buyer (نقدی گاہک)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.city}) - Udhar Due: Rs. {c.balanceDue.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {/* Running Bill Header */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
          <span>Current Bill ({cart.length} items)</span>
          {cart.length > 0 && (
            <button
              onClick={() => { sound.click(); onClearBill(); }}
              className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>

        {/* Bill Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <Layers className="w-12 h-12 stroke-[1.5] text-slate-300" />
              <div className="text-base font-bold text-slate-600">No Items in Bill</div>
              <p className="text-xs text-slate-500 max-w-xs">
                Click <strong>+1 Roll</strong> on any item to add full Thaan, or click <strong>Cut Guz</strong> to cut loose meters.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemTotal = item.rate * item.quantity;
              const isRoll = item.unitType === 'roll';

              return (
                <div
                  key={item.id}
                  className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 space-y-2.5 shadow-xs"
                >
                  {/* Item Title */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-heading font-black text-sm text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500 font-medium">{item.color}</div>
                    </div>
                    <button
                      onClick={() => {
                        sound.click();
                        setCart((prev) => prev.filter((i) => i.id !== item.id));
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    {/* Unit Switch Button */}
                    <button
                      onClick={() => handleToggleUnit(item.id)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border transition ${
                        isRoll
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-sky-100 text-sky-800 border-sky-300'
                      }`}
                    >
                      {isRoll ? '📦 Full Roll' : '✂️ Loose Guz'}
                    </button>

                    {/* Big +/- Quantity Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-black flex items-center justify-center border-2 border-slate-300 active:scale-95 shadow-xs"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <span className="font-num font-black text-xl text-slate-900 min-w-[32px] text-center">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-black flex items-center justify-center border-2 border-slate-300 active:scale-95 shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Price Total */}
                    <div className="text-right">
                      <div className="text-base font-black font-num text-emerald-700">
                        Rs. {itemTotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Bill Summary & Checkout */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-200 space-y-3 shrink-0">
          {/* Discount Field */}
          <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
            <span>Wholesale Discount (رعایت):</span>
            <div className="flex items-center gap-1">
              <span>Rs.</span>
              <input
                type="number"
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 bg-white border border-slate-300 rounded px-2 py-0.5 text-right font-num font-bold text-amber-700 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* GIANT GRAND TOTAL BOX */}
          <div className="bg-emerald-50 rounded-2xl p-4 border-2 border-emerald-400 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-xs font-bold text-emerald-800 uppercase">
                TOTAL BILL (کل رقم)
              </div>
              <div className="text-xs text-slate-600 font-num">
                {totalRollsCount} Thaan • {totalMetersCount} Total Meters
              </div>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-num text-emerald-700">
              Rs. {grandTotal.toLocaleString()}
            </div>
          </div>

          {/* 2 GIANT PAYMENT BUTTONS */}
          <div className="grid grid-cols-2 gap-2">
            {/* CASH BUTTON */}
            <button
              type="button"
              onClick={() => {
                sound.click();
                setPaymentMode('Cash');
              }}
              className={`py-3 rounded-xl font-heading font-black text-sm flex items-center justify-center gap-2 border-2 transition ${
                paymentMode === 'Cash'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/40'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Coins className="w-5 h-5" />
              <span>💵 CASH (نقد)</span>
            </button>

            {/* UDHAR / KHATA BUTTON */}
            <button
              type="button"
              onClick={() => {
                sound.click();
                setPaymentMode('Credit');
              }}
              className={`py-3 rounded-xl font-heading font-black text-sm flex items-center justify-center gap-2 border-2 transition ${
                paymentMode === 'Credit'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400/40'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span>📝 UDHAR (ادھار)</span>
            </button>
          </div>

          {/* PRINT BUTTON */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-4 rounded-xl font-heading font-black text-lg flex items-center justify-center gap-2 shadow-md transition active:scale-[0.99] border-2 ${
              cart.length === 0
                ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                : paymentMode === 'Credit'
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-600'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
            }`}
          >
            <Printer className="w-6 h-6" />
            <span>PRINT GATE PASS / BILL (F5)</span>
          </button>
        </div>
      </div>

      {/* Loose Cut Meter Modal */}
      {cuttingModalProduct && (
        <CutMeterModal
          product={cuttingModalProduct}
          isOpen={!!cuttingModalProduct}
          onClose={() => setCuttingModalProduct(null)}
          onAddCutMeters={handleAddCutMeters}
        />
      )}
    </div>
  );
}
