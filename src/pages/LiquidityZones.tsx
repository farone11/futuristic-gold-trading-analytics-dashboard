import { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';
 
interface LiquidityZone {
  type: 'BSL' | 'SSL';
  price: number;
  status: 'ACTIVE' | 'AGED' | 'SWEPT';
  age: string;
  obConfluence: boolean;
}
 
interface SessionData {
  high: number | null;
  low: number | null;
  mid: number | null;
  range: number | null;
}
 
interface LiquidityData {
  buySideLiquidity: number;
  sellSideLiquidity: number;
  sessionLiquidity: number;
  zones: LiquidityZone[];
  asiaSession: SessionData;
  londonSession: SessionData;
  newYorkSession: SessionData;
  lastUpdate: string;
  activeZones: number;
}
 
export default function LiquidityZones() {
  const [data, setData] = useState<LiquidityData>({
    buySideLiquidity: 0,
    sellSideLiquidity: 0,
    sessionLiquidity: 0,
    zones: [],
    asiaSession: { high: null, low: null, mid: null, range: null },
    londonSession: { high: null, low: null, mid: null, range: null },
    newYorkSession: { high: null, low: null, mid: null, range: null },
    lastUpdate: '-------',
    activeZones: 0,
  });
 
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/liquidity');
        if (response.ok) {
          const json = await response.json();
          if (json) {
            setData({
              buySideLiquidity: json.buy_side_count ?? 0,
              sellSideLiquidity: json.sell_side_count ?? 0,
              sessionLiquidity: json.session_count ?? 0,
              zones: json.zones ?? [],
              asiaSession: json.asia_session ?? { high: null, low: null, mid: null, range: null },
              londonSession: json.london_session ?? { high: null, low: null, mid: null, range: null },
              newYorkSession: json.new_york_session ?? { high: null, low: null, mid: null, range: null },
              lastUpdate: json.timestamp ?? '-------',
              activeZones: json.active_zones ?? 0,
            });
          }
        }
      } catch {
        // keep default
      }
    };
 
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
 
  const formatPrice = (price: number | null) => price ? price.toFixed(2) : '----,--';
  const formatRange = (range: number | null) => range ? `${range.toFixed(0)} pips` : '--- pips';
 
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
 
  const card: React.CSSProperties = { background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' };
  const labelStyle: React.CSSProperties = { color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', marginTop: 0 };
 
  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#fff', padding: '24px', fontFamily: 'inherit', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Droplets size={22} color="#facc15" />
          LIQUIDITY ZONES - XAUUSD H1
        </h1>
        <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
          Buy-Side &amp; Sell-Side Liquidity + Session Levels · Auto Sweep Detection
        </p>
      </div>
 
      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
        {/* Buy-Side */}
        <div style={card}>
          <p style={labelStyle}>Buy-Side Liquidity</p>
          <p style={{ fontSize: '48px', fontWeight: 800, color: '#4ade80', margin: '0 0 8px 0', lineHeight: 1 }}>{data.buySideLiquidity}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block', flexShrink: 0 }}></span>
            Above Highs · Sweep Target
          </p>
        </div>
 
        {/* Sell-Side */}
        <div style={card}>
          <p style={labelStyle}>Sell-Side Liquidity</p>
          <p style={{ fontSize: '48px', fontWeight: 800, color: '#f87171', margin: '0 0 8px 0', lineHeight: 1 }}>{data.sellSideLiquidity}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f87171', display: 'inline-block', flexShrink: 0 }}></span>
            Below Lows · Sweep Target
          </p>
        </div>
 
        {/* Session Liquidity */}
        <div style={card}>
          <p style={labelStyle}>Session Liquidity</p>
          <p style={{ fontSize: '48px', fontWeight: 800, color: '#60a5fa', margin: '0 0 8px 0', lineHeight: 1 }}>{data.sessionLiquidity}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block', flexShrink: 0 }}></span>
            Asia / London / NY
          </p>
        </div>
      </div>
 
      {/* Active Liquidity Zones Table */}
      <div style={{ ...card, marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ color: '#facc15', fontWeight: 600, fontSize: '14px', margin: 0 }}>Active Liquidity Zones</p>
          <span style={{ color: '#4ade80', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
            {data.activeZones || data.zones.length} zona aktif · {timeStr}
          </span>
        </div>
 
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f87171', display: 'inline-block' }}></span>
            BSL = Buy-Side Liq
          </span>
          <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
            SSL = Sell-Side Liq
          </span>
          <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }}></span>
            Session High/Low
          </span>
        </div>
 
        {/* Table Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 80px 120px', gap: '8px', padding: '8px 0', borderBottom: '1px solid #1f2937' }}>
          {['Type', 'Price Zone', 'Status', 'Age', 'OB Confluence'].map((h) => (
            <span key={h} style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
          ))}
        </div>
 
        {/* Table Rows */}
        {data.zones.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#4b5563', fontSize: '13px' }}>
            No active liquidity zones
          </div>
        ) : (
          data.zones.map((zone, idx) => (
            <div key={idx} style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 120px 80px 120px',
              gap: '8px',
              padding: '12px 0',
              borderBottom: idx < data.zones.length - 1 ? '1px solid #1f2937' : 'none',
              alignItems: 'center',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                background: zone.type === 'BSL' ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
                color: zone.type === 'BSL' ? '#f87171' : '#4ade80',
                border: `1px solid ${zone.type === 'BSL' ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
                width: 'fit-content',
              }}>{zone.type}</span>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{zone.price.toFixed(2)}</span>
              <span style={{ color: zone.status === 'ACTIVE' ? '#4ade80' : '#6b7280', fontSize: '13px', fontWeight: zone.status === 'ACTIVE' ? 600 : 400 }}>{zone.status}</span>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>{zone.age}</span>
              <span style={{ color: zone.obConfluence ? '#4ade80' : '#4b5563', fontSize: '13px', fontWeight: zone.obConfluence ? 600 : 400 }}>
                {zone.obConfluence ? 'YES' : 'NO'}
              </span>
            </div>
          ))
        )}
      </div>
 
      {/* Session Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {/* Asia Session */}
        <div style={card}>
          <p style={{ color: '#facc15', fontWeight: 600, fontSize: '14px', marginBottom: '16px', marginTop: 0 }}>Asia Session</p>
          {[
            { label: 'High', value: formatPrice(data.asiaSession.high) },
            { label: 'Low', value: formatPrice(data.asiaSession.low) },
            { label: 'Mid', value: formatPrice(data.asiaSession.mid) },
            { label: 'Range', value: formatRange(data.asiaSession.range), isRange: true },
          ].map((item, idx, arr) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < arr.length - 1 ? '1px solid #1f2937' : 'none' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>{item.label}</span>
              <span style={{ color: (item as any).isRange ? '#facc15' : '#fff', fontSize: '13px', fontWeight: 500 }}>{item.value}</span>
            </div>
          ))}
        </div>
 
        {/* London Session */}
        <div style={card}>
          <p style={{ color: '#facc15', fontWeight: 600, fontSize: '14px', marginBottom: '16px', marginTop: 0 }}>London Session</p>
          {[
            { label: 'High', value: formatPrice(data.londonSession.high) },
            { label: 'Low', value: formatPrice(data.londonSession.low) },
            { label: 'Mid', value: formatPrice(data.londonSession.mid) },
            { label: 'Range', value: formatRange(data.londonSession.range), isRange: true },
          ].map((item, idx, arr) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < arr.length - 1 ? '1px solid #1f2937' : 'none' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>{item.label}</span>
              <span style={{ color: (item as any).isRange ? '#facc15' : '#fff', fontSize: '13px', fontWeight: 500 }}>{item.value}</span>
            </div>
          ))}
        </div>
 
        {/* New York Session */}
        <div style={card}>
          <p style={{ color: '#facc15', fontWeight: 600, fontSize: '14px', marginBottom: '16px', marginTop: 0 }}>New York Session</p>
          {[
            { label: 'High', value: formatPrice(data.newYorkSession.high) },
            { label: 'Low', value: formatPrice(data.newYorkSession.low) },
            { label: 'Mid', value: formatPrice(data.newYorkSession.mid) },
            { label: 'Range', value: formatRange(data.newYorkSession.range), isRange: true },
          ].map((item, idx, arr) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < arr.length - 1 ? '1px solid #1f2937' : 'none' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>{item.label}</span>
              <span style={{ color: (item as any).isRange ? '#facc15' : '#fff', fontSize: '13px', fontWeight: 500 }}>{item.value}</span>
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
