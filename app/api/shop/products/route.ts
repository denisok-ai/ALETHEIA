/**
 * Public: list products (services linked to published courses) for the main page shop.
 */
import { NextResponse } from 'next/server';
import { getPublicProducts } from '@/lib/shop/public-products';

/** Не кешировать: иначе nginx proxy_cache / CDN / браузер держат старый список тарифов. */
export const dynamic = 'force-dynamic';

export async function GET() {
  const list = await getPublicProducts();
  const products = list.map((p) => ({
    slug: p.slug,
    id: p.slug,
    name: p.name,
    price: p.price,
    description: p.cardDescription,
    imageUrl: p.imageUrl,
    courseId: p.courseId,
    courseTitle: p.courseTitle,
    features: p.features,
    installmentEnabled: p.installmentEnabled,
    maxInstallments: p.maxInstallments,
  }));

  return NextResponse.json(
    { products },
    {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    }
  );
}
