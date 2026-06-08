'use client';

/**
 * Баннер выбора cookie: необходимые или аналитика (после выбора грузится Яндекс.Метрика).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_STORAGE_KEY, type CookieConsentValue } from '@/lib/cookie-consent';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      setVisible(!v);
    } catch {
      setVisible(true);
    }
  }, []);

  function persist(value: CookieConsentValue) {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Использование файлов cookie"
      className="fixed bottom-0 left-0 right-0 z-[200] border-t border-[var(--border)] bg-[var(--lavender-light)]/98 px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm md:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-relaxed text-[var(--text)]">
          Сайт использует необходимые cookie для работы (сессия, безопасность), а при вашем согласии — аналитические
          cookie (Яндекс.Метрика) для улучшения сайта. Иностранные счётчики (Google Analytics, Microsoft Clarity) на
          сайте не подключаются. Подробнее — в{' '}
          <Link href="/privacy" className="font-medium text-plum underline hover:opacity-90">
            Политике обработки персональных данных
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => persist('essential')} className="text-sm">
            Только необходимые
          </Button>
          <Button type="button" variant="landingPlum" size="sm" onClick={() => persist('analytics')} className="text-sm">
            Принять аналитику
          </Button>
        </div>
      </div>
    </div>
  );
}
