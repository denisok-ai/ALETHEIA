'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import type { Profile } from '@/lib/auth';

interface PortalUIContextValue {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  user: { email?: string | null };
  profile: Profile | null;
}

const PortalUIContext = createContext<PortalUIContextValue | null>(null);

export function usePortalUI() {
  const ctx = useContext(PortalUIContext);
  return ctx ?? { mobileMenuOpen: false, setMobileMenuOpen: () => {}, user: {}, profile: null };
}

/** Вызов ping для трекинга активности (онлайн) при загрузке портала и по таймеру. */
function PingOnMount() {
  useEffect(() => {
    const ping = () => fetch('/api/portal/ping', { credentials: 'include' }).catch(() => {});
    ping();
    const t = setInterval(ping, 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return null;
}

function MobileMenuBar() {
  const { setMobileMenuOpen } = usePortalUI();
  return (
    <div className="flex h-10 shrink-0 items-center border-b border-[#E2E8F0] bg-white px-3 lg:hidden">
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--portal-text)] hover:bg-[#F8FAFC]"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}

interface PortalUIProviderProps {
  user: { email?: string | null };
  profile: Profile | null;
  portalTitle?: string;
  children: React.ReactNode;
}

export function PortalUIProvider({ user, profile, children }: PortalUIProviderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const value: PortalUIContextValue = { mobileMenuOpen, setMobileMenuOpen, user, profile };

  return (
    <PortalUIContext.Provider value={value}>
      <PingOnMount />
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--portal-bg)]">
        <MobileMenuBar />
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>
    </PortalUIContext.Provider>
  );
}
