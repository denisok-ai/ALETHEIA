'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookOpen, Headphones, X } from 'lucide-react';

const STORAGE_KEY = 'avaterra_student_onboarding_seen';

export function StudentOnboardingHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(STORAGE_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="portal-card flex flex-wrap items-start gap-4 p-4 border-[var(--portal-accent)]/30 bg-[var(--portal-accent-soft)]/50"
      aria-label="Подсказка по разделам личного кабинета"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--portal-text)]">Подсказка</p>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
          Ваши курсы и прогресс — в разделе <strong>«Мои курсы»</strong>. Вопросы и обращение в поддержку — в разделе <strong>«Поддержка»</strong>.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href="/portal/student/courses">
            <Button variant="secondary" size="sm">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Мои курсы
            </Button>
          </Link>
          <Link href="/portal/student/support">
            <Button variant="ghost" size="sm">
              <Headphones className="h-3.5 w-3.5 mr-1.5" />
              Поддержка
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Понятно
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8 text-[var(--portal-text-muted)] hover:text-[var(--portal-text)]"
        onClick={dismiss}
        aria-label="Закрыть подсказку"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
