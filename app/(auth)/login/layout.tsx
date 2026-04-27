import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/login', 'Вход');
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
