import { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import InstitutionalFlow from './pages/InstitutionalFlow';
import LiquidityZones from './pages/LiquidityZones';
import RiskEngine from './pages/RiskEngine';
import AISignals from './pages/AISignals';

interface AppContextType {
  liveData: any;
  signalHistory: any[];
  isConnected: boolean;
  apiUrl: string;
}

const AppContext = createContext<AppContextType>({
  liveData: {},
  signalHistory: [],
  isConnected: false,
  apiUrl: ''
});

export const useAppData = () => useContext(AppContext);

const API_URL = import.meta.env.VITE_API_URL || 'https://future-production-67e6.up.railway.app';

function AppContent() {
  const [liveData, setLiveData] = useState<any>({});
  const [signalHistory, setSignalHistory] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentYear, setCurrentYear] = useState(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    
    const fetchData = async () => {
      try {
        const [dashboardRes, historyRes] = await Promise.all([
          fetch(`${API_URL}/api/dashboard`),
          fetch(`${API_URL}/api/signal-history`)
        ]);
        const dashboardData = await dashboardRes.json();
        const historyData = await historyRes.json();
        setLiveData(dashboardData);
        setSignalHistory(historyData.history || []);
      } catch (e) {
        console.error("API fetch error:", e);
      }
    };
    fetchData();

    const socket = io(`${API_URL}`, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('signal', (data: any) => setLiveData(data));

    const historyInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/signal-history`);
        const data = await res.json();
        setSignalHistory(data.history || []);
      } catch (e) {
        console.error("History fetch error:", e);
      }
    }, 15000);

    return () => {
      socket.disconnect();
      clearInterval(historyInterval);
    };
  }, []);

  return (
    <AppContext.Provider value={{ liveData, signalHistory, isConnected, apiUrl: API_URL }}>
      <div className="flex h-screen bg-[#0a0a0c] text-gray-100">
        <Sidebar />
        {/* GANTI overflow-hidden JADI overflow-y-auto DI SINI */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <main className="flex-1">
            <div className="fixed top-2 right-4 z-50">
              <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {isConnected ? '● LIVE' : '● OFFLINE'}
              </span>
            </div>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/institutional-flow" element={<InstitutionalFlow />} />
              <Route path="/liquidity-zones" element={<LiquidityZones />} />
              <Route path="/risk-engine" element={<RiskEngine />} />
              <Route path="/ai-signals" element={<AISignals />} />
            </Routes>
          </main>

          {/* FOOTER GLOBAL - SEKARANG PASTI MUNCUL */}
          <footer className="border-t border-[#1e1e24] px-5 py-3 flex items-start justify-between text-xs text-gray-600 shrink-0 bg-[#0a0a0c] z-10">
            <div>
              <span className="text-red-400 font-semibold">Risk Warning:</span> Trading foreign exchange on margin carries a high level of risk and may not be suitable for all investors.
              <br />© {currentYear} FARONE.AI — Powered by MetaTrader 5 | Contact: farone2013@gmail.com for licensing
            </div>
            <div className="text-right shrink-0 ml-4">
              <div className="text-gray-500 mb-1">Authors</div>
              <div>
                <span className="text-yellow-400">Setiawan F</span>
                <span className="text-gray-500"> | </span>
                <span className="text-yellow-400">Selviana R</span>
              </div>
              <div className="text-gray-500">Founder @ Aitopia</div>
            </div>
          </footer>
        </div>
      </div>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
