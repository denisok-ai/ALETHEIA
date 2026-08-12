'use client';

/**
 * Информационный баннер о cookie — одна кнопка «Понятно».
 *
 * Раньше здесь был выбор «Только необходимые / Принять аналитику», и Метрика
 * грузилась лишь согласившимся — счётчик видел долю посетителей, статистика
 * получалась «кривой» (решение владельца от 24.07.2026 — барьер убрать).
 * Теперь баннер только информирует и даёт ссылку на политику; Метрика
 * подключается для всех в YandexMetrika.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';

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

  function acknowledge() {
    try {
      // То же значение, что раньше означало полное согласие: посетители со
      // старым 'essential' в localStorage баннер повторно не увидят, а новые
      // получают единый маркер «уведомлён».
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'analytics');
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
          Сайт использует cookie: необходимые для работы (сессия, безопасность) и аналитические — Яндекс.Метрика, Google
          Analytics и Microsoft Clarity — для улучшения сайта. Продолжая пользоваться сайтом, вы соглашаетесь с{' '}
          <Link href="/privacy" className="font-medium text-plum underline hover:opacity-90">
            Политикой обработки персональных данных
          </Link>
          .
        </p>
        <div className="flex shrink-0">
          <Button type="button" variant="landingPlum" size="sm" onClick={acknowledge} className="text-sm">
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
}
