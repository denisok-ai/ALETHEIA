import { describe, expect, it } from 'vitest';
import { auditAnswerAgainstCatalog } from '@/lib/ai/answer-audit';
import type { PublicProduct } from '@/lib/shop/public-products';

function product(name: string, price: number, courseTitle = name): PublicProduct {
  return {
    slug: name, name, price, cardDescription: '', fullDescription: '', features: [], imageUrl: null,
    courseId: 'c', courseTitle, courseDescription: null, installmentEnabled: false, maxInstallments: 3,
  } as unknown as PublicProduct;
}

const catalog = [
  product('Первый тест', 0, 'Первый тест: бесплатное знакомство с мышечным тестированием'),
  product('Тело знает всё — практикум', 5000),
  product('«Пробуждение» — групповой формат', 22000, 'Пробуждение'),
];

describe('auditAnswerAgainstCatalog: названия в падежах', () => {
  it('склонённое название тарифа из каталога — без тревоги (прод 13.10: «Пробуждения»)', () => {
    const answer = 'Если тариф «Пробуждения» кажется дорогим, начните с «Первого теста» — он бесплатный.';
    expect(auditAnswerAgainstCatalog(answer, catalog)).toEqual([]);
  });

  it('именительный падеж — без тревоги', () => {
    expect(auditAnswerAgainstCatalog('Тариф «Тело знает всё» стоит 5 000 ₽.', catalog)).toEqual([]);
  });

  it('несуществующий тариф по-прежнему ловится', () => {
    const f = auditAnswerAgainstCatalog('Возьмите тариф «Профи» — там есть куратор.', catalog);
    expect(f).toEqual([{ kind: 'unknown_tariff', value: 'Профи' }]);
  });

  it('снятый «Практик» ловится и в падеже', () => {
    const f = auditAnswerAgainstCatalog('В тарифе «Практике» были живые занятия.', catalog);
    expect(f.map((x) => x.kind)).toEqual(['unknown_tariff']);
  });

  it('неизвестная цена ловится', () => {
    const f = auditAnswerAgainstCatalog('Стоимость — 25 000 ₽.', catalog);
    expect(f).toEqual([{ kind: 'unknown_price', value: '25 000 ₽' }]);
  });
});
