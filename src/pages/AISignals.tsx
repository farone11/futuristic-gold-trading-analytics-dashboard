import { useState, useEffect } from 'react';
import { Zap, TrendingDown, TrendingUp, Clock, AlertTriangle, CheckCircle, Activity, BarChart2, Shield, Target } from 'lucide-react';
 
interface Signal {
  id: string;
  type: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  timestamp: string;
  confluence: string;
  result?: 'WIN' | 'LOSS' | 'PENDING';
  rr?: number;
}
 
interface SignalData {
  status: 'STANDBY' | 'BUY' | 'SELL';
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  confluence: string;
  lastUpdate: string;
  riskPerTrade: string;
}
 
export default function AISignals() {
  const [signalData, setSignalData] = useState<SignalData>({
    status: 'STANDBY',
    entry: null,
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    confluence: 'No confluence',
    lastUpdate: '-------',
    riskPerTrade: '1% per trade',
  });
 
  const [signalHistory] = useState<Signal[]>([]);
 
  const [layers] = useState([
    { name: 'Maxwell AI', status: 'Waiting', color: 'text-yellow-400' },
    { name: 'Order Block (OB)', status: 'Scanning', color: 'text-blue-400' },
    { name: 'Liquidity Detection', status: 'Monitoring', color: 'text-cyan-400' },
    { name: 'COT Analysis', status: 'Loaded', color: 'text-green-400' },
    { name: 'Seasonal Patterns', status: 'Loaded', color: 'text-green-400' },
  ]);
 
  const [performanceStats] = useState({
    totalSignals: 0,
    winRate: 0,
    avgRR: 0.0,
    lastSignal: 'None',
  });
 
  // Fetch signal from backend
  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const response = await fetch('/api/signal');
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setSignalData({
              status: data.signal_type || 'STANDBY',
              entry: data.entry_price || null,
              stopLoss: data.stop_loss || null,
              takeProfit1: data.take_profit_1 || null,
              takeProfit2: data.take_profit_2 || null,
              confluence: data.confluence || 'No confluence',
              lastUpdate: data.timestamp || '-------',
              riskPerTrade: '1% per trade',
            });
          }
        }
      } catch {
        // Backend not available, keep STANDBY
      }
    };
 
    fetchSignal();
    const interval = setInterval(fetchSignal, 30000);
    return () => clearInterval(interval);
  }, []);
 
  const formatPrice = (price: number | null) => {
    if (!price) return '-----.--.--';
    return price.toFixed(2);
  };
 
  const getStatusColor = (status: string) => {
    if (status === 'BUY') return 'text-green-400';
    if (status === 'SELL') return 'text-red-400';
    return 'text-yellow-400';
  };
 
  const getStatusBg = (status: string) => {
    if (status === 'BUY') return 'bg-green-400/10 border-green-400/30';
    if (status === 'SELL') return 'bg-red-400/10 border-red-400/30';
    return 'bg-yellow-400/10 border-yellow-400/30';
  };
 
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="text-yellow-400" size={24} />
          AI SIGNAL CENTER
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Live trade signals from 5-layer confluence engine: Maxwell AI + OB + Liquidity + COT + Seasonal
        </p>
      </div>
 
      {/* Current Signal */}
      <div className={`rounded-xl border p-5 mb-6 ${getStatusBg(signalData.status)}`}>
        <h2 className="text-yellow-400 font-semibold text-sm mb-4">Current Signal</h2>
        <div className="grid grid-cols-5 gap-4">
          {/* Status */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Status</p>
            <p className={`text-3xl font-extrabold tracking-widest ${getStatusColor(signalData.status)}`}>
              {signalData.status}
            </p>
          </div>
 
          {/* Entry */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Entry</p>
            <p className={`text-2xl font-bold ${signalData.entry ? 'text-white' : 'text-gray-600'}`}>
              {formatPrice(signalData.entry)}
            </p>
          </div>
 
          {/* Stop Loss */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Stop Loss</p>
            <p className={`text-2xl font-bold ${signalData.stopLoss ? 'text-red-400' : 'text-gray-600'}`}>
              {formatPrice(signalData.stopLoss)}
            </p>
          </div>
 
          {/* Take Profit 1 */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Take Profit 1</p>
            <p className={`text-2xl font-bold ${signalData.takeProfit1 ? 'text-green-400' : 'text-gray-600'}`}>
              {formatPrice(signalData.takeProfit1)}
            </p>
          </div>
 
          {/* Take Profit 2 */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Take Profit 2</p>
            <p className={`text-2xl font-bold ${signalData.takeProfit2 ? 'text-green-400' : 'text-gray-600'}`}>
              {formatPrice(signalData.takeProfit2)}
            </p>
          </div>
        </div>
 
        {/* Confluence info */}
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <p className="text-gray-400 text-sm">{signalData.confluence}</p>
          <p className="text-gray-600 text-xs mt-1">
            Last Update: {signalData.lastUpdate} | Risk: {signalData.riskPerTrade}
          </p>
        </div>
      </div>
 
      {/* Middle Row: 5-Layer Engine + Signal History */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* 5-Layer Confluence Engine */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-yellow-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <Activity size={16} />
            5-Layer Confluence Engine
          </h3>
          <div className="space-y-3">
            {layers.map((layer, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <span className="text-gray-300 text-sm">{layer.name}</span>
                <span className={`text-sm font-medium ${layer.color}`}>{layer.status}</span>
              </div>
            ))}
          </div>
        </div>
 
        {/* Signal History */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-yellow-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <BarChart2 size={16} />
            Signal History
          </h3>
          {signalHistory.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-600 text-sm">No signal history available</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-48">
              {signalHistory.map((sig) => (
                <div key={sig.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-2 text-xs">
                  <span className={sig.type === 'BUY' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {sig.type}
                  </span>
                  <span className="text-gray-400">{sig.entry}</span>
                  <span className="text-gray-500">{sig.timestamp}</span>
                  {sig.result && (
                    <span className={sig.result === 'WIN' ? 'text-green-400' : 'text-red-400'}>
                      {sig.result}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
 
      {/* Bottom Row: Entry Criteria + Risk Parameters + Performance Stats */}
      <div className="grid grid-cols-3 gap-6">
        {/* Entry Criteria */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-yellow-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <Target size={16} />
            Entry Criteria
          </h3>
          <ul className="space-y-2">
            {[
              'Minimum 3/5 confluence layers active',
              'OB + Liquidity confluence required',
              'COT alignment with trade direction',
              'Session timing: London / NY overlap',
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-yellow-400 mt-0.5">▸</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
 
        {/* Risk Parameters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-yellow-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <Shield size={16} />
            Risk Parameters
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Risk Per Trade', value: '1%' },
              { label: 'Min R:R', value: '1:2' },
              { label: 'Max Trades/Day', value: '3' },
              { label: 'Max Open Positions', value: '2' },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 text-sm">{item.label}</span>
                <span className="text-white font-semibold text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
 
        {/* Performance Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-yellow-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp size={16} />
            Performance Stats
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Total Signals', value: performanceStats.totalSignals.toString() },
              { label: 'Win Rate', value: `${performanceStats.winRate}%` },
              { label: 'Avg R:R Achieved', value: performanceStats.avgRR.toFixed(1) },
              { label: 'Last Signal', value: performanceStats.lastSignal },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 text-sm">{item.label}</span>
                <span className="text-white font-semibold text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
 
      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-800 flex justify-between items-center text-xs text-gray-600">
        <div>
          <span className="text-red-400 font-semibold">Risk Warning:</span> Trading foreign exchange on margin carries a high level of risk and may not be suitable for all investors.
          <br />© 2026 FARONE.AI — Powered by MetaTrader 5 | Contact: farone2013@gmail.com for licensing
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs">Authors</p>
          <p className="text-yellow-400 font-medium">Setiawan F | Selviana R</p>
          <p className="text-gray-600 text-xs">Founder @ Aitopia</p>
        </div>
      </div>
    </div>
  );
}
