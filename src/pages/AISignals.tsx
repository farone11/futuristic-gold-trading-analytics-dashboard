import {
  Activity,
  Shield,
  TrendingUp,
  Zap,
  Flame,
  BarChart3
} from "lucide-react";

export default function AISignals() {
  const signal = null; // nanti inject dari API / MT5

  return (
    <div className="flex min-h-screen bg-black text-white">

      {/* Sidebar */}
      <aside className="w-64 border-r border-yellow-500/20 bg-[#05070d]">
        <div className="p-6">
          <h1 className="text-yellow-400 font-bold text-2xl">
            FARONE
          </h1>
          <p className="text-yellow-500 text-sm">
            GOLD AI
          </p>
        </div>

        <nav className="space-y-2 px-4">
          {[
            ["Dashboard", Activity],
            ["Institutional Flow", TrendingUp],
            ["Liquidity Zones", Flame],
            ["Risk Engine", Shield],
            ["AI Signals", Zap]
          ].map(([name, Icon]) => (
            <button
              key={name}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition
              ${name === "AI Signals"
                ? "bg-yellow-500/10 border border-yellow-500/40 text-yellow-400"
                : "hover:bg-white/5 text-gray-300"}
              `}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">

        <h1 className="text-4xl font-bold">
          AI SIGNAL CENTER
        </h1>

        <p className="text-gray-400 mt-2">
          Live trade signals from 5-layer confluence engine
        </p>

        {/* Signal Card */}
        <section className="mt-8 rounded-2xl border border-yellow-500/10 bg-[#090d17] p-8">

          <h2 className="text-yellow-400 font-semibold">
            Current Signal
          </h2>

          <div className="grid grid-cols-5 gap-8 mt-8">

            <Metric
              title="STATUS"
              value={signal ? "SELL" : "STANDBY"}
              color="text-yellow-400"
            />

            <Metric title="ENTRY" value="-----.--" />
            <Metric title="STOP LOSS" value="-----.--" color="text-red-400" />
            <Metric title="TAKE PROFIT 1" value="-----.--" color="text-green-400" />
            <Metric title="TAKE PROFIT 2" value="-----.--" color="text-green-400" />

          </div>

          <div className="mt-8 border-t border-white/5 pt-6 text-center">
            <p className="text-gray-500">
              No confluence
            </p>

            <p className="text-sm text-gray-600 mt-2">
              Last Update: ----- | Risk: 1% per trade
            </p>
          </div>

        </section>

        {/* Mid Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mt-6">

          <Card title="5-Layer Confluence Engine">

            <Row name="Maxwell AI" status="Waiting" />
            <Row name="Order Block (OB)" status="Scanning" />
            <Row name="Liquidity Detection" status="Monitoring" />
            <Row name="COT Analysis" status="Loaded" />
            <Row name="Seasonal Patterns" status="Loaded" />

          </Card>

          <Card title="Signal History">

            <div className="h-64 flex items-center justify-center text-gray-500">
              No signal history available
            </div>

          </Card>

        </div>

        {/* Bottom Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mt-6">

          <Card title="Entry Criteria">

            <ul className="space-y-3 text-gray-300">
              <li>Minimum 3/5 confluence layers active</li>
              <li>OB + Liquidity required</li>
              <li>COT alignment required</li>
              <li>London / NY overlap</li>
            </ul>

          </Card>

          <Card title="Risk Parameters">

            <Stat label="Risk Per Trade" value="1%" />
            <Stat label="Min R:R" value="1:2" />
            <Stat label="Max Trades / Day" value="3" />
            <Stat label="Max Open Positions" value="2" />

          </Card>

          <Card title="Performance Stats">

            <Stat label="Total Signals" value="0" />
            <Stat label="Win Rate" value="0%" />
            <Stat label="Avg RR" value="0.0" />
            <Stat label="Last Signal" value="None" />

          </Card>

        </div>

      </main>

    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-yellow-500/10 bg-[#090d17] p-6">
      <h3 className="text-yellow-400 font-semibold mb-6">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ title, value, color }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-3">
        {title}
      </div>

      <div className={`text-4xl font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}

function Row({ name, status }) {
  return (
    <div className="flex justify-between py-5 border-b border-white/5">
      <span>{name}</span>
      <span className="text-cyan-400">
        {status}
      </span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-gray-400">
        {label}
      </span>

      <span className="font-semibold">
        {value}
      </span>
    </div>
  );
}
