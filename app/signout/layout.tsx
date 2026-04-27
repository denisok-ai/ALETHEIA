import type { Metadata } from 'next';
import { transactionalPageMetadata } from '@/lib/transactional-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return transactionalPageMetadata('/signout', 'Выход');
}

export default function SignOutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
