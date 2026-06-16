import type { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  children: ReactNode;
}

export default function PageLayout({ title, subtitle, badge, badgeColor = 'text-green-400', children }: PageLayoutProps) {
  // AMBIL DARI .env ATAU HAPUS AJA KALO GA PERLU
  const appYear = import.meta.env.VITE_APP_YEAR || '2026';
  const appName = import.meta.env.VITE_APP_NAME || 'FARONE.AI';
  const appContact = import.meta.env.VITE_APP_CONTACT || 'farone2013@gmail.com';

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0c]">
      <div className="flex-1 p-5">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-white font-bold text-xl tracking-wide uppercase">{title}</h1>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
          {badge && <p className={`text-xs mt-1 ${badgeColor}`}>• {badge}</p>}
        </div>
        {children}
      </div>

      {/* Footer - GA HARDCODE AUTHORS LAGI */}
      <footer className="border-t border-[#1e1e24] px-5 py-3 flex items-start justify-between text-xs text-gray-600">
        <div>
          <span className="text-red-400 font-semibold">Risk Warning:</span> Trading foreign exchange on margin carries a high level of risk and may not be suitable for all investors.
          <br />© {appYear} {appName} — Powered by MetaTrader 5 | Contact: {appContact} for licensing
        </div>
        {/* HAPUS BAGIAN AUTHORS HARDCODE */}
        <div className="text-right shrink-0 ml-4">
          <div className="text-gray-500">Founder @ Aitopia</div>
        </div>
      </footer>
    </div>
  );
}
