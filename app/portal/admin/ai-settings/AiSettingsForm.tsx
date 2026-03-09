'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LlmSettings {
  id?: string;
  key: string;
  provider: string;
  model: string;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
}

export function AiSettingsForm({ initial }: { initial: LlmSettings | null }) {
  const [provider, setProvider] = useState(initial?.provider ?? 'deepseek');
  const [model, setModel] = useState(initial?.model ?? 'deepseek-chat');
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? '');
  const [temperature, setTemperature] = useState(String(initial?.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState(String(initial?.max_tokens ?? 2000));
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
          key: 'chatbot',
          provider,
          model,
          system_prompt: systemPrompt || null,
          temperature: parseFloat(temperature) || 0.7,
          max_tokens: parseInt(maxTokens, 10) || 2000,
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
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4 rounded-xl border border-border bg-white p-6">
      <div>
        <Label htmlFor="provider">Провайдер</Label>
        <Input
          id="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="model">Модель</Label>
        <Input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="prompt">System prompt (для чат-бота)</Label>
        <textarea
          id="prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-lg border border-border px-4 py-2 font-mono text-sm"
          placeholder="You are a helpful assistant for AVATERRA school..."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="temperature">Temperature (0–1)</Label>
          <Input
            id="temperature"
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
          <Label htmlFor="max_tokens">Max tokens</Label>
          <Input
            id="max_tokens"
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
