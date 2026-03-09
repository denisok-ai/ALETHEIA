'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DayData {
  date: string;
  revenue: number;
  count: number;
}

export function RevenueChart({ data }: { data: DayData[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v ?? 0)} ₽`} />
          <Tooltip
            formatter={(value) => [`${Number(value ?? 0).toLocaleString('ru')} ₽`]}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="revenue" fill="#2D1B4E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
