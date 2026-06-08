import { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';

interface LiquidityZone {
  type: string;
  price: number;
  status: 'ACTIVE' | 'AGED' | 'SWEPT' | 'SESSION';
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

const emptySession: SessionData = { high: null, low: null, mid: null, range: null };

export default function LiquidityZones() {
  const [data, setData] = useState<LiquidityData>({
    buySideLiquidity: 0,
    sellSideLiquidity: 0,
    sessionLiquidity: 0,
    zones: [],
    asiaSession: emptySession,
    londonSession: emptySession,
    newYorkSession: emptySession,
    lastUpdate: '--:--:--',
    activeZones: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('https://future-production-67e6.up.railway.app/api/liquidity-zones');
        if (response.ok) {
          const json = await response.json();
          const zones = (json.zones ?? []).map((z: any) => ({
            type: z.type,
            price: Number(z.price),
            status: z.status ?? 'ACTIVE',
            age: z.age ?? '--',
            obConfluence: Boolean(z.obConfluence ?? z.ob_confluence),
          }));

          setData({
            buySideLiquidity: json.buy_side_count ?? 0,
            sellSideLiquidity: json.sell_side_count ?? 0,
            sessionLiquidity: json.session_count ?? 0,
            zones,
            asiaSession: json.asia_session ?? emptySession,
            londonSession: json.london_session ?? emptySession,
            newYorkSession: json.new_york_session ?? emptySession,
            lastUpdate: json.timestamp ?? '--:--:--',
            activeZones: json.active_zones ?? 0,
          });
        }
      } catch (error) {
        console.error('Liquidity fetch error:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number | null) => price === null ? '----.--' : price.toFixed(2);
  const formatRange = (range: number | null) => range === null ? '--- pips' : `${range.toFixed(0)} pips`;

  const card: React.CSSProperties = { background: '#111113', border: '1px solid #24242a', borderRadius: '8px', padding: '20px' };
  const labelStyle: React.CSSProperties = { color: '#9fb0cb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px', marginTop: 0 };
  const tableGrid = '110px minmax(160px, 1fr) 120px 80px 140px';

  const sessionCards = [
    { name: 'Asia Session', data: data.asiaSession },
    { name: 'London Session', data: data.londonSession },
    { name: 'New York Session', data: data.newYorkSession },
  ];

  const getZoneColor = (type: string) => {
    if (type === 'BSL') return '#ef2f3a';
    if (type === 'SSL') return '#19c463';
    return '#3b82f6';
  };

  const getStatusColor = (status: string) => {
    if (status === 'ACTIVE') return '#33e681';
    if (status === 'SESSION') return '#3b82f6';
    return '#6f7f99';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c', color: '#fff', padding: '28px 20px 24px', fontFamily: 'inherit', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, letterSpacing: '0.02em' }}>
          <Droplets size={22} color="#facc15" />
          LIQUIDITY ZONES - XAUUSD H1
        </h1>
        <p style={{ color: '#b8d7ff', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>
          Buy-Side &amp; Sell-Side Liquidity + Session Levels &middot; Auto Sweep Detection
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div style={card}>
          <p style={labelStyle}>Buy-Side Liquidity</p>
          <p style={{ fontSize: '36px', fontWeight: 800, color: '#ff6b6b', margin: '0 0 6px 0', lineHeight: 1 }}>{data.buySideLiquidity}</p>
          <p style={{ color: '#8090ad', fontSize: '12px', margin: 0 }}>Above Highs &middot; Sweep Target</p>
        </div>

        <div style={card}>
          <p style={labelStyle}>Sell-Side Liquidity</p>
          <p style={{ fontSize: '36px', fontWeight: 800, color: '#33e681', margin: '0 0 6px 0', lineHeight: 1 }}>{data.sellSideLiquidity}</p>
          <p style={{ color: '#8090ad', fontSize: '12px', margin: 0 }}>Below Lows &middot; Sweep Target</p>
        </div>

        <div style={card}>
          <p style={labelStyle}>Session Liquidity</p>
          <p style={{ fontSize: '36px', fontWeight: 800, color: '#68a3ff', margin: '0 0 6px 0', lineHeight: 1 }}>{data.sessionLiquidity}</p>
          <p style={{ color: '#8090ad', fontSize: '12px', margin: 0 }}>Asia / London / NY</p>
        </div>
      </div>

      <div style={{ ...card, marginBottom: '16px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', minWidth: '760px' }}>
          <p style={{ color: '#facc15', fontWeight: 700, fontSize: '14px', margin: 0 }}>Active Liquidity Zones</p>
          <span style={{ color: '#facc15', fontSize: '11px' }}>{data.activeZones} active &middot; {data.lastUpdate}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: tableGrid, gap: '8px', padding: '0 0 10px', borderBottom: '1px solid #24242a', minWidth: '760px' }}>
          {['Type', 'Price Zone', 'Status', 'Age', 'OB Confluence'].map((h) => (
            <span key={h} style={{ color: '#8fa2c2', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{h}</span>
          ))}
        </div>

        {data.zones.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
            No liquidity zones. Open XAUUSDc H1 chart in MT5.
          </div>
        ) : data.zones.map((zone, idx) => (
          <div key={`${zone.type}-${zone.price}-${idx}`} style={{
            display: 'grid',
            gridTemplateColumns: tableGrid,
            gap: '8px',
            padding: '11px 0',
            borderBottom: idx < data.zones.length - 1 ? '1px solid #202027' : 'none',
            alignItems: 'center',
            minWidth: '760px',
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 800,
              background: getZoneColor(zone.type),
              color: '#fff',
              width: 'fit-content',
            }}>{zone.type}</span>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{zone.price.toFixed(2)}</span>
            <span style={{ color: getStatusColor(zone.status), fontSize: '13px' }}>{zone.status}</span>
            <span style={{ color: '#b8d7ff', fontSize: '13px' }}>{zone.age}</span>
            <span style={{ color: zone.obConfluence ? '#33e681' : '#66738a', fontSize: '13px', fontWeight: zone.obConfluence ? 700 : 400 }}>
              {zone.obConfluence ? 'YES' : 'NO'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {sessionCards.map((session) => (
          <div key={session.name} style={card}>
            <p style={{ color: '#facc15', fontWeight: 700, fontSize: '14px', marginBottom: '16px', marginTop: 0 }}>{session.name}</p>
            {[
              { label: 'High', value: formatPrice(session.data.high), isRange: false },
              { label: 'Low', value: formatPrice(session.data.low), isRange: false },
              { label: 'Mid', value: formatPrice(session.data.mid), isRange: false },
              { label: 'Range', value: formatRange(session.data.range), isRange: true },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ color: '#8090ad', fontSize: '12px' }}>{item.label}</span>
                <span style={{ color: item.isRange ? '#facc15' : '#fff', fontSize: '12px', fontWeight: item.isRange ? 700 : 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #24242a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0' }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>Risk Warning:</span> Trading foreign exchange on margin carries a high level of risk and may not be suitable for all investors.
          </p>
          <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>&copy; 2026 FARONE.AI &mdash; Powered by MetaTrader 5 | Contact: admin@faronecapital.online</p>
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
