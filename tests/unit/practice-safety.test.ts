import { describe, it, expect } from 'vitest';
import { practiceSafetyPlainText, PRACTICE_SAFETY_RULES } from '@/lib/content/practice-safety';

describe('practice-safety', () => {
  const text = practiceSafetyPlainText();
  it('содержит экстренный номер и границу с медициной', () => {
    expect(text).toContain('112');
    expect(text).toContain('не заменяет врача');
    expect(PRACTICE_SAFETY_RULES.length).toBe(4);
  });
  it('без запрещённых слов школы', () => {
    expect(text).not.toMatch(/метод(?!ик)|калибровк|диагност/iu);
  });
});
