'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CourseTutorSettings {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

export function CourseTutorForm({ initial }: { initial: CourseTutorSettings | null }) {
  const [provider, setProvider] = useState(initial?.provider ?? 'deepseek');
  const [model, setModel] = useState(initial?.model ?? 'deepseek-chat');
  const [temperature, setTemperature] = useState(String(initial?.temperature ?? 0.5));
  const [maxTokens, setMaxTokens] = useState(String(initial?.max_tokens ?? 1500));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/portal/admin/llm-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'course-tutor',
          provider,
          model,
          system_prompt: null,
          temperature: parseFloat(temperature) || 0.5,
          max_tokens: parseInt(maxTokens, 10) || 1500,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-2xl space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-6">
      <p className="text-sm text-[var(--portal-text-muted)]">
        Модель и параметры для AI-тьютора в плеере курса (ответы по материалам курса). System prompt формируется автоматически.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ct-provider">Провайдер</Label>
          <Input
            id="ct-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ct-model">Модель</Label>
          <Input id="ct-model" value={model} onChange={(e) => setModel(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ct-temperature">Temperature (0–1)</Label>
          <Input
            id="ct-temperature"
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ct-max_tokens">Max tokens</Label>
          <Input
            id="ct-max_tokens"
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        {saved && <span className="text-sm text-green-600">Сохранено</span>}
      </div>
    </form>
  );
}
