import { useState, useEffect } from 'react';
import { Zap, Activity, BarChart2, Shield, Target, TrendingUp } from 'lucide-react';
 
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
 
const layerStatusColor: Record<string, string> = {
  Waiting: '#facc15',
  Scanning: '#60a5fa',
  Monitoring: '#22d3ee',
  Loaded: '#4ade80',
};
 
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
 
  const layers = [
    { name: 'Maxwell AI', status: 'Waiting' },
    { name: 'Order Block (OB)', status: 'Scanning' },
    { name: 'Liquidity Detection', status: 'Monitoring' },
    { name: 'COT Analysis', status: 'Loaded' },
    { name: 'Seasonal Patterns', status: 'Loaded' },
  ];
 
  const performanceStats = {
    totalSignals: 0,
    winRate: 0,
    avgRR: 0.0,
    lastSignal: 'None',
  };
 
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
        // keep STANDBY
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
 
  const getStatusColor = () => {
    if (signalData.status === 'BUY') return '#4ade80';
    if (signalData.status === 'SELL') return '#f87171';
    return '#facc15';
  };
 
  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#030712', color: '#fff', padding: '24px', fontFamily: 'inherit', boxSizing: 'border-box' },
    card: { background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' },
    sectionTitle: { color: '#facc15', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' },
    divider: { borderBottom: '1px solid #1f2937' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' },
    labelGray: { color: '#9ca3af', fontSize: '13px' },
    valueWhite: { color: '#fff', fontWeight: 600, fontSize: '13px' },
  };
 
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Zap size={22} color="#facc15" />
          AI SIGNAL CENTER
        </h1>
        <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
          Live trade signals from 5-layer confluence engine: Maxwell AI + OB + Liquidity + COT + Seasonal
        </p>
      </div>
 
      {/* Current Signal */}
      <div style={{
        borderRadius: '12px',
        border: '1px solid rgba(250,204,21,0.15)',
        background: '#111827',
        padding: '20px',
        marginBottom: '24px',
      }}>
        <p style={{ color: '#facc15', fontWeight: 600, fontSize: '13px', marginBottom: '16px', marginTop: 0 }}>Current Signal</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
          <div>
            <p style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', marginTop: 0 }}>Status</p>
            <p style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '0.1em', color: getStatusColor(), margin: 0 }}>{signalData.status}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', marginTop: 0 }}>Entry</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: signalData.entry ? '#fff' : '#374151', margin: 0 }}>{formatPrice(signalData.entry)}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', marginTop: 0 }}>Stop Loss</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: signalData.stopLoss ? '#f87171' : '#374151', margin: 0 }}>{formatPrice(signalData.stopLoss)}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', marginTop: 0 }}>Take Profit 1</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: signalData.takeProfit1 ? '#4ade80' : '#374151', margin: 0 }}>{formatPrice(signalData.takeProfit1)}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', marginTop: 0 }}>Take Profit 2</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: signalData.takeProfit2 ? '#4ade80' : '#374151', margin: 0 }}>{formatPrice(signalData.takeProfit2)}</p>
          </div>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 4px 0' }}>{signalData.confluence}</p>
          <p style={{ color: '#4b5563', fontSize: '11px', margin: 0 }}>Last Update: {signalData.lastUpdate} | Risk: {signalData.riskPerTrade}</p>
        </div>
      </div>
 
      {/* Middle Row: Engine + History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* 5-Layer Engine */}
        <div style={s.card}>
          <p style={s.sectionTitle}><Activity size={15} color="#facc15" />5-Layer Confluence Engine</p>
          {layers.map((layer, idx) => (
            <div key={idx} style={{ ...s.row, ...(idx < layers.length - 1 ? s.divider : {}) }}>
              <span style={{ color: '#d1d5db', fontSize: '13px' }}>{layer.name}</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: layerStatusColor[layer.status] || '#fff' }}>{layer.status}</span>
            </div>
          ))}
        </div>
 
        {/* Signal History */}
        <div style={s.card}>
          <p style={s.sectionTitle}><BarChart2 size={15} color="#facc15" />Signal History</p>
          {signalHistory.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px' }}>
              <p style={{ color: '#4b5563', fontSize: '13px' }}>No signal history available</p>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: '180px' }}>
              {signalHistory.map((sig) => (
                <div key={sig.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#1f2937', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px', fontSize: '12px' }}>
                  <span style={{ color: sig.type === 'BUY' ? '#4ade80' : '#f87171', fontWeight: 700 }}>{sig.type}</span>
                  <span style={{ color: '#9ca3af' }}>{sig.entry}</span>
                  <span style={{ color: '#6b7280' }}>{sig.timestamp}</span>
                  {sig.result && <span style={{ color: sig.result === 'WIN' ? '#4ade80' : '#f87171' }}>{sig.result}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
 
      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {/* Entry Criteria */}
        <div style={s.card}>
          <p style={s.sectionTitle}><Target size={15} color="#facc15" />Entry Criteria</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {['Minimum 3/5 confluence layers active', 'OB + Liquidity confluence required', 'COT alignment with trade direction', 'Session timing: London / NY overlap'].map((item, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#d1d5db', fontSize: '13px', marginBottom: '10px' }}>
                <span style={{ color: '#facc15', marginTop: '2px', flexShrink: 0 }}>▸</span>{item}
              </li>
            ))}
          </ul>
        </div>
 
        {/* Risk Parameters */}
        <div style={s.card}>
          <p style={s.sectionTitle}><Shield size={15} color="#facc15" />Risk Parameters</p>
          {[{ label: 'Risk Per Trade', value: '1%' }, { label: 'Min R:R', value: '1:2' }, { label: 'Max Trades/Day', value: '3' }, { label: 'Max Open Positions', value: '2' }].map((item, idx, arr) => (
            <div key={idx} style={{ ...s.row, ...(idx < arr.length - 1 ? s.divider : {}) }}>
              <span style={s.labelGray}>{item.label}</span>
              <span style={s.valueWhite}>{item.value}</span>
            </div>
          ))}
        </div>
 
        {/* Performance Stats */}
        <div style={s.card}>
          <p style={s.sectionTitle}><TrendingUp size={15} color="#facc15" />Performance Stats</p>
          {[{ label: 'Total Signals', value: String(performanceStats.totalSignals) }, { label: 'Win Rate', value: `${performanceStats.winRate}%` }, { label: 'Avg R:R Achieved', value: performanceStats.avgRR.toFixed(1) }, { label: 'Last Signal', value: performanceStats.lastSignal }].map((item, idx, arr) => (
            <div key={idx} style={{ ...s.row, ...(idx < arr.length - 1 ? s.divider : {}) }}>
              <span style={s.labelGray}>{item.label}</span>
              <span style={s.valueWhite}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
 
      {/* Footer */}
      <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0' }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>Risk Warning:</span> Trading foreign exchange on margin carries a high level of risk and may not be suitable for all investors.
          </p>
          <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>© 2026 FARONE.AI — Powered by MetaTrader 5 | Contact: farone2013@gmail.com for licensing</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0' }}>Authors</p>
          <p style={{ fontSize: '13px', color: '#facc15', fontWeight: 500, margin: '0 0 2px 0' }}>Setiawan F | Selviana R</p>
          <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>Founder @ Aitopia</p>
        </div>
      </div>
    </div>
  );
}
