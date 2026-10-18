/** Заголовок Next-Action: мусорные значения от сканеров отсекаются до рендера (Next 16). */
import { describe, expect, it } from 'vitest';
import { isValidServerActionId } from '@/lib/next-action';

describe('isValidServerActionId', () => {
  it('отклоняет мусор сканеров: «x» и пустая строка', () => {
    expect(isValidServerActionId('x')).toBe(false);
    expect(isValidServerActionId('')).toBe(false);
  });

  it('отклоняет короткий hex и hex длиной не 42 символа', () => {
    expect(isValidServerActionId('a'.repeat(40))).toBe(false);
    expect(isValidServerActionId('a'.repeat(41))).toBe(false);
    expect(isValidServerActionId('a'.repeat(43))).toBe(false);
  });

  it('отклоняет не-hex нужной длины', () => {
    expect(isValidServerActionId('g'.repeat(42))).toBe(false);
    expect(isValidServerActionId(`${'a'.repeat(41)} `)).toBe(false);
    expect(isValidServerActionId(`${'a'.repeat(40)}<>`)).toBe(false);
  });

  it('пропускает валидный ID: 42 hex-символа', () => {
    const id = `7f${'0123456789abcdef'.repeat(2)}01234567`;
    expect(id).toHaveLength(42);
    expect(isValidServerActionId(id)).toBe(true);
    expect(isValidServerActionId(id.toUpperCase())).toBe(true);
  });
});
