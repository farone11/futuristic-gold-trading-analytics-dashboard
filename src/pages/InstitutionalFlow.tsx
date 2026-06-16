import { useEffect, useState, useRef } from "react";
import PageLayout from "../components/PageLayout"; // TAMBAH INI

const API_URL = import.meta.env.VITE_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────
interface CotHistoryItem {
  week: string;
  value: number;
  date: string;
}

interface FlowSummary {
  institutional_net: number | null;
  managed_long: number | null;
  managed_short: number | null;
  commercial_hedgers: number | null;
  non_reportable: number | null;
  yoy_change: number | null;
}

interface CotData {
  asOf: string;
  netNonCommercial: number | null;
  longPositions: number | null;
  shortPositions: number | null;
  history: CotHistoryItem[];
}

interface SentimentData {
  longPct: number | null;
  shortPct: number | null;
}

interface SmartMoneyData {
  value: number | null;
  signal: string | null;
  updated: string | null;
}

interface FlowState {
  cot: CotData;
  sentiment: SentimentData;
  smartMoney: SmartMoneyData;
  flow_summary: FlowSummary;
  isLive: boolean;
  lastUpdate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null, dec = 0) =>
  n == null ? "---" : n.toLocaleString("en-US", { maximumFractionDigits: dec });

const pct = (n: number | null) => (n == null ? "--%" : `${n.toFixed(0)}%`);

const signalColor = (signal: string | null) => {
  if (!signal) return "#a0a0a0";
  const s = signal.toLowerCase();
  if (s.includes("bull") || s.includes("long") || s.includes("buy")) return "#22c55e";
  if (s.includes("bear") || s.includes("short") || s.includes("sell")) return "#ef4444";
  return "#f5c518";
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function LiveBadge({ live, price }: { live: boolean; price?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: live ? "#22c55e" : "#ef4444",
          display: "inline-block",
          boxShadow: live ? "0 0 6px #22c55e" : "none",
          animation: live ? "pulse 2s infinite" : "none",
        }}
      />
      <span style={{ color: live ? "#22c55e" : "#ef4444", fontSize: 14, fontWeight: 600 }}>
        {live ? "WebSocket Live" : "Disconnected"} {price ? `| $${fmt(price, 2)}` : ""}
      </span>
    </div>
  );
}

function Card({
  title,
  subtitle,
  accent = "#f5c518",
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#111418",
        border: "1px solid #2a2d35",
        borderRadius: 8,
        padding: "20px 24px",
        flex: 1,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: accent, fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: 0, textTransform: "uppercase" }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0", fontWeight: 400 }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function CotBar({ week, value }: { week: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <span style={{ color: "#6b7280", fontSize: 12, width: 56, flexShrink: 0 }}>{week}</span>
      <div style={{ flex: 1, background: "#1e2229", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: "linear-gradient(90deg, #f5c518, #d4a017)",
            borderRadius: 4,
            transition: "width 0.8s ease",
          }}
        />
      </div>
      <span style={{ color: "#e0e0e0", fontSize: 12, width: 32, textAlign: "right", flexShrink: 0 }}>{value}%</span>
    </div>
  );
}

function FlowSummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e2229" }}>
      <span style={{ color: "#9ca3af", fontSize: 13 }}>{label}</span>
      <span style={{ color: color || "#e0e0e0", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InstitutionalFlow() {
  const [state, setState] = useState<FlowState>({
    isLive: false,
    lastUpdate: "--:--:--",
    cot: {
      asOf: "--/--/--",
      netNonCommercial: null,
      longPositions: null,
      shortPositions: null,
      history: [],
    },
    sentiment: { longPct: null, shortPct: null },
    smartMoney: { value: null, signal: null, updated: null },
    flow_summary: {
      institutional_net: null,
      managed_long: null,
      managed_short: null,
      commercial_hedgers: null,
      non_reportable: null,
      yoy_change: null,
    },
  });
  const [currentPrice, setCurrentPrice] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    try {
      const mainRes = await fetch(`${API_URL}/api`, { signal: AbortSignal.timeout(4000) });
      const mainJson = await mainRes.json();
      
      const instRes = await fetch(`${API_URL}/api/institutional?v=${Date.now()}`, { signal: AbortSignal.timeout(4000) }); // CACHE BUST
      const instJson = await instRes.json();

      setCurrentPrice(mainJson.price || 0);
      setState({
        isLive: true,
        lastUpdate: mainJson.updated || new Date().toLocaleTimeString(),
        cot: {
          asOf: instJson.cftc?.date || "--/--/--",
          netNonCommercial: instJson.cftc?.net || null,
          longPositions: instJson.cftc?.long || null,
          shortPositions: instJson.cftc?.short || null,
          history: instJson.cot_history || [],
        },
        sentiment: {
          longPct: instJson.retail?.long || null,
          shortPct: instJson.retail?.short || null,
        },
        smartMoney: {
          value: instJson.smi?.value || null,
          signal: instJson.smi?.bias || null,
          updated: instJson.smi?.updated || null,
        },
        flow_summary: {
          institutional_net: instJson.flow_summary?.institutional_net ?? null,
          managed_long: instJson.flow_summary?.managed_long ?? null,
          managed_short: instJson.flow_summary?.managed_short ?? null,
          commercial_hedgers: instJson.flow_summary?.commercial_hedgers ?? null,
          non_reportable: instJson.flow_summary?.non_reportable ?? null,
          yoy_change: instJson.flow_summary?.yoy_change ?? null,
        },
      });
    } catch (e) {
      console.error("Fetch error:", e);
      setState(prev => ({...prev, isLive: false }));
    }
  };

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const { cot, sentiment, smartMoney, flow_summary, isLive } = state;

  const netDisplay =
    cot.netNonCommercial == null
     ? "---"
      : cot.netNonCommercial > 0
     ? `+${fmt(cot.netNonCommercial)}`
      : fmt(cot.netNonCommercial);

  return (
    <PageLayout title="INSTITUTIONAL FLOW ANALYSIS" badge="Live from MT5 + Tailscale" badgeColor="text-green-400">
      <style>{`@keyframes pulse {0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div style={{ marginBottom: 24 }}>
        <LiveBadge live={isLive} price={currentPrice} />
      </div>

      {/* ── Row 1: CFTC COT | Retail Sentiment | Smart Money ───────────────── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <Card title="CFTC COT Report" subtitle={`As of ${cot.asOf}`} accent="#f5c518">
          <div style={{ textAlign: "center", padding: "12px 0 16px" }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: cot.netNonCommercial == null ? "#6b7280" : cot.netNonCommercial >= 0 ? "#f5c518" : "#ef4444", letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>
              {netDisplay}
            </span>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "6px 0 0" }}>Net Non-Commercial</p>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 12, borderTop: "1px solid #1e2229" }}>
            <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Long: {fmt(cot.longPositions)}</span>
            <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>Short: {fmt(cot.shortPositions)}</span>
          </div>
        </Card>

        <Card title="Retail Sentiment SWFX" subtitle="Live MT5" accent="#22c55e">
          <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e", fontVariantNumeric: "tabular-nums" }}>
                  {pct(sentiment.longPct)}
                </div>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>Long</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                  {pct(sentiment.shortPct)}
                </div>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>Short</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Smart Money Index" accent="#a78bfa">
          <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: smartMoney.value == null ? "#f5c518" : signalColor(smartMoney.signal), letterSpacing: 1, marginBottom: 6 }}>
              {smartMoney.value == null ? "--" : fmt(smartMoney.value, 0)}
            </div>
            <div style={{ color: signalColor(smartMoney.signal), fontSize: 14, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              {smartMoney.signal ?? "NEUTRAL"}
            </div>
            <div style={{ color: "#6b7280", fontSize: 11 }}>Updated: {smartMoney.updated ?? "--:--:--"}</div>
          </div>
        </Card>
      </div>

      {/* ── Row 2: COT History | Flow Summary ──────────────── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card title="COT Positioning History" accent="#f5c518">
          <div style={{ marginTop: 4 }}>
            {cot.history.length > 0 ? cot.history.map((h) => (
              <CotBar key={h.week} week={h.week} value={h.value} />
            )) : <div style={{ color: "#6b7280", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No history data</div>}
          </div>
        </Card>

        <Card title="Flow Summary" accent="#f5c518">
          <div>
            <FlowSummaryRow
              label="Institutional Net Position"
              value={fmt(flow_summary.institutional_net)}
              color={
                flow_summary.institutional_net != null
                 ? flow_summary.institutional_net >= 0
                   ? "#22c55e"
                    : "#ef4444"
                  : "#6b7280"
              }
            />
            <FlowSummaryRow label="Managed Money Long" value={fmt(flow_summary.managed_long)} color="#22c55e" />
            <FlowSummaryRow label="Managed Money Short" value={fmt(flow_summary.managed_short)} color="#ef4444" />
            <FlowSummaryRow label="Commercial Hedgers" value={fmt(flow_summary.commercial_hedgers)} color="#3b82f6" />
            <FlowSummaryRow label="Non-Reportable" value={fmt(flow_summary.non_reportable)} color="#a78bfa" />
            <FlowSummaryRow label="YoY Change" value={flow_summary.yoy_change != null ? `${flow_summary.yoy_change}%` : '---%'} color={flow_summary.yoy_change != null && flow_summary.yoy_change >= 0 ? "#22c55e" : "#ef4444"} />
          </div>
        </Card>
      </div>
      {/* FOOTER DIHAPUS - SUDAH DIHANDLE PageLayout.tsx */}
    </PageLayout>
  );
}
