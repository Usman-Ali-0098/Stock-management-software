import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Warehouse, 
  Users, 
  Receipt, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2,
  Clock,
  Store
} from 'lucide-react';
import { sound } from '../utils/audio';

export default function TopKpiBar({ 
  activeTab, 
  setActiveTab, 
  todaySalesTotal, 
  totalRollsInGodown, 
  totalMarketUdhar,
  soundEnabled,
  setSoundEnabled
}) {
  const [timeStr, setTimeStr] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const navTabs = [
    { id: 'billing', label: '1. New Bill', urdu: 'نئی پرچی / سیل', icon: ShoppingBag, shortcut: 'F1' },
    { id: 'stock', label: '2. Godown Stock', urdu: 'گودام کا مال', icon: Warehouse, shortcut: 'F2' },
    { id: 'khata', label: '3. Customer Khata', urdu: 'ادھار کھاتہ', icon: Users, shortcut: 'F3' },
    { id: 'passes', label: '4. Gate Passes', urdu: 'پرانی پرچیاں', icon: Receipt, shortcut: 'F4' },
  ];

  return (
    <header className="bg-white border-b-2 border-slate-200 text-slate-900 select-none shrink-0 shadow-sm">
      {/* Top Header Row */}
      <div className="px-5 py-2.5 flex items-center justify-between border-b border-slate-200 bg-slate-50/80">
        {/* Shop Name */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white font-black shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-heading font-black tracking-tight text-slate-900 flex items-center gap-2">
              AL-MADINA REXINE TRADERS
              <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold">
                شاہ عالم مارکیٹ، لاہور
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Wholesale Artificial Leather & PVC Rolls • Shalmi Bazar, Lahore
            </div>
          </div>
        </div>

        {/* 3 Main KPIs - Clean, bright, large numbers */}
        <div className="flex items-center gap-3">
          {/* Today Sale */}
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl px-4 py-1.5 text-center min-w-[155px]">
            <div className="text-[10px] uppercase font-bold text-emerald-800">
              Today Cash Sale (آج کی نقد)
            </div>
            <div className="text-2xl font-black font-num text-emerald-700">
              Rs. {todaySalesTotal.toLocaleString()}
            </div>
          </div>

          {/* Godown Rolls */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-1.5 text-center min-w-[135px]">
            <div className="text-[10px] uppercase font-bold text-amber-800">
              Total Rolls (کل تھان)
            </div>
            <div className="text-2xl font-black font-num text-amber-700">
              {totalRollsInGodown} <span className="text-xs font-semibold text-amber-900">Thaan</span>
            </div>
          </div>

          {/* Market Udhar */}
          <div className="bg-rose-50 border-2 border-rose-300 rounded-xl px-4 py-1.5 text-center min-w-[155px]">
            <div className="text-[10px] uppercase font-bold text-rose-800">
              Market Udhar (کل ادھار)
            </div>
            <div className="text-2xl font-black font-num text-rose-700">
              Rs. {totalMarketUdhar.toLocaleString()}
            </div>
          </div>

          {/* Sound & Screen */}
          <div className="flex items-center gap-2 pl-2">
            <button
              onClick={() => {
                sound.enabled = !soundEnabled;
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) sound.click();
              }}
              className={`p-2.5 rounded-xl border-2 transition ${
                soundEnabled 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm' 
                  : 'bg-slate-100 border-slate-300 text-slate-400'
              }`}
              title="Toggle Audio Feedback"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-slate-100 border-2 border-slate-300 text-slate-700 hover:bg-slate-200"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Big Nav Tabs */}
      <div className="px-4 py-2 flex items-center gap-3 bg-white">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                sound.click();
                setActiveTab(tab.id);
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-150 border-2 ${
                isActive
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-emerald-700'}`} />
              <div className="text-left">
                <div className="font-heading font-extrabold text-sm leading-tight flex items-center gap-2">
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    isActive ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.shortcut}
                  </span>
                </div>
                <div className={`text-xs ${isActive ? 'text-emerald-50 font-semibold' : 'text-slate-500'}`}>
                  {tab.urdu}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </header>
  );
}
