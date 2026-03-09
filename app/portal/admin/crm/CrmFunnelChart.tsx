'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STAGES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const STAGE_LABELS: Record<string, string> = {
  new: 'Новые',
  contacted: 'Контакт',
  qualified: 'Квалифицированы',
  converted: 'Конвертированы',
  lost: 'Потеряны',
};
const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#6b7280'];

interface FunnelData {
  stage: string;
  count: number;
  label: string;
}

export function CrmFunnelChart({ byStatus }: { byStatus: Record<string, number> }) {
  const data: FunnelData[] = STAGES.map((s) => ({
    stage: s,
    count: byStatus[s] ?? 0,
    label: STAGE_LABELS[s] ?? s,
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 60, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={(v) => [Number(v ?? 0), 'Лидов']} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
