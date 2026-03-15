'use client';

import { createContext, useContext, useState, useEffect } from 'react';
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
    const t = setInterval(ping, 120 * 1000);
    return () => clearInterval(t);
  }, []);
  return null;
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
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>
    </PortalUIContext.Provider>
  );
}
