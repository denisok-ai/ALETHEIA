import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/success', 'Оплата успешна');
}

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
