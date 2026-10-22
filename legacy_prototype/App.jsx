import React, { useState, useEffect, useMemo } from 'react';
import TopKpiBar from './components/TopKpiBar';
import PosBillingScreen from './components/PosBillingScreen';
import GodownStockScreen from './components/GodownStockScreen';
import CustomerKhataScreen from './components/CustomerKhataScreen';
import GatePassesScreen from './components/GatePassesScreen';
import GatePassModal from './components/GatePassModal';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_PRODUCTS, 
  INITIAL_CUSTOMERS, 
  INITIAL_RECENT_BILLS 
} from './data/mockData';
import { sound } from './utils/audio';

export default function App() {
  const [activeTab, setActiveTab] = useState('billing'); // 'billing' | 'stock' | 'khata' | 'passes'
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [recentBills, setRecentBills] = useState(INITIAL_RECENT_BILLS);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Cart & POS Billing State
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash' | 'Credit'
  const [discount, setDiscount] = useState('');
  const [cashPaidAmount, setCashPaidAmount] = useState('');
  
  // Gate Pass Modal
  const [activeGatePass, setActiveGatePass] = useState(null);

  // Global KPIs Calculation
  const todaySalesTotal = useMemo(() => {
    return recentBills.reduce((acc, b) => acc + (b.paymentMode === 'Cash' ? b.totalAmount : (b.amountPaid || 0)), 0);
  }, [recentBills]);

  const todaySalesCount = recentBills.length;

  const totalRollsInGodown = useMemo(() => {
    return products.reduce((acc, p) => acc + p.rollsInStock, 0);
  }, [products]);

  const totalCutMeters = useMemo(() => {
    return products.reduce((acc, p) => acc + p.looseMetersInStock, 0);
  }, [products]);

  const totalMarketUdhar = useMemo(() => {
    return customers.reduce((acc, c) => acc + c.balanceDue, 0);
  }, [customers]);

  // Handle Checkout / Print Bill
  const handlePrintBill = (billDetails) => {
    const newGatePassNo = `GP-${Math.floor(4912 + recentBills.length * 3)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newBillRecord = {
      id: newGatePassNo,
      gatePassNo: newGatePassNo,
      date: nowStr,
      customerName: billDetails.selectedCustomer ? billDetails.selectedCustomer.name : 'Counter Cash Buyer',
      city: billDetails.selectedCustomer ? billDetails.selectedCustomer.city : 'Shalmi Market, Lahore',
      truckDriver: billDetails.transportNote || 'Direct Hand-Cart / Shalmi Bazar',
      paymentMode: billDetails.paymentMode,
      amountPaid: billDetails.cashPaidAmount,
      amountDue: billDetails.paymentMode === 'Credit' ? billDetails.grandTotal : 0,
      totalAmount: billDetails.grandTotal,
      subtotal: billDetails.subtotal,
      discount: billDetails.discount,
      totalRolls: billDetails.totalRollsCount,
      totalMeters: billDetails.totalMetersCount,
      items: billDetails.cart,
      cart: billDetails.cart,
      selectedCustomer: billDetails.selectedCustomer,
      transportNote: billDetails.transportNote,
      grandTotal: billDetails.grandTotal,
    };

    // 1. Deduct Stock from Godown
    setProducts((prevProducts) => {
      const updated = [...prevProducts];
      billDetails.cart.forEach((cartItem) => {
        const prodIndex = updated.findIndex((p) => p.id === cartItem.productId);
        if (prodIndex > -1) {
          const prod = { ...updated[prodIndex] };
          if (cartItem.unitType === 'roll') {
            prod.rollsInStock = Math.max(0, prod.rollsInStock - cartItem.quantity);
          } else {
            // Cut meters
            if (prod.looseMetersInStock >= cartItem.quantity) {
              prod.looseMetersInStock -= cartItem.quantity;
            } else {
              // Deduct from a full roll
              const neededFromRoll = cartItem.quantity - prod.looseMetersInStock;
              const rollsToBreak = Math.ceil(neededFromRoll / prod.rollLengthMeters);
              prod.rollsInStock = Math.max(0, prod.rollsInStock - rollsToBreak);
              prod.looseMetersInStock = (rollsToBreak * prod.rollLengthMeters) - neededFromRoll;
            }
          }
          updated[prodIndex] = prod;
        }
      });
      return updated;
    });

    // 2. If Credit, update customer ledger
    if (billDetails.paymentMode === 'Credit' && billDetails.selectedCustomer) {
      setCustomers((prevCusts) => {
        return prevCusts.map((c) => {
          if (c.id === billDetails.selectedCustomer.id) {
            const newBalance = c.balanceDue + billDetails.grandTotal;
            const newTx = {
              id: `TX-${Date.now()}`,
              date: nowStr,
              type: 'Gate Pass (Udhar)',
              ref: newGatePassNo,
              amount: billDetails.grandTotal,
              status: 'Credit'
            };
            return {
              ...c,
              balanceDue: newBalance,
              history: [newTx, ...(c.history || [])]
            };
          }
          return c;
        });
      });
    }

    // 3. Save to recent bills
    setRecentBills((prev) => [newBillRecord, ...prev]);

    // 4. Open Gate Pass Print Preview Modal
    setActiveGatePass(newBillRecord);

    // 5. Clear cart
    setCart([]);
    setDiscount('');
    setCashPaidAmount('');
  };

  const handleClearBill = () => {
    if (cart.length > 0) {
      if (window.confirm('Clear all items from current bill?')) {
        setCart([]);
        setDiscount('');
        setCashPaidAmount('');
      }
    }
  };

  // Keyboard Shortcuts for Cashier Speed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        sound.click();
        setActiveTab('billing');
      } else if (e.key === 'F2') {
        e.preventDefault();
        sound.click();
        setActiveTab('stock');
      } else if (e.key === 'F3') {
        e.preventDefault();
        sound.click();
        setActiveTab('khata');
      } else if (e.key === 'F4') {
        e.preventDefault();
        sound.click();
        setActiveTab('passes');
      } else if (e.key === 'Escape') {
        if (activeGatePass) {
          setActiveGatePass(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGatePass]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 font-sans">
      {/* Top Wholesale KPI & Navigation Header */}
      <TopKpiBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        todaySalesTotal={todaySalesTotal}
        todaySalesCount={todaySalesCount}
        totalRollsInGodown={totalRollsInGodown}
        totalCutMeters={totalCutMeters}
        totalMarketUdhar={totalMarketUdhar}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />

      {/* Main Tab Screen Area */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'billing' && (
          <PosBillingScreen
            products={products}
            categories={INITIAL_CATEGORIES}
            customers={customers}
            cart={cart}
            setCart={setCart}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode}
            discount={discount}
            setDiscount={setDiscount}
            cashPaidAmount={cashPaidAmount}
            setCashPaidAmount={setCashPaidAmount}
            onPrintBill={handlePrintBill}
            onClearBill={handleClearBill}
          />
        )}

        {activeTab === 'stock' && (
          <GodownStockScreen
            products={products}
            setProducts={setProducts}
          />
        )}

        {activeTab === 'khata' && (
          <CustomerKhataScreen
            customers={customers}
            setCustomers={setCustomers}
          />
        )}

        {activeTab === 'passes' && (
          <GatePassesScreen
            bills={recentBills}
            onOpenSlip={(slip) => setActiveGatePass(slip)}
          />
        )}
      </main>

      {/* Gate Pass & Slip Preview Modal */}
      {activeGatePass && (
        <GatePassModal
          billData={activeGatePass}
          isOpen={!!activeGatePass}
          onClose={() => setActiveGatePass(null)}
        />
      )}
    </div>
  );
}
