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

type ApiZone = Partial<{
  type: string;
  price: number | string;
  price_zone: number | string;
  status: string;
  age: string;
  obConfluence: boolean;
  ob_confluence: boolean;
}>;

const emptySession: SessionData = { high: null, low: null, mid: null, range: null };

const demoLiquidityData: LiquidityData = {
  buySideLiquidity: 2,
  sellSideLiquidity: 6,
  sessionLiquidity: 0,
  zones: [
    { type: 'SSL', price: 4438.88, status: 'ACTIVE', age: '16h', obConfluence: true },
    { type: 'SSL', price: 4433.59, status: 'ACTIVE', age: '9h', obConfluence: true },
    { type: 'SSL', price: 4426.14, status: 'ACTIVE', age: '12h', obConfluence: true },
    { type: 'SSL', price: 4452.35, status: 'AGED', age: '26h', obConfluence: false },
    { type: 'SSL', price: 4452.68, status: 'AGED', age: '48h', obConfluence: false },
    { type: 'BSL', price: 4458.03, status: 'ACTIVE', age: '14h', obConfluence: false },
    { type: 'SSL', price: 4478.52, status: 'AGED', age: '31h', obConfluence: false },
    { type: 'BSL', price: 4488.24, status: 'ACTIVE', age: '21h', obConfluence: false },
  ],
  asiaSession: emptySession,
  londonSession: emptySession,
  newYorkSession: emptySession,
  lastUpdate: 'demo',
  activeZones: 5,
};

const normalizeZones = (zones: ApiZone[] = []): LiquidityZone[] => zones
  .map((zone) => {
    const type = zone.type === 'BSL' ? 'BSL' : zone.type === 'SSL' ? 'SSL' : null;
    const price = Number(zone.price ?? zone.price_zone);
    const status = zone.status === 'AGED' || zone.status === 'SWEPT' ? zone.status : 'ACTIVE';

    if (!type || !Number.isFinite(price)) return null;

    return {
      type,
      price,
      status,
      age: zone.age ?? '--',
      obConfluence: Boolean(zone.obConfluence ?? zone.ob_confluence),
    };
  })
  .filter((zone): zone is LiquidityZone => zone !== null);

export default function LiquidityZones() {
  const [data, setData] = useState<LiquidityData>(demoLiquidityData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/liquidity');
        if (response.ok) {
          const json = await response.json();
          const zones = normalizeZones(json.zones ?? json.liquidity_zones ?? []);

          if (json) {
            setData({
              buySideLiquidity: json.buy_side_count ?? zones.filter((zone) => zone.type === 'BSL').length,
              sellSideLiquidity: json.sell_side_count ?? zones.filter((zone) => zone.type === 'SSL').length,
              sessionLiquidity: json.session_count ?? 0,
              zones,
              asiaSession: json.asia_session ?? emptySession,
              londonSession: json.london_session ?? emptySession,
              newYorkSession: json.new_york_session ?? emptySession,
              lastUpdate: json.timestamp ?? json.updated ?? '--:--:--',
              activeZones: json.active_zones ?? zones.filter((zone) => zone.status === 'ACTIVE').length,
            });
          }
        }
      } catch {
        setData(demoLiquidityData);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const displayData = data.zones.length > 0 ? data : demoLiquidityData;

  const formatPrice = (price: number | null) => price === null ? '----.--' : price.toFixed(2);
  const formatRange = (range: number | null) => range === null ? '--- pips' : `${range.toFixed(0)} pips`;

  const now = new Date();
  const timeStr = displayData.lastUpdate && displayData.lastUpdate !== 'demo'
    ? displayData.lastUpdate
    : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const card: React.CSSProperties = { background: '#111113', border: '1px solid #24242a', borderRadius: '8px', padding: '20px' };
  const labelStyle: React.CSSProperties = { color: '#9fb0cb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px', marginTop: 0 };
  const tableGrid = '90px minmax(160px, 1fr) 120px 80px 140px';

  const sessionCards = [
    { name: 'Asia Session', data: displayData.asiaSession },
    { name: 'London Session', data: displayData.londonSession },
    { name: 'New York Session', data: displayData.newYorkSession },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', color: '#fff', padding: '28px 20px 24px', fontFamily: 'inherit', boxSizing: 'border-box' }}>
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
          <p style={{ fontSize: '36px', fontWeight: 800, color: '#ff6b6b', margin: '0 0 6px 0', lineHeight: 1 }}>{displayData.buySideLiquidity}</p>
          <p style={{ color: '#8090ad', fontSize: '12px', margin: 0 }}>Above Highs &middot; Sweep Target</p>
        </div>

        <div style={card}>
          <p style={labelStyle}>Sell-Side Liquidity</p>
          <p style={{ fontSize: '36px', fontWeight: 800, color: '#33e681', margin: '0 0 6px 0', lineHeight: 1 }}>{displayData.sellSideLiquidity}</p>
          <p style={{ color: '#8090ad', fontSize: '12px', margin: 0 }}>Below Lows &middot; Sweep Target</p>
        </div>

        <div style={card}>
          <p style={labelStyle}>Session Liquidity</p>
          <p style={{ fontSize: '36px', fontWeight: 800, color: '#68a3ff', margin: '0 0 6px 0', lineHeight: 1 }}>{displayData.sessionLiquidity}</p>
          <p style={{ color: '#8090ad', fontSize: '12px', margin: 0 }}>Asia / London / NY</p>
        </div>
      </div>

      <div style={{ ...card, marginBottom: '16px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', minWidth: '760px' }}>
          <p style={{ color: '#facc15', fontWeight: 700, fontSize: '14px', margin: 0 }}>Active Liquidity Zones</p>
          <span style={{ color: '#facc15', fontSize: '11px' }}>{displayData.activeZones} active &middot; {timeStr}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: tableGrid, gap: '8px', padding: '0 0 10px', borderBottom: '1px solid #24242a', minWidth: '760px' }}>
          {['Type', 'Price Zone', 'Status', 'Age', 'OB Confluence'].map((h) => (
            <span key={h} style={{ color: '#8fa2c2', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{h}</span>
          ))}
        </div>

        {displayData.zones.map((zone, idx) => (
          <div key={`${zone.type}-${zone.price}-${idx}`} style={{
            display: 'grid',
            gridTemplateColumns: tableGrid,
            gap: '8px',
            padding: '11px 0',
            borderBottom: idx < displayData.zones.length - 1 ? '1px solid #202027' : 'none',
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
              background: zone.type === 'BSL' ? '#ef2f3a' : '#19c463',
              color: '#fff',
              width: 'fit-content',
            }}>{zone.type}</span>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{zone.price.toFixed(2)}</span>
            <span style={{ color: zone.status === 'ACTIVE' ? '#33e681' : '#6f7f99', fontSize: '13px' }}>{zone.status}</span>
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
          <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>&copy; 2026 FARONE.AI &mdash; Powered by MetaTrader 5 | Contact: farone2013@gmail.com for licensing</p>
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
