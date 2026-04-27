/**
 * Админ: товары для блока «Купить курс» на главной (Service в БД).
 */
import type { Metadata } from 'next';
import { PageHeader } from '@/components/portal/PageHeader';
import { ServicesAdminBlock } from '../payments/ServicesAdminBlock';

export const metadata: Metadata = { title: 'Товары' };

export default function AdminShopPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Товары' },
        ]}
        title="Товары для продажи на главной"
        description="Услуги в блоке «Купить курс»: slug, цена, тариф PayKeeper, привязка к курсу."
      />
      <ServicesAdminBlock />
    </div>
  );
}
