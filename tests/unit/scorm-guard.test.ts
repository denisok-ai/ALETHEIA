/** Серверный рубеж SCORM: 'completed' без CMI не даёт 100 % и сертификата (инцидент 09.2026). */
import { describe, expect, it } from 'vitest';
import { guardCompletionStatus, isLessonCompleted } from '@/lib/scorm/completion-guard';

describe('scorm completion guard', () => {
  it('completed/passed без CMI понижаются до incomplete', () => {
    expect(guardCompletionStatus('completed', {})).toEqual({ status: 'incomplete', downgraded: true });
    expect(guardCompletionStatus('passed', null)).toEqual({ status: 'incomplete', downgraded: true });
    expect(guardCompletionStatus('completed', undefined).downgraded).toBe(true);
  });

  it('completed с реальным CMI проходит как есть', () => {
    const cmi = { core: { lesson_status: 'completed', total_time: '00:12:30' }, suspend_data: 'x' };
    expect(guardCompletionStatus('completed', cmi)).toEqual({ status: 'completed', downgraded: false });
  });

  it('incomplete/browsed без CMI не трогаются', () => {
    expect(guardCompletionStatus('incomplete', {})).toEqual({ status: 'incomplete', downgraded: false });
    expect(guardCompletionStatus('browsed', {})).toEqual({ status: 'browsed', downgraded: false });
  });

  it('isLessonCompleted: только completed и passed', () => {
    expect(isLessonCompleted('completed')).toBe(true);
    expect(isLessonCompleted('passed')).toBe(true);
    expect(isLessonCompleted('incomplete')).toBe(false);
    expect(isLessonCompleted(null)).toBe(false);
  });
});
