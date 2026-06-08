import { useState, useEffect, createContext, useContext } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import InstitutionalFlow from './pages/InstitutionalFlow';
import LiquidityZones from './pages/LiquidityZones';
import RiskEngine from './pages/RiskEngine';
import AISignals from './pages/AISignals';
import { io } from 'socket.io-client';

type Page = 'dashboard' | 'institutional-flow' | 'liquidity-zones' | 'risk-engine' | 'ai-signals';

// 1. Context buat share data ke semua page
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

// 2. API URL dari env, fallback ke Railway kamu
const API_URL = import.meta.env.VITE_API_URL || 'https://future-production-67e6.up.railway.app';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [liveData, setLiveData] = useState<any>({});
  const [signalHistory, setSignalHistory] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 3. WebSocket + Polling buat live data
  useEffect(() => {
    // Fetch initial data
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

    // WebSocket buat update real-time
    const socket = io(`${API_URL}`, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('✅ WebSocket Connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('⚠ WebSocket Disconnected');
    });

    socket.on('signal', (data: any) => {
      setLiveData(data); // Update price, signal, account langsung
    });

    // Polling history tiap 15 detik, karena history nggak dikirim via WS
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

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'institutional-flow': return <InstitutionalFlow />;
      case 'liquidity-zones': return <LiquidityZones />;
      case 'risk-engine': return <RiskEngine />;
      case 'ai-signals': return <AISignals />;
    }
  };

  return (
    <AppContext.Provider value={{ liveData, signalHistory, isConnected, apiUrl: API_URL }}>
      <div className="flex min-h-screen bg-[#0a0a0c] text-gray-100">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Status koneksi */}
          <div className="fixed top-2 right-4 z-50">
            <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {isConnected ? '● LIVE' : '● OFFLINE'}
            </span>
          </div>
          {renderPage()}
        </main>
      </div>
    </AppContext.Provider>
  );
}
