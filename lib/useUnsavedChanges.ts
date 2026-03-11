'use client';

import { useEffect } from 'react';

/**
 * Предупреждение при закрытии вкладки или обновлении страницы, если есть несохранённые изменения.
 * Используйте в формах редактирования: передайте true, когда форма изменена и не сохранена.
 */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
