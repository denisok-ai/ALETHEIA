'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/portal/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Trash2 } from 'lucide-react';

type ApiKeyRef = { id: string; name: string; provider: string };

type LlmConfig = {
  provider: string;
  model: string;
  system_prompt?: string | null;
  temperature: number;
  max_tokens: number;
  api_key_set?: boolean;
  api_key_id?: string | null;
  api_key_ref?: ApiKeyRef | null;
};

const PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'other', label: 'Другой' },
] as const;

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner', 'deepseek-r1'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'o1-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  other: [],
};

const DEFAULT_CHATBOT: LlmConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  system_prompt: null,
  temperature: 0.7,
  max_tokens: 2000,
};
const DEFAULT_TUTOR: LlmConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  system_prompt: null,
  temperature: 0.5,
  max_tokens: 1500,
};

export function LlmAndChatbotBlock({
  chatbotInitial,
  tutorInitial,
}: {
  chatbotInitial: LlmConfig | null;
  tutorInitial: LlmConfig | null;
}) {
  const [apiKeys, setApiKeys] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState('deepseek');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [addingKey, setAddingKey] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);

  const normProvider = (p: string) => (p && PROVIDERS.some((x) => x.id === p) ? p : 'other');
  const [chatbot, setChatbot] = useState<LlmConfig & { api_key: string; api_key_id: string | null }>({
    ...(chatbotInitial ?? DEFAULT_CHATBOT),
    provider: normProvider(chatbotInitial?.provider ?? ''),
    api_key: '',
    api_key_id: chatbotInitial?.api_key_id ?? null,
    api_key_set: chatbotInitial?.api_key_set ?? false,
  });
  const [tutor, setTutor] = useState<LlmConfig & { api_key: string; api_key_id: string | null }>({
    ...(tutorInitial ?? DEFAULT_TUTOR),
    provider: normProvider(tutorInitial?.provider ?? ''),
    api_key: '',
    api_key_id: tutorInitial?.api_key_id ?? null,
    api_key_set: tutorInitial?.api_key_set ?? false,
  });

  const [savingChatbot, setSavingChatbot] = useState(false);
  const [savingTutor, setSavingTutor] = useState(false);

  useEffect(() => {
    fetch('/api/portal/admin/llm-settings/api-keys')
      .then((r) => (r.ok ? r.json() : { apiKeys: [] }))
      .then((d) => setApiKeys(d.apiKeys ?? []))
      .catch(() => {});
  }, []);

  async function addApiKey(e: React.FormEvent) {
    e.preventDefault();
    const name = newKeyName.trim();
    const key = newKeyValue.trim();
    if (!name || !key) {
      toast.error('Укажите название и API-ключ');
      return;
    }
    setAddingKey(true);
    try {
      const r = await fetch('/api/portal/admin/llm-settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, provider: newKeyProvider, api_key: key }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(data?.error ?? 'Ошибка');
        return;
      }
      setApiKeys((prev) => [data.apiKey, ...prev]);
      setNewKeyName('');
      setNewKeyValue('');
      toast.success('Ключ добавлен');
    } catch {
      toast.error('Ошибка');
    } finally {
      setAddingKey(false);
    }
  }

  async function removeApiKey(id: string) {
    const r = await fetch(`/api/portal/admin/llm-settings/api-keys/${id}`, { method: 'DELETE' });
    if (!r.ok) return;
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    if (chatbot.api_key_id === id) setChatbot((p) => ({ ...p, api_key_id: null }));
    if (tutor.api_key_id === id) setTutor((p) => ({ ...p, api_key_id: null }));
    setDeleteKeyId(null);
    toast.success('Ключ удалён');
  }

  const chatbotModels = MODELS_BY_PROVIDER[chatbot.provider] ?? [];
  const tutorModels = MODELS_BY_PROVIDER[tutor.provider] ?? [];

  async function saveChatbot(e: React.FormEvent) {
    e.preventDefault();
    setSavingChatbot(true);
    try {
      const body: Record<string, unknown> = {
        key: 'chatbot',
        provider: chatbot.provider === 'other' ? '' : chatbot.provider,
        model: chatbot.model,
        system_prompt: chatbot.system_prompt?.trim() || null,
        temperature: chatbot.temperature,
        max_tokens: chatbot.max_tokens,
      };
      if (chatbot.api_key_id) body.api_key_id = chatbot.api_key_id;
      else if (chatbot.api_key) body.api_key = chatbot.api_key;
      const res = await fetch('/api/portal/admin/llm-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Ошибка сохранения');
        return;
      }
      if (chatbot.api_key) setChatbot((p) => ({ ...p, api_key: '', api_key_set: true }));
      toast.success('Настройки чат-бота сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSavingChatbot(false);
    }
  }

  async function saveTutor(e: React.FormEvent) {
    e.preventDefault();
    setSavingTutor(true);
    try {
      const body: Record<string, unknown> = {
        key: 'course-tutor',
        provider: tutor.provider === 'other' ? '' : tutor.provider,
        model: tutor.model,
        system_prompt: tutor.system_prompt?.trim() ? tutor.system_prompt.trim() : null,
        temperature: tutor.temperature,
        max_tokens: tutor.max_tokens,
      };
      if (tutor.api_key_id) body.api_key_id = tutor.api_key_id;
      else if (tutor.api_key) body.api_key = tutor.api_key;
      const res = await fetch('/api/portal/admin/llm-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Ошибка сохранения');
        return;
      }
      if (tutor.api_key) setTutor((p) => ({ ...p, api_key: '', api_key_set: true }));
      toast.success('Настройки тьютора сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSavingTutor(false);
    }
  }

  return (
    <Card
      title="Подключение LLM: чат на сайте и тьютор в курсе"
      description="Два сценария: публичный чат на лендинге (продажи и вопросы по продукту) и AI в плеере SCORM для записанных студентов (ответы по материалам курса). Ключи и модели можно задать раздельно."
    >
      <div className="space-y-10">
        {/* Сохранённые API ключи */}
        <section className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <h3 className="text-base font-semibold text-[var(--portal-text)] mb-3">Сохранённые API ключи</h3>
          <p className="text-sm text-[var(--portal-text-muted)] mb-4">
            Добавьте ключи для разных провайдеров и выберите нужный в настройках чат-бота или тьютора.
          </p>
          {apiKeys.length > 0 && (
            <Table className="mb-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Провайдер</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.name}</TableCell>
                    <TableCell>{PROVIDERS.find((p) => p.id === k.provider)?.label ?? k.provider}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setDeleteKeyId(k.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <form onSubmit={addApiKey} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <Label htmlFor="new-key-name">Название</Label>
              <Input
                id="new-key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Например: DeepSeek основной"
                className="mt-1"
              />
            </div>
            <div className="min-w-[120px]">
              <Label htmlFor="new-key-provider">Провайдер</Label>
              <select
                id="new-key-provider"
                value={newKeyProvider}
                onChange={(e) => setNewKeyProvider(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
              >
                {PROVIDERS.filter((p) => p.id !== 'other').map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="new-key-value">API-ключ</Label>
              <Input
                id="new-key-value"
                type="password"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="sk-..."
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={addingKey}>{addingKey ? 'Добавление…' : 'Добавить ключ'}</Button>
          </form>
        </section>

        {/* Чат-бот */}
        <section className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <h3 className="text-base font-semibold text-[var(--portal-text)] mb-4">Чат на лендинге (консультант по продукту)</h3>
          <form onSubmit={saveChatbot} className="space-y-4">
            <div>
              <Label>Использовать сохранённый ключ</Label>
              <select
                value={chatbot.api_key_id ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  if (!id) {
                    setChatbot((p) => ({ ...p, api_key_id: null }));
                    return;
                  }
                  const k = apiKeys.find((x) => x.id === id);
                  if (!k) {
                    setChatbot((p) => ({ ...p, api_key_id: id }));
                    return;
                  }
                  const kp =
                    k.provider && PROVIDERS.some((pr) => pr.id === k.provider) ? k.provider : 'other';
                  setChatbot((p) => {
                    const models = MODELS_BY_PROVIDER[kp] ?? [];
                    const nextModel =
                      models.length > 0 && !models.includes(p.model) ? models[0]! : p.model;
                    return { ...p, api_key_id: id, provider: kp, model: nextModel };
                  });
                }}
                className="mt-1 w-full max-w-md rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
              >
                <option value="">— Свой ключ ниже или не менять —</option>
                {apiKeys.map((k) => (
                  <option key={k.id} value={k.id}>{k.name} ({k.provider})</option>
                ))}
              </select>
            </div>
            {!chatbot.api_key_id && (
              <div>
                <Label htmlFor="cb-api-key">Свой API-ключ (если не выбран сохранённый)</Label>
                <Input
                  id="cb-api-key"
                  type="password"
                  value={chatbot.api_key}
                  onChange={(e) => setChatbot((p) => ({ ...p, api_key: e.target.value }))}
                  placeholder={chatbot.api_key_set ? '•••••• (пусто — не менять)' : 'sk-...'}
                  className="mt-1 max-w-md"
                  autoComplete="off"
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cb-provider">Провайдер</Label>
                <select
                  id="cb-provider"
                  value={chatbot.provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setChatbot((prev) => ({
                      ...prev,
                      provider: p,
                      model: (MODELS_BY_PROVIDER[p]?.[0] ?? prev.model),
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="cb-model">Модель</Label>
                {chatbot.provider === 'other' ? (
                  <Input
                    id="cb-model"
                    value={chatbot.model}
                    onChange={(e) => setChatbot((p) => ({ ...p, model: e.target.value }))}
                    placeholder="Например: deepseek-chat"
                    className="mt-1"
                  />
                ) : (
                  <select
                    id="cb-model"
                    value={chatbotModels.includes(chatbot.model) ? chatbot.model : ''}
                    onChange={(e) => setChatbot((p) => ({ ...p, model: e.target.value || p.model }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                  >
                    {chatbotModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {!chatbotModels.includes(chatbot.model) && chatbot.model && (
                      <option value={chatbot.model}>{chatbot.model}</option>
                    )}
                  </select>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="cb-fallback">Резервный system prompt (если нет активного шаблона)</Label>
              <textarea
                id="cb-fallback"
                value={chatbot.system_prompt ?? ''}
                onChange={(e) => setChatbot((p) => ({ ...p, system_prompt: e.target.value || null }))}
                rows={4}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm"
                placeholder="Ты консультант курса..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cb-temperature">Temperature (0–1)</Label>
                <Input
                  id="cb-temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={chatbot.temperature}
                  onChange={(e) => setChatbot((p) => ({ ...p, temperature: parseFloat(e.target.value) || 0.7 }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cb-max_tokens">Max tokens</Label>
                <Input
                  id="cb-max_tokens"
                  type="number"
                  value={chatbot.max_tokens}
                  onChange={(e) => setChatbot((p) => ({ ...p, max_tokens: parseInt(e.target.value, 10) || 2000 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <Button type="submit" disabled={savingChatbot}>
              {savingChatbot ? 'Сохранение…' : 'Сохранить чат-бот'}
            </Button>
          </form>
        </section>

        {/* Тьютор курсов */}
        <section className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <h3 className="text-base font-semibold text-[var(--portal-text)] mb-4">AI-тьютор в плеере курса (для студентов)</h3>
          <p className="text-sm text-[var(--portal-text-muted)] mb-4">
            Доступен после записи на курс в SCORM-плеере. Если ключ не задан — используется ключ чат-бота. Включение по курсам — в карточке курса («AI-тьютор в плеере»). Ниже — редактируемые инструкции (playbook); контент уроков подставляется из SCORM автоматически.{' '}
            <Link href="/portal/admin/help#ai-tutor-admin" className="font-medium text-[var(--portal-accent)] hover:underline">
              Справка: где смотреть беседы студентов
            </Link>
            .
          </p>
          <form onSubmit={saveTutor} className="space-y-4">
            <div>
              <Label>Использовать сохранённый ключ</Label>
              <select
                value={tutor.api_key_id ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  if (!id) {
                    setTutor((p) => ({ ...p, api_key_id: null }));
                    return;
                  }
                  const k = apiKeys.find((x) => x.id === id);
                  if (!k) {
                    setTutor((p) => ({ ...p, api_key_id: id }));
                    return;
                  }
                  const kp =
                    k.provider && PROVIDERS.some((pr) => pr.id === k.provider) ? k.provider : 'other';
                  setTutor((p) => {
                    const models = MODELS_BY_PROVIDER[kp] ?? [];
                    const nextModel =
                      models.length > 0 && !models.includes(p.model) ? models[0]! : p.model;
                    return { ...p, api_key_id: id, provider: kp, model: nextModel };
                  });
                }}
                className="mt-1 w-full max-w-md rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
              >
                <option value="">— Ключ чат-бота или свой ниже —</option>
                {apiKeys.map((k) => (
                  <option key={k.id} value={k.id}>{k.name} ({k.provider})</option>
                ))}
              </select>
            </div>
            {!tutor.api_key_id && (
              <div>
                <Label htmlFor="ct-api-key">Свой API-ключ (необязательно)</Label>
                <Input
                  id="ct-api-key"
                  type="password"
                  value={tutor.api_key}
                  onChange={(e) => setTutor((p) => ({ ...p, api_key: e.target.value }))}
                  placeholder={tutor.api_key_set ? '•••••• (пусто — ключ чат-бота)' : 'Оставьте пустым для ключа чат-бота'}
                  className="mt-1 max-w-md"
                  autoComplete="off"
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ct-provider">Провайдер</Label>
                <select
                  id="ct-provider"
                  value={tutor.provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setTutor((prev) => ({
                      ...prev,
                      provider: p,
                      model: (MODELS_BY_PROVIDER[p]?.[0] ?? prev.model),
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ct-model">Модель</Label>
                {tutor.provider === 'other' ? (
                  <Input
                    id="ct-model"
                    value={tutor.model}
                    onChange={(e) => setTutor((p) => ({ ...p, model: e.target.value }))}
                    placeholder="Например: deepseek-chat"
                    className="mt-1"
                  />
                ) : (
                  <select
                    id="ct-model"
                    value={tutorModels.includes(tutor.model) ? tutor.model : ''}
                    onChange={(e) => setTutor((p) => ({ ...p, model: e.target.value || p.model }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                  >
                    {tutorModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {!tutorModels.includes(tutor.model) && tutor.model && (
                      <option value={tutor.model}>{tutor.model}</option>
                    )}
                  </select>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="tutor-playbook">Инструкции тьютора (playbook, Markdown)</Label>
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                Если в блоке «Шаблоны промптов» выбран активный шаблон для «Тьютор в курсе», он подставляется вместо этого текста. Подстановки: {'{{PORTAL_URL}}'}, {'{{STUDENT_DASHBOARD_URL}}'}, {'{{PORTAL_COURSE_URL}}'}, {'{{PORTAL_COURSE_PLAY_URL}}'}, {'{{COURSE_URL}}'}, {'{{PRICING_URL}}'}, {'{{SUPPORT_EMAIL}}'}.
              </p>
              <textarea
                id="tutor-playbook"
                value={tutor.system_prompt ?? ''}
                onChange={(e) => setTutor((p) => ({ ...p, system_prompt: e.target.value || null }))}
                rows={12}
                className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm"
                placeholder="Роль наставника, правила эскалации к куратору…"
                spellCheck={false}
              />
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
                  value={tutor.temperature}
                  onChange={(e) => setTutor((p) => ({ ...p, temperature: parseFloat(e.target.value) || 0.5 }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ct-max_tokens">Max tokens</Label>
                <Input
                  id="ct-max_tokens"
                  type="number"
                  value={tutor.max_tokens}
                  onChange={(e) => setTutor((p) => ({ ...p, max_tokens: parseInt(e.target.value, 10) || 1500 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <Button type="submit" disabled={savingTutor}>
              {savingTutor ? 'Сохранение…' : 'Сохранить тьютор'}
            </Button>
          </form>
        </section>
      </div>

      <ConfirmDialog
        open={!!deleteKeyId}
        onOpenChange={(open) => !open && setDeleteKeyId(null)}
        title="Удалить ключ?"
        description="Настройки чат-бота и тьютора, использующие этот ключ, перестанут его использовать."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => { if (deleteKeyId) void removeApiKey(deleteKeyId); }}
      />
    </Card>
  );
}
