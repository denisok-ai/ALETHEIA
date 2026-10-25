import { describe, expect, it } from 'vitest';
import { isMinimalPublicShell, isPrivateToolPage } from '@/lib/public-shell-paths';

describe('страница согласования без оформления сайта и счётчиков', () => {
  it('isPrivateToolPage — только /soglasovanie и вложенные адреса', () => {
    expect(isPrivateToolPage('/soglasovanie/abc')).toBe(true);
    expect(isPrivateToolPage('/soglasovanie')).toBe(true);
    expect(isPrivateToolPage('/soglasovanie-x')).toBe(false);
    expect(isPrivateToolPage('/')).toBe(false);
    expect(isPrivateToolPage(null)).toBe(false);
  });

  it('страница согласования — минимальная оболочка (без шапки, подвала, чата)', () => {
    expect(isMinimalPublicShell('/soglasovanie/abc')).toBe(true);
    expect(isMinimalPublicShell('/login')).toBe(true);
    expect(isMinimalPublicShell('/blog')).toBe(false);
  });
});
