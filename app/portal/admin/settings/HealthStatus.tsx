'use client';

/**
 * Проверка доступности сервера (GET /api/health) для блока «О системе» в настройках.
 */
import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function HealthStatus() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      setStatus(r.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return (
    <div className="mt-2 flex items-center gap-2">
      <span
        className={`inline-block h-3 w-3 shrink-0 rounded-full ${
          status === 'ok' ? 'bg-green-500' : status === 'error' ? 'bg-red-400' : 'bg-gray-300'
        }`}
        aria-hidden
      />
      <span className="text-sm text-text-muted">
        {loading && 'Проверка…'}
        {!loading && status === 'idle' && 'Нажмите кнопку, чтобы проверить доступность сервера.'}
        {!loading && status === 'ok' && 'Сервер отвечает.'}
        {!loading && status === 'error' && 'Сервер не ответил или ошибка.'}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={check}
        disabled={loading}
        aria-label="Проверить доступность сервера"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
