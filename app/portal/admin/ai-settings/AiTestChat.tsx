'use client';

import { useState } from 'react';
import { ChatMarkdown } from '@/components/ChatMarkdown';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * Test chat: проверка ответов чат-бота с текущими настройками (key=chatbot).
 */
export function AiTestChat() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const text = message.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Ошибка запроса');
        return;
      }
      setReply(data.answer ?? 'Нет ответа');
      setMessage('');
    } catch (e) {
      setError('Сеть или сервер недоступен');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="test-msg" className="sr-only">Сообщение</Label>
          <input
            id="test-msg"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Введите вопрос..."
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
            disabled={loading}
          />
        </div>
        <Button onClick={handleSend} disabled={loading || !message.trim()}>
          {loading ? '…' : 'Отправить'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {reply && (
        <div className="rounded-lg bg-[#F8FAFC] p-3 text-sm text-[var(--portal-text)] leading-relaxed">
          <div className="chat-markdown [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-[var(--portal-accent)] [&_a]:underline [&_a:hover]:opacity-80 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold">
            <ChatMarkdown>{reply}</ChatMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
