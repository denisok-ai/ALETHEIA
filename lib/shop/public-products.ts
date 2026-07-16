/**
 * Публичная витрина: услуги (тарифы), привязанные к опубликованным курсам.
 * Единый источник данных для API /api/shop/products, SSR-блока «Тарифы»,
 * страниц /services, sitemap и llms.txt.
 */
import { prisma } from '@/lib/db';

export type PublicProduct = {
  slug: string;
  name: string;
  price: number;
  /** Первая строка description — краткий текст карточки */
  cardDescription: string;
  /** Полное описание услуги как в БД (для страницы товара) */
  fullDescription: string;
  features: string[];
  imageUrl: string | null;
  courseId: string | null;
  courseTitle: string;
  courseDescription: string | null;
  installmentEnabled: boolean;
  maxInstallments: number;
  updatedAt: Date;
};

/** Первая строка description — краткий текст карточки; строки с «•» или с новой строки — пункты списка. */
export function descriptionToCardAndFeatures(
  raw: string | null | undefined,
  courseDesc: string | null | undefined,
  name: string
): { cardDescription: string; features: string[] } {
  const lines = (raw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    const fallback = (courseDesc?.trim() || name).slice(0, 2000);
    const featuresFromCourse = courseDesc
      ? [courseDesc.slice(0, 100) + (courseDesc.length > 100 ? '…' : '')]
      : [name];
    return { cardDescription: fallback, features: featuresFromCourse };
  }
  const first = lines[0];
  const rest = lines.slice(1).map((l) => l.replace(/^[\s•\-*]+\s*/, '').trim()).filter(Boolean);
  const features =
    rest.length > 0
      ? rest
      : courseDesc
        ? [courseDesc.slice(0, 100) + (courseDesc.length > 100 ? '…' : '')]
        : [name];
  return { cardDescription: first.slice(0, 2000), features };
}

/** Активные услуги опубликованных курсов. При ошибке БД возвращает []. */
export async function getPublicProducts(): Promise<PublicProduct[]> {
  try {
    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        courseId: { not: null },
        course: { status: 'published' },
      },
      include: {
        course: {
          select: { id: true, title: true, description: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return services.map((s) => {
      const { cardDescription, features } = descriptionToCardAndFeatures(
        s.description,
        s.course?.description ?? null,
        s.name
      );
      return {
        slug: s.slug,
        name: s.name,
        price: s.price,
        cardDescription,
        fullDescription: (s.description ?? '').trim() || cardDescription,
        features,
        imageUrl: s.imageUrl ?? null,
        courseId: s.courseId,
        courseTitle: s.course?.title ?? s.name,
        courseDescription: s.course?.description ?? null,
        installmentEnabled: s.installmentEnabled,
        maxInstallments: s.maxInstallments,
        updatedAt: s.updatedAt,
      };
    });
  } catch {
    // БД недоступна (сборка/деградация) — публичные страницы не должны падать
    return [];
  }
}

/** Один активный товар по slug (для страницы /services/[slug]). */
export async function getPublicProductBySlug(slug: string): Promise<PublicProduct | null> {
  const products = await getPublicProducts();
  return products.find((p) => p.slug === slug) ?? null;
}
