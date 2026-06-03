import { useEffect, useState } from 'react';

export default function InstitutionalFlow() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/institutional_flow.json')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return <div className="p-8 text-white">Loading CFTC data...</div>;

  const { cftc, orderflow, smart_money_index } = data;
  const bias = smart_money_index >= 60 ? 'BULLISH' : smart_money_index <= 40 ? 'BEARISH' : 'NEUTRAL';
  const biasColor = bias === 'BULLISH' ? 'text-green-400' : bias === 'BEARISH' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-bold text-yellow-400 mb-6">Institutional Flow Analysis</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 p-6 rounded-xl border border-yellow-500/20">
          <h2 className="text-xl text-yellow-400 mb-2">CFTC COT Report</h2>
          <p className="text-sm text-gray-400">As of {cftc.date}</p>
          <p className="text-4xl mt-3">{cftc.net_noncomm.toLocaleString()}</p>
          <p className="text-gray-400">Net Non-Commercial</p>
          <div className="mt-4 text-sm space-y-1">
            <p>Long: <span className="text-green-400">{cftc.noncomm_long.toLocaleString()}</span></p>
            <p>Short: <span className="text-red-400">{cftc.noncomm_short.toLocaleString()}</span></p>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl border border-yellow-500/20">
          <h2 className="text-xl text-yellow-400 mb-2">Retail Sentiment</h2>
          <p className="text-sm text-gray-400">{orderflow.source}</p>
          <div className="flex justify-between mt-4">
            <div>
              <p className="text-4xl text-green-400">{orderflow.long_percent}%</p>
              <p className="text-gray-400">Long</p>
            </div>
            <div>
              <p className="text-4xl text-red-400">{orderflow.short_percent}%</p>
              <p className="text-gray-400">Short</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl border border-yellow-500/20">
          <h2 className="text-xl text-yellow-400 mb-2">Smart Money Index</h2>
          <p className={`text-6xl mt-2 ${biasColor}`}>{smart_money_index}</p>
          <p className={`text-2xl ${biasColor}`}>{bias}</p>
          <p className="text-xs text-gray-500 mt-4">Updated: {cftc.updated}</p>
        </div>
      </div>
    </div>
  );
}
