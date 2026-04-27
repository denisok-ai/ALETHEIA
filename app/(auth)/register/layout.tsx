import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/register', 'Регистрация');
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
