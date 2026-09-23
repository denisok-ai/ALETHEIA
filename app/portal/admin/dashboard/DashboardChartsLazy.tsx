'use client';

import dynamic from 'next/dynamic';

function DashboardChartsFallback() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true" aria-label="Загрузка графиков">
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-[#E2E8F0]" />
      <div className="portal-card h-72 animate-pulse rounded-xl bg-[#F1F5F9] md:h-80" />
      <div className="portal-card h-72 animate-pulse rounded-xl bg-[#F1F5F9] md:h-80" />
    </div>
  );
}

/** Графики (recharts) — только на клиенте; Next 16 требует клиентскую обёртку для `ssr: false`. */
export const DashboardChartsLazy = dynamic(() => import('./DashboardCharts').then((m) => ({ default: m.DashboardCharts })), {
  ssr: false,
  loading: () => <DashboardChartsFallback />,
});
